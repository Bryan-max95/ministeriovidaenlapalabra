import { jsPDF } from 'jspdf';
import { PersonWithVisits, VisitWithPerson } from './types';
import {
  formatDateSpanishLong,
  formatDateTimeHonduras,
  getOrdinalVisitLabel,
} from './date-utils';

export interface ReportFilterSummary {
  title: string;
  periodLabel: string;
  totalVisits: number;
  uniquePersons: number;
  returningPersons: number;
}

/**
 * Descarga un archivo CSV con BOM UTF-8 compatible con Microsoft Excel
 */
export function exportVisitsToCSV(
  visits: VisitWithPerson[],
  filenamePrefix = 'reporte_invitados_mvp'
) {
  const headers = [
    'ID Registro',
    'No. Ficha',
    'Nombre del Amigo / Invitado',
    'Número Telefónico',
    'Dónde Vive',
    'Nombre de Quien lo Invita',
    'Fecha de Reunión / Visita',
    'Estado de Invitación',
    'No. de Visita',
    'Total Invitaciones / Visitas',
    'Fecha y Hora de Registro',
  ];

  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = visits.map((v) => [
    v.id,
    v.personFormattedCode,
    v.personName,
    v.personPhone,
    v.personAddress || '—',
    v.invitedByMember || v.registeredByName,
    v.visitDate,
    v.status === 'attended' ? 'Llegó a la invitación' : 'Invitado (Pendiente de llegar)',
    getOrdinalVisitLabel(v.visitNumberForPerson),
    v.totalVisitsForPerson,
    formatDateTimeHonduras(v.registeredAt),
  ]);

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join(
      '\r\n'
    );

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Descarga un archivo Excel (.xls HTML/XML) con formato institucional de MINISTERIO VIDA EN LA PALABRA
 */
export function exportVisitsToExcel(
  visits: VisitWithPerson[],
  summary: ReportFilterSummary,
  filenamePrefix = 'reporte_invitados_mvp'
) {
  const escapeHtml = (str: string | number) =>
    String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const rowsHtml = visits
    .map(
      (v, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px; font-family: monospace;">${escapeHtml(v.personFormattedCode)}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px; font-weight: bold;">${escapeHtml(v.personName)}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px;">${escapeHtml(v.personPhone)}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px;">${escapeHtml(v.personAddress || '—')}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px;">${escapeHtml(
          v.invitedByMember || v.registeredByName
        )}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px;">${escapeHtml(v.visitDate)}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px; font-weight: bold; color: ${
          v.status === 'attended' ? '#15803D' : '#B45309'
        };">${escapeHtml(
          v.status === 'attended'
            ? 'Llegó a la invitación'
            : 'Pendiente de llegar'
        )}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px;">${escapeHtml(getOrdinalVisitLabel(v.visitNumberForPerson))}</td>
        <td style="border: 1px solid #CBD5E1; padding: 6px 10px; text-align: center;">${escapeHtml(v.totalVisitsForPerson)}</td>
      </tr>`
    )
    .join('');

  const excelHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8" />
    </head>
    <body>
      <table>
        <tr>
          <td colspan="9" style="background-color: #0B1D3A; color: #FFFFFF; font-size: 16pt; font-weight: bold; padding: 12px; text-align: center; border-bottom: 3px solid #D4AF37;">
            MINISTERIO VIDA EN LA PALABRA
          </td>
        </tr>
        <tr>
          <td colspan="9" style="background-color: #F1F5F9; color: #0B1D3A; font-size: 11pt; padding: 8px; text-align: center;">
            ${escapeHtml(summary.title)} — Período: ${escapeHtml(summary.periodLabel)}
          </td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 6px; font-weight: bold;">Total Registros: ${summary.totalVisits}</td>
          <td colspan="3" style="padding: 6px; font-weight: bold;">Personas Únicas: ${summary.uniquePersons}</td>
          <td colspan="3" style="padding: 6px; font-weight: bold;">Recurrentes: ${summary.returningPersons}</td>
        </tr>
        <tr style="background-color: #1D4ED8; color: #FFFFFF; font-weight: bold;">
          <th style="border: 1px solid #0B1D3A; padding: 8px;">No. Registro</th>
          <th style="border: 1px solid #0B1D3A; padding: 8px;">Nombre del Invitado</th>
          <th style="border: 1px solid #0B1D3A; padding: 8px;">Teléfono</th>
          <th style="border: 1px solid #0B1D3A; padding: 8px;">Dónde Vive</th>
          <th style="border: 1px solid #0B1D3A; padding: 8px;">Nombre de Quien Invita</th>
          <th style="border: 1px solid #0B1D3A; padding: 8px;">Fecha Reunión</th>
          <th style="border: 1px solid #0B1D3A; padding: 8px;">Verificación</th>
          <th style="border: 1px solid #0B1D3A; padding: 8px;">Visita No.</th>
          <th style="border: 1px solid #0B1D3A; padding: 8px;">Total</th>
        </tr>
        ${rowsHtml}
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + excelHtml], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  triggerDownload(blob, `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xls`);
}

/**
 * Genera un informe PDF institucional con el logotipo y nombre de MINISTERIO VIDA EN LA PALABRA
 */
export function exportVisitsToPDF(
  visits: VisitWithPerson[],
  summary: ReportFilterSummary,
  customLogoDataUrl?: string | null,
  filenamePrefix = 'informe_invitados_mvp'
) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const drawHeader = (pageNumber: number) => {
    doc.setFillColor(11, 29, 58);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setFillColor(212, 175, 55);
    doc.rect(0, 28, pageWidth, 2, 'F');

    if (customLogoDataUrl && customLogoDataUrl.startsWith('data:image/png')) {
      try {
        doc.addImage(customLogoDataUrl, 'PNG', 12, 4, 20, 20);
      } catch {
        drawVectorSeal(doc, 22, 14);
      }
    } else {
      drawVectorSeal(doc, 22, 14);
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('MINISTERIO VIDA EN LA PALABRA', 36, 12);

    doc.setTextColor(212, 175, 55);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('REGISTRO DE INVITADOS Y VERIFICACIÓN DE VISITAS (RMS)', 36, 18);

    doc.setTextColor(226, 232, 240);
    doc.setFontSize(8.5);
    doc.text(`${summary.title} — ${summary.periodLabel}`, 36, 23.5);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.text(
      `Emitido: ${formatDateTimeHonduras(new Date().toISOString())}`,
      pageWidth - 12,
      12,
      { align: 'right' }
    );
    doc.text(`Página ${pageNumber}`, pageWidth - 12, 20, { align: 'right' });
  };

  drawHeader(1);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.3);
  doc.roundedRect(12, 34, pageWidth - 24, 14, 2, 2, 'FD');

  doc.setTextColor(11, 29, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Total de Invitaciones/Visitas: ${summary.totalVisits}`, 18, 42.5);
  doc.text(`Personas Únicas: ${summary.uniquePersons}`, 105, 42.5);
  doc.text(`Personas que Han Regresado (>1 visita): ${summary.returningPersons}`, 185, 42.5);

  let y = 54;
  const colX = [12, 32, 82, 114, 158, 184, 224];
  const drawTableHeader = (topY: number) => {
    doc.setFillColor(29, 78, 216);
    doc.rect(12, topY, pageWidth - 24, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Código', colX[0] + 2, topY + 5.5);
    doc.text('Nombre del Invitado', colX[1] + 2, topY + 5.5);
    doc.text('Teléfono', colX[2] + 2, topY + 5.5);
    doc.text('Dónde Vive', colX[3] + 2, topY + 5.5);
    doc.text('Fecha', colX[4] + 2, topY + 5.5);
    doc.text('Estado Llegada', colX[5] + 2, topY + 5.5);
    doc.text('Quien lo Invita', colX[6] + 2, topY + 5.5);
  };

  drawTableHeader(y);
  y += 8;

  let pageNumber = 1;

  visits.forEach((v, idx) => {
    if (y > pageHeight - 20) {
      drawFooter(doc, pageWidth, pageHeight);
      doc.addPage();
      pageNumber += 1;
      drawHeader(pageNumber);
      y = 35;
      drawTableHeader(y);
      y += 8;
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(12, y, pageWidth - 24, 7.2, 'F');
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.15);
    doc.line(12, y + 7.2, pageWidth - 12, y + 7.2);

    doc.setTextColor(15, 23, 42);
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.text(v.personFormattedCode, colX[0] + 2, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.text(v.personName.slice(0, 26), colX[1] + 2, y + 5);

    doc.setFont('courier', 'normal');
    doc.text(v.personPhone.slice(0, 15), colX[2] + 2, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.text((v.personAddress || '—').slice(0, 23), colX[3] + 2, y + 5);

    doc.text(v.visitDate, colX[4] + 2, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.text(
      v.status === 'attended' ? 'Llegó (Confirmado)' : 'Pendiente',
      colX[5] + 2,
      y + 5
    );

    doc.setFont('helvetica', 'normal');
    doc.text(
      (v.invitedByMember || v.registeredByName).slice(0, 28),
      colX[6] + 2,
      y + 5
    );

    y += 7.2;
  });

  drawFooter(doc, pageWidth, pageHeight);
  doc.save(`${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Genera un informe PDF individual con el historial completo de una persona
 */
export function exportPersonHistoryToPDF(
  person: PersonWithVisits,
  customLogoDataUrl?: string | null
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(11, 29, 58);
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setFillColor(212, 175, 55);
  doc.rect(0, 30, pageWidth, 2, 'F');

  if (customLogoDataUrl && customLogoDataUrl.startsWith('data:image/png')) {
    try {
      doc.addImage(customLogoDataUrl, 'PNG', 12, 5, 20, 20);
    } catch {
      drawVectorSeal(doc, 22, 15);
    }
  } else {
    drawVectorSeal(doc, 22, 15);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('MINISTERIO VIDA EN LA PALABRA', 36, 13);

  doc.setTextColor(212, 175, 55);
  doc.setFontSize(9.5);
  doc.text('FICHA OFICIAL E HISTORIAL DE INVITACIONES Y VISITAS', 36, 19.5);

  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Generado el ${formatDateTimeHonduras(new Date().toISOString())}`,
    36,
    25
  );

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, 38, pageWidth - 28, 38, 2, 2, 'FD');

  doc.setTextColor(11, 29, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(person.fullName, 20, 47);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Número de Registro: ${person.formattedCode}`, 20, 54);
  doc.text(`Número Telefónico: ${person.phone}`, 20, 60);
  doc.text(`Dónde Vive: ${person.address || '—'}`, 20, 66);
  doc.text(`Invitado por: ${person.invitedByMember}`, 20, 72);

  doc.setFont('helvetica', 'bold');
  doc.text(
    `Visitas Confirmadas: ${person.attendedCount} de ${person.visitCount}`,
    pageWidth - 20,
    47,
    { align: 'right' }
  );
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Última Fecha: ${formatDateSpanishLong(person.lastVisitDate)}`,
    pageWidth - 20,
    54,
    { align: 'right' }
  );

  let y = 84;
  doc.setFillColor(29, 78, 216);
  doc.rect(14, y, pageWidth - 28, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Orden', 18, y + 5.5);
  doc.text('Fecha de Reunión', 54, y + 5.5);
  doc.text('Estado de Llegada', 105, y + 5.5);
  doc.text('Nombre de Quien Invitó', 150, y + 5.5);

  y += 8;
  person.visits.forEach((v, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y, pageWidth - 28, 8, 'F');
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(14, y + 8, pageWidth - 14, y + 8);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(getOrdinalVisitLabel(idx + 1), 18, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.text(formatDateSpanishLong(v.visitDate), 54, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.text(
      v.status === 'attended' ? 'Llegó a la invitación' : 'Pendiente de llegar',
      105,
      y + 5.5
    );

    doc.setFont('helvetica', 'normal');
    doc.text(
      (v.invitedByMember || v.registeredByName).slice(0, 22),
      150,
      y + 5.5
    );

    y += 8;
  });

  drawFooter(doc, pageWidth, pageHeight);
  doc.save(`ficha_${person.formattedCode}_${person.fullName.replace(/\s+/g, '_')}.pdf`);
}

function drawVectorSeal(doc: jsPDF, cx: number, cy: number) {
  doc.setFillColor(15, 37, 71);
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.7);
  doc.circle(cx, cy, 8.5, 'FD');

  doc.setLineWidth(0.3);
  doc.circle(cx, cy, 7.1, 'S');

  doc.setTextColor(212, 175, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('MVP', cx, cy + 1, { align: 'center' });
}

function drawFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.4);
  doc.line(12, pageHeight - 12, pageWidth - 12, pageHeight - 12);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(
    'MINISTERIO VIDA EN LA PALABRA — Sistema Oficial de Registro de Invitados y Control de Visitas',
    pageWidth / 2,
    pageHeight - 7,
    { align: 'center' }
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
