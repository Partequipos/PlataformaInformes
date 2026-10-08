import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Download, ArrowLeft } from 'lucide-react';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';
import { Button } from '../components/atoms/Button';
import { useAuth } from '../context/AuthContext';
import { useAct } from '../hooks/useActs';
import { buildActHtml } from '../utils/actHtml';
import { COMPANY_LOGO_URL } from '../constants/equipmentActs';
import { sanitizeFilename } from '../utils/filenameSanitizer';

export const ActHtmlPage: React.FC = () => {
  const { state } = useAuth();
  const role = state.user?.role;
  const { id } = useParams();
  const { data: act, isLoading, error } = useAct(id);
  const [viewer, setViewer] = useState<{ kind: 'photo' | 'video'; url: string; name: string } | null>(null);

  const htmlTitle = act?.act_type === 'exit' ? 'Acta de Salida' : 'Acta de Entrada';

  const downloadHtml = () => {
    if (!act) return;
    const html = buildActHtml(act);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const code = sanitizeFilename(act.internal_code || act.pin_serial || act.id.slice(0, 8));
    a.href = url;
    a.download = `${sanitizeFilename(htmlTitle)}_${code}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const photos = useMemo(
    () =>
      (act?.photos || []).map((p) => ({
        url: p.file_path,
        name: p.photo_name || p.original_name || p.filename,
      })),
    [act]
  );
  const videos = useMemo(
    () =>
      (act?.videos || []).map((v) => ({
        url: v.file_path,
        name: v.video_name || v.original_name || v.filename,
      })),
    [act]
  );

  if (role === 'viewer') {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !act) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <p className="text-slate-700">No se pudo cargar el acta.</p>
        <Link to="/acts">
          <Button type="button">Volver a actas</Button>
        </Link>
      </div>
    );
  }

  const motiveTitle =
    act.act_type === 'entry'
      ? 'II. Motivo de ingreso y trabajos a realizar'
      : 'II. Motivo de salida y trabajos realizados';
  const stateTitle =
    act.act_type === 'entry'
      ? 'III. Estado del equipo y condiciones de entrada'
      : 'III. Estado del equipo y condiciones de salida';

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <Link to="/acts" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="mr-1 h-4 w-4" /> Actas
        </Link>
        <div className="flex gap-2">
          <Link to={`/acts/${act.id}/edit`}>
            <Button type="button" variant="secondary" size="sm">
              Editar
            </Button>
          </Link>
          <Button type="button" size="sm" onClick={downloadHtml}>
            <Download className="mr-1 h-4 w-4" /> Descargar HTML
          </Button>
        </div>
      </div>

      <article className="mx-auto my-6 max-w-4xl rounded-xl bg-white p-6 shadow-panel md:p-10">
        <header className="mb-6 flex flex-wrap items-center gap-5 border-b-4 border-brand-red pb-4">
          <img src={COMPANY_LOGO_URL} alt="Logo Partequipos" className="w-28 object-contain" />
          <div>
            <h1 className="font-display text-3xl font-bold text-brand-red">{htmlTitle}</h1>
            <p className="mt-1 text-slate-600">
              <strong>Lugar:</strong> {act.location}
            </p>
            <p className="text-slate-600">
              <strong>Fecha:</strong> {String(act.act_date).slice(0, 10)}
            </p>
          </div>
        </header>

        <section className="mb-8 space-y-2">
          <h2 className="font-display text-lg font-bold text-brand-red">I. Datos de identificación del equipo (encabezado)</h2>
          {[
            ['Tipo de máquina', act.equipment_type],
            ['Modelo', act.model_type],
            ['Línea / Serie', act.line_series],
            ['PIN / N° Serie (Chasis)', act.pin_serial],
            ['Número de Motor', act.engine_number],
            ['Código / Identificación Interna', act.internal_code],
            ['Año / Mes de Fabricación', act.manufacture_date],
            ['Capacidad de Carga', act.load_capacity],
            ['Serial GPS', act.gps_serial],
            ['Fecha Instalación GPS', act.gps_install_date],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 border-b border-dotted border-slate-200 py-1.5 text-sm md:grid-cols-[240px_1fr]">
              <span className="font-semibold text-slate-500">{label}</span>
              <span className="text-slate-800">{value || '—'}</span>
            </div>
          ))}
        </section>

        <section className="mb-8 space-y-3">
          <h2 className="font-display text-lg font-bold text-brand-red">{motiveTitle}</h2>
          <div className="rounded-lg bg-slate-50 p-3 whitespace-pre-wrap text-sm text-slate-800">{act.motive || '—'}</div>
          <div className="rounded-lg bg-slate-50 p-3 whitespace-pre-wrap text-sm text-slate-800">{act.works || '—'}</div>
        </section>

        <section className="mb-8 space-y-3">
          <h2 className="font-display text-lg font-bold text-brand-red">{stateTitle}</h2>
          <p className="text-sm text-slate-600">
            Por medio de la presente acta se hace constar que el equipo descrito en el encabezado se{' '}
            {act.act_type === 'entry' ? 'recibe en taller' : 'entrega al operador'} bajo las siguientes condiciones:
          </p>
          <div className="rounded-lg bg-slate-50 p-3 whitespace-pre-wrap text-sm">{act.mechanical_state}</div>
          <div className="rounded-lg bg-slate-50 p-3 whitespace-pre-wrap text-sm">{act.lubrication}</div>
          <div className="rounded-lg bg-slate-50 p-3 whitespace-pre-wrap text-sm">{act.operation_test}</div>
        </section>

        <section className="mb-8 space-y-3">
          <h2 className="font-display text-lg font-bold text-brand-red">IV. Imágenes y videos</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {photos.map((p) => (
              <button
                key={p.url + p.name}
                type="button"
                className="overflow-hidden rounded-lg border border-slate-200 bg-white text-left"
                onClick={() => setViewer({ kind: 'photo', url: p.url, name: p.name })}
              >
                <img src={p.url} alt={p.name} className="h-36 w-full object-cover" />
                <span className="block truncate px-2 py-1 text-xs text-slate-500">{p.name}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {videos.map((v) => (
              <button
                key={v.url + v.name}
                type="button"
                className="overflow-hidden rounded-lg border border-slate-200 bg-black text-left"
                onClick={() => setViewer({ kind: 'video', url: v.url, name: v.name })}
              >
                <video src={v.url} muted playsInline preload="metadata" className="h-48 w-full object-contain" />
                <span className="block truncate bg-white px-2 py-1 text-xs text-slate-500">{v.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mb-8 space-y-3">
          <h2 className="font-display text-lg font-bold text-brand-red">V. Constancia de firmas y conformidad</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="font-semibold">ENTREGA</p>
              <p className="text-sm">Nombre: {act.deliverer_name || '—'}</p>
              <p className="text-sm">C.C.: {act.deliverer_cc || '—'}</p>
              {act.deliverer_signature ? (
                <img src={act.deliverer_signature} alt="Firma entrega" className="mt-2 max-h-24" />
              ) : (
                <div className="mt-6 border-b border-slate-400" />
              )}
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="font-semibold">RECIBE</p>
              <p className="text-sm">Nombre: {act.receiver_name || '—'}</p>
              <p className="text-sm">C.C.: {act.receiver_cc || '—'}</p>
              {act.receiver_signature ? (
                <img src={act.receiver_signature} alt="Firma recibe" className="mt-2 max-h-24" />
              ) : (
                <div className="mt-6 border-b border-slate-400" />
              )}
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-bold text-brand-red">VI. Adjuntos PDF</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {(act.attachments || []).map((a) => (
              <li key={a.id}>
                <a className="text-brand-red underline" href={a.file_path} target="_blank" rel="noreferrer">
                  {a.original_name || a.filename}
                </a>
              </li>
            ))}
            {(act.attachments || []).length === 0 && <li className="list-none text-slate-400">Sin adjuntos</li>}
          </ul>
        </section>
      </article>

      {viewer && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-900/90 p-4"
          onClick={() => setViewer(null)}
          onKeyDown={(e) => e.key === 'Escape' && setViewer(null)}
          role="dialog"
          aria-modal="true"
        >
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white px-3 py-1" onClick={() => setViewer(null)}>
            ×
          </button>
          {viewer.kind === 'photo' ? (
            <img src={viewer.url} alt={viewer.name} className="max-h-[84vh] max-w-[92vw] rounded-lg bg-white object-contain" />
          ) : (
            <video src={viewer.url} controls autoPlay playsInline className="h-[50vh] w-[50vw] max-w-full rounded-lg bg-black" />
          )}
          <p className="text-sm text-white">{viewer.name}</p>
        </div>
      )}
    </div>
  );
};
