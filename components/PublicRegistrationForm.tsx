'use client';

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  MapPin,
  Phone,
  User,
  AlertCircle,
  RotateCcw,
  UserCheck,
  UserPlus,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { MinistryLogo } from './MinistryLogo';
import {
  formatDateSpanishLong,
  getHondurasDateString,
  validatePhoneNumber,
} from '@/lib/date-utils';

interface PublicRegistrationFormProps {
  formSlug?: string;
  onSuccessRegistered?: () => void;
}

export function PublicRegistrationForm({
  formSlug = 'visitantes',
  onSuccessRegistered,
}: PublicRegistrationFormProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [invitedByMember, setInvitedByMember] = useState('');
  const [hondurasToday, setHondurasToday] = useState<string>(() =>
    getHondurasDateString()
  );
  const [visitDate, setVisitDate] = useState<string>(() => getHondurasDateString());
  const [defaultMemberFromLink, setDefaultMemberFromLink] = useState<string>('');
  const [customLogoDataUrl, setCustomLogoDataUrl] = useState<string | null>(null);
  const [formActive, setFormActive] = useState<boolean>(true);
  const [formLoading, setFormLoading] = useState(true);
  const [formName, setFormName] = useState<string>('');
  const [isAdminSession, setIsAdminSession] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setFormLoading(true);
    setErrorMessage(null);
    async function loadFormMeta() {
      try {
        const res = await fetch(
          `/api/public/form?slug=${encodeURIComponent(formSlug)}`
        );
        if (!res.ok) {
          if (active) {
            setFormActive(false);
            setErrorMessage('Este formulario no está disponible. Comprueba el enlace o inténtalo más tarde.');
          }
          return;
        }
        const data = await res.json();
        if (!active) return;
        if (data.hondurasToday) {
          setHondurasToday(data.hondurasToday);
          setVisitDate(data.hondurasToday);
        }
        setCustomLogoDataUrl(data.customLogoDataUrl || null);
        if (data.isAdminAuthenticated) {
          setIsAdminSession(true);
        }
        setIsAdminSession(Boolean(data.isAdminAuthenticated));
        if (data.form) {
          setFormActive(Boolean(data.form.isActive));
          setFormName(data.form.name || '');
          const mName = data.form.memberName || '';
          setDefaultMemberFromLink(mName);
          if (mName && mName !== 'Miembros de la Iglesia') {
            setInvitedByMember(mName);
          }
        }
      } catch {
        if (active) {
          setFormActive(false);
          setErrorMessage('No se pudo cargar el formulario. Inténtalo nuevamente.');
        }
      } finally {
        if (active) setFormLoading(false);
      }
    }
    loadFormMeta();
    return () => {
      active = false;
    };
  }, [formSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMessage(
        'Por favor ingresa el nombre completo de la persona invitada.'
      );
      return;
    }

    const phoneCheck = validatePhoneNumber(phone);
    if (!phoneCheck.valid) {
      setErrorMessage(phoneCheck.error || 'Ingresa un número telefónico válido.');
      return;
    }

    if (!address.trim() || address.trim().length < 2) {
      setErrorMessage(
        'Por favor ingresa dónde vive la persona (colonia, barrio o dirección).'
      );
      return;
    }

    const effectiveInviter =
      invitedByMember.trim() || defaultMemberFromLink.trim();

    if (!effectiveInviter || effectiveInviter.length < 2) {
      setErrorMessage('Por favor ingresa el nombre de quien lo invita.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/public/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          invitedByMember: effectiveInviter,
          visitDate,
          formSlug,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'No se pudo completar el registro.');
        setSubmitting(false);
        return;
      }

      setSubmittedMessage(
        data.message ||
          'Invitado registrado correctamente'
      );
      setSubmitting(false);
      if (onSuccessRegistered) {
        onSuccessRegistered();
      }
    } catch {
      setErrorMessage(
        'Error de conexión al guardar el registro. Por favor intenta de nuevo.'
      );
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setFullName('');
    setPhone('');
    setAddress('');
    setInvitedByMember(invitedByMember || defaultMemberFromLink);
    setVisitDate(hondurasToday);
    setErrorMessage(null);
    setSubmittedMessage(null);
  };

  const inputClass = 'w-full min-w-0 rounded-xl border border-slate-200 bg-white py-3.5 pl-11 pr-4 text-base sm:text-sm text-[#0B1D3A] placeholder:text-slate-400 outline-none transition focus:border-[#C59B27] focus:ring-4 focus:ring-[#D4AF37]/15';
  const labelClass = 'mb-2 block text-sm font-semibold text-[#0B1D3A]';
  const iconClass = 'pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400';

  return (
    <main className="min-h-screen bg-[#F3F5F8] px-4 py-6 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-center gap-3 sm:mb-8">
          <MinistryLogo size="md" customLogoDataUrl={customLogoDataUrl} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#9B7925]">Ministerio</p>
            <p className="text-sm font-bold tracking-tight text-[#0B1D3A] sm:text-base">VIDA EN LA PALABRA</p>
          </div>
        </div>

        <article className="overflow-hidden rounded-2xl border border-[#0B1D3A]/10 bg-white shadow-[0_16px_60px_-24px_rgba(11,29,58,0.28)] sm:rounded-3xl">
          <header className="relative overflow-hidden bg-[#0B1D3A] px-6 py-8 sm:px-10 sm:py-10">
            <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-24 h-72 w-72 rounded-full border border-[#D4AF37]/15" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 -right-4 h-72 w-72 rounded-full border border-white/5" />
            <div className="relative">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#E5CB7B]">
                <UserPlus className="h-3.5 w-3.5" />
                Invitaciones de la iglesia
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Registro de invitados</h1>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-300 sm:text-base">
                Hermano, registra aquí a la persona que estás invitando.
              </p>
              {defaultMemberFromLink && (
                <div className="mt-5 flex items-center gap-2 text-xs text-[#E5CB7B]">
                  <UserCheck className="h-4 w-4 shrink-0" />
                  <span>Invita: <strong className="font-semibold">{defaultMemberFromLink}</strong></span>
                </div>
              )}
              {!defaultMemberFromLink && formSlug !== 'visitantes' && formName && (
                <p className="mt-5 text-xs text-[#E5CB7B]">{formName}</p>
              )}
            </div>
            <div aria-hidden="true" className="absolute bottom-0 left-6 h-0.5 w-16 rounded-full bg-[#D4AF37] sm:left-10" />
          </header>

          {formLoading ? (
            <div className="flex items-center justify-center gap-3 px-6 py-16 text-sm text-slate-500" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-[#9B7925]" />
              Cargando formulario…
            </div>
          ) : !formActive ? (
            <div className="px-6 py-12 text-center sm:px-10" role="alert">
              <AlertCircle className="mx-auto mb-4 h-10 w-10 text-[#9B7925]" />
              <h2 className="text-lg font-bold text-[#0B1D3A]">Formulario no disponible</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                {errorMessage || 'Este enlace de invitación está desactivado temporalmente. Consulta con el equipo de la iglesia.'}
              </p>
            </div>
          ) : submittedMessage ? (
            <div className="px-6 py-10 text-center sm:px-10 sm:py-14" role="status" aria-live="polite">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10">
                <CheckCircle2 className="h-8 w-8 text-[#9B7925]" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#0B1D3A]">Invitado registrado</h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
                Hermano, la invitación quedó guardada. Gracias por ayudarnos a preparar la bienvenida.
              </p>
              <dl className="mx-auto mt-7 max-w-md divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-5 text-left text-sm">
                <div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-slate-500">Invitado</dt><dd className="break-words font-semibold text-[#0B1D3A]">{fullName}</dd></div>
                <div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-slate-500">Hermano que invita</dt><dd className="break-words font-semibold text-[#0B1D3A]">{invitedByMember || defaultMemberFromLink}</dd></div>
                <div className="flex flex-wrap justify-between gap-2 py-4"><dt className="text-slate-500">Fecha de visita</dt><dd className="font-semibold text-[#0B1D3A]">{formatDateSpanishLong(visitDate)}</dd></div>
              </dl>
              <button type="button" onClick={handleReset} className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0B1D3A] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#16345C] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C59B27] cursor-pointer">
                <RotateCcw className="h-4 w-4" />Registrar otro invitado
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className="px-6 pb-7 pt-7 sm:px-10 sm:pb-8 sm:pt-8">
                {errorMessage && (
                  <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{errorMessage}</span>
                  </div>
                )}
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0B1D3A]/5 text-xs font-bold text-[#0B1D3A]">01</span>
                  <div><h2 className="text-sm font-bold text-[#0B1D3A]">Datos del invitado</h2><p className="mt-0.5 text-xs text-slate-500">La persona que nos acompañará.</p></div>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="visitor-fullname" className={labelClass}>Nombre del invitado <span className="text-[#9B7925]" aria-hidden="true">*</span></label>
                    <div className="relative"><User className={iconClass} /><input id="visitor-fullname" name="guest-name" type="text" required maxLength={160} autoComplete="off" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre y apellidos del invitado" className={inputClass} /></div>
                  </div>
                  <div>
                    <label htmlFor="visitor-phone" className={labelClass}>Teléfono del invitado <span className="text-[#9B7925]" aria-hidden="true">*</span></label>
                    <div className="relative"><Phone className={iconClass} /><input id="visitor-phone" name="guest-phone" type="tel" required autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej. 9999-9999" className={inputClass} /></div>
                  </div>
                  <div>
                    <label htmlFor="visitor-address" className={labelClass}>Dónde vive <span className="text-[#9B7925]" aria-hidden="true">*</span></label>
                    <div className="relative"><MapPin className={iconClass} /><input id="visitor-address" name="guest-address" type="text" required autoComplete="off" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Colonia, barrio o dirección" className={inputClass} /></div>
                  </div>
                </div>
              </div>

              <div className="border-y border-slate-100 bg-[#F8FAFC] px-6 py-7 sm:px-10 sm:py-8">
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/15 text-xs font-bold text-[#9B7925]">02</span>
                  <div><h2 className="text-sm font-bold text-[#0B1D3A]">Tu invitación</h2><p className="mt-0.5 text-xs text-slate-500">Indica quién invita y el día de la visita.</p></div>
                </div>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="visitor-inviter" className={labelClass}>Hermano que lo invita <span className="text-[#9B7925]" aria-hidden="true">*</span></label>
                    <div className="relative"><UserCheck className={iconClass} /><input id="visitor-inviter" name="member-name" type="text" required autoComplete="name" value={invitedByMember} onChange={(e) => setInvitedByMember(e.target.value)} placeholder="Tu nombre y apellidos" className={inputClass} /></div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">Si tú realizaste la invitación, escribe tu nombre.</p>
                  </div>
                  <div>
                    <label htmlFor="visitor-date" className={labelClass}>Fecha de visita <span className="text-[#9B7925]" aria-hidden="true">*</span></label>
                    <div className="relative"><Calendar className={iconClass} /><input id="visitor-date" name="visit-date" type="date" required value={visitDate} min={isAdminSession ? undefined : hondurasToday} onChange={(e) => setVisitDate(e.target.value || hondurasToday)} className={inputClass} /></div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">Selecciona el día en que asistirá a la reunión.</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 sm:px-10 sm:py-7">
                <p className="mb-4 text-xs text-slate-500"><span className="text-[#9B7925]">*</span> Todos los campos son obligatorios.</p>
                <button type="submit" disabled={submitting} className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-[#0B1D3A] px-5 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#16345C] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C59B27] disabled:cursor-wait disabled:opacity-60">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 text-[#E5CB7B]" />}
                  <span>{submitting ? 'Guardando invitado…' : 'Registrar invitado'}</span>
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </button>
              </div>
            </form>
          )}
        </article>
        <footer className="px-3 pb-2 pt-6 text-center text-[11px] leading-relaxed text-slate-500">
          Ministerio Vida en la Palabra <span className="mx-1 text-[#C59B27]" aria-hidden="true">·</span> Unidos para recibir a cada invitado
        </footer>
      </div>
    </main>
  );
}
