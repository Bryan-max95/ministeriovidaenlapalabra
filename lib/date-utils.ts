/**
 * Utilidades de fecha y hora para Honduras (America/Tegucigalpa, UTC-6)
 * y validación de números telefónicos.
 */

export const HONDURAS_TIMEZONE = 'America/Tegucigalpa';

/**
 * Obtiene la fecha actual en Honduras en formato YYYY-MM-DD
 */
export function getHondurasDateString(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: HONDURAS_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    // Fallback UTC-6 calculation
    const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
    const hnDate = new Date(utcMs - 6 * 3600000);
    return hnDate.toISOString().split('T')[0];
  }
}

/**
 * Formatea una fecha YYYY-MM-DD en español institucional
 * Ejemplo: "21 de octubre de 2026"
 */
export function formatDateSpanishLong(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const months = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];

  if (month < 0 || month > 11 || isNaN(day) || isNaN(year)) return dateStr;
  return `${day} de ${months[month]} de ${year}`;
}

/**
 * Formatea una fecha YYYY-MM-DD en formato corto legible
 * Ejemplo: "21 oct 2026"
 */
export function formatDateSpanishShort(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const monthsShort = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];

  if (month < 0 || month > 11 || isNaN(day) || isNaN(year)) return dateStr;
  return `${String(day).padStart(2, '0')} ${monthsShort[month]} ${year}`;
}

/**
 * Formatea un timestamp ISO a fecha y hora de Honduras
 */
export function formatDateTimeHonduras(isoStr: string): string {
  if (!isoStr) return '—';
  try {
    const date = new Date(isoStr);
    return new Intl.DateTimeFormat('es-HN', {
      timeZone: HONDURAS_TIMEZONE,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return isoStr;
  }
}

/**
 * Normaliza un número telefónico para comparaciones y detección de duplicados.
 * Si tiene prefijo +504 y 8 dígitos locales, conserva los 8 dígitos locales para coincidencia exacta.
 */
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('504')) {
    return digits.slice(3);
  }
  return digits;
}

/**
 * Formatea un número telefónico para visualización limpia
 */
export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.trim();
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  if (digits.length === 11 && digits.startsWith('504')) {
    const local = digits.slice(3);
    return `+504 ${local.slice(0, 4)}-${local.slice(4)}`;
  }
  return cleaned;
}

/**
 * Valida que el número telefónico tenga un formato razonable (7 a 15 dígitos numéricos,
 * permitiendo espacios, guiones, paréntesis y signo +) sin limitarlo a un único operador.
 */
export function validatePhoneNumber(phone: string): { valid: boolean; error?: string } {
  const trimmed = phone.trim();
  if (!trimmed) {
    return { valid: false, error: 'El número telefónico es obligatorio.' };
  }
  if (!/^[0-9+\-\s()]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'El teléfono solo puede contener números, espacios, guiones o el signo +.',
    };
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return {
      valid: false,
      error: 'Ingresa un número telefónico válido (mínimo 8 dígitos en Honduras, ej. 9876-5432).',
    };
  }
  return { valid: true };
}

/**
 * Normaliza un nombre para comparaciones insensibles a mayúsculas/acentos
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Calcula el inicio de la semana (lunes) y fin de la semana (domingo) para una fecha YYYY-MM-DD
 */
export function getWeekBounds(dateStr: string): { start: string; end: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dayOfWeek = date.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

/**
 * Etiqueta ordinal de visita en español (Primera visita, Segunda visita, etc.)
 */
export function getOrdinalVisitLabel(indexOneBased: number): string {
  const ordinals: Record<number, string> = {
    1: 'Primera visita',
    2: 'Segunda visita',
    3: 'Tercera visita',
    4: 'Cuarta visita',
    5: 'Quinta visita',
    6: 'Sexta visita',
    7: 'Séptima visita',
    8: 'Octava visita',
    9: 'Novena visita',
    10: 'Décima visita',
  };
  return ordinals[indexOneBased] || `Visita #${indexOneBased}`;
}
