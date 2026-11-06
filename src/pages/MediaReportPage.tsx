import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useReport } from '../hooks/useReports';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';
import { Button } from '../components/atoms/Button';
import { buildMediaReportHtml, MediaReportFile, MediaReportParameter, MediaReportPart } from '../utils/mediaReportHtml';
import { sanitizeFilename } from '../utils/filenameSanitizer';

type MediaItem = { url: string; name: string };

const toMediaUrl = (item: unknown): MediaItem | null => {
  if (!item) return null;
  if (typeof item === 'string') {
    return { url: item, name: item.split('/').pop() || 'media' };
  }
  if (typeof item !== 'object') return null;
  const record = item as {
    file_path?: string;
    url?: string;
    video_name?: string;
    photo_name?: string;
    original_name?: string;
    filename?: string;
  };
  const raw = record.file_path || record.url;
  if (!raw) return null;
  const url = raw.startsWith('http') || raw.startsWith('/') ? raw : `/${raw}`;
  return {
    url,
    name: record.photo_name || record.video_name || record.original_name || record.filename || 'media',
  };
};

const collectMedia = (value: unknown): MediaItem[] => {
  if (!Array.isArray(value)) return [];
  return value.map(toMediaUrl).filter((item): item is MediaItem => item !== null);
};

const cellText = (row: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value);
    }
  }
  return '';
};

const parseParameters = (value: unknown): MediaReportParameter[] => {
  let raw = value;
  if (typeof value === 'string') {
    try {
      raw = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const parameter: MediaReportParameter = {
      name: cellText(row, ['name']),
      minValue: cellText(row, ['minValue', 'min_value']),
      maxValue: cellText(row, ['maxValue', 'max_value']),
      measuredValue: cellText(row, ['measuredValue', 'measured_value']),
      corrected: row.corrected === true || row.corrected === 'true' || row.corrected === 'Yes' ? 'Yes' : 'No',
      observation: cellText(row, ['observation']),
    };
    const hasContent = parameter.name || parameter.minValue || parameter.maxValue || parameter.measuredValue || parameter.observation;
    return hasContent ? [parameter] : [];
  });
};

const parseSuggestedParts = (value: unknown): MediaReportPart[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const part: MediaReportPart = {
      partNumber: cellText(row, ['part_number', 'partNumber']),
      description: cellText(row, ['description']),
      quantity: cellText(row, ['quantity']),
    };
    return part.partNumber || part.description ? [part] : [];
  });
};

/** Full-screen report (opened in a new tab). PDF download is unchanged. */
export const MediaReportPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useReport(id || '');
  const report = data?.data;
  const [viewer, setViewer] = useState<{ kind: 'photo' | 'video'; url: string; name: string } | null>(null);

  const documentModel = useMemo<MediaReportFile | null>(() => {
    if (!report) return null;
    const components = Array.isArray(report.components) ? report.components : [];
    return {
      clientName: report.client_name || '',
      machineType: report.machine_type || '',
      model: report.model || '',
      serialNumber: report.serial_number || '',
      ott: report.ott || '-',
      hourmeter: report.hourmeter != null ? String(report.hourmeter) : '-',
      reportDate: report.report_date || '',
      reasonOfService: report.reason_of_service || '',
      conclusions: report.conclusions || '',
      overallSuggestions: report.overall_suggestions || '',
      suggestedParts: parseSuggestedParts(report.suggested_parts),
      sections: components.map((component, index) => ({
        title: `${index + 1}. ${component.type || 'Component'}`,
        findings: component.findings || '',
        suggestions: component.suggestions || '',
        parameters: parseParameters(component.parameters),
        photos: collectMedia(component.photos),
        videos: collectMedia(component.videos),
      })),
    };
  }, [report]);

  const downloadHtml = () => {
    if (!documentModel) return;
    const html = buildMediaReportHtml(documentModel);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = sanitizeFilename(documentModel.clientName || 'informe');
    link.href = url;
    link.download = `Informe_videos_${safeName}_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-mute flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !report || !documentModel) {
    return (
      <div className="min-h-screen bg-brand-mute flex items-center justify-center p-6">
        <p className="text-brand-red">Could not load the media report.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-mute py-4 px-4">
      <div className="w-full bg-white shadow-panel border border-slate-200 rounded-xl overflow-hidden">
        <div className="h-1.5 bg-brand-red" />
        <div className="p-6 md:p-8 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-red">
                Informe con videos
              </p>
              <h1 className="text-2xl font-display font-bold text-slate-900 mt-1">
                {documentModel.clientName}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {documentModel.machineType} · {documentModel.model} · S/N {documentModel.serialNumber}
              </p>
              <p className="text-sm text-slate-600">
                OTT {documentModel.ott} · Horómetro {documentModel.hourmeter} · {documentModel.reportDate}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={downloadHtml}>
                Descargar para enviar
              </Button>
              <Link to={`/reports/${report.id}`}>
                <Button variant="outline" type="button">Volver al informe</Button>
              </Link>
            </div>
          </div>

          <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            Haga clic en una foto para ampliarla o en un video para verlo a media pantalla, sin salir del informe.
          </p>

          {documentModel.reasonOfService && (
            <section>
              <h2 className="font-display font-semibold text-slate-900">Reason of service</h2>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{documentModel.reasonOfService}</p>
            </section>
          )}

          {documentModel.sections.map((section) => (
            <section key={section.title} className="border border-slate-200 rounded-lg p-4 space-y-3">
              <h2 className="font-display font-semibold text-slate-900">{section.title}</h2>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{section.findings}</p>
              {section.parameters.length > 0 && (
                <div className="overflow-x-auto">
                  <p className="text-sm font-medium text-slate-800 mb-2">Parameters</p>
                  <table className="min-w-full border border-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="border border-slate-200 px-2 py-1 text-left">Name</th>
                        <th className="border border-slate-200 px-2 py-1 text-left">Min Value</th>
                        <th className="border border-slate-200 px-2 py-1 text-left">Max Value</th>
                        <th className="border border-slate-200 px-2 py-1 text-left">Measured</th>
                        <th className="border border-slate-200 px-2 py-1 text-left">Corrected</th>
                        <th className="border border-slate-200 px-2 py-1 text-left">Observation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.parameters.map((parameter, index) => (
                        <tr key={`${section.title}-${index}`}>
                          <td className="border border-slate-200 px-2 py-1">{parameter.name}</td>
                          <td className="border border-slate-200 px-2 py-1">{parameter.minValue}</td>
                          <td className="border border-slate-200 px-2 py-1">{parameter.maxValue}</td>
                          <td className="border border-slate-200 px-2 py-1">{parameter.measuredValue}</td>
                          <td className="border border-slate-200 px-2 py-1">{parameter.corrected}</td>
                          <td className="border border-slate-200 px-2 py-1 whitespace-pre-wrap">{parameter.observation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {section.suggestions && (
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  <span className="font-medium text-slate-800">Suggestions: </span>
                  {section.suggestions}
                </p>
              )}
              {section.photos.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-800 mb-2">Fotos / Photos</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                    {section.photos.map((photo) => (
                      <button
                        key={`${section.title}-${photo.url}`}
                        type="button"
                        className="text-left border border-slate-200 rounded-lg overflow-hidden bg-white cursor-zoom-in"
                        onClick={() => setViewer({ kind: 'photo', url: photo.url, name: photo.name })}
                      >
                        <img src={photo.url} alt={photo.name} className="w-full h-32 object-cover" />
                        <span className="block text-xs text-slate-600 px-2 py-1 break-words">{photo.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {section.videos.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-800 mb-2">Videos</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {section.videos.map((video) => (
                      <button
                        key={`${section.title}-${video.url}`}
                        type="button"
                        className="text-left border border-slate-200 rounded-lg overflow-hidden bg-white"
                        onClick={() => setViewer({ kind: 'video', url: video.url, name: video.name })}
                      >
                        <video src={video.url} muted playsInline preload="metadata" className="w-full h-40 object-cover bg-black pointer-events-none" />
                        <span className="block text-xs text-slate-600 px-2 py-1 break-words">{video.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          ))}

          {documentModel.suggestedParts.length > 0 && (
            <section className="border border-slate-200 rounded-lg p-4">
              <h2 className="font-display font-semibold text-slate-900 mb-3">Suggested Parts and Activities</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-slate-200 text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="border border-slate-200 px-2 py-1 text-left">Part</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">Description</th>
                      <th className="border border-slate-200 px-2 py-1 text-left">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentModel.suggestedParts.map((part, index) => (
                      <tr key={`${part.partNumber}-${index}`}>
                        <td className="border border-slate-200 px-2 py-1">{part.partNumber}</td>
                        <td className="border border-slate-200 px-2 py-1 whitespace-pre-wrap">{part.description}</td>
                        <td className="border border-slate-200 px-2 py-1">{part.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {documentModel.conclusions && (
            <section>
              <h2 className="font-display font-semibold text-slate-900">Conclusions</h2>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{documentModel.conclusions}</p>
            </section>
          )}
          {documentModel.overallSuggestions && (
            <section>
              <h2 className="font-display font-semibold text-slate-900">Overall suggestions</h2>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{documentModel.overallSuggestions}</p>
            </section>
          )}
        </div>
      </div>
      {viewer && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4"
          onClick={() => setViewer(null)}
        >
          <div className="flex flex-col items-center gap-3 max-w-full" onClick={(event) => event.stopPropagation()}>
            <Button type="button" onClick={() => setViewer(null)}>Cerrar</Button>
            {viewer.kind === 'photo' ? (
              <img src={viewer.url} alt={viewer.name} className="max-w-[92vw] max-h-[84vh] object-contain bg-white rounded-lg" />
            ) : (
              <video src={viewer.url} controls autoPlay playsInline className="w-[50vw] h-[50vh] max-w-full bg-black rounded-lg" />
            )}
            <p className="text-sm text-white text-center">{viewer.name}</p>
          </div>
        </div>
      )}
    </div>
  );
};
