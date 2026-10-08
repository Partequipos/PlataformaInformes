import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { Select } from '../components/atoms/Select';
import { PhotoUpload } from '../components/molecules/PhotoUpload';
import { VideoUpload } from '../components/molecules/VideoUpload';
import { SignaturePad } from '../components/molecules/SignaturePad';
import { useAuth } from '../context/AuthContext';
import { useTypes } from '../context/TypesContext';
import { useAct, useSaveAct } from '../hooks/useActs';
import { apiService } from '../services/api';
import { REPORT_MODEL_OPTIONS } from '../constants/reportModels';
import { compressImageFiles } from '../utils/compressImage';
import { compressVideoFiles } from '../utils/compressVideo';
import {
  ACT_LOCATIONS,
  DEFAULT_LUBRICATION,
  DEFAULT_MECHANICAL_STATE,
  DEFAULT_OPERATION_TEST,
  type ActType,
  type EquipmentAct,
} from '../constants/equipmentActs';

const PHOTO_BATCH_SIZE = 2;
const MEDIA_ONLY_ACT_DATA = '{}';

type PhotoItem = File | { id: string; url: string; filename: string; photo_name?: string };
type VideoItem = File | { id: string; url: string; filename: string };
type AttachmentItem = File | { id: string; url: string; filename: string; original_name?: string };

type FormState = {
  act_type: ActType;
  location: string;
  act_date: string;
  status: 'draft' | 'completed';
  equipment_type: string;
  brand: string;
  line_series: string;
  model_type: string;
  pin_serial: string;
  engine_number: string;
  internal_code: string;
  manufacture_date: string;
  load_capacity: string;
  gps_serial: string;
  gps_install_date: string;
  motive: string;
  works: string;
  mechanical_state: string;
  lubrication: string;
  operation_test: string;
  deliverer_name: string;
  deliverer_cc: string;
  deliverer_signature: string;
  receiver_name: string;
  receiver_cc: string;
  receiver_signature: string;
};

const emptyForm = (type: ActType): FormState => ({
  act_type: type,
  location: ACT_LOCATIONS[0],
  act_date: new Date().toISOString().slice(0, 10),
  status: 'draft',
  equipment_type: '',
  brand: '',
  line_series: '',
  model_type: '',
  pin_serial: '',
  engine_number: '',
  internal_code: '',
  manufacture_date: '',
  load_capacity: '',
  gps_serial: '',
  gps_install_date: '',
  motive: '',
  works: '',
  mechanical_state: DEFAULT_MECHANICAL_STATE,
  lubrication: DEFAULT_LUBRICATION,
  operation_test: DEFAULT_OPERATION_TEST,
  deliverer_name: '',
  deliverer_cc: '',
  deliverer_signature: '',
  receiver_name: '',
  receiver_cc: '',
  receiver_signature: '',
});

const mapActToForm = (act: EquipmentAct): FormState => ({
  act_type: act.act_type,
  location: act.location || ACT_LOCATIONS[0],
  act_date: act.act_date ? String(act.act_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
  status: act.status || 'draft',
  equipment_type: act.equipment_type || '',
  brand: act.brand || '',
  line_series: act.line_series || '',
  model_type: act.model_type || '',
  pin_serial: act.pin_serial || '',
  engine_number: act.engine_number || '',
  internal_code: act.internal_code || '',
  manufacture_date: act.manufacture_date || '',
  load_capacity: act.load_capacity || '',
  gps_serial: act.gps_serial || '',
  gps_install_date: act.gps_install_date || '',
  motive: act.motive || '',
  works: act.works || '',
  mechanical_state: act.mechanical_state || DEFAULT_MECHANICAL_STATE,
  lubrication: act.lubrication || DEFAULT_LUBRICATION,
  operation_test: act.operation_test || DEFAULT_OPERATION_TEST,
  deliverer_name: act.deliverer_name || '',
  deliverer_cc: act.deliverer_cc || '',
  deliverer_signature: act.deliverer_signature || '',
  receiver_name: act.receiver_name || '',
  receiver_cc: act.receiver_cc || '',
  receiver_signature: act.receiver_signature || '',
});

const sectionClass = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4';
const sectionTitle = 'font-display text-lg font-bold text-brand-red border-b border-slate-100 pb-2';

export const ActFormPage: React.FC = () => {
  const { state: auth } = useAuth();
  const role = auth.user?.role;
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get('type') === 'exit' ? 'exit' : 'entry') as ActType;
  const isEdit = Boolean(id);
  const { machineTypes } = useTypes();

  const machineTypeOptions = useMemo(
    () =>
      machineTypes
        .map((mt) => ({ value: mt.name, label: mt.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [machineTypes]
  );

  const { data: existing, isLoading } = useAct(id);
  const saveMutation = useSaveAct();

  const [form, setForm] = useState<FormState>(() => emptyForm(initialType));
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setForm(mapActToForm(existing));
    setPhotos(
      (existing.photos || []).map((p) => ({
        id: p.id,
        url: p.file_path,
        filename: p.original_name || p.filename,
        photo_name: p.photo_name,
      }))
    );
    setVideos(
      (existing.videos || []).map((v) => ({
        id: v.id,
        url: v.file_path,
        filename: v.original_name || v.filename,
      }))
    );
    setAttachments(
      (existing.attachments || []).map((a) => ({
        id: a.id,
        url: a.file_path,
        filename: a.original_name || a.filename,
        original_name: a.original_name,
      }))
    );
  }, [existing]);

  const title = useMemo(
    () => (form.act_type === 'entry' ? 'Acta de Entrada' : 'Acta de Salida'),
    [form.act_type]
  );

  if (role === 'viewer') {
    return <Navigate to="/dashboard" replace />;
  }

  if (isEdit && isLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-96 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    );
  }

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const buildMetaFormData = (): FormData => {
    const fd = new FormData();
    fd.append('actData', JSON.stringify(form));
    return fd;
  };

  const buildMediaFormData = (files: File[], fieldPrefix: 'photos' | 'videos' | 'attachments'): FormData => {
    const fd = new FormData();
    fd.append('actData', MEDIA_ONLY_ACT_DATA);
    files.forEach((file, index) => {
      fd.append(`${fieldPrefix}_${index}`, file, file.name);
    });
    return fd;
  };

  const uploadMediaInBatches = async (actId: string) => {
    const newPhotos = photos.filter((p): p is File => typeof File !== 'undefined' && p instanceof File);
    const newVideos = videos.filter((v): v is File => typeof File !== 'undefined' && v instanceof File);
    const newPdfs = attachments.filter((a): a is File => typeof File !== 'undefined' && a instanceof File);

    if (newPhotos.length > 0) {
      const compressed = await compressImageFiles(newPhotos);
      for (let offset = 0; offset < compressed.length; offset += PHOTO_BATCH_SIZE) {
        const batch = compressed.slice(offset, offset + PHOTO_BATCH_SIZE);
        await apiService.updateAct(actId, buildMediaFormData(batch, 'photos'));
      }
    }

    if (newVideos.length > 0) {
      const compressedVideos = await compressVideoFiles(newVideos);
      for (const video of compressedVideos) {
        await apiService.updateAct(actId, buildMediaFormData([video], 'videos'));
      }
    }

    for (const pdf of newPdfs) {
      await apiService.updateAct(actId, buildMediaFormData([pdf], 'attachments'));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!form.location.trim()) {
      setError('Seleccione el lugar');
      return;
    }
    if (!form.equipment_type?.trim()) {
      setError('Tipo de máquina es requerido');
      return;
    }
    if (!form.model_type?.trim()) {
      setError('Modelo es requerido');
      return;
    }
    setIsSaving(true);
    try {
      // 1) Save text + signatures first (no binary media) to avoid Vercel 413
      const saved = await saveMutation.mutateAsync({ id, formData: buildMetaFormData() });
      // 2) Upload compressed media in small batches
      await uploadMediaInBatches(saved.id);
      navigate(`/acts/${saved.id}/html`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al guardar';
      if (message.includes('413') || /too large/i.test(message)) {
        setError(
          'Request too large. Photos/videos are uploaded in small batches — try again or use fewer/smaller files.'
        );
        return;
      }
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <form onSubmit={handleSubmit} className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-600">Diligenciamiento interno Partequipos</p>
          </div>
          <div className="flex gap-2">
            <Link to="/acts">
              <Button type="button" variant="ghost">
                Volver
              </Button>
            </Link>
            <Button type="submit" isLoading={isSaving || saveMutation.isPending}>
              Guardar acta
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className={sectionClass}>
          <h2 className={sectionTitle}>Encabezado</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Select
              label="Tipo de acta"
              required
              value={form.act_type}
              onChange={(e) => setField('act_type', e.target.value as ActType)}
              options={[
                { value: 'entry', label: 'Acta de Entrada' },
                { value: 'exit', label: 'Acta de Salida' },
              ]}
            />
            <Select
              label="Lugar"
              required
              value={form.location}
              onChange={(e) => setField('location', e.target.value)}
              options={ACT_LOCATIONS.map((loc) => ({ value: loc, label: loc }))}
            />
            <Input
              label="Fecha"
              type="date"
              required
              value={form.act_date}
              onChange={(e) => setField('act_date', e.target.value)}
            />
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className={sectionTitle}>I. Datos de identificación del equipo (encabezado)</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Tipo de máquina"
              required
              value={form.equipment_type}
              onChange={(e) => setField('equipment_type', e.target.value)}
              options={machineTypeOptions}
              placeholder="Seleccione tipo de máquina"
            />
            <Select
              label="Modelo"
              required
              value={form.model_type}
              onChange={(e) => setField('model_type', e.target.value)}
              options={REPORT_MODEL_OPTIONS}
              placeholder="Seleccione modelo"
            />
            <Input label="Línea / Serie" value={form.line_series} onChange={(e) => setField('line_series', e.target.value)} />
            <Input label="PIN / N° Serie Máquina (Chasis)" value={form.pin_serial} onChange={(e) => setField('pin_serial', e.target.value)} />
            <Input label="Número de Motor" value={form.engine_number} onChange={(e) => setField('engine_number', e.target.value)} />
            <Input label="Código / Identificación Interna" value={form.internal_code} onChange={(e) => setField('internal_code', e.target.value)} />
            <Input label="Año / Mes de Fabricación" value={form.manufacture_date} onChange={(e) => setField('manufacture_date', e.target.value)} placeholder="2018-06" />
            <Input label="Capacidad de Carga" value={form.load_capacity} onChange={(e) => setField('load_capacity', e.target.value)} placeholder="0.99 TON" />
            <Input label="Serial GPS (Rastrack S.A.S.)" value={form.gps_serial} onChange={(e) => setField('gps_serial', e.target.value)} />
            <Input label="Fecha Instalación GPS" value={form.gps_install_date} onChange={(e) => setField('gps_install_date', e.target.value)} placeholder="15 / 12 / 2025" />
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className={sectionTitle}>
            {form.act_type === 'entry'
              ? 'II. Motivo de ingreso y trabajos a realizar'
              : 'II. Motivo de salida y trabajos realizados'}
          </h2>
          <label className="form-label">
            {form.act_type === 'entry' ? 'Motivo de ingreso' : 'Motivo de salida'}
          </label>
          <textarea
            className="form-input min-h-[90px]"
            value={form.motive}
            onChange={(e) => setField('motive', e.target.value)}
          />
          <label className="form-label">
            {form.act_type === 'entry' ? 'Trabajos a realizar' : 'Trabajos efectuados'}
          </label>
          <textarea
            className="form-input min-h-[110px]"
            value={form.works}
            onChange={(e) => setField('works', e.target.value)}
            placeholder={'Diagnóstico especializado…\nMantenimiento correctivo…'}
          />
        </section>

        <section className={sectionClass}>
          <h2 className={sectionTitle}>
            {form.act_type === 'entry'
              ? 'III. Estado del equipo y condiciones de entrada'
              : 'III. Estado del equipo y condiciones de salida'}
          </h2>
          <label className="form-label">1. Estado mecánico y operativo</label>
          <textarea className="form-input min-h-[80px]" value={form.mechanical_state} onChange={(e) => setField('mechanical_state', e.target.value)} />
          <label className="form-label">2. Lubricación</label>
          <textarea className="form-input min-h-[70px]" value={form.lubrication} onChange={(e) => setField('lubrication', e.target.value)} />
          <label className="form-label">3. Prueba de operación</label>
          <textarea className="form-input min-h-[80px]" value={form.operation_test} onChange={(e) => setField('operation_test', e.target.value)} />
        </section>

        <section className={sectionClass}>
          <h2 className={sectionTitle}>IV. Imágenes y videos</h2>
          <PhotoUpload
            photos={photos}
            onPhotosChange={setPhotos}
            maxPhotos={30}
            label="Imágenes del acta"
            onDeleteExistingPhoto={async (photoId) => {
              await apiService.deleteActPhoto(photoId);
              setPhotos((prev) => prev.filter((p) => !(!(p instanceof File) && p.id === photoId)));
            }}
          />
          <VideoUpload
            videos={videos}
            onVideosChange={setVideos}
            maxVideos={10}
            onDeleteExistingVideo={async (videoId) => {
              await apiService.deleteActVideo(videoId);
              setVideos((prev) => prev.filter((v) => !(!(v instanceof File) && v.id === videoId)));
            }}
          />
        </section>

        <section className={sectionClass}>
          <h2 className={sectionTitle}>V. Constancia de firmas y conformidad</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-800">ENTREGA</h3>
              <Input label="Nombre" value={form.deliverer_name} onChange={(e) => setField('deliverer_name', e.target.value)} />
              <Input label="C.C." value={form.deliverer_cc} onChange={(e) => setField('deliverer_cc', e.target.value)} />
              <SignaturePad
                label="Firma digital entrega"
                value={form.deliverer_signature}
                onChange={(v) => setField('deliverer_signature', v)}
              />
            </div>
            <div className="space-y-3 rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-800">RECIBE</h3>
              <Input label="Nombre" value={form.receiver_name} onChange={(e) => setField('receiver_name', e.target.value)} />
              <Input label="C.C." value={form.receiver_cc} onChange={(e) => setField('receiver_cc', e.target.value)} />
              <SignaturePad
                label="Firma digital recibe"
                value={form.receiver_signature}
                onChange={(v) => setField('receiver_signature', v)}
              />
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className={sectionTitle}>VI. Adjuntos PDF (SAMM / informes)</h2>
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length === 0) return;
              setAttachments((prev) => [...prev, ...files]);
              e.target.value = '';
            }}
          />
          <ul className="space-y-2 text-sm text-slate-700">
            {attachments.map((item, index) => {
              const key = item instanceof File ? `f-${index}-${item.name}` : item.id;
              const name = item instanceof File ? item.name : item.original_name || item.filename;
              return (
                <li key={key} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                  <span className="truncate">{name}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!(item instanceof File)) {
                        await apiService.deleteActAttachment(item.id);
                      }
                      setAttachments((prev) => prev.filter((_, i) => i !== index));
                    }}
                  >
                    Quitar
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="flex justify-end gap-2 pb-8">
          <Select
            label="Estado"
            value={form.status}
            onChange={(e) => setField('status', e.target.value as 'draft' | 'completed')}
            options={[
              { value: 'draft', label: 'Borrador' },
              { value: 'completed', label: 'Completada' },
            ]}
          />
          <Button type="submit" isLoading={isSaving || saveMutation.isPending}>
            Guardar y ver HTML
          </Button>
        </div>
      </form>
    </DashboardLayout>
  );
};
