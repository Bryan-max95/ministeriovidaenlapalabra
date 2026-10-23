'use client';
import { publicFormUrl } from '@/lib/site-url';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  BarChart3,
  Check,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  History,
  KeyRound,
  Link2,
  LogOut,
  Menu,
  Phone,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
  AlertCircle,
  CheckCircle2,
  Eye,
  Database,
  Clock,
  Sliders,
} from 'lucide-react';
import { MinistryLogo } from './MinistryLogo';
import {
  ALL_RMS_MODULES,
  DashboardStats,
  FormConfig,
  MinistrySettings,
  PersonWithVisits,
  RmsModuleId,
  SafeUserAccount,
  UserRole,
  VisitAttendanceStatus,
  VisitWithPerson,
} from '@/lib/types';
import {
  formatDateSpanishLong,
  formatDateSpanishShort,
  formatDateTimeHonduras,
  getHondurasDateString,
  getOrdinalVisitLabel,
  getWeekBounds,
  normalizeName,
  normalizePhoneNumber,
} from '@/lib/date-utils';
import {
  exportPersonHistoryToPDF,
  exportVisitsToCSV,
  exportVisitsToExcel,
  exportVisitsToPDF,
} from '@/lib/export-utils';
import { POSTGRESQL_SCHEMA_DDL } from '@/lib/schema-sql';

export type RmsTab = RmsModuleId | 'permisos_root';

interface RmsPanelProps {
  onSwitchToPublicForm: (slug?: string) => void;
}

export function RmsPanel({ onSwitchToPublicForm }: RmsPanelProps) {
  // Auth state (clean, no pre-filled demo credentials)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<SafeUserAccount | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSubmitting, setLoginSubmitting] = useState<boolean>(false);

  // Navigation state (Top bar menu)
  const [activeTab, setActiveTab] = useState<RmsTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Data state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [persons, setPersons] = useState<PersonWithVisits[]>([]);
  const [visits, setVisits] = useState<VisitWithPerson[]>([]);
  const [forms, setForms] = useState<FormConfig[]>([]);
  const [users, setUsers] = useState<SafeUserAccount[]>([]);
  const [settings, setSettings] = useState<MinistrySettings | null>(null);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // SuperUsuario BWP Module Permissions state
  const [adminModsDraft, setAdminModsDraft] = useState<RmsModuleId[]>(
    ALL_RMS_MODULES.map((m) => m.id)
  );
  const [regModsDraft, setRegModsDraft] = useState<RmsModuleId[]>([
    'dashboard',
    'visitantes',
    'registrar',
    'formularios',
    'qr',
  ]);
  const [savingPermissions, setSavingPermissions] = useState<boolean>(false);

  // Dashboard chart period state
  const [chartMode, setChartMode] = useState<'day' | 'week' | 'month'>('day');

  // Visitantes module filters
  const [visitorSearch, setVisitorSearch] = useState<string>('');
  const [visitorDateMode, setVisitorDateMode] = useState<
    'all' | 'pending' | 'attended' | 'day' | 'week' | 'month' | 'returning'
  >('all');
  const [visitorFilterDay, setVisitorFilterDay] = useState<string>(() =>
    getHondurasDateString()
  );
  const [visitorFilterMonth, setVisitorFilterMonth] = useState<string>(() =>
    getHondurasDateString().slice(0, 7)
  );

  // Selected person modal
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [personModalTab, setPersonModalTab] = useState<'history' | 'add_visit' | 'edit'>(
    'history'
  );
  const [modalNewVisitDate, setModalNewVisitDate] = useState<string>(() =>
    getHondurasDateString()
  );
  const [modalNewVisitStatus, setModalNewVisitStatus] =
    useState<VisitAttendanceStatus>('invited');
  const [modalInvitedByMember, setModalInvitedByMember] = useState<string>('');
  const [editPersonName, setEditPersonName] = useState<string>('');
  const [editPersonPhone, setEditPersonPhone] = useState<string>('');
  const [editPersonAddress, setEditPersonAddress] = useState<string>('');
  const [editPersonInvitedBy, setEditPersonInvitedBy] = useState<string>('');
  const [modalBusy, setModalBusy] = useState<boolean>(false);

  // Registrar visita / invitado module state
  const [manualSearchQuery, setManualSearchQuery] = useState<string>('');
  const [manualFullName, setManualFullName] = useState<string>('');
  const [manualPhone, setManualPhone] = useState<string>('');
  const [manualAddress, setManualAddress] = useState<string>('');
  const [manualVisitDate, setManualVisitDate] = useState<string>(() =>
    getHondurasDateString()
  );
  const [manualStatus, setManualStatus] =
    useState<VisitAttendanceStatus>('invited');
  const [manualInvitedBy, setManualInvitedBy] = useState<string>('');
  const [manualSelectedPersonId, setManualSelectedPersonId] = useState<string | null>(
    null
  );
  const [manualSubmitting, setManualSubmitting] = useState<boolean>(false);

  // Enlaces para Miembros y QR state
  const [selectedFormIdForQr, setSelectedFormIdForQr] = useState<string>('');
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newFormName, setNewFormName] = useState<string>('');
  const [newFormSlug, setNewFormSlug] = useState<string>('');
  const [newFormDesc, setNewFormDesc] = useState<string>('');

  // Reportes state
  const [reportFilterType, setReportFilterType] = useState<
    | 'all'
    | 'pending'
    | 'attended'
    | 'specific_date'
    | 'week'
    | 'month'
    | 'custom_range'
    | 'returning'
    | 'person'
  >('all');
  const [reportDate, setReportDate] = useState<string>(() => getHondurasDateString());
  const [reportMonth, setReportMonth] = useState<string>(() =>
    getHondurasDateString().slice(0, 7)
  );
  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    const hn = getHondurasDateString();
    return `${hn.slice(0, 8)}01`;
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() =>
    getHondurasDateString()
  );
  const [reportPersonId, setReportPersonId] = useState<string>('');

  // Usuarios module state
  const [newUsername, setNewUsername] = useState<string>('');
  const [newUserFullName, setNewUserFullName] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Administrador');
  const [newUserModules, setNewUserModules] = useState<RmsModuleId[]>(
    ALL_RMS_MODULES.map((m) => m.id)
  );
  const [editingUserPermissionsId, setEditingUserPermissionsId] = useState<
    string | null
  >(null);
  const [editingUserModulesDraft, setEditingUserModulesDraft] = useState<
    RmsModuleId[]
  >([]);

  // Configuración state
  const [pinInput, setPinInput] = useState<string>('2026');

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  }, []);

  const fetchOverview = useCallback(
    async (tokenOverride?: string | null) => {
      setDataLoading(true);
      try {
        const headers: Record<string, string> = {};
        const effectiveToken = tokenOverride ?? authToken;
        if (effectiveToken) {
          headers['Authorization'] = `Bearer ${effectiveToken}`;
        }
        const res = await fetch('/api/rms/overview', { headers });
        if (res.status === 401) {
          setCurrentUser(null);
          setAuthLoading(false);
          setDataLoading(false);
          return;
        }
        if (!res.ok) {
          setAuthLoading(false);
          setDataLoading(false);
          return;
        }
        const data = await res.json();
        setCurrentUser(data.currentUser);
        setStats(data.stats);
        setPersons(data.persons || []);
        setVisits(data.visits || []);
        setForms(data.forms || []);
        setUsers(data.users || []);
        setSettings(data.settings || null);

        if (data.settings?.adminDateOverridePin) {
          setPinInput(data.settings.adminDateOverridePin);
        }
        if (Array.isArray(data.settings?.adminAllowedModules)) {
          setAdminModsDraft(data.settings.adminAllowedModules);
        }
        if (Array.isArray(data.settings?.registradorAllowedModules)) {
          setRegModsDraft(data.settings.registradorAllowedModules);
        }
        if (data.stats?.hondurasToday) {
          setManualVisitDate(data.stats.hondurasToday);
          setModalNewVisitDate(data.stats.hondurasToday);
        }
        setAuthLoading(false);
      } catch {
        setAuthLoading(false);
      } finally {
        setDataLoading(false);
      }
    },
    [authToken]
  );

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Ensure activeTab is allowed for the current user
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'SuperUsuario') return;
    const allowed = currentUser.allowedModules || [];
    if (
      allowed.length > 0 &&
      activeTab !== 'permisos_root' &&
      !allowed.includes(activeTab as RmsModuleId)
    ) {
      setActiveTab(allowed[0]);
    }
  }, [currentUser, activeTab]);

  const selectedFormObj = useMemo(() => {
    return forms.find((f) => f.id === selectedFormIdForQr) || forms[0] || null;
  }, [forms, selectedFormIdForQr]);

  const buildPublicUrlForForm = useCallback((slug: string) => {
    return publicFormUrl(slug);
  }, []);

  const handleGenerateLink = useCallback(
    (slug?: string) => {
      const targetSlug = slug || selectedFormObj?.slug || 'visitantes';
      const url = buildPublicUrlForForm(targetSlug);
      setGeneratedLink(url);
      return url;
    },
    [buildPublicUrlForForm, selectedFormObj]
  );

  const handleGenerateQrCode = useCallback(
    async (slug?: string) => {
      const url = handleGenerateLink(slug);
      try {
        const dataUrl = await QRCode.toDataURL(url, {
          width: 480,
          margin: 2,
          color: {
            dark: '#0B1D3A',
            light: '#FFFFFF',
          },
        });
        setQrDataUrl(dataUrl);
      } catch (err) {
        console.error('Error generating QR:', err);
      }
    },
    [handleGenerateLink]
  );

  useEffect(() => {
    if (selectedFormObj) {
      handleGenerateQrCode(selectedFormObj.slug);
    } else {
      handleGenerateQrCode('visitantes');
    }
  }, [selectedFormObj, handleGenerateQrCode]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Credenciales inválidas.');
        setLoginSubmitting(false);
        return;
      }
      setAuthToken(data.token);
      setCurrentUser(data.user);
      await fetchOverview(data.token);
      setLoginSubmitting(false);
    } catch {
      setLoginError('Error de conexión al iniciar sesión.');
      setLoginSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAuthToken(null);
    setCurrentUser(null);
    setLoginUsername('');
    setLoginPassword('');
  };

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) h['Authorization'] = `Bearer ${authToken}`;
    return h;
  }, [authToken]);

  // Save global module permissions from SuperUsuario BWP
  const handleSaveRolePermissions = async () => {
    if (adminModsDraft.length === 0) {
      showToast(
        'error',
        'Debes seleccionar al menos un módulo para los Administradores.'
      );
      return;
    }
    setSavingPermissions(true);
    try {
      const res = await fetch('/api/rms/settings', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          adminAllowedModules: adminModsDraft,
          registradorAllowedModules: regModsDraft,
          applyToExistingAdmins: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'No se pudieron guardar los permisos.');
        setSavingPermissions(false);
        return;
      }
      await fetchOverview();
      showToast(
        'success',
        'Permisos de módulos actualizados correctamente para los Administradores.'
      );
      setSavingPermissions(false);
    } catch {
      showToast('error', 'Error al guardar permisos de módulos.');
      setSavingPermissions(false);
    }
  };

  const handleSaveIndividualUserModules = async (userId: string) => {
    if (editingUserModulesDraft.length === 0) {
      showToast('error', 'Selecciona al menos un módulo para este usuario.');
      return;
    }
    try {
      const res = await fetch('/api/rms/users', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          id: userId,
          allowedModules: editingUserModulesDraft,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        showToast('error', err.error || 'Error al actualizar módulos del usuario.');
        return;
      }
      await fetchOverview();
      setEditingUserPermissionsId(null);
      showToast('success', 'Módulos del administrador actualizados correctamente.');
    } catch {
      showToast('error', 'Error al guardar módulos del usuario.');
    }
  };

  const handleToggleVisitArrival = async (
    visitId: string,
    newStatus: VisitAttendanceStatus,
    personName?: string
  ) => {
    try {
      const res = await fetch('/api/rms/visits', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          visitId,
          status: newStatus,
        }),
      });
      if (!res.ok) {
        showToast('error', 'No se pudo actualizar la verificación de llegada.');
        return;
      }
      await fetchOverview();
      if (newStatus === 'attended') {
        showToast(
          'success',
          `¡Llegada confirmada! Se marcó que ${personName || 'el invitado'} asistió a la invitación.`
        );
      } else {
        showToast(
          'success',
          `Se cambió el estado de ${personName || 'el invitado'} a Pendiente de llegar.`
        );
      }
    } catch {
      showToast('error', 'Error de conexión al actualizar estado.');
    }
  };

  const selectedPerson = useMemo(() => {
    if (!selectedPersonId) return null;
    return persons.find((p) => p.id === selectedPersonId) || null;
  }, [persons, selectedPersonId]);

  const openPersonModal = (
    person: PersonWithVisits,
    initialTab: 'history' | 'add_visit' | 'edit' = 'history'
  ) => {
    setSelectedPersonId(person.id);
    setPersonModalTab(initialTab);
    setEditPersonName(person.fullName);
    setEditPersonPhone(person.phone);
    setEditPersonAddress(person.address || '');
    setEditPersonInvitedBy(person.invitedByMember || '');
    setModalInvitedByMember(person.invitedByMember || '');
    setModalNewVisitDate(stats?.hondurasToday || getHondurasDateString());
    setModalNewVisitStatus('invited');
  };

  const filteredPersons = useMemo(() => {
    const q = normalizeName(visitorSearch);
    const qDigits = visitorSearch.replace(/\D/g, '');
    const hnToday = stats?.hondurasToday || getHondurasDateString();
    const weekBounds = getWeekBounds(visitorFilterDay || hnToday);

    return persons.filter((p) => {
      if (q || qDigits) {
        const matchName = normalizeName(p.fullName).includes(q);
        const matchMember = normalizeName(p.invitedByMember || '').includes(q);
        const matchAddress = normalizeName(p.address || '').includes(q);
        const matchCode = p.formattedCode.toLowerCase().includes(q);
        const matchPhone = qDigits
          ? p.normalizedPhone.includes(qDigits) || p.phone.includes(visitorSearch.trim())
          : false;
        if (!matchName && !matchMember && !matchAddress && !matchCode && !matchPhone)
          return false;
      }

      if (visitorDateMode === 'pending') {
        return p.pendingCount > 0;
      }
      if (visitorDateMode === 'attended') {
        return p.attendedCount > 0;
      }
      if (visitorDateMode === 'returning') {
        return p.visitCount > 1;
      }
      if (visitorDateMode === 'day') {
        return p.visits.some((v) => v.visitDate === visitorFilterDay);
      }
      if (visitorDateMode === 'week') {
        return p.visits.some(
          (v) => v.visitDate >= weekBounds.start && v.visitDate <= weekBounds.end
        );
      }
      if (visitorDateMode === 'month') {
        return p.visits.some((v) => v.visitDate.startsWith(visitorFilterMonth));
      }
      return true;
    });
  }, [
    persons,
    visitorSearch,
    visitorDateMode,
    visitorFilterDay,
    visitorFilterMonth,
    stats,
  ]);

  const matchingExistingPersons = useMemo(() => {
    const searchVal = (manualSearchQuery || manualFullName || manualPhone).trim();
    if (!searchVal || searchVal.length < 2) return [];

    const normQ = normalizeName(manualSearchQuery || manualFullName);
    const normPhoneQ = normalizePhoneNumber(manualSearchQuery || manualPhone);

    return persons
      .filter((p) => {
        const nameMatch = normQ.length >= 2 && normalizeName(p.fullName).includes(normQ);
        const phoneMatch =
          normPhoneQ.length >= 3 && p.normalizedPhone.includes(normPhoneQ);
        const codeMatch = p.formattedCode
          .toLowerCase()
          .includes(searchVal.toLowerCase());
        return nameMatch || phoneMatch || codeMatch;
      })
      .slice(0, 6);
  }, [persons, manualSearchQuery, manualFullName, manualPhone]);

  const handleManualVisitSubmit = async (
    e: React.FormEvent,
    explicitPersonId?: string,
    explicitStatus?: VisitAttendanceStatus
  ) => {
    e.preventDefault();
    setManualSubmitting(true);
    try {
      const targetId = explicitPersonId || manualSelectedPersonId || undefined;
      const effectiveStatus = explicitStatus || manualStatus;
      const res = await fetch('/api/rms/visits', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          personId: targetId,
          fullName: manualFullName.trim(),
          phone: manualPhone.trim(),
          address: manualAddress.trim(),
          visitDate: manualVisitDate,
          status: effectiveStatus,
          invitedByMember: manualInvitedBy.trim() || undefined,
          formId: forms[0]?.id || 'frm-general',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'No se pudo guardar el registro.');
        setManualSubmitting(false);
        return;
      }

      await fetchOverview();
      setManualFullName('');
      setManualPhone('');
      setManualAddress('');
      setManualInvitedBy('');
      setManualSearchQuery('');
      setManualSelectedPersonId(null);

      const visitOrdinal = getOrdinalVisitLabel(data.visitNumber || 1);
      showToast(
        'success',
        effectiveStatus === 'invited'
          ? `Invitación registrada para ${data.person.fullName} (${visitOrdinal} · ${formatDateSpanishShort(data.visit.visitDate)}). Pendiente de verificar llegada.`
          : `Llegada registrada y confirmada para ${data.person.fullName} (${visitOrdinal}).`
      );
      setManualSubmitting(false);
    } catch {
      showToast('error', 'Error de conexión al guardar el registro.');
      setManualSubmitting(false);
    }
  };

  const handleAddVisitInModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) return;
    setModalBusy(true);
    try {
      const res = await fetch('/api/rms/visits', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          personId: selectedPerson.id,
          visitDate: modalNewVisitDate,
          status: modalNewVisitStatus,
          invitedByMember: modalInvitedByMember.trim() || selectedPerson.invitedByMember,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'No se pudo añadir el registro.');
        setModalBusy(false);
        return;
      }
      await fetchOverview();
      setPersonModalTab('history');
      showToast(
        'success',
        `Nuevo registro añadido al historial de ${selectedPerson.fullName}.`
      );
      setModalBusy(false);
    } catch {
      showToast('error', 'Error al guardar el registro.');
      setModalBusy(false);
    }
  };

  const handleUpdatePersonInModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPerson) return;
    setModalBusy(true);
    try {
      const res = await fetch('/api/rms/persons', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          id: selectedPerson.id,
          fullName: editPersonName,
          phone: editPersonPhone,
          address: editPersonAddress,
          invitedByMember: editPersonInvitedBy,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Error al actualizar datos.');
        setModalBusy(false);
        return;
      }
      await fetchOverview();
      setPersonModalTab('history');
      showToast('success', 'Datos personales actualizados correctamente.');
      setModalBusy(false);
    } catch {
      showToast('error', 'Error al actualizar la ficha.');
      setModalBusy(false);
    }
  };

  const handleDeleteVisit = async (visitId: string) => {
    try {
      const res = await fetch(`/api/rms/visits?visitId=${encodeURIComponent(visitId)}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        await fetchOverview();
        showToast('success', 'Registro eliminado.');
      }
    } catch {
      showToast('error', 'No se pudo eliminar el registro.');
    }
  };

  const chartData = useMemo(() => {
    const hnToday = stats?.hondurasToday || getHondurasDateString();
    const [y, m, d] = hnToday.split('-').map(Number);
    const baseDate = new Date(Date.UTC(y, m - 1, d));

    if (chartMode === 'day') {
      const points: { label: string; sub: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const dt = new Date(baseDate);
        dt.setUTCDate(baseDate.getUTCDate() - i);
        const dateStr = dt.toISOString().split('T')[0];
        const count = visits.filter((v) => v.visitDate === dateStr).length;
        points.push({
          label: formatDateSpanishShort(dateStr).slice(0, 6),
          sub: dateStr,
          count,
        });
      }
      return points;
    }

    if (chartMode === 'week') {
      const points: { label: string; sub: string; count: number }[] = [];
      for (let w = 3; w >= 0; w--) {
        const dt = new Date(baseDate);
        dt.setUTCDate(baseDate.getUTCDate() - w * 7);
        const dateStr = dt.toISOString().split('T')[0];
        const bounds = getWeekBounds(dateStr);
        const count = visits.filter(
          (v) => v.visitDate >= bounds.start && v.visitDate <= bounds.end
        ).length;
        points.push({
          label: `Sem. ${formatDateSpanishShort(bounds.start).slice(0, 6)}`,
          sub: `${bounds.start} a ${bounds.end}`,
          count,
        });
      }
      return points;
    }

    const points: { label: string; sub: string; count: number }[] = [];
    const monthNames = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    for (let i = 5; i >= 0; i--) {
      const dt = new Date(Date.UTC(y, m - 1 - i, 1));
      const ym = dt.toISOString().slice(0, 7);
      const count = visits.filter((v) => v.visitDate.startsWith(ym)).length;
      points.push({
        label: `${monthNames[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`,
        sub: ym,
        count,
      });
    }
    return points;
  }, [visits, chartMode, stats]);

  const maxChartVal = useMemo(() => {
    return Math.max(...chartData.map((d) => d.count), 1);
  }, [chartData]);

  const filteredReportVisits = useMemo(() => {
    const hnToday = stats?.hondurasToday || getHondurasDateString();
    const weekBounds = getWeekBounds(reportDate || hnToday);

    return visits.filter((v) => {
      if (reportFilterType === 'pending') {
        return v.status === 'invited';
      }
      if (reportFilterType === 'attended') {
        return v.status === 'attended';
      }
      if (reportFilterType === 'specific_date') {
        return v.visitDate === reportDate;
      }
      if (reportFilterType === 'week') {
        return v.visitDate >= weekBounds.start && v.visitDate <= weekBounds.end;
      }
      if (reportFilterType === 'month') {
        return v.visitDate.startsWith(reportMonth);
      }
      if (reportFilterType === 'custom_range') {
        return v.visitDate >= reportStartDate && v.visitDate <= reportEndDate;
      }
      if (reportFilterType === 'returning') {
        return v.totalVisitsForPerson > 1;
      }
      if (reportFilterType === 'person') {
        return reportPersonId ? v.personId === reportPersonId : true;
      }
      return true;
    });
  }, [
    visits,
    reportFilterType,
    reportDate,
    reportMonth,
    reportStartDate,
    reportEndDate,
    reportPersonId,
    stats,
  ]);

  const reportSummary = useMemo(() => {
    const uniquePersonIds = new Set(filteredReportVisits.map((v) => v.personId));
    const returningIds = new Set(
      filteredReportVisits
        .filter((v) => v.totalVisitsForPerson > 1)
        .map((v) => v.personId)
    );

    let periodLabel = 'Todos los registros históricos';
    if (reportFilterType === 'pending') {
      periodLabel = 'Invitados pendientes por verificar llegada';
    } else if (reportFilterType === 'attended') {
      periodLabel = 'Invitados con llegada confirmada';
    } else if (reportFilterType === 'specific_date') {
      periodLabel = `Fecha: ${formatDateSpanishLong(reportDate)}`;
    } else if (reportFilterType === 'week') {
      const wb = getWeekBounds(reportDate);
      periodLabel = `Semana del ${wb.start} al ${wb.end}`;
    } else if (reportFilterType === 'month') {
      periodLabel = `Mes: ${reportMonth}`;
    } else if (reportFilterType === 'custom_range') {
      periodLabel = `Desde ${reportStartDate} hasta ${reportEndDate}`;
    } else if (reportFilterType === 'returning') {
      periodLabel = 'Personas que han visitado más de una vez';
    } else if (reportFilterType === 'person') {
      const p = persons.find((per) => per.id === reportPersonId);
      periodLabel = p ? `Historial de ${p.fullName} (${p.formattedCode})` : 'Por persona';
    }

    return {
      title: 'Reporte Oficial de Invitados y Verificación de Visitas',
      periodLabel,
      totalVisits: filteredReportVisits.length,
      uniquePersons: uniquePersonIds.size,
      returningPersons: returningIds.size,
    };
  }, [
    filteredReportVisits,
    reportFilterType,
    reportDate,
    reportMonth,
    reportStartDate,
    reportEndDate,
    reportPersonId,
    persons,
  ]);

  const handleCreateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    try {
      const res = await fetch('/api/rms/forms', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          memberName: newMemberName.trim(),
          name:
            newFormName.trim() ||
            `Enlace de Invitación — ${newMemberName.trim()}`,
          slug: newFormSlug.trim() || `invita-${newMemberName.trim()}`,
          description: newFormDesc.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Error al crear enlace para miembro.');
        return;
      }
      await fetchOverview();
      setSelectedFormIdForQr(data.form.id);
      setNewMemberName('');
      setNewFormName('');
      setNewFormSlug('');
      setNewFormDesc('');
      showToast(
        'success',
        `Enlace creado para ${data.form.memberName}. Ya puedes compartirlo o generar su QR.`
      );
    } catch {
      showToast('error', 'Error al guardar el enlace.');
    }
  };

  const handleToggleFormActive = async (form: FormConfig) => {
    try {
      const res = await fetch('/api/rms/forms', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          id: form.id,
          isActive: !form.isActive,
        }),
      });
      if (res.ok) {
        await fetchOverview();
        showToast(
          'success',
          `Enlace "${form.name}" ${!form.isActive ? 'activado' : 'desactivado'}.`
        );
      }
    } catch {
      showToast('error', 'No se pudo cambiar el estado del enlace.');
    }
  };

  const handlePrintQrPoster = () => {
    window.print();
  };

  const handleDownloadQrPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR_MINISTERIO_VIDA_EN_LA_PALABRA_${selectedFormObj?.slug || 'visitantes'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyLink = async (linkToCopy?: string) => {
    const target = linkToCopy || generatedLink || handleGenerateLink();
    try {
      await navigator.clipboard.writeText(target);
      setCopiedLink(true);
      showToast('success', 'Enlace copiado al portapapeles.');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast('error', 'No se pudo copiar automáticamente.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/rms/users', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          username: newUsername,
          fullName: newUserFullName,
          password: newUserPassword,
          role: newUserRole,
          allowedModules: newUserModules,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'No se pudo crear el usuario.');
        return;
      }
      await fetchOverview();
      setNewUsername('');
      setNewUserFullName('');
      setNewUserPassword('');
      showToast('success', `Usuario @${data.user.username} creado correctamente.`);
    } catch {
      showToast('error', 'Error al crear el usuario.');
    }
  };

  const handleToggleUserActive = async (u: SafeUserAccount) => {
    try {
      const res = await fetch('/api/rms/users', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          id: u.id,
          isActive: !u.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'No se pudo actualizar el usuario.');
        return;
      }
      await fetchOverview();
      showToast('success', `Estado de @${u.username} actualizado.`);
    } catch {
      showToast('error', 'Error al actualizar el usuario.');
    }
  };

  const handleDeleteUser = async (u: SafeUserAccount) => {
    try {
      const res = await fetch(`/api/rms/users?id=${encodeURIComponent(u.id)}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        await fetchOverview();
        showToast('success', `Usuario @${u.username} eliminado.`);
      }
    } catch {
      showToast('error', 'No se pudo eliminar el usuario.');
    }
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('error', 'La imagen no debe superar los 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const res = await fetch('/api/rms/settings', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ customLogoDataUrl: dataUrl }),
      });
      if (res.ok) {
        await fetchOverview();
        showToast('success', 'Logotipo oficial actualizado en todo el sistema.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePinSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/rms/settings', {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ adminDateOverridePin: pinInput }),
    });
    if (res.ok) {
      await fetchOverview();
      showToast('success', 'PIN de autorización actualizado correctamente.');
    } else {
      showToast('error', 'El PIN debe tener al menos 4 caracteres.');
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/rms/settings', { headers: authHeaders });
      if (!res.ok) {
        showToast('error', 'No autorizado para exportar respaldos.');
        return;
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo_rms_mvp_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('success', 'Copia de seguridad descargada correctamente.');
    } catch {
      showToast('error', 'Error al descargar copia de seguridad.');
    }
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const res = await fetch('/api/rms/settings', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(parsed),
        });
        if (res.ok) {
          await fetchOverview();
          showToast('success', 'Copia de seguridad restaurada exitosamente.');
        } else {
          const err = await res.json();
          showToast('error', err.error || 'Archivo de respaldo inválido.');
        }
      } catch {
        showToast('error', 'El archivo seleccionado no es un JSON válido.');
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSqlSchema = () => {
    const blob = new Blob([POSTGRESQL_SCHEMA_DDL], {
      type: 'text/plain;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ministerio_vida_en_la_palabra_schema.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <MinistryLogo size="lg" />
          <p className="text-sm font-bold text-[#0B1D3A]">
            MINISTERIO VIDA EN LA PALABRA
          </p>
          <p className="text-xs text-slate-500">Cargando Panel Administrativo RMS...</p>
        </div>
      </div>
    );
  }

  // Pantalla de Inicio de Sesión (Sin datos de ejemplo)
  if (!currentUser) {
    return (
      <div className="min-h-[calc(100vh-64px)] bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-2.5 bg-[#0B1D3A] border-b-2 border-[#D4AF37]" />
          <div className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <MinistryLogo size="lg" customLogoDataUrl={settings?.customLogoDataUrl} />
              <p className="mt-3 text-xs font-bold tracking-wider text-[#C59B27]">
                MINISTERIO VIDA EN LA PALABRA
              </p>
              <h1 className="mt-1 text-xl font-bold text-[#0B1D3A]">
                Panel Administrativo RMS
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Ingresa tus credenciales autorizadas para acceder al sistema
              </p>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                  Usuario
                </label>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="Ingresa tu usuario"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0B1D3A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                  Contraseña
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0B1D3A] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />
              </div>

              <button
                type="submit"
                disabled={loginSubmitting}
                className="w-full py-3 px-4 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-sm transition-colors cursor-pointer"
              >
                {loginSubmitting ? 'Verificando acceso...' : 'Ingresar al Panel RMS'}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => onSwitchToPublicForm('visitantes')}
                className="text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
              >
                ← Volver al Formulario Público de Registro
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const allModuleNavItems: {
    id: RmsModuleId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'visitantes', label: 'Invitados y Visitas', icon: Users },
    { id: 'registrar', label: 'Registrar visita', icon: UserPlus },
    { id: 'formularios', label: 'Enlaces para Miembros', icon: Link2 },
    { id: 'qr', label: 'Códigos QR', icon: QrCode },
    { id: 'reportes', label: 'Reportes', icon: FileSpreadsheet },
    { id: 'usuarios', label: 'Usuarios', icon: Shield },
    { id: 'configuracion', label: 'Configuración', icon: Settings },
  ];

  // Filtrar los módulos que puede ver el usuario actual según lo configurado por el SuperUsuario Root (bwp)
  const visibleNavItems = allModuleNavItems.filter((item) => {
    if (currentUser.role === 'SuperUsuario') return true;
    return (currentUser.allowedModules || []).includes(item.id);
  });

  const canSeeRegisterButton =
    currentUser.role === 'SuperUsuario' ||
    (currentUser.allowedModules || []).includes('registrar');

  const pendingVisitsList = visits.filter((v) => v.status === 'invited');

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* =======================================================================
          MENÚ SUPERIOR INSTITUCIONAL (En la parte de arriba)
         ======================================================================= */}
      <div className="bg-[#0B1D3A] text-white border-b-2 border-[#D4AF37] print:hidden sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6">
          <div className="py-3 flex items-center justify-between gap-4 border-b border-white/10">
            <div className="flex items-center gap-3 min-w-0">
              <MinistryLogo
                size="sm"
                customLogoDataUrl={settings?.customLogoDataUrl}
              />
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-wider text-[#D4AF37] truncate">
                  {currentUser.role === 'SuperUsuario'
                    ? 'SUPER USUARIO ROOT (BWP) · CONTROL TOTAL DE MÓDULOS Y SISTEMA'
                    : `PANEL ADMINISTRATIVO RMS · ${currentUser.role.toUpperCase()}`}
                </p>
                <p className="text-sm font-bold text-white leading-tight truncate">
                  MINISTERIO VIDA EN LA PALABRA
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => fetchOverview()}
                disabled={dataLoading}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
                title="Actualizar datos en tiempo real"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#D4AF37] ${
                    dataLoading ? 'animate-spin' : ''
                  }`}
                />
                <span className="hidden md:inline">Actualizar</span>
              </button>

              {canSeeRegisterButton && (
                <button
                  type="button"
                  onClick={() => setActiveTab('registrar')}
                  className="px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold tracking-wide transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 border border-[#D4AF37]"
                >
                  <Plus className="w-4 h-4 text-[#D4AF37]" />
                  <span>REGISTRAR VISITA</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-xs font-medium text-slate-300 hover:text-red-200 transition-colors cursor-pointer whitespace-nowrap"
                title={`Cerrar sesión de ${currentUser.fullName}`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Salir ({currentUser.username})</span>
              </button>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10 cursor-pointer"
                aria-label="Abrir menú"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Barra Horizontal de Pestañas en la Parte Superior */}
          <nav
            className={`${
              mobileMenuOpen ? 'flex flex-col py-3 space-y-1' : 'hidden'
            } lg:flex lg:flex-row lg:items-center lg:justify-between lg:py-2 lg:gap-1 overflow-x-auto`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-[#1D4ED8] text-white border border-[#D4AF37]/70 shadow-xs'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        active ? 'text-[#D4AF37]' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                    {item.id === 'visitantes' &&
                      stats &&
                      stats.totalPendingAllDates > 0 && (
                        <span className="ml-1 font-mono text-[11px] text-[#D4AF37] font-bold">
                          ({stats.totalPendingAllDates})
                        </span>
                      )}
                  </button>
                );
              })}

              {/* Pestaña exclusiva para el Super Usuario Root (bwp): Control de Módulos */}
              {currentUser.role === 'SuperUsuario' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('permisos_root');
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'permisos_root'
                      ? 'bg-[#D4AF37] text-[#0B1D3A] shadow-xs'
                      : 'text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/15'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 shrink-0" />
                  <span>Control de Módulos (Root BWP)</span>
                </button>
              )}
            </div>

            <div className="pt-2 lg:pt-0 border-t border-white/10 lg:border-t-0 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  onSwitchToPublicForm(selectedFormObj?.slug || 'visitantes')
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#D4AF37] hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span>Formulario Público</span>
              </button>
            </div>
          </nav>
        </div>
      </div>

      {/* Notificación Toast */}
      {toastMessage && (
        <div className="max-w-[1400px] w-full mx-auto px-6 mt-4 print:hidden">
          <div className="p-3.5 rounded-lg border flex items-center justify-between gap-3 text-xs font-medium bg-white border-[#D4AF37] text-[#0B1D3A] shadow-xs">
            <div className="flex items-center gap-2.5">
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Contenido Dinámico Principal */}
      <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto space-y-6">
        {/* =====================================================================
            MÓDULO EXCLUSIVO SUPER USUARIO ROOT (BWP): CONTROL DE MÓDULOS
           ===================================================================== */}
        {activeTab === 'permisos_root' && currentUser.role === 'SuperUsuario' && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-[#C59B27]">
                PANEL EXCLUSIVO DE SUPER USUARIO ROOT ({currentUser.username.toUpperCase()})
              </p>
              <h1 className="text-2xl font-bold text-[#0B1D3A]">
                Control de Visibilidad de Módulos para Administradores
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Selecciona exactamente qué módulos de la barra superior podrán ver y
                utilizar los Administradores y Registradores cuando inicien sesión.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Matriz para Rol Administrador */}
              <div className="bg-white p-6 rounded-xl border-2 border-[#D4AF37] space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-[#0B1D3A]">
                      Módulos Visibles para Administradores
                    </h2>
                    <p className="text-xs text-slate-500">
                      Activa o desactiva los módulos a los que tendrán acceso los
                      Administradores:
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#1D4ED8]">
                    {adminModsDraft.length} de {ALL_RMS_MODULES.length} activos
                  </span>
                </div>

                <div className="space-y-2.5">
                  {ALL_RMS_MODULES.map((mod) => {
                    const checked = adminModsDraft.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          checked
                            ? 'bg-[#F8FAFC] border-[#1D4ED8]'
                            : 'bg-white border-slate-200 opacity-70'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setAdminModsDraft(
                                adminModsDraft.filter((id) => id !== mod.id)
                              );
                            } else {
                              setAdminModsDraft([...adminModsDraft, mod.id]);
                            }
                          }}
                          className="mt-0.5 w-4 h-4 accent-[#1D4ED8] cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0B1D3A]">
                            {mod.label}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {mod.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Matriz para Rol Registrador / Equipo de Bienvenida */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-[#0B1D3A]">
                      Módulos Visibles para Registradores / Ujieres
                    </h2>
                    <p className="text-xs text-slate-500">
                      Configura qué módulos ve el equipo de recepción y bienvenida:
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#0B1D3A]">
                    {regModsDraft.length} de {ALL_RMS_MODULES.length} activos
                  </span>
                </div>

                <div className="space-y-2.5">
                  {ALL_RMS_MODULES.map((mod) => {
                    const checked = regModsDraft.includes(mod.id);
                    return (
                      <label
                        key={mod.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          checked
                            ? 'bg-[#F8FAFC] border-[#0B1D3A]'
                            : 'bg-white border-slate-200 opacity-70'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setRegModsDraft(
                                regModsDraft.filter((id) => id !== mod.id)
                              );
                            } else {
                              setRegModsDraft([...regModsDraft, mod.id]);
                            }
                          }}
                          className="mt-0.5 w-4 h-4 accent-[#0B1D3A] cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#0B1D3A]">
                            {mod.label}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {mod.description}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                disabled={savingPermissions}
                onClick={handleSaveRolePermissions}
                className="px-6 py-3 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold tracking-wide transition-colors cursor-pointer inline-flex items-center gap-2 border border-[#D4AF37]"
              >
                <Check className="w-4 h-4 text-[#D4AF37]" />
                <span>
                  {savingPermissions
                    ? 'GUARDANDO PERMISOS...'
                    : 'GUARDAR Y APLICAR MÓDULOS A LOS ADMINISTRADORES'}
                </span>
              </button>
            </div>

            {/* Permisos individuales por cada Administrador registrado */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#0B1D3A]">
                    Permisos Individuales por Cuenta de Administrador
                  </h2>
                  <p className="text-xs text-slate-500">
                    También puedes personalizar los módulos de un administrador
                    específico o crear nuevos administradores en la pestaña Usuarios.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('usuarios')}
                  className="px-3.5 py-2 rounded-lg bg-[#0B1D3A] text-white text-xs font-bold hover:bg-[#132C57] cursor-pointer"
                >
                  Ir a Crear Administradores →
                </button>
              </div>

              {users.length === 0 ? (
                <div className="p-6 rounded-lg bg-[#F8FAFC] border border-slate-200 text-center text-xs text-slate-500">
                  Aún no se han creado cuentas de Administradores o Registradores. Puedes
                  crearlos en la pestaña <strong>Usuarios</strong>.
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((u) => {
                    const isEditing = editingUserPermissionsId === u.id;
                    return (
                      <div
                        key={u.id}
                        className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-[#0B1D3A]">
                              {u.fullName}{' '}
                              <span className="font-mono text-slate-500">
                                (@{u.username})
                              </span>{' '}
                              · <span className="text-[#1D4ED8]">{u.role}</span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Módulos habilitados:{' '}
                              {(u.allowedModules || [])
                                .map(
                                  (mId) =>
                                    ALL_RMS_MODULES.find((m) => m.id === mId)?.label ||
                                    mId
                                )
                                .join(' · ')}
                            </p>
                          </div>

                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUserPermissionsId(u.id);
                                setEditingUserModulesDraft(u.allowedModules || []);
                              }}
                              className="px-3 py-1.5 rounded bg-white border border-slate-300 text-xs font-semibold text-[#0B1D3A] hover:bg-slate-100 cursor-pointer"
                            >
                              Configurar Módulos
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingUserPermissionsId(null)}
                                className="px-3 py-1.5 rounded border border-slate-300 text-xs text-slate-600 cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveIndividualUserModules(u.id)}
                                className="px-3 py-1.5 rounded bg-[#1D4ED8] text-white text-xs font-bold cursor-pointer"
                              >
                                Guardar Módulos de @{u.username}
                              </button>
                            </div>
                          )}
                        </div>

                        {isEditing && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200">
                            {ALL_RMS_MODULES.map((m) => {
                              const active = editingUserModulesDraft.includes(m.id);
                              return (
                                <label
                                  key={m.id}
                                  className="flex items-center gap-2 p-2 rounded bg-white border border-slate-200 text-xs cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={() => {
                                      if (active) {
                                        setEditingUserModulesDraft(
                                          editingUserModulesDraft.filter(
                                            (id) => id !== m.id
                                          )
                                        );
                                      } else {
                                        setEditingUserModulesDraft([
                                          ...editingUserModulesDraft,
                                          m.id,
                                        ]);
                                      }
                                    }}
                                    className="accent-[#1D4ED8]"
                                  />
                                  <span className="font-medium text-[#0B1D3A]">
                                    {m.label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            MÓDULO 1: DASHBOARD PRINCIPAL Y VERIFICACIÓN DEL DÍA DE REUNIÓN
           ===================================================================== */}
        {activeTab === 'dashboard' && stats && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[#C59B27]">
                  SEGUIMIENTO DE AMIGOS INVITADOS Y CONTROL DE ASISTENCIA
                </p>
                <h1 className="text-2xl font-bold text-[#0B1D3A]">
                  Dashboard Principal — MINISTERIO VIDA EN LA PALABRA
                </h1>
              </div>
              <p className="text-xs text-slate-500 font-mono tabular-nums">
                Fecha oficial Honduras: {formatDateSpanishLong(stats.hondurasToday)}
              </p>
            </div>

            {/* 5 Tarjetas Estadísticas Oficiales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <p className="text-xs font-medium text-slate-500">
                  Total de personas registradas
                </p>
                <p className="mt-2 text-3xl font-bold text-[#0B1D3A] font-mono tabular-nums">
                  {stats.totalPersons}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Amigos / nuevos hermanos en base de datos
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <p className="text-xs font-medium text-slate-500">
                  Invitados / Visitas para hoy
                </p>
                <p className="mt-2 text-3xl font-bold text-[#1D4ED8] font-mono tabular-nums">
                  {stats.visitsToday}
                </p>
                <p className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
                  <strong className="text-emerald-700">{stats.arrivedToday} llegaron</strong>{' '}
                  ·{' '}
                  <strong className="text-amber-700">
                    {stats.pendingToday} por llegar
                  </strong>
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <p className="text-xs font-medium text-slate-500">
                  Visitas de la semana
                </p>
                <p className="mt-2 text-3xl font-bold text-[#0B1D3A] font-mono tabular-nums">
                  {stats.visitsThisWeek}
                </p>
                <p className="mt-1 text-xs text-slate-500">Semana actual (Lun–Dom)</p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <p className="text-xs font-medium text-slate-500">Visitas del mes</p>
                <p className="mt-2 text-3xl font-bold text-[#0B1D3A] font-mono tabular-nums">
                  {stats.visitsThisMonth}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Acumulado mensual ({stats.hondurasToday.slice(0, 7)})
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-[#D4AF37]">
                <p className="text-xs font-bold text-[#0B1D3A]">
                  Personas con &gt; 1 visita
                </p>
                <p className="mt-2 text-3xl font-bold text-[#C59B27] font-mono tabular-nums">
                  {stats.returningPersonsCount}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Amigos que han regresado
                </p>
              </div>
            </div>

            {/* BLOQUE DESTACADO: VERIFICACIÓN DE LLEGADA A LA INVITACIÓN */}
            <div className="bg-white rounded-xl border-2 border-[#D4AF37] overflow-hidden">
              <div className="bg-[#0B1D3A] px-6 py-4 border-b border-[#D4AF37] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-[#D4AF37] tracking-wider">
                    PASO DE VERIFICACIÓN EL DÍA DE LA REUNIÓN
                  </p>
                  <h2 className="text-base font-bold text-white">
                    Amigos Invitados Pendientes de Confirmar Llegada ({pendingVisitsList.length})
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('registrar')}
                    className="px-3 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    + Registrar Invitado
                  </button>
                </div>
              </div>

              {pendingVisitsList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No hay amigos invitados pendientes de confirmar llegada en este momento.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-slate-200 text-[11px] font-bold text-slate-600">
                        <th className="py-3 px-4">Código</th>
                        <th className="py-3 px-4">Nombre del Amigo Invitado</th>
                        <th className="py-3 px-4">Teléfono</th>
                        <th className="py-3 px-4">Dónde Vive</th>
                        <th className="py-3 px-4">Nombre de Quien lo Invita</th>
                        <th className="py-3 px-4">Fecha de Reunión</th>
                        <th className="py-3 px-4">Estado</th>
                        <th className="py-3 px-4 text-right">
                          Verificar que Llegó a la Invitación
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs">
                      {pendingVisitsList.map((v) => {
                        const parentPerson = persons.find((p) => p.id === v.personId);
                        return (
                          <tr key={v.id} className="hover:bg-[#F8FAFC]">
                            <td className="py-3 px-4 font-mono tabular-nums font-bold text-[#0B1D3A]">
                              {v.personFormattedCode}
                            </td>
                            <td className="py-3 px-4 font-bold text-[#0B1D3A]">
                              {v.personName}
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                              {v.personPhone}
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              {v.personAddress || '—'}
                            </td>
                            <td className="py-3 px-4 font-medium text-[#0B1D3A]">
                              {v.invitedByMember}
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                              {formatDateSpanishShort(v.visitDate)}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Invitado · Pendiente</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleVisitArrival(
                                    v.id,
                                    'attended',
                                    v.personName
                                  )
                                }
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Marcar que Llegó</span>
                              </button>
                              {parentPerson && (
                                <button
                                  type="button"
                                  onClick={() => openPersonModal(parentPerson, 'history')}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-[#0B1D3A] hover:bg-slate-100 font-semibold text-xs cursor-pointer"
                                >
                                  Ficha
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Gráfico de Visitas por Día, Semana o Mes + Resumen de Retención */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-base font-bold text-[#0B1D3A]">
                      Gráfico de Invitaciones y Visitas
                    </h2>
                    <p className="text-xs text-slate-500">
                      Actividad registrada por día, semana o mes en MINISTERIO VIDA EN LA
                      PALABRA
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                    <button
                      type="button"
                      onClick={() => setChartMode('day')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        chartMode === 'day'
                          ? 'bg-[#0B1D3A] text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Por Día
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMode('week')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        chartMode === 'week'
                          ? 'bg-[#0B1D3A] text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Por Semana
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartMode('month')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        chartMode === 'month'
                          ? 'bg-[#0B1D3A] text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Por Mes
                    </button>
                  </div>
                </div>

                <div className="h-52 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-200">
                  {chartData.map((item) => {
                    const heightPct =
                      item.count === 0
                        ? 4
                        : Math.max(Math.round((item.count / maxChartVal) * 100), 10);
                    return (
                      <div
                        key={item.sub}
                        className="flex-1 flex flex-col items-center h-full justify-end group"
                      >
                        <span className="text-xs font-bold text-[#0B1D3A] font-mono tabular-nums mb-1.5">
                          {item.count}
                        </span>
                        <div
                          className="w-full max-w-[48px] rounded-t-md bg-[#1D4ED8] group-hover:bg-[#0B1D3A] transition-colors border-t-2 border-[#D4AF37]"
                          style={{ height: `${heightPct}%` }}
                          title={`${item.sub}: ${item.count} registros`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-3 pt-2.5 px-2">
                  {chartData.map((item) => (
                    <div key={item.sub} className="flex-1 text-center">
                      <p className="text-[11px] font-medium text-slate-600 truncate">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-bold text-[#0B1D3A]">
                      Amigos que Han Regresado
                    </h2>
                    <History className="w-4 h-4 text-[#C59B27]" />
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    Nuevos hermanos e invitados con múltiples visitas registradas
                  </p>

                  {persons.filter((p) => p.visitCount > 1).length === 0 ? (
                    <div className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs text-slate-500 text-center">
                      Aún no hay visitantes recurrentes registrados.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {persons
                        .filter((p) => p.visitCount > 1)
                        .slice(0, 4)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="p-3 rounded-lg bg-[#F8FAFC] border border-slate-200 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-[#0B1D3A] truncate">
                                {p.fullName}
                              </p>
                              <p className="text-[11px] text-slate-500 font-mono tabular-nums truncate">
                                {p.phone} · Invitó: {p.invitedByMember}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openPersonModal(p, 'history')}
                              className="text-xs font-bold text-[#1D4ED8] hover:underline font-mono tabular-nums whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              {p.visitCount} visitas →
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setVisitorDateMode('returning');
                    setActiveTab('visitantes');
                  }}
                  className="mt-4 w-full py-2.5 px-4 rounded-lg bg-[#F8FAFC] hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-[#0B1D3A] transition-colors cursor-pointer"
                >
                  Ver todos los recurrentes
                </button>
              </div>
            </div>

            {/* Tabla de Registros Más Recientes */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#0B1D3A]">
                    Últimos Amigos Invitados y Visitas Registradas
                  </h2>
                  <p className="text-xs text-slate-500">
                    Verifica con un clic si la persona llegó el día de la invitación
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8FAFC] border-b border-slate-200 text-[11px] font-bold text-slate-600">
                      <th className="py-3 px-4">No. Registro</th>
                      <th className="py-3 px-4">Nombre del Invitado</th>
                      <th className="py-3 px-4">Teléfono</th>
                      <th className="py-3 px-4">Fecha Reunión</th>
                      <th className="py-3 px-4">Miembro que Invitó</th>
                      <th className="py-3 px-4">Estado de Llegada</th>
                      <th className="py-3 px-4 text-right">Verificación / Ficha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {visits.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 px-6 text-center text-slate-500"
                        >
                          Aún no hay registros de visitas o invitados en el sistema.
                        </td>
                      </tr>
                    ) : (
                      visits.slice(0, 8).map((v) => {
                        const parentPerson = persons.find((p) => p.id === v.personId);
                        return (
                          <tr
                            key={v.id}
                            className="hover:bg-[#F8FAFC] transition-colors"
                          >
                            <td className="py-3 px-4 font-mono tabular-nums font-bold text-[#0B1D3A]">
                              {v.personFormattedCode}
                            </td>
                            <td className="py-3 px-4 font-semibold text-[#0B1D3A]">
                              {v.personName}
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                              {v.personPhone}
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                              {formatDateSpanishShort(v.visitDate)}
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              {v.invitedByMember}
                            </td>
                            <td className="py-3 px-4">
                              {v.status === 'attended' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Llegó a la invitación</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Pendiente de llegar</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                              {v.status === 'invited' ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleVisitArrival(
                                      v.id,
                                      'attended',
                                      v.personName
                                    )
                                  }
                                  className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Marcar que Llegó</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleVisitArrival(
                                      v.id,
                                      'invited',
                                      v.personName
                                    )
                                  }
                                  className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                                >
                                  Cambiar a pendiente
                                </button>
                              )}
                              {parentPerson && (
                                <button
                                  type="button"
                                  onClick={() => openPersonModal(parentPerson, 'history')}
                                  className="text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                                >
                                  Ficha ({v.totalVisitsForPerson})
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MÓDULO 2: INVITADOS Y VISITANTES (Directorio y Verificación)
           ===================================================================== */}
        {activeTab === 'visitantes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#C59B27]">
                  SEGUIMIENTO DE NUEVOS HERMANOS Y AMIGOS INVITADOS
                </p>
                <h1 className="text-2xl font-bold text-[#0B1D3A]">
                  Directorio de Invitados y Verificación de Llegadas
                </h1>
              </div>

              {canSeeRegisterButton && (
                <button
                  type="button"
                  onClick={() => setActiveTab('registrar')}
                  className="px-4 py-2.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-2 self-start"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Registrar Nuevo Invitado</span>
                </button>
              )}
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                <div className="lg:col-span-4 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={visitorSearch}
                    onChange={(e) => setVisitorSearch(e.target.value)}
                    placeholder="Buscar por nombre del amigo, teléfono o miembro que invitó..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[#F8FAFC] border border-slate-300 text-xs text-[#0B1D3A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                  />
                </div>

                <div className="lg:col-span-8 flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'Todos' },
                      { id: 'pending', label: 'Pendientes de Llegar' },
                      { id: 'attended', label: 'Ya Llegaron (Confirmados)' },
                      { id: 'day', label: 'Por Día' },
                      { id: 'week', label: 'Por Semana' },
                      { id: 'month', label: 'Por Mes' },
                      { id: 'returning', label: 'Recurrentes (>1 visita)' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setVisitorDateMode(f.id)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        visitorDateMode === f.id
                          ? 'bg-[#0B1D3A] text-white'
                          : 'bg-[#F8FAFC] text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}

                  {(visitorDateMode === 'day' || visitorDateMode === 'week') && (
                    <input
                      type="date"
                      value={visitorFilterDay}
                      onChange={(e) => setVisitorFilterDay(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-[#1D4ED8] text-xs font-mono tabular-nums text-[#0B1D3A]"
                    />
                  )}

                  {visitorDateMode === 'month' && (
                    <input
                      type="month"
                      value={visitorFilterMonth}
                      onChange={(e) => setVisitorFilterMonth(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-[#1D4ED8] text-xs font-mono tabular-nums text-[#0B1D3A]"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0B1D3A] text-white text-xs font-semibold border-b-2 border-[#D4AF37]">
                      <th className="py-3.5 px-4 whitespace-nowrap">
                        Número de registro
                      </th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Nombre completo</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">
                        Número telefónico
                      </th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Dónde vive</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">
                        Nombre de quien lo invita
                      </th>
                      <th className="py-3.5 px-4 whitespace-nowrap text-center">
                        Visitas / Invitaciones
                      </th>
                      <th className="py-3.5 px-4 whitespace-nowrap">
                        Última fecha / Estado
                      </th>
                      <th className="py-3.5 px-4 whitespace-nowrap text-right">
                        Verificación y Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {filteredPersons.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-12 px-6 text-center text-slate-500"
                        >
                          No hay personas registradas todavía.
                        </td>
                      </tr>
                    ) : (
                      filteredPersons.map((person) => (
                        <tr
                          key={person.id}
                          className="hover:bg-[#F8FAFC] transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono tabular-nums font-bold text-[#0B1D3A]">
                            {person.formattedCode}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-[#0B1D3A]">
                            <button
                              type="button"
                              onClick={() => openPersonModal(person, 'history')}
                              className="hover:text-[#1D4ED8] hover:underline text-left cursor-pointer"
                            >
                              {person.fullName}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums text-slate-700">
                            {person.phone}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {person.address || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            {person.invitedByMember}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono tabular-nums">
                            <span className="font-bold text-[#1D4ED8]">
                              {person.attendedCount} llegaron
                            </span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-slate-600">
                              {person.visitCount} total
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono tabular-nums">
                            <div className="font-medium text-[#0B1D3A]">
                              {formatDateSpanishShort(person.lastVisitDate)}
                            </div>
                            {person.latestStatus === 'attended' ? (
                              <span className="text-[11px] font-sans font-bold text-emerald-700">
                                ✓ Llegó a la invitación
                              </span>
                            ) : (
                              <span className="text-[11px] font-sans font-semibold text-amber-700">
                                • Invitado (Pendiente de llegar)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-1.5">
                            {person.latestStatus === 'invited' &&
                              person.latestVisitId && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleVisitArrival(
                                      person.latestVisitId,
                                      'attended',
                                      person.fullName
                                    )
                                  }
                                  className="px-2.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                                  title="Confirmar que llegó a la reunión"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Marcar que Llegó</span>
                                </button>
                              )}

                            <button
                              type="button"
                              onClick={() => openPersonModal(person, 'history')}
                              className="px-2.5 py-1.5 rounded bg-[#F8FAFC] hover:bg-slate-200 border border-slate-300 text-[#0B1D3A] font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#1D4ED8]" />
                              <span>Ficha ({person.visitCount})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openPersonModal(person, 'add_visit')}
                              className="px-2.5 py-1.5 rounded bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-semibold transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Invitar / Visita</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openPersonModal(person, 'edit')}
                              className="px-2 py-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer inline-flex items-center"
                              title="Editar datos de la persona"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MÓDULO 3: REGISTRAR INVITADO O VISITA DESDE EL PANEL
           ===================================================================== */}
        {activeTab === 'registrar' && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-[#C59B27]">
                REGISTRO DE INVITACIONES Y CONTROL DE ASISTENCIA
              </p>
              <h1 className="text-2xl font-bold text-[#0B1D3A]">
                Registrar Nuevo Amigo Invitado o Visita
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Registra a la persona invitada a la Reunión de Amigos para guardar su
                información y verificar su llegada el día del evento, o confirma su
                asistencia si ya llegó.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 space-y-4">
                <h2 className="text-base font-bold text-[#0B1D3A] flex items-center gap-2">
                  <Search className="w-4 h-4 text-[#1D4ED8]" />
                  <span>Paso 1: Buscar si el invitado ya está registrado</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Si el amigo ya fue invitado antes, búscalo aquí por nombre o teléfono:
                </p>

                <input
                  type="text"
                  value={manualSearchQuery}
                  onChange={(e) => setManualSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre o teléfono..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#F8FAFC] border border-slate-300 text-xs text-[#0B1D3A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                />

                <div className="space-y-2.5 pt-2">
                  {matchingExistingPersons.length > 0 ? (
                    <>
                      <p className="text-xs font-bold text-[#C59B27]">
                        Personas encontradas ({matchingExistingPersons.length}):
                      </p>
                      {matchingExistingPersons.map((p) => (
                        <div
                          key={p.id}
                          className="p-3.5 rounded-lg bg-[#F8FAFC] border border-[#D4AF37] flex flex-col gap-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-bold text-[#0B1D3A]">
                                {p.fullName}{' '}
                                <span className="font-mono text-slate-500 font-normal">
                                  ({p.formattedCode})
                                </span>
                              </p>
                              <p className="text-xs font-mono tabular-nums text-slate-600 mt-0.5">
                                Tel: {p.phone} · {p.attendedCount} llegadas de{' '}
                                {p.visitCount} invitaciones
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openPersonModal(p, 'history')}
                              className="text-[11px] font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                            >
                              Ver ficha
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
                            <button
                              type="button"
                              disabled={manualSubmitting}
                              onClick={(e) =>
                                handleManualVisitSubmit(e, p.id, 'invited')
                              }
                              className="px-2.5 py-1.5 rounded bg-[#0B1D3A] hover:bg-[#132C57] text-white text-xs font-semibold transition-colors cursor-pointer"
                            >
                              + Agendar Invitación
                            </button>
                            <button
                              type="button"
                              disabled={manualSubmitting}
                              onClick={(e) =>
                                handleManualVisitSubmit(e, p.id, 'attended')
                              }
                              className="px-2.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Llegó Hoy</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs text-slate-500">
                      Si es la primera vez que se invita a este amigo, llena sus datos en
                      el formulario de la derecha para guardar su información.
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 bg-white p-6 rounded-xl border border-slate-200">
                <h2 className="text-base font-bold text-[#0B1D3A] mb-1">
                  Paso 2: Información del Amigo Invitado
                </h2>
                <p className="text-xs text-slate-500 mb-5">
                  Guarda siempre los datos de la persona invitada para verificar su
                  asistencia el día que llegue a la reunión.
                </p>

                <form
                  onSubmit={(e) => handleManualVisitSubmit(e)}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                      1. Nombre completo del amigo invitado{' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={manualFullName}
                      onChange={(e) => setManualFullName(e.target.value)}
                      placeholder="Nombre y apellidos del invitado"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#F8FAFC] border border-slate-300 text-sm text-[#0B1D3A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                      2. Número telefónico <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="Número telefónico"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#F8FAFC] border border-slate-300 text-sm font-mono tabular-nums text-[#0B1D3A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                      3. ¿Dónde vive la persona? <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={manualAddress}
                      onChange={(e) => setManualAddress(e.target.value)}
                      placeholder="Colonia, barrio o dirección donde vive"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#F8FAFC] border border-slate-300 text-sm text-[#0B1D3A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                        4. Nombre de quien lo invita <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={manualInvitedBy}
                        onChange={(e) => setManualInvitedBy(e.target.value)}
                        placeholder="Nombre de la persona que invita"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#F8FAFC] border border-slate-300 text-sm text-[#0B1D3A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                        5. Fecha de la reunión / invitación
                      </label>
                      <input
                        type="date"
                        required
                        value={manualVisitDate}
                        onChange={(e) => setManualVisitDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-[#F8FAFC] border border-slate-300 text-sm font-mono tabular-nums text-[#0B1D3A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B1D3A] mb-2">
                      Estado del registro:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setManualStatus('invited')}
                        className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                          manualStatus === 'invited'
                            ? 'bg-[#0B1D3A] text-white border-[#D4AF37]'
                            : 'bg-[#F8FAFC] text-slate-700 border-slate-300'
                        }`}
                      >
                        <p className="text-xs font-bold">
                          Invitado (Verificar cuando llegue)
                        </p>
                        <p
                          className={`text-[11px] mt-0.5 ${
                            manualStatus === 'invited'
                              ? 'text-slate-300'
                              : 'text-slate-500'
                          }`}
                        >
                          Lo invito hoy y el día de la reunión marco que llegó
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setManualStatus('attended')}
                        className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                          manualStatus === 'attended'
                            ? 'bg-emerald-700 text-white border-emerald-900'
                            : 'bg-[#F8FAFC] text-slate-700 border-slate-300'
                        }`}
                      >
                        <p className="text-xs font-bold">
                          ✓ Ya Llegó a la Reunión Hoy
                        </p>
                        <p
                          className={`text-[11px] mt-0.5 ${
                            manualStatus === 'attended'
                              ? 'text-emerald-100'
                              : 'text-slate-500'
                          }`}
                        >
                          Registrar y marcar su llegada inmediatamente
                        </p>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={manualSubmitting}
                      className="w-full py-3.5 px-6 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-sm tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>
                        {manualSubmitting
                          ? 'GUARDANDO INFORMACIÓN...'
                          : manualStatus === 'invited'
                            ? 'GUARDAR INVITADO PARA VERIFICAR EL DÍA DE LA REUNIÓN'
                            : 'REGISTRAR Y CONFIRMAR LLEGADA'}
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MÓDULO 4: ENLACES PARA MIEMBROS DE LA IGLESIA (Sección 8)
           ===================================================================== */}
        {activeTab === 'formularios' && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-[#C59B27]">
                ENLACES PARA QUE LOS MIEMBROS REGISTREN A SUS AMIGOS INVITADOS
              </p>
              <h1 className="text-2xl font-bold text-[#0B1D3A]">
                Generador de Enlaces para Miembros de la Iglesia
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Crea enlaces personalizados para los miembros, líderes o ministerios de la
                iglesia. Cuando un miembro invita a un amigo a la reunión, abre su enlace
                y registra al amigo para que el día del evento verifiquemos su llegada.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                {forms.length === 0 ? (
                  <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-2">
                    <Link2 className="w-8 h-8 text-[#1D4ED8] mx-auto" />
                    <p className="text-sm font-bold text-[#0B1D3A]">
                      Aún no se han creado enlaces para miembros
                    </p>
                    <p className="text-xs text-slate-500">
                      Utiliza el formulario de la derecha para generar el primer enlace
                      de invitación para un miembro o grupo de la iglesia.
                    </p>
                  </div>
                ) : (
                  forms.map((f) => {
                    const url = buildPublicUrlForForm(f.slug);
                    const countForForm = visits.filter((v) => v.formId === f.id).length;
                    return (
                      <div
                        key={f.id}
                        className="bg-white p-5 rounded-xl border border-slate-200 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-bold text-[#1D4ED8]">
                              Miembro / Grupo: {f.memberName || 'Miembros de la Iglesia'}
                            </p>
                            <h3 className="text-sm font-bold text-[#0B1D3A] mt-0.5">
                              {f.name}
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {f.description}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-semibold text-slate-600 block">
                              Estado:{' '}
                              <strong
                                className={
                                  f.isActive ? 'text-emerald-700' : 'text-red-600'
                                }
                              >
                                {f.isActive ? 'Activo' : 'Inactivo'}
                              </strong>
                            </span>
                            <span className="text-[11px] font-mono text-slate-500">
                              {countForForm} amigos registrados
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-[#F8FAFC] border border-slate-200 flex items-center justify-between gap-2">
                          <span className="text-xs font-mono text-[#0B1D3A] truncate">
                            {url}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(url)}
                            className="px-2.5 py-1 rounded bg-white border border-slate-300 text-xs font-semibold text-[#0B1D3A] hover:bg-slate-100 transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar enlace</span>
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFormIdForQr(f.id);
                                handleGenerateLink(f.slug);
                                handleCopyLink(url);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#0B1D3A] hover:bg-[#132C57] text-white text-xs font-bold transition-colors cursor-pointer"
                            >
                              GENERAR ENLACE
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFormIdForQr(f.id);
                                handleGenerateQrCode(f.slug);
                                setActiveTab('qr');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>GENERAR CÓDIGO QR</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onSwitchToPublicForm(f.slug)}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#0B1D3A] hover:bg-slate-100 transition-colors cursor-pointer inline-flex items-center gap-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Abrir enlace</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleFormActive(f)}
                            className="text-xs font-medium text-slate-600 hover:text-[#0B1D3A] underline cursor-pointer"
                          >
                            {f.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 h-fit">
                <h2 className="text-base font-bold text-[#0B1D3A] mb-1">
                  Crear Enlace para un Miembro o Grupo
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  Genera un enlace único para dárselo a un hermano de la iglesia y que él
                  mismo registre en el sistema a los amigos que invita.
                </p>
                <form onSubmit={handleCreateForm} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0B1D3A] mb-1">
                      Nombre del Miembro o Ministerio que invita{' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="Nombre del hermano o ministerio"
                      className="w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-slate-300 text-xs text-[#0B1D3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B1D3A] mb-1">
                      Título del enlace (opcional)
                    </label>
                    <input
                      type="text"
                      value={newFormName}
                      onChange={(e) => setNewFormName(e.target.value)}
                      placeholder="Título descriptivo del enlace"
                      className="w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-slate-300 text-xs text-[#0B1D3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B1D3A] mb-1">
                      Identificador corto del enlace (opcional)
                    </label>
                    <input
                      type="text"
                      value={newFormSlug}
                      onChange={(e) => setNewFormSlug(e.target.value)}
                      placeholder="Identificador URL"
                      className="w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-slate-300 text-xs font-mono text-[#0B1D3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B1D3A] mb-1">
                      Nota o descripción
                    </label>
                    <input
                      type="text"
                      value={newFormDesc}
                      onChange={(e) => setNewFormDesc(e.target.value)}
                      placeholder="Descripción opcional"
                      className="w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-slate-300 text-xs text-[#0B1D3A]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    GENERAR ENLACE PARA EL MIEMBRO
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MÓDULO 5: GENERADOR DE CÓDIGOS QR (Sección 8)
           ===================================================================== */}
        {activeTab === 'qr' && (
          <div className="space-y-6">
            <div className="print:hidden">
              <p className="text-xs font-semibold text-[#C59B27]">
                CÓDIGOS QR PARA MIEMBROS E INVITACIONES
              </p>
              <h1 className="text-2xl font-bold text-[#0B1D3A]">
                Generador de Enlaces y Códigos QR
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Comparte el enlace o el código QR con los miembros de la iglesia para que
                registren desde su celular a cada amigo que inviten.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-slate-200 space-y-5 print:hidden">
                <div>
                  <label className="block text-xs font-bold text-[#0B1D3A] mb-2">
                    1. Selecciona el enlace del miembro o formulario:
                  </label>
                  <select
                    value={selectedFormIdForQr}
                    onChange={(e) => setSelectedFormIdForQr(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#F8FAFC] border border-slate-300 text-xs font-semibold text-[#0B1D3A]"
                  >
                    {forms.length === 0 ? (
                      <option value="">Enlace General de Visitantes (/registro/visitantes)</option>
                    ) : (
                      forms.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name} — {f.memberName} ({f.isActive ? 'Activo' : 'Inactivo'})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const url = handleGenerateLink(selectedFormObj?.slug);
                      showToast('success', `Enlace listo: ${url}`);
                    }}
                    className="py-3 px-4 rounded-lg bg-[#0B1D3A] hover:bg-[#132C57] text-white text-xs font-bold tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Link2 className="w-4 h-4 text-[#D4AF37]" />
                    <span>GENERAR ENLACE</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleGenerateQrCode(selectedFormObj?.slug);
                      showToast('success', 'Código QR generado correctamente.');
                    }}
                    className="py-3 px-4 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4 text-[#D4AF37]" />
                    <span>GENERAR CÓDIGO QR</span>
                  </button>
                </div>

                <div className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200 space-y-2">
                  <p className="text-xs font-bold text-[#0B1D3A]">
                    Dirección pública para enviar al miembro de la iglesia:
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={
                        generatedLink ||
                        buildPublicUrlForForm(selectedFormObj?.slug || 'visitantes')
                      }
                      className="w-full px-3 py-2 rounded bg-white border border-slate-300 text-xs font-mono text-[#0B1D3A]"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink()}
                      className="px-3 py-2 rounded bg-[#0B1D3A] text-white text-xs font-semibold hover:bg-[#132C57] transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                    >
                      {copiedLink ? (
                        <Check className="w-3.5 h-3.5 text-[#D4AF37]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedLink ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-200">
                  <p className="text-xs font-bold text-[#0B1D3A]">
                    Opciones de descarga e impresión:
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleDownloadQrPng}
                      className="px-4 py-2.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar QR (PNG)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePrintQrPoster}
                      className="px-4 py-2.5 rounded-lg bg-[#0B1D3A] hover:bg-[#132C57] text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-2"
                    >
                      <Printer className="w-4 h-4 text-[#D4AF37]" />
                      <span>Imprimir Cartel QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onSwitchToPublicForm(selectedFormObj?.slug || 'visitantes')
                      }
                      className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0B1D3A] transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-4 h-4 text-[#1D4ED8]" />
                      <span>Abrir Enlace</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 bg-white rounded-xl border-2 border-[#D4AF37] overflow-hidden shadow-xs text-center">
                <div className="bg-[#0B1D3A] py-5 px-6 border-b-2 border-[#D4AF37]">
                  <div className="flex justify-center mb-2">
                    <MinistryLogo
                      size="md"
                      customLogoDataUrl={settings?.customLogoDataUrl}
                    />
                  </div>
                  <p className="text-xs font-bold tracking-widest text-[#D4AF37]">
                    REGISTRO DE INVITADOS Y AMIGOS
                  </p>
                  <h2 className="text-lg font-bold text-white mt-0.5">
                    MINISTERIO VIDA EN LA PALABRA
                  </h2>
                </div>

                <div className="p-6 sm:p-8 flex flex-col items-center">
                  <h3 className="text-base font-bold text-[#0B1D3A]">
                    {selectedFormObj?.memberName || 'REGISTRO DE VISITANTES'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-xs">
                    Escanea este código QR para registrar los datos del amigo invitado a
                    la iglesia:
                  </p>

                  <div className="my-5 p-4 bg-white rounded-xl border-2 border-[#0B1D3A] inline-block">
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrDataUrl}
                        alt="Código QR Oficial Registro de Invitados"
                        referrerPolicy="no-referrer"
                        className="w-56 h-56 object-contain mx-auto"
                      />
                    ) : (
                      <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                        Generando QR...
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] font-mono text-slate-500 break-all max-w-sm">
                    {generatedLink ||
                      buildPublicUrlForForm(selectedFormObj?.slug || 'visitantes')}
                  </p>
                </div>

                <div className="bg-[#F8FAFC] py-3 px-6 border-t border-slate-200 text-xs font-bold text-[#0B1D3A]">
                  MINISTERIO VIDA EN LA PALABRA · Control de Invitados y Visitas
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MÓDULO 6: REPORTES Y EXPORTACIÓN (Sección 10)
           ===================================================================== */}
        {activeTab === 'reportes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#C59B27]">
                  CONSULTA, VERIFICACIÓN Y EXPORTACIÓN OFICIAL
                </p>
                <h1 className="text-2xl font-bold text-[#0B1D3A]">
                  Módulo de Reportes de Invitados y Visitas
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    exportVisitsToExcel(filteredReportVisits, reportSummary)
                  }
                  className="px-3.5 py-2.5 rounded-lg bg-[#0B1D3A] hover:bg-[#132C57] text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#D4AF37]" />
                  <span>Exportar a Excel (.xls)</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportVisitsToCSV(filteredReportVisits)}
                  className="px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[#0B1D3A] text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4 text-[#1D4ED8]" />
                  <span>Exportar CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    exportVisitsToPDF(
                      filteredReportVisits,
                      reportSummary,
                      settings?.customLogoDataUrl
                    )
                  }
                  className="px-4 py-2.5 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-[#D4AF37]" />
                  <span>Generar Informe PDF</span>
                </button>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: 'all', label: 'Todos' },
                    { id: 'pending', label: 'Invitados Pendientes de Llegar' },
                    { id: 'attended', label: 'Confirmados que Llegaron' },
                    { id: 'specific_date', label: 'Fecha Específica' },
                    { id: 'week', label: 'Por Semana' },
                    { id: 'month', label: 'Por Mes' },
                    { id: 'custom_range', label: 'Rango de Fechas' },
                    { id: 'returning', label: 'Personas que Han Regresado' },
                    { id: 'person', label: 'Historial de una Persona' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setReportFilterType(tab.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      reportFilterType === tab.id
                        ? 'bg-[#0B1D3A] text-white'
                        : 'bg-[#F8FAFC] text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4">
                {(reportFilterType === 'specific_date' ||
                  reportFilterType === 'week') && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-[#0B1D3A]">
                      Seleccionar fecha:
                    </label>
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono tabular-nums text-[#0B1D3A]"
                    />
                  </div>
                )}

                {reportFilterType === 'month' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-[#0B1D3A]">
                      Seleccionar mes:
                    </label>
                    <input
                      type="month"
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono tabular-nums text-[#0B1D3A]"
                    />
                  </div>
                )}

                {reportFilterType === 'custom_range' && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-[#0B1D3A]">Desde:</label>
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono tabular-nums text-[#0B1D3A]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-[#0B1D3A]">Hasta:</label>
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono tabular-nums text-[#0B1D3A]"
                      />
                    </div>
                  </div>
                )}

                {reportFilterType === 'person' && (
                  <div className="flex items-center gap-2 w-full max-w-md">
                    <label className="text-xs font-bold text-[#0B1D3A] shrink-0">
                      Persona:
                    </label>
                    <select
                      value={reportPersonId}
                      onChange={(e) => setReportPersonId(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-[#0B1D3A]"
                    >
                      <option value="">-- Todas las personas --</option>
                      {persons.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.fullName} ({p.formattedCode} · {p.visitCount} registros)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <span className="text-xs text-slate-500 ml-auto">
                  {reportSummary.periodLabel}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500">
                  Total de invitaciones / visitas en el reporte
                </p>
                <p className="text-2xl font-bold text-[#0B1D3A] font-mono tabular-nums mt-1">
                  {reportSummary.totalVisits}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500">Personas únicas</p>
                <p className="text-2xl font-bold text-[#1D4ED8] font-mono tabular-nums mt-1">
                  {reportSummary.uniquePersons}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200">
                <p className="text-xs text-slate-500">
                  Personas recurrentes en este reporte
                </p>
                <p className="text-2xl font-bold text-[#C59B27] font-mono tabular-nums mt-1">
                  {reportSummary.returningPersons}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0B1D3A] text-white text-xs font-semibold border-b-2 border-[#D4AF37]">
                      <th className="py-3 px-4">No. Registro</th>
                      <th className="py-3 px-4">Nombre del Invitado</th>
                      <th className="py-3 px-4">Número telefónico</th>
                      <th className="py-3 px-4">Dónde vive</th>
                      <th className="py-3 px-4">Nombre de quien lo invita</th>
                      <th className="py-3 px-4">Fecha de reunión</th>
                      <th className="py-3 px-4">Estado de llegada</th>
                      <th className="py-3 px-4">Orden</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {filteredReportVisits.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="py-10 px-6 text-center text-slate-500"
                        >
                          No hay registros en el período seleccionado.
                        </td>
                      </tr>
                    ) : (
                      filteredReportVisits.map((v) => (
                        <tr key={v.id} className="hover:bg-[#F8FAFC]">
                          <td className="py-3 px-4 font-mono tabular-nums font-bold text-[#0B1D3A]">
                            {v.personFormattedCode}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#0B1D3A]">
                            {v.personName}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                            {v.personPhone}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {v.personAddress || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            {v.invitedByMember}
                          </td>
                          <td className="py-3 px-4 font-mono tabular-nums text-slate-700">
                            {formatDateSpanishLong(v.visitDate)}
                          </td>
                          <td className="py-3 px-4">
                            {v.status === 'attended' ? (
                              <span className="font-bold text-emerald-700">
                                ✓ Llegó a la invitación
                              </span>
                            ) : (
                              <span className="font-semibold text-amber-700">
                                • Pendiente de llegar
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {getOrdinalVisitLabel(v.visitNumberForPerson)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MÓDULO 7: USUARIOS Y CONTROL DE ACCESO (Sección 11 y 12)
           ===================================================================== */}
        {activeTab === 'usuarios' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#C59B27]">
                  SEGURIDAD, ADMINISTRADORES Y ACCESO A MÓDULOS
                </p>
                <h1 className="text-2xl font-bold text-[#0B1D3A]">
                  Administración de Usuarios Autorizados
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Crea cuentas para Administradores y Registradores y define a qué
                  módulos tienen acceso.
                </p>
              </div>

              {currentUser.role === 'SuperUsuario' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('permisos_root')}
                  className="px-4 py-2.5 rounded-lg bg-[#0B1D3A] hover:bg-[#132C57] text-[#D4AF37] border border-[#D4AF37] text-xs font-bold cursor-pointer inline-flex items-center gap-2 self-start"
                >
                  <Sliders className="w-4 h-4" />
                  <span>Configurar Módulos Globales (Root BWP)</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0B1D3A] text-white text-xs font-semibold border-b-2 border-[#D4AF37]">
                      <th className="py-3.5 px-4">Usuario</th>
                      <th className="py-3.5 px-4">Nombre del Responsable</th>
                      <th className="py-3.5 px-4">Rol y Módulos</th>
                      <th className="py-3.5 px-4">Estado</th>
                      <th className="py-3.5 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {/* Fila informativa del SuperUsuario Root BWP */}
                    <tr className="bg-[#F8FAFC]">
                      <td className="py-3.5 px-4 font-mono font-bold text-[#0B1D3A]">
                        @bwp
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[#0B1D3A]">
                        Super Usuario Root (.env)
                      </td>
                      <td className="py-3.5 px-4 text-[#C59B27] font-bold">
                        SuperUsuario · Todos los módulos
                      </td>
                      <td className="py-3.5 px-4 text-emerald-700 font-bold">
                        Activo (Root)
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-400">
                        Protegido (.env)
                      </td>
                    </tr>

                    {users.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-8 px-6 text-center text-slate-500"
                        >
                          No hay otros usuarios creados aún. Crea el primer Administrador
                          en el formulario de la derecha.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.id} className="hover:bg-[#F8FAFC]">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#0B1D3A]">
                            @{u.username}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-[#0B1D3A]">
                            {u.fullName}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-[#0B1D3A]">
                              {u.role}
                            </span>
                            <span className="block text-[11px] text-slate-500">
                              {(u.allowedModules || []).length} módulos habilitados
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={
                                u.isActive
                                  ? 'text-emerald-700 font-semibold'
                                  : 'text-red-600 font-semibold'
                              }
                            >
                              {u.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                            {(currentUser.role === 'SuperUsuario' ||
                              currentUser.role === 'Administrador') && (
                              <button
                                type="button"
                                onClick={() => handleToggleUserActive(u)}
                                className="text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                              >
                                {u.isActive ? 'Desactivar' : 'Activar'}
                              </button>
                            )}
                            {currentUser.role === 'SuperUsuario' && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                              >
                                Eliminar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="lg:col-span-5 bg-white p-6 rounded-xl border border-slate-200 h-fit">
                <h2 className="text-base font-bold text-[#0B1D3A] mb-1">
                  Crear Nuevo Administrador o Usuario
                </h2>
                <p className="text-xs text-slate-500 mb-4">
                  Asigna usuario, contraseña y selecciona qué módulos podrá ver.
                </p>

                {currentUser.role !== 'SuperUsuario' &&
                currentUser.role !== 'Administrador' ? (
                  <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                    Tu cuenta no tiene permisos para crear nuevos usuarios.
                  </p>
                ) : (
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-[#0B1D3A] mb-1">
                        Nombre de usuario
                      </label>
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Nombre de usuario"
                        className="w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-slate-300 text-xs text-[#0B1D3A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#0B1D3A] mb-1">
                        Nombre completo del responsable
                      </label>
                      <input
                        type="text"
                        required
                        value={newUserFullName}
                        onChange={(e) => setNewUserFullName(e.target.value)}
                        placeholder="Nombre y apellido"
                        className="w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-slate-300 text-xs text-[#0B1D3A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#0B1D3A] mb-1">
                        Contraseña segura (mínimo 6 caracteres)
                      </label>
                      <input
                        type="password"
                        required
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Contraseña"
                        className="w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-slate-300 text-xs text-[#0B1D3A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#0B1D3A] mb-1">
                        Rol de acceso
                      </label>
                      <select
                        value={newUserRole}
                        onChange={(e) => {
                          const r = e.target.value as UserRole;
                          setNewUserRole(r);
                          if (r === 'Administrador') {
                            setNewUserModules(adminModsDraft);
                          } else {
                            setNewUserModules(regModsDraft);
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-[#F8FAFC] border border-slate-300 text-xs text-[#0B1D3A]"
                      >
                        <option value="Administrador">Administrador</option>
                        <option value="Registrador">
                          Registrador / Equipo de Bienvenida
                        </option>
                      </select>
                    </div>

                    {currentUser.role === 'SuperUsuario' && (
                      <div>
                        <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                          Módulos que podrá ver este usuario:
                        </label>
                        <div className="grid grid-cols-2 gap-1.5 p-3 rounded-lg bg-[#F8FAFC] border border-slate-200">
                          {ALL_RMS_MODULES.map((m) => {
                            const checked = newUserModules.includes(m.id);
                            return (
                              <label
                                key={m.id}
                                className="flex items-center gap-2 text-xs text-[#0B1D3A] cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    if (checked) {
                                      setNewUserModules(
                                        newUserModules.filter((id) => id !== m.id)
                                      );
                                    } else {
                                      setNewUserModules([...newUserModules, m.id]);
                                    }
                                  }}
                                  className="accent-[#1D4ED8]"
                                />
                                <span className="truncate">{m.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Crear Cuenta de Usuario
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            MÓDULO 8: CONFIGURACIÓN, LOGOTIPO Y COPIAS DE SEGURIDAD
           ===================================================================== */}
        {activeTab === 'configuracion' && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-[#C59B27]">
                PARÁMETROS INSTITUCIONALES Y RESPALDOS
              </p>
              <h1 className="text-2xl font-bold text-[#0B1D3A]">
                Configuración del Sistema
              </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
                <h2 className="text-base font-bold text-[#0B1D3A]">
                  Identidad Visual y Logotipo Oficial
                </h2>
                <p className="text-xs text-slate-600">
                  El logotipo se muestra en el encabezado del formulario público, en el
                  cartel de código QR y en los reportes PDF de{' '}
                  <strong>MINISTERIO VIDA EN LA PALABRA</strong>.
                </p>

                <div className="flex items-center gap-5 p-4 rounded-lg bg-[#F8FAFC] border border-slate-200">
                  <MinistryLogo
                    size="lg"
                    customLogoDataUrl={settings?.customLogoDataUrl}
                  />
                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold transition-colors cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Subir archivo de logotipo (PNG/JPG)</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        onChange={handleLogoFileChange}
                        className="hidden"
                      />
                    </label>

                    {settings?.customLogoDataUrl && (
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch('/api/rms/settings', {
                            method: 'PUT',
                            headers: authHeaders,
                            body: JSON.stringify({ customLogoDataUrl: null }),
                          });
                          await fetchOverview();
                          showToast(
                            'success',
                            'Se restauró el emblema institucional predeterminado.'
                          );
                        }}
                        className="block text-xs text-red-600 hover:underline cursor-pointer"
                      >
                        Restaurar emblema institucional predeterminado
                      </button>
                    )}
                  </div>
                </div>

                <form
                  onSubmit={handleSavePinSetting}
                  className="pt-4 border-t border-slate-200 space-y-3"
                >
                  <label className="block text-xs font-bold text-[#0B1D3A]">
                    PIN de Administrador para corrección de fechas anteriores
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#F8FAFC] border border-slate-300 text-xs font-mono text-[#0B1D3A]"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-[#0B1D3A] text-white text-xs font-bold hover:bg-[#132C57] transition-colors cursor-pointer"
                    >
                      Guardar PIN
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-5">
                <div>
                  <h2 className="text-base font-bold text-[#0B1D3A]">
                    Copias de Seguridad y Base de Datos PostgreSQL
                  </h2>
                  <p className="text-xs text-slate-600 mt-1">
                    Exporta o restaura copias de seguridad completas y descarga el
                    esquema SQL listo para la conexión a PostgreSQL.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-[#0B1D3A]">
                        Respaldo Completo de Datos (JSON)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Incluye las {persons.length} personas y {visits.length}{' '}
                        invitaciones/visitas.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadBackup}
                      className="px-3.5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar Backup</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-[#0B1D3A]">
                        Restaurar Copia de Seguridad
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Importa un archivo de respaldo previamente descargado.
                      </p>
                    </div>
                    <label className="px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-[#0B1D3A] text-xs font-bold transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-[#1D4ED8]" />
                      <span>Restaurar JSON</span>
                      <input
                        type="file"
                        accept="application/json"
                        onChange={handleRestoreBackup}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-[#0B1D3A]">
                        Esquema Relacional PostgreSQL (schema.sql)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Tablas: personas, visitas, formularios y usuarios.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadSqlSchema}
                      className="px-3.5 py-2 rounded-lg bg-[#0B1D3A] hover:bg-[#132C57] text-white text-xs font-bold transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                    >
                      <Database className="w-3.5 h-3.5 text-[#D4AF37]" />
                      <span>Descargar SQL</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto px-6 py-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 print:hidden">
        <span className="font-bold text-[#0B1D3A]">
          MINISTERIO VIDA EN LA PALABRA
        </span>
        <span>
          Sistema de Registro de Amigos Invitados y Verificación de Visitas
        </span>
      </footer>

      {/* =========================================================================
          MODAL DE FICHA PERSONAL E HISTORIAL DE INVITACIONES Y VISITAS
         ========================================================================= */}
      {selectedPerson && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto print:hidden">
          <div className="bg-white w-full max-w-2xl rounded-xl border-2 border-[#D4AF37] shadow-xl overflow-hidden my-8">
            <div className="bg-[#0B1D3A] px-6 py-5 border-b-2 border-[#D4AF37] flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-mono font-bold text-[#D4AF37]">
                  FICHA DE INVITADO · {selectedPerson.formattedCode}
                </p>
                <h2 className="text-xl font-bold text-white mt-0.5">
                  {selectedPerson.fullName}
                </h2>
                <p className="text-xs text-slate-300 font-mono tabular-nums mt-1 flex flex-wrap items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>{selectedPerson.phone}</span>
                  <span>·</span>
                  <span>Vive en: {selectedPerson.address || '—'}</span>
                  <span>·</span>
                  <span>Invitado por: {selectedPerson.invitedByMember}</span>
                  <span>·</span>
                  <strong className="text-[#D4AF37]">
                    {selectedPerson.attendedCount} llegadas confirmadas de{' '}
                    {selectedPerson.visitCount}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPersonId(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Cerrar ficha"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 pt-3 bg-[#F8FAFC] border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPersonModalTab('history')}
                  className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    personModalTab === 'history'
                      ? 'border-[#1D4ED8] text-[#1D4ED8]'
                      : 'border-transparent text-slate-600 hover:text-[#0B1D3A]'
                  }`}
                >
                  Historial y Verificación ({selectedPerson.visitCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPersonModalTab('add_visit')}
                  className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    personModalTab === 'add_visit'
                      ? 'border-[#1D4ED8] text-[#1D4ED8]'
                      : 'border-transparent text-slate-600 hover:text-[#0B1D3A]'
                  }`}
                >
                  + Nueva Invitación / Visita
                </button>
                <button
                  type="button"
                  onClick={() => setPersonModalTab('edit')}
                  className={`px-3.5 py-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                    personModalTab === 'edit'
                      ? 'border-[#1D4ED8] text-[#1D4ED8]'
                      : 'border-transparent text-slate-600 hover:text-[#0B1D3A]'
                  }`}
                >
                  Editar Datos
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  exportPersonHistoryToPDF(
                    selectedPerson,
                    settings?.customLogoDataUrl
                  )
                }
                className="mb-1.5 px-3 py-1.5 rounded bg-[#0B1D3A] hover:bg-[#132C57] text-white text-xs font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Descargar Ficha PDF</span>
              </button>
            </div>

            <div className="p-6">
              {personModalTab === 'history' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 p-3.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs">
                    <div>
                      <p className="text-slate-500">Primera invitación/visita</p>
                      <p className="font-bold text-[#0B1D3A] font-mono tabular-nums mt-0.5">
                        {formatDateSpanishLong(selectedPerson.firstVisitDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Última fecha</p>
                      <p className="font-bold text-[#0B1D3A] font-mono tabular-nums mt-0.5">
                        {formatDateSpanishLong(selectedPerson.lastVisitDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Llegadas confirmadas</p>
                      <p className="font-bold text-emerald-700 font-mono tabular-nums mt-0.5">
                        {selectedPerson.attendedCount} de {selectedPerson.visitCount}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {selectedPerson.visits.map((v, idx) => (
                      <div
                        key={v.id}
                        className="p-3.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-[#0B1D3A] text-[#D4AF37] font-mono text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#0B1D3A]">
                              {getOrdinalVisitLabel(idx + 1)}:{' '}
                              <span className="text-[#1D4ED8]">
                                {formatDateSpanishLong(v.visitDate)}
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                              Invitado por: {v.invitedByMember || v.registeredByName} ·{' '}
                              {v.status === 'attended'
                                ? '✓ Llegó a la invitación'
                                : 'Pendiente de llegar'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {v.status === 'invited' ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleVisitArrival(
                                  v.id,
                                  'attended',
                                  selectedPerson.fullName
                                )
                              }
                              className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Marcar que Llegó</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleToggleVisitArrival(
                                  v.id,
                                  'invited',
                                  selectedPerson.fullName
                                )
                              }
                              className="px-2.5 py-1 rounded border border-slate-300 text-[11px] text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              Llegó ✓ (Cambiar)
                            </button>
                          )}

                          {selectedPerson.visits.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteVisit(v.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                              title="Eliminar este registro"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {personModalTab === 'add_visit' && (
                <form onSubmit={handleAddVisitInModal} className="space-y-4">
                  <div className="p-4 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs text-slate-600">
                    Se añadirá la{' '}
                    <strong className="text-[#0B1D3A]">
                      {getOrdinalVisitLabel(selectedPerson.visitCount + 1)}
                    </strong>{' '}
                    al historial de <strong>{selectedPerson.fullName}</strong>.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                        Fecha de la reunión / visita
                      </label>
                      <input
                        type="date"
                        required
                        value={modalNewVisitDate}
                        onChange={(e) => setModalNewVisitDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono tabular-nums text-[#0B1D3A]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                        Miembro que invita
                      </label>
                      <input
                        type="text"
                        value={modalInvitedByMember}
                        onChange={(e) => setModalInvitedByMember(e.target.value)}
                        placeholder="Nombre del miembro"
                        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0B1D3A]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                      Estado inicial:
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setModalNewVisitStatus('invited')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                          modalNewVisitStatus === 'invited'
                            ? 'bg-[#0B1D3A] text-white border-[#D4AF37]'
                            : 'bg-[#F8FAFC] text-slate-700 border-slate-300'
                        }`}
                      >
                        Invitado (Verificar cuando llegue)
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalNewVisitStatus('attended')}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                          modalNewVisitStatus === 'attended'
                            ? 'bg-emerald-700 text-white border-emerald-900'
                            : 'bg-[#F8FAFC] text-slate-700 border-slate-300'
                        }`}
                      >
                        ✓ Ya llegó a la invitación
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPersonModalTab('history')}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={modalBusy}
                      className="px-5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold cursor-pointer"
                    >
                      {modalBusy ? 'Guardando...' : 'Guardar Registro'}
                    </button>
                  </div>
                </form>
              )}

              {personModalTab === 'edit' && (
                <form onSubmit={handleUpdatePersonInModal} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      required
                      value={editPersonName}
                      onChange={(e) => setEditPersonName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0B1D3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                      Número telefónico
                    </label>
                    <input
                      type="tel"
                      required
                      value={editPersonPhone}
                      onChange={(e) => setEditPersonPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono tabular-nums text-[#0B1D3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                      ¿Dónde vive la persona?
                    </label>
                    <input
                      type="text"
                      value={editPersonAddress}
                      onChange={(e) => setEditPersonAddress(e.target.value)}
                      placeholder="Colonia, barrio o dirección donde vive"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0B1D3A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0B1D3A] mb-1.5">
                      Nombre de quien lo invita
                    </label>
                    <input
                      type="text"
                      value={editPersonInvitedBy}
                      onChange={(e) => setEditPersonInvitedBy(e.target.value)}
                      placeholder="Nombre de la persona que invita"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0B1D3A]"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setPersonModalTab('history')}
                      className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={modalBusy}
                      className="px-5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold cursor-pointer"
                    >
                      {modalBusy ? 'Actualizando...' : 'Guardar Cambios'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="px-6 py-3 bg-[#F8FAFC] border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>MINISTERIO VIDA EN LA PALABRA</span>
              <button
                type="button"
                onClick={() => setSelectedPersonId(null)}
                className="font-semibold text-[#0B1D3A] hover:underline cursor-pointer"
              >
                Cerrar ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
