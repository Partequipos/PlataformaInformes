import { COMPANY_LOGO_URL } from '../constants/equipmentActs';
import type { EquipmentAct } from '../constants/equipmentActs';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const absoluteUrl = (url: string): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  if (typeof window === 'undefined') return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${window.location.origin}${path}`;
};

const fieldRow = (label: string, value?: string | null): string =>
  `<div class="field"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value || '—')}</span></div>`;

const mediaGrid = (
  kind: 'photo' | 'video',
  items: Array<{ url: string; name: string }>
): string => {
  if (items.length === 0) return '<p class="empty">Sin archivos</p>';
  const nodes = items
    .map((item) => {
      const src = escapeHtml(absoluteUrl(item.url));
      const name = escapeHtml(item.name);
      if (kind === 'video') {
        return `<button type="button" class="media-card" data-view="video" data-src="${src}" data-name="${name}">
          <video muted playsinline preload="metadata" src="${src}"></video>
          <span class="media-name">${name}</span>
        </button>`;
      }
      return `<button type="button" class="media-card" data-view="photo" data-src="${src}" data-name="${name}">
        <img src="${src}" alt="${name}" />
        <span class="media-name">${name}</span>
      </button>`;
    })
    .join('');
  return `<div class="${kind === 'photo' ? 'photo-grid' : 'video-grid'}">${nodes}</div>`;
};

const VIEWER_SCRIPT = `
document.addEventListener('click', function (event) {
  var viewer = document.getElementById('media-viewer');
  var image = document.getElementById('viewer-image');
  var video = document.getElementById('viewer-video');
  var caption = document.getElementById('viewer-caption');
  if (!viewer || !image || !video || !caption) return;
  if (event.target.id === 'media-viewer' || event.target.closest('[data-close-viewer]')) {
    video.pause(); video.removeAttribute('src'); image.removeAttribute('src'); viewer.hidden = true; return;
  }
  var card = event.target.closest('[data-view]');
  if (!card) return;
  var src = card.getAttribute('data-src') || '';
  var name = card.getAttribute('data-name') || '';
  caption.textContent = name;
  if (card.getAttribute('data-view') === 'video') {
    image.hidden = true; video.hidden = false; video.src = src; video.play();
  } else {
    video.pause(); video.removeAttribute('src'); video.hidden = true; image.hidden = false; image.src = src;
  }
  viewer.hidden = false;
});
`;

export function buildActHtml(act: EquipmentAct): string {
  const isEntry = act.act_type === 'entry';
  const title = isEntry ? 'Acta de Entrada' : 'Acta de Salida';
  const motiveTitle = isEntry ? 'II. MOTIVO DE INGRESO Y TRABAJOS A REALIZAR' : 'II. MOTIVO DE SALIDA Y TRABAJOS REALIZADOS';
  const stateTitle = isEntry
    ? 'III. ESTADO DEL EQUIPO Y CONDICIONES DE ENTRADA'
    : 'III. ESTADO DEL EQUIPO Y CONDICIONES DE SALIDA';
  const motiveLabel = isEntry ? 'Motivo de Ingreso' : 'Motivo de Salida';
  const worksLabel = isEntry ? 'Trabajos a realizar' : 'Trabajos efectuados';
  const deliveryPhrase = isEntry
    ? 'se recibe en taller bajo las siguientes condiciones'
    : 'se entrega al operador bajo las siguientes condiciones';

  const photos = (act.photos || []).map((p) => ({
    url: p.file_path,
    name: p.photo_name || p.original_name || p.filename,
  }));
  const videos = (act.videos || []).map((v) => ({
    url: v.file_path,
    name: v.video_name || v.original_name || v.filename,
  }));
  const attachments = (act.attachments || [])
    .map((a) => {
      const href = escapeHtml(absoluteUrl(a.file_path));
      const name = escapeHtml(a.original_name || a.filename);
      return `<li><a href="${href}" target="_blank" rel="noopener noreferrer">${name}</a></li>`;
    })
    .join('');

  const delivererSig = act.deliverer_signature
    ? `<img class="signature" src="${escapeHtml(absoluteUrl(act.deliverer_signature))}" alt="Firma entrega" />`
    : '<div class="sig-line"></div>';
  const receiverSig = act.receiver_signature
    ? `<img class="signature" src="${escapeHtml(absoluteUrl(act.receiver_signature))}" alt="Firma recibe" />`
    : '<div class="sig-line"></div>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — ${escapeHtml(act.internal_code || act.pin_serial || '')}</title>
<style>
  :root { --ink:#0f172a; --muted:#475569; --line:#cbd5e1; --brand:#b91c1c; --bg:#f8fafc; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: Georgia, "Times New Roman", serif; color:var(--ink); background:var(--bg); }
  .page { max-width: 920px; margin: 0 auto; padding: 28px 24px 48px; background:#fff; }
  .header { display:flex; gap:20px; align-items:center; border-bottom:3px solid var(--brand); padding-bottom:16px; margin-bottom:20px; }
  .header img { width:110px; height:auto; }
  .header h1 { margin:0; font-size:1.75rem; color:var(--brand); letter-spacing:0.02em; }
  .header p { margin:6px 0 0; color:var(--muted); font-size:0.95rem; }
  h2 { font-size:1.05rem; margin:28px 0 12px; color:var(--brand); border-bottom:1px solid var(--line); padding-bottom:6px; }
  .field { display:grid; grid-template-columns: 240px 1fr; gap:8px; padding:6px 0; border-bottom:1px dotted #e2e8f0; font-size:0.95rem; }
  .label { color:var(--muted); font-weight:600; }
  .value { white-space: pre-wrap; }
  .block { background:#f8fafc; border:1px solid var(--line); border-radius:8px; padding:12px 14px; margin:10px 0; white-space:pre-wrap; line-height:1.45; }
  .intro { color:var(--muted); margin: 8px 0 14px; }
  .photo-grid, .video-grid { display:grid; grid-template-columns: repeat(auto-fill,minmax(160px,1fr)); gap:12px; }
  .media-card { border:1px solid var(--line); border-radius:8px; background:#fff; padding:6px; cursor:pointer; text-align:left; }
  .media-card img, .media-card video { width:100%; height:120px; object-fit:cover; border-radius:6px; display:block; background:#000; }
  .media-name { display:block; font-size:0.75rem; margin-top:4px; color:var(--muted); }
  .signatures { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:16px; }
  .sig-box { border:1px solid var(--line); border-radius:8px; padding:14px; min-height:180px; }
  .signature { max-width:100%; max-height:90px; display:block; margin:10px 0; }
  .sig-line { height:70px; border-bottom:1px solid #94a3b8; margin:18px 0; }
  ul.attachments { padding-left:18px; }
  .empty { color:var(--muted); font-style:italic; }
  #media-viewer { position:fixed; inset:0; background:rgba(15,23,42,.88); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; z-index:50; }
  #media-viewer[hidden] { display:none !important; }
  #viewer-image { max-width:92vw; max-height:84vh; object-fit:contain; background:#fff; border-radius:8px; }
  #viewer-video { width:min(70vw,900px); max-height:80vh; background:#000; border-radius:8px; }
  .close-btn { position:absolute; top:16px; right:16px; background:#fff; border:0; border-radius:999px; width:36px; height:36px; cursor:pointer; font-size:1.2rem; }
  @media (max-width:700px){ .field{grid-template-columns:1fr;} .signatures{grid-template-columns:1fr;} }
</style>
</head>
<body>
  <div class="page">
    <header class="header">
      <img src="${escapeHtml(COMPANY_LOGO_URL)}" alt="Logo Partequipos" />
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p><strong>Lugar:</strong> ${escapeHtml(act.location || '—')}</p>
        <p><strong>Fecha:</strong> ${escapeHtml(act.act_date || '')}</p>
      </div>
    </header>

    <h2>I. DATOS DE IDENTIFICACIÓN DEL EQUIPO (ENCABEZADO)</h2>
    ${fieldRow('Tipo de máquina', act.equipment_type)}
    ${fieldRow('Modelo', act.model_type)}
    ${fieldRow('Línea / Serie', act.line_series)}
    ${fieldRow('PIN / Número de Serie Máquina (Chasis)', act.pin_serial)}
    ${fieldRow('Número de Motor', act.engine_number)}
    ${fieldRow('Código / Identificación Interna', act.internal_code)}
    ${fieldRow('Año / Mes de Fabricación', act.manufacture_date)}
    ${fieldRow('Capacidad de Carga', act.load_capacity)}
    ${fieldRow('Dispositivo GPS (Rastrack S.A.S.) — Serial', act.gps_serial)}
    ${fieldRow('Fecha Instalación GPS', act.gps_install_date)}

    <h2>${escapeHtml(motiveTitle)}</h2>
    <p class="label">${escapeHtml(motiveLabel)}</p>
    <div class="block">${escapeHtml(act.motive || '—')}</div>
    <p class="label">${escapeHtml(worksLabel)}</p>
    <div class="block">${escapeHtml(act.works || '—')}</div>

    <h2>${escapeHtml(stateTitle)}</h2>
    <p class="intro">Por medio de la presente acta se hace constar que el equipo descrito en el encabezado ${escapeHtml(deliveryPhrase)}:</p>
    <p class="label">1. Estado Mecánico y Operativo</p>
    <div class="block">${escapeHtml(act.mechanical_state || '—')}</div>
    <p class="label">2. Lubricación</p>
    <div class="block">${escapeHtml(act.lubrication || '—')}</div>
    <p class="label">3. Prueba de Operación</p>
    <div class="block">${escapeHtml(act.operation_test || '—')}</div>

    <h2>IV. IMÁGENES Y VIDEOS</h2>
    <p class="label">Imágenes</p>
    ${mediaGrid('photo', photos)}
    <p class="label" style="margin-top:14px">Videos</p>
    ${mediaGrid('video', videos)}

    <h2>V. CONSTANCIA DE FIRMAS Y CONFORMIDAD</h2>
    <p class="intro">Las partes firman a conformidad el recibo y entrega del equipo en la fecha estipulada.</p>
    <div class="signatures">
      <div class="sig-box">
        <strong>ENTREGA</strong>
        <p>Nombre: ${escapeHtml(act.deliverer_name || '—')}</p>
        <p>C.C.: ${escapeHtml(act.deliverer_cc || '—')}</p>
        ${delivererSig}
        <p>Firma digital</p>
      </div>
      <div class="sig-box">
        <strong>RECIBE</strong>
        <p>Nombre: ${escapeHtml(act.receiver_name || '—')}</p>
        <p>C.C.: ${escapeHtml(act.receiver_cc || '—')}</p>
        ${receiverSig}
        <p>Firma digital</p>
      </div>
    </div>

    <h2>VI. ADJUNTOS PDF</h2>
    ${attachments ? `<ul class="attachments">${attachments}</ul>` : '<p class="empty">Sin adjuntos PDF</p>'}
  </div>
  <div id="media-viewer" hidden>
    <button type="button" class="close-btn" data-close-viewer aria-label="Cerrar">×</button>
    <img id="viewer-image" alt="" />
    <video id="viewer-video" controls playsinline></video>
    <p id="viewer-caption" style="color:#fff"></p>
  </div>
  <script>${VIEWER_SCRIPT}</script>
</body>
</html>`;
}
