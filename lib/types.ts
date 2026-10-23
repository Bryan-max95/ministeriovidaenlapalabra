export type UserRole = 'SuperUsuario' | 'Administrador' | 'Registrador';

export type VisitAttendanceStatus = 'invited' | 'attended';

export type RmsModuleId =
  | 'dashboard'
  | 'visitantes'
  | 'registrar'
  | 'formularios'
  | 'qr'
  | 'reportes'
  | 'usuarios'
  | 'configuracion';

export const ALL_RMS_MODULES: {
  id: RmsModuleId;
  label: string;
  description: string;
}[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Tarjetas estadísticas, verificación rápida del día y gráficos de visitas.',
  },
  {
    id: 'visitantes',
    label: 'Invitados y Visitas',
    description: 'Directorio completo de personas invitadas, buscador, filtros y fichas de historial.',
  },
  {
    id: 'registrar',
    label: 'Registrar visita',
    description: 'Formulario interno para registrar amigos invitados o confirmar asistencia.',
  },
  {
    id: 'formularios',
    label: 'Enlaces para Miembros',
    description: 'Creación y administración de enlaces para que los miembros registren invitados.',
  },
  {
    id: 'qr',
    label: 'Códigos QR',
    description: 'Generación, descarga PNG e impresión de códigos QR de registro.',
  },
  {
    id: 'reportes',
    label: 'Reportes',
    description: 'Consultas por fechas y exportación a Excel, CSV e Informes PDF.',
  },
  {
    id: 'usuarios',
    label: 'Usuarios',
    description: 'Gestión de cuentas de acceso al panel administrativo.',
  },
  {
    id: 'configuracion',
    label: 'Configuración',
    description: 'Logotipo del ministerio, copias de seguridad y esquema SQL.',
  },
];

export interface Person {
  id: string;
  registrationNumber: number;
  fullName: string;
  phone: string;
  normalizedPhone: string;
  address: string;
  invitedByMember: string;
  createdAt: string;
}

export interface Visit {
  id: string;
  personId: string;
  visitDate: string;
  registeredAt: string;
  status: VisitAttendanceStatus;
  arrivedAt: string | null;
  invitedByMember: string;
  registeredByUserId: string | null;
  registeredByName: string;
  formId: string | null;
  source: 'public_form' | 'admin_panel';
}

export interface FormConfig {
  id: string;
  name: string;
  memberName: string;
  slug: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface UserAccount {
  id: string;
  username: string;
  fullName: string;
  passwordHash: string;
  role: UserRole;
  isActive: boolean;
  allowedModules?: RmsModuleId[];
  createdAt: string;
}

export interface SafeUserAccount {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  allowedModules: RmsModuleId[];
  isRoot?: boolean;
  createdAt: string;
}

export interface MinistrySettings {
  ministryName: string;
  subtitle: string;
  timezone: string;
  customLogoDataUrl: string | null;
  adminDateOverridePin: string;
  adminAllowedModules: RmsModuleId[];
  registradorAllowedModules: RmsModuleId[];
}

export interface PersonWithVisits extends Person {
  formattedCode: string;
  visits: Visit[];
  visitCount: number;
  attendedCount: number;
  pendingCount: number;
  latestStatus: VisitAttendanceStatus;
  latestVisitId: string;
  firstVisitDate: string;
  lastVisitDate: string;
}

export interface VisitWithPerson extends Visit {
  personName: string;
  personPhone: string;
  personAddress: string;
  personFormattedCode: string;
  visitNumberForPerson: number;
  totalVisitsForPerson: number;
  attendedVisitsForPerson: number;
}

export interface DashboardStats {
  totalPersons: number;
  visitsToday: number;
  arrivedToday: number;
  pendingToday: number;
  totalPendingAllDates: number;
  visitsThisWeek: number;
  visitsThisMonth: number;
  returningPersonsCount: number;
  totalVisitsAllTime: number;
  hondurasToday: string;
}

export interface DatabaseSchema {
  persons: Person[];
  visits: Visit[];
  forms: FormConfig[];
  users: UserAccount[];
  settings: MinistrySettings;
}
