import { formatStoredText } from './richText';

export type MediaReportParameter = {
  name: string;
  minValue: string;
  maxValue: string;
  measuredValue: string;
  corrected: string;
  observation: string;
};

export type MediaReportPart = {
  partNumber: string;
  description: string;
  quantity: string;
};

export type MediaReportFile = {
  clientName: string;
  machineType: string;
  model: string;
  serialNumber: string;
  ott: string;
  hourmeter: string;
  reportDate: string;
  reasonOfService: string;
  conclusions: string;
  overallSuggestions: string;
  suggestedParts: MediaReportPart[];
  sections: Array<{
    title: string;
    findings: string;
    suggestions: string;
    parameters: MediaReportParameter[];
    photos: Array<{ url: string; name: string }>;
    videos: Array<{ url: string; name: string }>;
  }>;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const absoluteUrl = (url: string): string => {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (typeof window === 'undefined') return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${window.location.origin}${path}`;
};

const photoBlock = (items: Array<{ url: string; name: string }>): string => {
  if (items.length === 0) return '';
  const nodes = items
    .map((item) => {
      const src = escapeHtml(absoluteUrl(item.url));
      const name = escapeHtml(item.name);
      return `<button type="button" class="media-card" data-view="photo" data-src="${src}" data-name="${name}">
        <img src="${src}" alt="${name}" />
        <span class="media-name">${name}</span>
      </button>`;
    })
    .join('');
  return `<p class="media-label">Fotos / Photos</p><div class="photo-grid">${nodes}</div>`;
};

const parametersTable = (rows: MediaReportParameter[]): string => {
  if (rows.length === 0) return '';
  const body = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.minValue)}</td>
        <td>${escapeHtml(row.maxValue)}</td>
        <td>${escapeHtml(row.measuredValue)}</td>
        <td>${escapeHtml(row.corrected)}</td>
        <td>${escapeHtml(row.observation)}</td>
      </tr>`
    )
    .join('');
  return `<p class="media-label">Parameters</p>
    <table class="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Min Value</th>
          <th>Max Value</th>
          <th>Measured</th>
          <th>Corrected</th>
          <th>Observation</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
};

const suggestedPartsTable = (rows: MediaReportPart[]): string => {
  if (rows.length === 0) return '';
  const body = rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.partNumber)}</td>
        <td>${escapeHtml(row.description)}</td>
        <td>${escapeHtml(row.quantity)}</td>
      </tr>`
    )
    .join('');
  return `<section class="block">
      <h2>Suggested Parts and Activities</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>Part</th>
            <th>Description</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </section>`;
};

const videoBlock = (items: Array<{ url: string; name: string }>): string => {
  if (items.length === 0) return '';
  const nodes = items
    .map((item) => {
      const src = escapeHtml(absoluteUrl(item.url));
      const name = escapeHtml(item.name);
      return `<button type="button" class="media-card" data-view="video" data-src="${src}" data-name="${name}">
        <video muted playsinline preload="metadata" src="${src}"></video>
        <span class="media-name">${name}</span>
      </button>`;
    })
    .join('');
  return `<p class="media-label">Videos</p><div class="video-grid">${nodes}</div>`;
};

const VIEWER_SCRIPT = `
document.addEventListener('click', function (event) {
  var viewer = document.getElementById('media-viewer');
  var image = document.getElementById('viewer-image');
  var video = document.getElementById('viewer-video');
  var caption = document.getElementById('viewer-caption');
  if (!viewer || !image || !video || !caption) return;

  var closeTarget = event.target.id === 'media-viewer' || event.target.closest('[data-close-viewer]');
  if (closeTarget) {
    video.pause();
    video.removeAttribute('src');
    image.removeAttribute('src');
    viewer.hidden = true;
    return;
  }

  var card = event.target.closest('[data-view]');
  if (!card) return;
  var src = card.getAttribute('data-src') || '';
  var name = card.getAttribute('data-name') || '';
  var kind = card.getAttribute('data-view');
  caption.textContent = name;
  if (kind === 'video') {
    image.hidden = true;
    video.hidden = false;
    video.className = 'viewer-video';
    video.src = src;
    video.play();
  } else {
    video.pause();
    video.removeAttribute('src');
    video.hidden = true;
    image.hidden = false;
    image.src = src;
  }
  viewer.hidden = false;
});
document.addEventListener('keydown', function (event) {
  if (event.key !== 'Escape') return;
  var closeButton = document.querySelector('[data-close-viewer]');
  if (closeButton) closeButton.click();
});
`;

/** Standalone HTML the user can email. Videos play from their public Supabase URL. */
export const buildMediaReportHtml = (report: MediaReportFile): string => {
  const sections = report.sections
    .map((section) => {
      return `<section class="block">
        <h2>${escapeHtml(section.title)}</h2>
        <div class="text">${formatStoredText(section.findings)}</div>
        ${parametersTable(section.parameters)}
        ${section.suggestions ? `<div class="text muted"><strong>Suggestions: </strong>${formatStoredText(section.suggestions)}</div>` : ''}
        ${photoBlock(section.photos)}
        ${videoBlock(section.videos)}
      </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Informe con videos - ${escapeHtml(report.clientName)}</title>
  <style>
    body { margin: 0; background: #f7f7f7; color: #1f1f1e; font-family: Segoe UI, Arial, sans-serif; }
    main { width: calc(100% - 32px); margin: 16px; background: #fff; border: 1px solid #e2e2e1; border-radius: 12px; overflow: hidden; }
    .pad { padding: 28px; }
    .bar { height: 6px; background: #cf1b22; }
    .kicker { margin: 0; color: #cf1b22; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; }
    h1 { margin: 8px 0 4px; font-size: 28px; }
    .meta, .note { color: #50504f; }
    .block { border: 1px solid #e2e2e1; border-radius: 10px; padding: 16px; margin-top: 16px; }
    .text { white-space: normal; }
    .text ul, .text ol { margin: 0.4em 0 0.4em 1.2em; }
    .muted { color: #50504f; }
    .media-label { font-weight: 600; margin: 12px 0 8px; }
    .photo-grid, .video-grid { display: grid; gap: 12px; }
    .photo-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
    .video-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .media-card { display: flex; flex-direction: column; gap: 6px; padding: 0; border: 1px solid #e2e2e1; border-radius: 8px; background: #fff; cursor: zoom-in; text-align: center; overflow: hidden; }
    .media-card img, .media-card video { width: 100%; height: 140px; object-fit: cover; background: #111; pointer-events: none; }
    .media-name { font-size: 12px; color: #50504f; padding: 0 6px 8px; word-break: break-word; }
    .data-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
    .data-table th, .data-table td { border: 1px solid #e2e2e1; padding: 6px; text-align: left; vertical-align: top; }
    .data-table th { background: #f7f7f7; color: #50504f; }
    #media-viewer { position: fixed; inset: 0; background: rgba(31, 31, 30, 0.72); display: flex; align-items: center; justify-content: center; z-index: 20; }
    #media-viewer[hidden] { display: none; }
    .viewer-panel { width: min(1100px, 92vw); display: flex; flex-direction: column; align-items: center; gap: 8px; }
    #viewer-image { max-width: 92vw; max-height: 84vh; object-fit: contain; background: #fff; border-radius: 8px; }
    .viewer-video { width: 50vw; height: 50vh; max-width: 960px; background: #000; border-radius: 8px; }
    #viewer-caption { color: #fff; margin: 0; text-align: center; }
    .close-viewer { border: 0; background: #cf1b22; color: #fff; border-radius: 8px; padding: 8px 14px; cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <div class="bar"></div>
    <div class="pad">
      <p class="kicker">Informe con videos</p>
      <h1>${escapeHtml(report.clientName)}</h1>
      <p class="meta">${escapeHtml(report.machineType)} · ${escapeHtml(report.model)} · S/N ${escapeHtml(report.serialNumber)}</p>
      <p class="meta">OTT ${escapeHtml(report.ott)} · Horómetro ${escapeHtml(report.hourmeter)} · ${escapeHtml(report.reportDate)}</p>
      <p class="note">Haga clic en una foto para ampliarla o en un video para verlo a media pantalla, sin salir de este informe.</p>
      ${report.reasonOfService ? `<h2>Reason of service</h2><div class="text">${formatStoredText(report.reasonOfService)}</div>` : ''}
      ${sections}
      ${suggestedPartsTable(report.suggestedParts)}
      ${report.conclusions ? `<h2>Conclusions</h2><div class="text">${formatStoredText(report.conclusions)}</div>` : ''}
      ${report.overallSuggestions ? `<h2>Overall suggestions</h2><div class="text">${formatStoredText(report.overallSuggestions)}</div>` : ''}
    </div>
  </main>
  <div id="media-viewer" hidden>
    <div class="viewer-panel">
      <button type="button" class="close-viewer" data-close-viewer>Cerrar</button>
      <img id="viewer-image" alt="" hidden />
      <video id="viewer-video" class="viewer-video" controls playsinline hidden></video>
      <p id="viewer-caption"></p>
    </div>
  </div>
  <script>${VIEWER_SCRIPT}</script>
</body>
</html>`;
};
