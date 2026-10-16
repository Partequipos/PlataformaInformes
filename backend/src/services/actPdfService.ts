import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

type ActPhoto = {
  file_path: string;
  mime_type?: string;
  photo_name?: string;
  original_name?: string;
  filename?: string;
};

export type ActPdfInput = {
  act_type: string;
  location?: string;
  act_date?: string;
  equipment_type?: string;
  line_series?: string;
  model_type?: string;
  pin_serial?: string;
  engine_number?: string;
  internal_code?: string;
  manufacture_date?: string;
  hourmeter?: number | string | null;
  gps_serial?: string;
  gps_install_date?: string;
  motive?: string;
  works?: string;
  mechanical_state?: string;
  lubrication?: string;
  operation_test?: string;
  deliverer_name?: string;
  deliverer_cc?: string;
  deliverer_signature?: string;
  receiver_name?: string;
  receiver_cc?: string;
  receiver_signature?: string;
  inspection?: Record<string, Record<string, string>>;
  photos?: ActPhoto[];
};

const LOGO_URL =
  'https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png';

const RATING_LABEL: Record<string, string> = {
  bueno: 'Bueno',
  regular: 'Regular',
  malo: 'Malo',
  na: 'No Aplica',
};

const INSPECTION_SECTIONS: Array<{ id: string; title: string; items: Array<{ key: string; label: string }> }> = [
  {
    id: 'exterior',
    title: '1. Inspección Exterior',
    items: [
      { key: 'pintura_general', label: 'Pintura General' },
      { key: 'estado_estructura', label: 'Estado general estructura' },
      { key: 'logos', label: 'Logos' },
      { key: 'calcomanias', label: 'Calcomanías' },
      { key: 'rayones', label: 'Rayones' },
      { key: 'golpes', label: 'Golpes' },
      { key: 'corrosion', label: 'Corrosión' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'cabina',
    title: '2. Cabina / Estación del Operador',
    items: [
      { key: 'vidrios', label: 'Vidrios' },
      { key: 'puertas', label: 'Puertas' },
      { key: 'cerraduras', label: 'Cerraduras' },
      { key: 'espejos', label: 'Espejos' },
      { key: 'asiento', label: 'Asiento' },
      { key: 'cinturon', label: 'Cinturón' },
      { key: 'tablero', label: 'Tablero' },
      { key: 'manual_operador', label: 'Manual del operador' },
      { key: 'llaves', label: 'Llaves' },
      { key: 'herramientas', label: 'Herramientas' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'fluidos',
    title: '3. Niveles de fluidos',
    items: [
      { key: 'aceite_motor', label: 'Aceite de motor' },
      { key: 'aceite_hidraulico', label: 'Aceite hidráulico' },
      { key: 'aceite_transmision', label: 'Aceite de transmisión' },
      { key: 'refrigerante', label: 'Refrigerante' },
      { key: 'combustible', label: 'Combustible' },
      { key: 'urea', label: 'Nivel de Urea' },
      { key: 'limpiaparabrisas', label: 'Líquido limpiaparabrisas' },
      { key: 'fugas', label: 'Verificación de fugas' },
      { key: 'tapas', label: 'Tapas de los depósitos' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'hidraulico',
    title: '4. Sistema Hidráulico',
    items: [
      { key: 'mangueras', label: 'Mangueras y tubos' },
      { key: 'cilindros', label: 'Cilindros' },
      { key: 'conexiones', label: 'Conexiones' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'implementos',
    title: '5. Implementos',
    items: [
      { key: 'balde', label: 'Balde' },
      { key: 'brazos', label: 'Brazos' },
      { key: 'cucharon', label: 'Cucharón' },
      { key: 'acoples', label: 'Acoples' },
      { key: 'dientes', label: 'Dientes' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'rodaje',
    title: '6. Tren de rodaje',
    items: [
      { key: 'llantas', label: 'Llantas' },
      { key: 'orugas', label: 'Orugas' },
      { key: 'rines', label: 'Rines' },
      { key: 'rodillos', label: 'Rodillos' },
      { key: 'tensor', label: 'Tensor' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'electrico',
    title: '7. Sistema eléctrico',
    items: [
      { key: 'luces', label: 'Luces' },
      { key: 'farolas', label: 'Farolas' },
      { key: 'alarma_reversa', label: 'Alarma de reversa' },
      { key: 'bocina', label: 'Bocina' },
      { key: 'bateria', label: 'Batería' },
      { key: 'cables', label: 'Cables' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'ventilacion',
    title: '8. Sistema de ventilación',
    items: [
      { key: 'radiador', label: 'Radiador' },
      { key: 'ventilador', label: 'Ventilador de motor' },
      { key: 'aire_acondicionado', label: 'Aire Acondicionado' },
      { key: 'correa_poleas', label: 'Correa y poleas' },
      { key: 'otros', label: 'Otros' },
    ],
  },
  {
    id: 'motor',
    title: '9. Motor',
    items: [
      { key: 'motor', label: 'Motor' },
      { key: 'compartimiento', label: 'Estado compartimiento motor' },
      { key: 'tapas', label: 'Tapas y cubiertas' },
      { key: 'cableado', label: 'Cableado' },
      { key: 'correa_poleas', label: 'Correa y poleas' },
      { key: 'otros', label: 'Otros' },
    ],
  },
];

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const withBreaks = (value?: string | null): string =>
  escapeHtml(value || '—').replace(/\n/g, '<br>');

const actTitle = (type: string): string => {
  if (type === 'exit') return 'Acta de Salida';
  if (type === 'delivery') return 'Acta de Entrega';
  return 'Acta de Entrada';
};

async function logoDataUrl(): Promise<string> {
  try {
    const response = await axios.get(LOGO_URL, { responseType: 'arraybuffer' });
    const base64 = Buffer.from(response.data).toString('base64');
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error('Act PDF logo download failed:', error);
    return '';
  }
}

async function photoDataUrl(photo: ActPhoto): Promise<string> {
  const mime = (photo.mime_type || 'image/jpeg').toLowerCase();
  if (mime.startsWith('video/')) return '';
  try {
    let buffer: Buffer;
    if (photo.file_path.startsWith('http')) {
      const response = await axios.get(photo.file_path, { responseType: 'arraybuffer' });
      buffer = Buffer.from(response.data);
    } else {
      const imagePath = path.join(__dirname, '..', '..', photo.file_path);
      buffer = await fs.promises.readFile(imagePath);
    }
    const name = escapeHtml(photo.photo_name || photo.original_name || photo.filename || 'Foto');
    return `<div class="photo-card"><img src="data:${mime};base64,${buffer.toString('base64')}" alt="${name}" /><div class="photo-name">${name}</div></div>`;
  } catch (error) {
    console.error('Act PDF photo skipped:', photo.file_path, error);
    return '';
  }
}

const infoItem = (label: string, value?: string | null): string =>
  `<div class="info-item"><strong>${escapeHtml(label)}</strong><br>${withBreaks(value)}</div>`;

function inspectionHtml(act: ActPdfInput): string {
  return INSPECTION_SECTIONS.map((section) => {
    const rows = section.items
      .map((item) => {
        const rating = act.inspection?.[section.id]?.[item.key] || '';
        return `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(RATING_LABEL[rating] || '—')}</td></tr>`;
      })
      .join('');
    const comments = withBreaks(act.inspection?.[section.id]?.comentarios);
    return `
      <div class="section">
        <h2>${escapeHtml(section.title)}</h2>
        <table class="rating-table"><tbody>${rows}</tbody></table>
        <p><strong>Comentarios:</strong> ${comments}</p>
      </div>`;
  }).join('');
}

function bodySections(act: ActPdfInput): string {
  if (act.act_type === 'delivery') {
    return inspectionHtml(act);
  }
  const isEntry = act.act_type === 'entry';
  const motiveTitle = isEntry
    ? 'Motivo de ingreso y trabajos a realizar'
    : 'Motivo de salida y trabajos realizados';
  const stateTitle = isEntry
    ? 'Estado del equipo y condiciones de entrada'
    : 'Estado del equipo y condiciones de salida';
  const phrase = isEntry
    ? 'se recibe en taller bajo las siguientes condiciones'
    : 'se entrega al operador bajo las siguientes condiciones';
  return `
    <div class="section">
      <h2>${escapeHtml(motiveTitle)}</h2>
      <p><strong>${isEntry ? 'Motivo de ingreso' : 'Motivo de salida'}:</strong> ${withBreaks(act.motive)}</p>
      <p><strong>${isEntry ? 'Trabajos a realizar' : 'Trabajos efectuados'}:</strong> ${withBreaks(act.works)}</p>
    </div>
    <div class="section">
      <h2>${escapeHtml(stateTitle)}</h2>
      <p>Por medio de la presente acta se hace constar que el equipo descrito en el encabezado ${escapeHtml(phrase)}:</p>
      <p><strong>1. Estado mecánico y operativo:</strong> ${withBreaks(act.mechanical_state)}</p>
      <p><strong>2. Lubricación:</strong> ${withBreaks(act.lubrication)}</p>
      <p><strong>3. Prueba de operación:</strong> ${withBreaks(act.operation_test)}</p>
    </div>`;
}

function signatureBlock(title: string, name?: string, cc?: string, signature?: string): string {
  const image =
    signature && signature.startsWith('data:image')
      ? `<img class="signature" src="${signature}" alt="Firma" />`
      : '<div class="sig-line"></div>';
  return `<div class="sig-box"><strong>${escapeHtml(title)}</strong><p>Nombre: ${escapeHtml(name || '—')}</p><p>C.C.: ${escapeHtml(cc || '—')}</p>${image}</div>`;
}

async function buildActHtml(act: ActPdfInput): Promise<string> {
  const logo = await logoDataUrl();
  const photoCards = (await Promise.all((act.photos || []).map(photoDataUrl))).filter(Boolean).join('');
  const dateLabel = act.act_date ? String(act.act_date).slice(0, 10) : '—';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(actTitle(act.act_type))}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
  .logo-container { width: 100%; display: flex; justify-content: center; margin-bottom: 10px; }
  .logo-img { width: 100%; max-width: 600px; height: auto; object-fit: contain; }
  .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #2563eb; padding-bottom: 16px; }
  .header h1 { color: #2563eb; margin-bottom: 8px; }
  .section { margin: 18px 0; }
  .section h2 { color: #2563eb; border-bottom: 1px solid #ddd; padding-bottom: 5px; font-size: 16px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .info-item { padding: 10px; background: #f8f9fa; border-radius: 5px; }
  .info-item strong { color: #2563eb; }
  .photos { display: flex; flex-wrap: wrap; gap: 10px; }
  .photo-card { width: 220px; border: 1px solid #ddd; border-radius: 4px; padding: 6px; page-break-inside: avoid; }
  .photo-card img { width: 100%; max-height: 180px; object-fit: contain; display: block; }
  .photo-name { font-size: 11px; color: #666; text-align: center; margin-top: 4px; }
  .rating-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .rating-table td { border: 1px solid #e2e8f0; padding: 6px 8px; }
  .rating-table td:last-child { font-weight: 600; color: #1e3a8a; width: 140px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .sig-box { border: 1px solid #ddd; border-radius: 6px; padding: 12px; min-height: 140px; }
  .signature { max-width: 100%; max-height: 80px; display: block; margin-top: 8px; }
  .sig-line { height: 60px; border-bottom: 1px solid #94a3b8; margin-top: 16px; }
  .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 16px; }
</style>
</head>
<body>
  <div class="logo-container"><img class="logo-img" src="${logo}" alt="Logo Partequipos" /></div>
  <div class="header">
    <h1>${escapeHtml(actTitle(act.act_type))}</h1>
    <p><strong>Lugar:</strong> ${escapeHtml(act.location || '—')}</p>
    <p><strong>Fecha:</strong> ${escapeHtml(dateLabel)}</p>
  </div>
  <div class="section">
    <h2>Datos de identificación del equipo (encabezado)</h2>
    <div class="info-grid">
      ${infoItem('Tipo de máquina', act.equipment_type)}
      ${infoItem('Modelo', act.model_type)}
      ${infoItem('Línea / Serie', act.line_series)}
      ${infoItem('PIN / N° Serie (Chasis)', act.pin_serial)}
      ${infoItem('Número de Motor', act.engine_number)}
      ${infoItem('Código / Identificación Interna', act.internal_code)}
      ${infoItem('Año / Mes de Fabricación', act.manufacture_date)}
      ${infoItem('Horómetro', act.hourmeter == null || act.hourmeter === '' ? '' : String(act.hourmeter))}
      ${infoItem('Serial GPS', act.gps_serial)}
      ${infoItem('Fecha Instalación GPS', act.gps_install_date)}
    </div>
  </div>
  ${bodySections(act)}
  <div class="section">
    <h2>Imágenes</h2>
    <div class="photos">${photoCards || '<p>Sin fotografías</p>'}</div>
  </div>
  <div class="section">
    <h2>Constancia de firmas y conformidad</h2>
    <div class="signatures">
      ${signatureBlock('ENTREGA', act.deliverer_name, act.deliverer_cc, act.deliverer_signature)}
      ${signatureBlock('RECIBE', act.receiver_name, act.receiver_cc, act.receiver_signature)}
    </div>
  </div>
  <div class="footer">
    <p>Acta generada el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}</p>
    <p>Plataforma de Informes de Maquinaria - Partequipos</p>
  </div>
</body>
</html>`;
}

async function htmlToPdf(html: string): Promise<Buffer> {
  const executablePath = await chromium.executablePath();
  if (!executablePath) {
    throw new Error('Chromium executablePath not found. PDF generation is not supported in this environment.');
  }
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '10mm', right: '10mm', bottom: '12mm', left: '10mm' },
      printBackground: true,
      displayHeaderFooter: false,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

const writeLine = (label: string): string =>
  `<div class="write-line"><span>${escapeHtml(label)}</span><span class="line"></span></div>`;

const blankChecks = '☐ Bueno &nbsp;&nbsp; ☐ Regular &nbsp;&nbsp; ☐ Malo &nbsp;&nbsp; ☐ No aplica';

function blankDeliveryHtml(logo: string): string {
  const identity = [
    'Tipo de máquina',
    'Modelo',
    'Línea / Serie',
    'PIN / N° Serie Máquina (Chasis)',
    'Número de Motor',
    'Código / Identificación Interna',
    'Año / Mes de Fabricación',
    'Horómetro',
    'Serial GPS (Rastrack S.A.S.)',
    'Fecha Instalación GPS',
  ]
    .map(writeLine)
    .join('');

  const sections = INSPECTION_SECTIONS.map((section) => {
    const rows = section.items
      .map(
        (item) =>
          `<tr><td class="item">${escapeHtml(item.label)}</td><td class="checks">${blankChecks}</td></tr>`
      )
      .join('');
    return `
      <div class="section">
        <h2>${escapeHtml(section.title)}</h2>
        <table class="blank-table"><tbody>${rows}</tbody></table>
        ${writeLine('Comentarios')}
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Acta de Entrega — formato en blanco</title>
<style>
  body { font-family: Arial, sans-serif; margin: 12px; color: #333; font-size: 12px; }
  .logo-container { width: 100%; display: flex; justify-content: center; margin-bottom: 6px; }
  .logo-img { width: 100%; max-width: 420px; height: auto; }
  .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 12px; }
  .header h1 { color: #2563eb; margin: 0 0 4px; font-size: 20px; }
  .note { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; margin: 10px 0 14px; color: #334155; }
  .section { margin: 12px 0; page-break-inside: avoid; }
  .section h2 { color: #2563eb; border-bottom: 1px solid #ddd; padding-bottom: 3px; font-size: 14px; margin: 0 0 6px; }
  .write-line { display: flex; align-items: flex-end; gap: 8px; margin: 7px 0; }
  .write-line span:first-child { min-width: 230px; font-weight: 700; color: #2563eb; }
  .line { flex: 1; border-bottom: 1px solid #94a3b8; height: 16px; }
  .blank-table { width: 100%; border-collapse: collapse; }
  .blank-table td { border-bottom: 1px solid #e2e8f0; padding: 5px 4px; vertical-align: middle; }
  .item { width: 38%; }
  .checks { letter-spacing: 0.2px; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
  .sig-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; min-height: 120px; }
  .sig-box strong { color: #2563eb; }
  .sig-box .write-line span:first-child { min-width: 72px; }
  .footer { margin-top: 18px; text-align: center; font-size: 11px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
</style>
</head>
<body>
  <div class="logo-container"><img class="logo-img" src="${logo}" alt="Logo Partequipos" /></div>
  <div class="header">
    <h1>Acta de Entrega</h1>
    <p>Formato en blanco para diligenciar a mano e imprimir</p>
  </div>
  <div class="note">
    Diligencie este formato en sitio, recoja la firma del cliente y luego digitalícelo en la plataforma.
    Las fotografías y los videos se adjuntan al cargar el acta; no se diligencian en este formato impreso.
  </div>
  <div class="section">
    <h2>Encabezado</h2>
    ${writeLine('Lugar')}
    ${writeLine('Fecha')}
  </div>
  <div class="section">
    <h2>Datos de identificación del equipo (encabezado)</h2>
    ${identity}
  </div>
  ${sections}
  <div class="section">
    <h2>Constancia de firmas y conformidad</h2>
    <p>Las partes firman a conformidad el recibo y entrega del equipo en la fecha estipulada.</p>
    <div class="signatures">
      <div class="sig-box">
        <strong>ENTREGA</strong>
        ${writeLine('Nombre')}
        ${writeLine('C.C.')}
        ${writeLine('Firma')}
      </div>
      <div class="sig-box">
        <strong>RECIBE</strong>
        ${writeLine('Nombre')}
        ${writeLine('C.C.')}
        ${writeLine('Firma')}
      </div>
    </div>
  </div>
  <div class="footer">
    <p>Partequipos — Plataforma de Informes de Maquinaria</p>
    <p>Formato de impresión. Marque una opción por ítem: Bueno, Regular, Malo o No aplica.</p>
  </div>
</body>
</html>`;
}

export async function generateBlankDeliveryPdf(): Promise<Buffer> {
  const logo = await logoDataUrl();
  return htmlToPdf(blankDeliveryHtml(logo));
}

export async function generateActPdf(act: ActPdfInput): Promise<Buffer> {
  const html = await buildActHtml(act);
  return htmlToPdf(html);
}
