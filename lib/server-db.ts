import crypto from 'crypto';
import 'server-only';
import { currentDatabase, stageDatabase } from './postgres-store';
import {
  ALL_RMS_MODULES,
  DatabaseSchema,
  DashboardStats,
  MinistrySettings,
  Person,
  PersonWithVisits,
  RmsModuleId,
  SafeUserAccount,
  UserAccount,
  Visit,
  VisitAttendanceStatus,
  VisitWithPerson,
} from './types';
import {
  formatPhoneDisplay,
  getHondurasDateString,
  getWeekBounds,
  normalizeName,
  normalizePhoneNumber,
} from './date-utils';

// Validate only when authentication needs the key. Next.js imports API modules
// while collecting build data, before any request is being authenticated.
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error('Configura SESSION_SECRET con al menos 32 caracteres en las variables privadas del servidor.');
  }
  return secret;
}

export function getRootCredentials(): { username: string; password: string } {
  return {
    username: (process.env.ROOT_SUPERUSER_USERNAME || 'bwp').trim(),
    password: (process.env.ROOT_SUPERUSER_PASSWORD || '').trim(),
  };
}

export function getRootSafeUser(): SafeUserAccount {
  const { username } = getRootCredentials();
  return {
    id: 'usr-root-bwp',
    username,
    fullName: 'Super Usuario Root (BWP)',
    role: 'SuperUsuario',
    isActive: true,
    isRoot: true,
    allowedModules: ALL_RMS_MODULES.map((m) => m.id),
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  return 'scrypt:' + salt + ':' + crypto.scryptSync(password, salt, 64).toString('hex');
}

function legacyHashPassword(password: string): string {
  return crypto
    .createHmac('sha256', process.env.LEGACY_PASSWORD_SECRET || getSessionSecret())
    .update(password)
    .digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  if (hash.startsWith('scrypt:')) {
    const [, salt, expected] = hash.split(':');
    if (!salt || !expected) return false;
    const actual = crypto.scryptSync(password, salt, 64);
    const stored = Buffer.from(expected, 'hex');
    return stored.length === actual.length && crypto.timingSafeEqual(stored, actual);
  }
  return legacyHashPassword(password) === hash;
}

export function createSessionToken(user: SafeUserAccount): string {
  const payload = {
    sub: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    isRoot: Boolean(user.isRoot),
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(base64Payload)
    .digest('base64url');
  return `${base64Payload}.${sig}`;
}

export function verifySessionToken(token?: string | null): SafeUserAccount | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [base64Payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(base64Payload)
    .digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;

    if (payload.sub === 'usr-root-bwp' || payload.isRoot) {
      return getRootSafeUser();
    }

    const db = loadDb();
    const dbUser = db.users.find((u) => u.id === payload.sub && u.isActive);
    if (!dbUser) return null;
    return toSafeUser(dbUser, db.settings);
  } catch {
    return null;
  }
}

export function toSafeUser(
  user: UserAccount,
  settings?: MinistrySettings
): SafeUserAccount {
  const currentSettings = settings || loadDb().settings;
  let effectiveModules: RmsModuleId[] = ALL_RMS_MODULES.map((m) => m.id);

  if (user.role === 'SuperUsuario') {
    effectiveModules = ALL_RMS_MODULES.map((m) => m.id);
  } else if (Array.isArray(user.allowedModules) && user.allowedModules.length > 0) {
    effectiveModules = user.allowedModules;
  } else if (user.role === 'Administrador') {
    effectiveModules =
      currentSettings.adminAllowedModules || ALL_RMS_MODULES.map((m) => m.id);
  } else {
    effectiveModules = currentSettings.registradorAllowedModules || [
      'dashboard',
      'visitantes',
      'registrar',
      'formularios',
      'qr',
    ];
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    allowedModules: effectiveModules,
    isRoot: false,
    createdAt: user.createdAt,
  };
}

export function formatRegistrationCode(num: number): string {
  return `MVP-${String(num).padStart(4, '0')}`;
}

export function createCleanDatabase(): DatabaseSchema {
  const defaultAdminModules: RmsModuleId[] = [
    'dashboard',
    'visitantes',
    'registrar',
    'formularios',
    'qr',
    'reportes',
    'usuarios',
    'configuracion',
  ];

  const defaultRegistradorModules: RmsModuleId[] = [
    'dashboard',
    'visitantes',
    'registrar',
    'formularios',
    'qr',
  ];

  const settings: MinistrySettings = {
    ministryName: 'MINISTERIO VIDA EN LA PALABRA',
    subtitle: 'Sistema de Registro de Invitados y Verificación de Visitas',
    timezone: 'America/Tegucigalpa',
    customLogoDataUrl: null,
    adminDateOverridePin: '2026',
    adminAllowedModules: defaultAdminModules,
    registradorAllowedModules: defaultRegistradorModules,
  };

  return {
    persons: [],
    visits: [],
    forms: [{
      id: 'frm-principal', name: 'Formulario general', memberName: '',
      slug: 'visitantes', description: 'Registro público de invitados',
      isActive: true, createdAt: new Date().toISOString(),
    }],
    users: [],
    settings,
  };
}

export function loadDb(): DatabaseSchema {
  return currentDatabase();
}

export function saveDb(db: DatabaseSchema): void {
  stageDatabase(db);
}

export function findExistingPerson(
  db: DatabaseSchema,
  fullName: string,
  phone: string
): Person | undefined {
  const normPhone = normalizePhoneNumber(phone);
  const normName = normalizeName(fullName);

  const byPhone = db.persons.find((p) => p.normalizedPhone === normPhone);
  if (byPhone) return byPhone;

  const byNameAndPhone = db.persons.find(
    (p) => normalizeName(p.fullName) === normName && p.normalizedPhone === normPhone
  );
  return byNameAndPhone;
}

export function registerVisitRecord(params: {
  personId?: string;
  fullName: string;
  phone: string;
  address?: string;
  visitDate: string;
  status?: VisitAttendanceStatus;
  invitedByMember?: string;
  formId?: string;
  source: 'public_form' | 'admin_panel';
  registeredByUser?: SafeUserAccount | null;
}): {
  person: PersonWithVisits;
  visit: Visit;
  isReturningVisitor: boolean;
  visitNumber: number;
} {
  const db = loadDb();
  const cleanName = params.fullName.trim().replace(/\s+/g, ' ');
  const formattedPhone = formatPhoneDisplay(params.phone);
  const normPhone = normalizePhoneNumber(params.phone);
  const cleanAddress = (params.address || '').trim().replace(/\s+/g, ' ');

  const matchedForm =
    db.forms.find((f) => f.id === params.formId || f.slug === params.formId) ||
    db.forms.find((f) => f.slug === 'visitantes');

  const effectiveInvitedBy =
    (params.invitedByMember || '').trim() ||
    matchedForm?.memberName ||
    (params.registeredByUser ? params.registeredByUser.fullName : 'Miembro de la Iglesia');

  let targetPerson: Person | undefined;

  if (params.personId) {
    targetPerson = db.persons.find((p) => p.id === params.personId);
  }

  if (!targetPerson) {
    targetPerson = findExistingPerson(db, cleanName, params.phone);
  }

  let isReturningVisitor = false;

  if (targetPerson) {
    isReturningVisitor = true;
    if (cleanAddress) {
      targetPerson.address = cleanAddress;
    }
    if ((params.invitedByMember || '').trim()) {
      targetPerson.invitedByMember = (params.invitedByMember || '').trim();
    }
  } else {
    const maxRegNum = db.persons.reduce(
      (max, p) => (p.registrationNumber > max ? p.registrationNumber : max),
      0
    );
    targetPerson = {
      id: `per-${crypto.randomUUID().slice(0, 8)}`,
      registrationNumber: maxRegNum + 1,
      fullName: cleanName,
      phone: formattedPhone,
      normalizedPhone: normPhone,
      address: cleanAddress,
      invitedByMember: effectiveInvitedBy,
      createdAt: new Date().toISOString(),
    };
    db.persons.push(targetPerson);
  }

  const effectiveStatus: VisitAttendanceStatus =
    params.status || (params.source === 'public_form' ? 'invited' : 'attended');

  const nowIso = new Date().toISOString();

  const newVisit: Visit = {
    id: `vis-${crypto.randomUUID().slice(0, 8)}`,
    personId: targetPerson.id,
    visitDate: params.visitDate,
    registeredAt: nowIso,
    status: effectiveStatus,
    arrivedAt: effectiveStatus === 'attended' ? nowIso : null,
    invitedByMember: effectiveInvitedBy,
    registeredByUserId: params.registeredByUser && !params.registeredByUser.isRoot ? params.registeredByUser.id : null,
    registeredByName: effectiveInvitedBy,
    formId: matchedForm?.id || null,
    source: params.source,
  };

  db.visits.push(newVisit);
  saveDb(db);

  const enrichedPerson = buildPersonWithVisits(targetPerson, db.visits);

  return {
    person: enrichedPerson,
    visit: newVisit,
    isReturningVisitor: enrichedPerson.visitCount > 1 || isReturningVisitor,
    visitNumber: enrichedPerson.visitCount,
  };
}

export function updateVisitArrivalStatus(params: {
  visitId: string;
  status: VisitAttendanceStatus;
  verifiedByUser?: SafeUserAccount | null;
}): Visit | null {
  const db = loadDb();
  const visit = db.visits.find((v) => v.id === params.visitId);
  if (!visit) return null;

  visit.status = params.status;
  visit.arrivedAt = params.status === 'attended' ? new Date().toISOString() : null;
  if (params.verifiedByUser) {
    visit.registeredByUserId = params.verifiedByUser.isRoot ? null : params.verifiedByUser.id;
  }

  saveDb(db);
  return visit;
}

export function buildPersonWithVisits(person: Person, allVisits: Visit[]): PersonWithVisits {
  const personVisits = allVisits
    .filter((v) => v.personId === person.id)
    .sort((a, b) => {
      if (a.visitDate !== b.visitDate) {
        return a.visitDate.localeCompare(b.visitDate);
      }
      return a.registeredAt.localeCompare(b.registeredAt);
    });

  const firstVisitDate =
    personVisits.length > 0 ? personVisits[0].visitDate : person.createdAt.split('T')[0];
  const lastVisitDate =
    personVisits.length > 0
      ? personVisits[personVisits.length - 1].visitDate
      : person.createdAt.split('T')[0];

  const attendedCount = personVisits.filter((v) => v.status === 'attended').length;
  const pendingCount = personVisits.filter((v) => v.status === 'invited').length;
  const latestVisit = personVisits[personVisits.length - 1];

  return {
    ...person,
    address: person.address || '',
    invitedByMember:
      person.invitedByMember || latestVisit?.invitedByMember || 'Miembro de la Iglesia',
    formattedCode: formatRegistrationCode(person.registrationNumber),
    visits: personVisits,
    visitCount: personVisits.length,
    attendedCount,
    pendingCount,
    latestStatus: latestVisit ? latestVisit.status : 'invited',
    latestVisitId: latestVisit ? latestVisit.id : '',
    firstVisitDate,
    lastVisitDate,
  };
}

export function getAllPersonsWithVisits(db: DatabaseSchema): PersonWithVisits[] {
  return db.persons
    .map((p) => buildPersonWithVisits(p, db.visits))
    .sort((a, b) => {
      if (b.lastVisitDate !== a.lastVisitDate) {
        return b.lastVisitDate.localeCompare(a.lastVisitDate);
      }
      return b.registrationNumber - a.registrationNumber;
    });
}

export function getAllVisitsWithPersons(db: DatabaseSchema): VisitWithPerson[] {
  const personMap = new Map<string, PersonWithVisits>();
  for (const p of db.persons) {
    personMap.set(p.id, buildPersonWithVisits(p, db.visits));
  }

  return db.visits
    .map((v) => {
      const person = personMap.get(v.personId);
      const visitIndex = person
        ? person.visits.findIndex((pv) => pv.id === v.id) + 1
        : 1;
      return {
        ...v,
        status: v.status || 'attended',
        invitedByMember:
          v.invitedByMember || person?.invitedByMember || v.registeredByName,
        personName: person ? person.fullName : 'Visitante',
        personPhone: person ? person.phone : '—',
        personAddress: person ? person.address || '—' : '—',
        personFormattedCode: person ? person.formattedCode : 'MVP-0000',
        visitNumberForPerson: visitIndex > 0 ? visitIndex : 1,
        totalVisitsForPerson: person ? person.visitCount : 1,
        attendedVisitsForPerson: person ? person.attendedCount : 1,
      };
    })
    .sort((a, b) => {
      if (b.visitDate !== a.visitDate) {
        return b.visitDate.localeCompare(a.visitDate);
      }
      return b.registeredAt.localeCompare(a.registeredAt);
    });
}

export function computeDashboardStats(db: DatabaseSchema): DashboardStats {
  const hnToday = getHondurasDateString();
  const { start: weekStart, end: weekEnd } = getWeekBounds(hnToday);
  const currentYearMonth = hnToday.slice(0, 7);

  const personsWithVisits = getAllPersonsWithVisits(db);

  const todayVisits = db.visits.filter((v) => v.visitDate === hnToday);
  const visitsToday = todayVisits.length;
  const arrivedToday = todayVisits.filter((v) => v.status === 'attended').length;
  const pendingToday = todayVisits.filter((v) => v.status === 'invited').length;
  const totalPendingAllDates = db.visits.filter((v) => v.status === 'invited').length;

  const visitsThisWeek = db.visits.filter(
    (v) => v.visitDate >= weekStart && v.visitDate <= weekEnd
  ).length;
  const visitsThisMonth = db.visits.filter((v) =>
    v.visitDate.startsWith(currentYearMonth)
  ).length;
  const returningPersonsCount = personsWithVisits.filter((p) => p.visitCount > 1).length;

  return {
    totalPersons: db.persons.length,
    visitsToday,
    arrivedToday,
    pendingToday,
    totalPendingAllDates,
    visitsThisWeek,
    visitsThisMonth,
    returningPersonsCount,
    totalVisitsAllTime: db.visits.length,
    hondurasToday: hnToday,
  };
}
