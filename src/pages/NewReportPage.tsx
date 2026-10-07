import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateReport, useReport, useUpdateReport } from '../hooks/useReports';
import { useAuth } from '../context/AuthContext';
import { useTypes } from '../context/TypesContext';
import { REPORT_MODEL_OPTIONS } from '../constants/reportModels';
import { DashboardLayout } from '../components/templates/DashboardLayout';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { Select } from '../components/atoms/Select';
import { Textarea } from '../components/atoms/Textarea';
import { PhotoUpload } from '../components/molecules/PhotoUpload';
import { VideoUpload } from '../components/molecules/VideoUpload';
import { LoadingSpinner } from '../components/molecules/LoadingSpinner';
import { 
  Save, 
  Plus, 
  Trash2, 
  ArrowRight, 
  ArrowLeft,
  AlertCircle 
} from 'lucide-react';
import { apiService } from '../services/api';
import { compressImageFiles } from '../utils/compressImage';
import { compressVideoFiles } from '../utils/compressVideo';

const DRAFT_STORAGE_PREFIX = 'report-draft-';
const MAX_PHOTOS_PER_COMPONENT = 20;
const MAX_VIDEOS_PER_COMPONENT = 10;
const STEP_STORAGE_KEY = 'reportEditStep';
/** Keep each multipart request under typical serverless body limits. */
const PHOTO_UPLOAD_BATCH_SIZE = 3;

type ExistingPhoto = { id: string; url: string; filename: string; photo_name?: string };

export const NewReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { state: authState } = useAuth();
  const { machineTypes, componentTypes } = useTypes();
  const createReportMutation = useCreateReport();
  const updateReportMutation = useUpdateReport();

  const isEditMode = Boolean(id);
  const { data: reportResponse, isLoading: isLoadingReport } = useReport(id || '');

  const [initialized, setInitialized] = useState(false);
  const hydratedReportIdRef = useRef<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  
  const [reportData, setReportData] = useState({
    clientName: '',
    clientContact: '',
    machineType: '',
    model: '',
    serialNumber: '',
    hourmeter: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    ott: '',
    reasonOfService: '',
    conclusions: '',
    overallSuggestions: '',
  });

  const [components, setComponents] = useState<Array<{
    id?: string;
    type: string;
    findings: string;
    parameters?: { name: string; minValue: number; maxValue: number; measuredValue: number; corrected: boolean; observation: string }[];
    status: 'CORRECTED' | 'PENDING';
    suggestions?: string;
    photos: Array<File | { id: string; url: string; filename: string }>;
    videos: Array<File | { id: string; url: string; filename: string }>;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
  }>>([]);

  const [suggestedParts, setSuggestedParts] = useState<Array<{
    partNumber: string;
    description: string;
    quantity: number;
  }>>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Convert machine types to options (obtenidos dinÃ¡micamente de la base de datos)
  const machineTypeOptions = machineTypes
    .map(mt => ({
      value: mt.name,
      label: mt.name
    }))
    .sort((a, b) => a.label.localeCompare(b.label)); // Ordenar alfabÃ©ticamente
  
  // Debug: Log machine types count - Force rebuild 2025-01-10
  console.log('ðŸ” Machine Types loaded:', machineTypes.length, machineTypeOptions.length);

  // Convert component types to options (alphabetical, no bilingual duplicates)
  const componentTypeOptions = (() => {
    const canonicalByKey = new Map<string, { value: string; label: string }>();
    const preferredNames = new Set([
      'Job Site / Sitio de trabajo',
      'Operation / OperaciÃ³n',
      'Appearance / Apariencia',
      'General / General',
      'Aftertreatment System / Sistema Postratamiento',
      'Others / Otros',
    ]);
    const normalizeKey = (name: string) =>
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split('/')
        .map((p) => p.trim())
        .filter(Boolean)
        .sort()
        .join('|');

    for (const ct of componentTypes) {
      const key = normalizeKey(ct.name);
      const existing = canonicalByKey.get(key);
      if (!existing) {
        canonicalByKey.set(key, { value: ct.name, label: ct.name });
        continue;
      }
      // Prefer EN / ES canonical label when both variants exist
      if (preferredNames.has(ct.name) && !preferredNames.has(existing.value)) {
        canonicalByKey.set(key, { value: ct.name, label: ct.name });
      }
    }

    return [...canonicalByKey.values()].sort((a, b) =>
      a.label.localeCompare(b.label, 'es', { sensitivity: 'base' })
    );
  })();

  const draftStorageKey = authState.user
    ? `${DRAFT_STORAGE_PREFIX}${authState.user.id}`
    : null;

  const persistLocalDraft = useCallback(() => {
    if (!draftStorageKey || isEditMode) return;
    try {
      const draft = {
        reportData,
        components: components.map((c) => ({
          ...c,
          // Files cannot be restored from localStorage; keep count for user notice
          photos: c.photos.filter((p) => !(typeof File !== 'undefined' && p instanceof File)),
          videos: (c.videos || []).filter((p) => !(typeof File !== 'undefined' && p instanceof File)),
          pendingNewPhotos: c.photos.filter((p) => typeof File !== 'undefined' && p instanceof File).length,
        })),
        suggestedParts,
        currentStep,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch (err) {
      console.warn('Could not persist local draft:', err);
    }
  }, [draftStorageKey, isEditMode, reportData, components, suggestedParts, currentStep]);

  // Autosave text draft locally every 20s (survives app switch / tab discard)
  useEffect(() => {
    if (isEditMode || !draftStorageKey) return;
    const timer = window.setInterval(() => persistLocalDraft(), 20000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persistLocalDraft();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isEditMode, draftStorageKey, persistLocalDraft]);

  // Restore local draft for new reports (once)
  useEffect(() => {
    if (isEditMode || !draftStorageKey || draftLoaded) return;
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) {
        setDraftLoaded(true);
        return;
      }
      const draft = JSON.parse(raw);
      if (draft?.reportData) setReportData((prev) => ({ ...prev, ...draft.reportData }));
      if (Array.isArray(draft?.components) && draft.components.length > 0) {
        setComponents(draft.components);
      }
      if (Array.isArray(draft?.suggestedParts)) setSuggestedParts(draft.suggestedParts);
      if (draft?.currentStep) setCurrentStep(Number(draft.currentStep) || 1);
      const pending = (draft.components || []).reduce(
        (n: number, c: { pendingNewPhotos?: number }) => n + (c.pendingNewPhotos || 0),
        0
      );
      if (pending > 0) {
        setSaveSuccess(
          `Local draft restored. Re-attach ${pending} photo(s) that could not be recovered from the browser cache.`
        );
      } else if (draft?.reportData?.clientName) {
        setSaveSuccess('Local draft restored. Use Save Progress to sync to the server.');
      }
    } catch (err) {
      console.warn('Could not restore local draft:', err);
    } finally {
      setDraftLoaded(true);
    }
  }, [isEditMode, draftStorageKey, draftLoaded]);
  // Restore step after create â†’ edit redirect
  useEffect(() => {
    if (!isEditMode) return;
    const stepRaw = sessionStorage.getItem(STEP_STORAGE_KEY);
    if (stepRaw) {
      const step = Number.parseInt(stepRaw, 10);
      if (step >= 1 && step <= 3) setCurrentStep(step);
      sessionStorage.removeItem(STEP_STORAGE_KEY);
    }
  }, [isEditMode]);

  const modelOptions = REPORT_MODEL_OPTIONS;

  const statusOptions = [
    { value: 'CORRECTED', label: 'Corrected' },
    { value: 'PENDING', label: 'Pending' },
  ];

  const mapStoredMedia = (raw: unknown, kind: 'photo' | 'video') => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((p: any) => {
        if (!p) return null;
        if (typeof p === 'string') {
          return { id: `url_${p}`, url: p, filename: p.split('/').pop() || (kind === 'video' ? 'video.mp4' : 'photo.jpg') };
        }
        const rawUrl = p.file_path || p.url;
        if (!rawUrl && p.filename) {
          return {
            id: String(p.id || p.filename),
            url: `/uploads/${p.filename}`,
            filename: p.filename,
          };
        }
        if (!rawUrl) return null;
        const url = rawUrl.startsWith('http') || rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
        return {
          id: String(p.id || url),
          url,
          filename: p.filename || p.original_name || (kind === 'video' ? 'video.mp4' : 'photo.jpg'),
        };
      })
      .filter((p): p is { id: string; url: string; filename: string } => Boolean(p && p.url));
  };

  const hydrateFormFromReport = (r: any) => {
    setReportData({
      clientName: r.client_name || '',
      clientContact: '',
      machineType: r.machine_type || '',
      model: r.model || '',
      serialNumber: r.serial_number || '',
      hourmeter: r.hourmeter?.toString() || '',
      date: r.report_date ? new Date(r.report_date).toISOString().split('T')[0] : '',
      location: '',
      ott: r.ott || '',
      reasonOfService: r.reason_of_service || '',
      conclusions: r.conclusions || '',
      overallSuggestions: r.overall_suggestions || '',
    });

    const loadedComponents = (r.components || []).map((comp: any) => {
      let params: any[] = [];
      if (Array.isArray(comp.parameters)) {
        params = comp.parameters;
      } else if (typeof comp.parameters === 'string') {
        try {
          params = JSON.parse(comp.parameters);
          if (!Array.isArray(params)) params = [];
        } catch {
          params = [];
        }
      }

      let photos: Array<{ id: string; url: string; filename: string; photo_name?: string }> = [];
      if (Array.isArray(comp.photos)) {
        photos = comp.photos
          .map((p: any) => {
            if (typeof p === 'string') {
              return {
                id: `url_${p}`,
                url: p,
                filename: p.split('/').pop() || 'unknown.jpg',
              };
            }
            if (p.file_path) {
              const url = p.file_path.startsWith('http')
                ? p.file_path
                : p.file_path.startsWith('/')
                  ? p.file_path
                  : `/${p.file_path}`;
              return {
                id: String(p.id || `path_${p.filename || url}`),
                url,
                filename: p.filename || p.original_name || 'unknown.jpg',
                photo_name: p.photo_name,
              };
            }
            if (p.url) {
              return {
                id: String(p.id || `url_${p.url}`),
                url: p.url,
                filename: p.filename || 'unknown.jpg',
                photo_name: p.photo_name,
              };
            }
            if (p.filename) {
              return {
                id: String(p.id || `file_${p.filename}`),
                url: `/uploads/${p.filename}`,
                filename: p.filename,
                photo_name: p.photo_name,
              };
            }
            return null;
          })
          .filter((p: { url: string } | null): p is { id: string; url: string; filename: string; photo_name?: string } =>
            Boolean(p && p.url)
          );
      }

      return {
        ...comp,
        id: comp.id,
        type: comp.type || '',
        findings: comp.findings || '',
        status: comp.status || 'PENDING',
        suggestions: comp.suggestions || '',
        priority: comp.priority || 'MEDIUM',
        parameters: params,
        photos,
        videos: mapStoredMedia(comp.videos, 'video'),
      };
    });

    setComponents(loadedComponents);
    setSuggestedParts(
      Array.isArray(r.suggested_parts)
        ? r.suggested_parts.map((p: any) => ({
            partNumber: p.part_number,
            description: p.description,
            quantity: p.quantity,
          }))
        : []
    );
  };

  const mapServerPhotos = (rawPhotos: unknown): ExistingPhoto[] => {
    if (!Array.isArray(rawPhotos)) return [];
    return rawPhotos
      .map((p: any) => {
        if (typeof p === 'string') {
          return {
            id: `url_${p}`,
            url: p,
            filename: p.split('/').pop() || 'unknown.jpg',
          };
        }
        if (p?.file_path) {
          const url = p.file_path.startsWith('http')
            ? p.file_path
            : p.file_path.startsWith('/')
              ? p.file_path
              : `/${p.file_path}`;
          return {
            id: String(p.id || `path_${p.filename || url}`),
            url,
            filename: p.filename || p.original_name || 'unknown.jpg',
            photo_name: p.photo_name,
          };
        }
        if (p?.url) {
          return {
            id: String(p.id || `url_${p.url}`),
            url: p.url,
            filename: p.filename || 'unknown.jpg',
            photo_name: p.photo_name,
          };
        }
        return null;
      })
      .filter((p: ExistingPhoto | null): p is ExistingPhoto => Boolean(p?.url));
  };

  /** After metadata save: attach server component ids without wiping local fields/photos. */
  const patchComponentIdsFromServer = (serverReport: any) => {
    const serverComps = Array.isArray(serverReport?.components) ? serverReport.components : [];
    setComponents((prev) =>
      prev.map((local, index) => {
        const match =
          (local.id && serverComps.find((s: any) => s.id === local.id)) || serverComps[index];
        if (!match?.id) return local;
        return { ...local, id: match.id };
      })
    );
  };

  /**
   * After photo uploads: replace File previews with server URLs but keep all typed fields.
   * Never blank the form if the server payload is incomplete.
   */
  const syncPhotosFromServer = async (reportId: string) => {
    const fresh = await apiService.getReport(reportId);
    if (!fresh?.success || !fresh.data) return;
    queryClient.setQueryData(['report', reportId], fresh);
    const serverComps = Array.isArray(fresh.data.components) ? fresh.data.components : [];
    setComponents((prev) =>
      prev.map((local, index) => {
        const match =
          (local.id && serverComps.find((s: any) => s.id === local.id)) || serverComps[index];
        if (!match) return local;
        const serverPhotos = mapServerPhotos(match.photos);
        const serverVideos = mapServerPhotos(match.videos);
        const localExisting = local.photos.filter(
          (p) => !(typeof File !== 'undefined' && p instanceof File)
        ) as ExistingPhoto[];
        const localVideos = (local.videos || []).filter(
          (p) => !(typeof File !== 'undefined' && p instanceof File)
        ) as ExistingPhoto[];
        return {
          ...local,
          id: match.id || local.id,
          photos: serverPhotos.length > 0 ? serverPhotos : localExisting,
          videos: serverVideos.length > 0 ? serverVideos : localVideos,
        };
      })
    );
    hydratedReportIdRef.current = reportId;
    setInitialized(true);
  };

  // Reset hydrate guard only when switching to a different report id
  useEffect(() => {
    if (!id) return;
    if (hydratedReportIdRef.current && hydratedReportIdRef.current !== id) {
      hydratedReportIdRef.current = null;
      setInitialized(false);
    }
  }, [id]);

  useEffect(() => {
    if (!isEditMode || !id || !reportResponse?.data) return;
    if (hydratedReportIdRef.current === id || initialized) return;
    hydrateFormFromReport(reportResponse.data);
    hydratedReportIdRef.current = id;
    setInitialized(true);
  }, [isEditMode, id, reportResponse, initialized]);

  const validateAllSteps = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Step 1 validation
    if (!reportData.clientName) newErrors.clientName = 'Client name is required';
    if (!reportData.machineType) newErrors.machineType = 'Machine type is required';
    if (!reportData.model) newErrors.model = 'Model is required';
    if (!reportData.serialNumber) newErrors.serialNumber = 'Serial number is required';
    if (!reportData.hourmeter) {
      newErrors.hourmeter = 'Hourmeter reading is required';
    } else if (isNaN(Number(reportData.hourmeter))) {
      newErrors.hourmeter = 'Hourmeter must be a valid number';
    }
    if (!reportData.ott) newErrors.ott = 'OTT is required';
    if (!reportData.reasonOfService) newErrors.reasonOfService = 'Reason of service is required';

    // Step 2 validation
    if (components.length === 0) {
      newErrors.components = 'At least one component assessment is required';
    } else {
      components.forEach((comp, index) => {
        if (!comp.findings) {
          newErrors[`component_${index}_findings`] = `Findings are required for component ${index + 1}`;
        }
      });
    }

    // Validate total number of photos
    const totalPhotos = components.reduce((total, comp) => {
      const newPhotos = comp.photos.filter(p => p instanceof File).length;
      return total + newPhotos;
    }, 0);
    
    if (totalPhotos > MAX_PHOTOS_PER_COMPONENT * Math.max(components.length, 1)) {
      newErrors.photos = `Too many photos. Maximum is ${MAX_PHOTOS_PER_COMPONENT} photos per component.`;
    }

    // Step 3 validation
    if (!reportData.conclusions) newErrors.conclusions = 'Conclusions are required';
    
    // Step 4 (suggested parts) validation
    suggestedParts.forEach((part, index) => {
      if (!part.partNumber) {
        newErrors[`part_${index}_partNumber`] = `Part number is required for part ${index + 1}`;
      }
      if (!part.description) {
        newErrors[`part_${index}_description`] = `Description is required for part ${index + 1}`;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!reportData.clientName) newErrors.clientName = 'Client name is required';
      if (!reportData.machineType) newErrors.machineType = 'Machine type is required';
      if (!reportData.model) newErrors.model = 'Model is required';
      if (!reportData.serialNumber) newErrors.serialNumber = 'Serial number is required';
      if (!reportData.hourmeter) {
        newErrors.hourmeter = 'Hourmeter reading is required';
      } else if (isNaN(Number(reportData.hourmeter))) {
        newErrors.hourmeter = 'Hourmeter must be a valid number';
      }
      if (!reportData.ott) newErrors.ott = 'OTT is required';
      if (!reportData.reasonOfService) newErrors.reasonOfService = 'Reason of service is required';
    } else if (step === 2) {
      if (components.length === 0) {
        newErrors.components = 'At least one component assessment is required';
      }
    } else if (step === 3) {
      if (!reportData.conclusions) newErrors.conclusions = 'Conclusions are required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
  };

  const addComponent = () => {
    const defaultType = componentTypes.length > 0 ? componentTypes[0].name : '';
    setComponents(prev => [...prev, {
      type: defaultType,
      findings: '',
      parameters: [],
      status: 'PENDING',
      suggestions: '',
      photos: [],
      videos: [],
      priority: 'MEDIUM',
    }]);
  };

  const updateComponent = (index: number, field: string, value: any) => {
    setComponents(prev => prev.map((comp, i) => 
      i === index ? { ...comp, [field]: value } : comp
    ));
  };

  const removeComponent = (index: number) => {
    setComponents(prev => prev.filter((_, i) => i !== index));
  };

  const addPart = () => {
    setSuggestedParts(prev => [...prev, {
      partNumber: '',
      description: '',
      quantity: 1,
    }]);
  };

  const updatePart = (index: number, field: keyof typeof suggestedParts[0], value: any) => {
    setSuggestedParts(prev => prev.map((part, i) => 
      i === index ? { ...part, [field]: value } : part
    ));
  };

  const removePart = (index: number) => {
    setSuggestedParts(prev => prev.filter((_, i) => i !== index));
  };

  const addParameter = (componentIdx: number) => {
    setComponents(prev => prev.map((comp, i) =>
      i === componentIdx
        ? { ...comp, parameters: [...(comp.parameters || []), { name: '', minValue: 0, maxValue: 0, measuredValue: 0, corrected: false, observation: '' }] }
        : comp
    ));
  };

  const updateParameter = (componentIdx: number, paramIdx: number, field: string, value: any) => {
    setComponents(prev => prev.map((comp, i) => {
      if (i !== componentIdx) return comp;
      const newParams = (comp.parameters || []).map((param, j) =>
        j === paramIdx ? { ...param, [field]: value } : param
      );
      return { ...comp, parameters: newParams };
    }));
  };

  const removeParameter = (componentIdx: number, paramIdx: number) => {
    const newComponents = [...components];
    newComponents[componentIdx].parameters = newComponents[componentIdx].parameters?.filter((_, i) => i !== paramIdx);
    setComponents(newComponents);
  };

  const deleteExistingPhoto = async (photoId: string) => {
    try {
      await apiService.deletePhoto(photoId);
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw error;
    }
  };

  const deleteExistingVideo = async (videoId: string) => {
    try {
      await apiService.deleteVideo(videoId);
    } catch (error) {
      console.error('Error deleting video:', error);
      throw error;
    }
  };

  const updatePhotoName = async (photoId: string, newName: string) => {
    try {
      await apiService.updatePhotoName(photoId, newName);
    } catch (error) {
      console.error('Error updating photo name:', error);
      throw error;
    }
  };

  const buildReportPayload = (componentList = components) => ({
    client_name: reportData.clientName,
    machine_type: reportData.machineType,
    model: reportData.model,
    serial_number: reportData.serialNumber,
    hourmeter: Number(reportData.hourmeter) || 0,
    report_date: reportData.date,
    ott: reportData.ott,
    reason_of_service: reportData.reasonOfService,
    conclusions: reportData.conclusions,
    overall_suggestions: reportData.overallSuggestions,
    status: isEditMode ? (reportResponse?.data?.status || 'draft') : 'draft',
    components: componentList.map((c) => ({
      id: c.id,
      type: c.type,
      findings: c.findings || '',
      parameters: c.parameters,
      status: c.status,
      suggestions: c.suggestions,
      priority: c.priority,
      photos: c.photos
        .map((p) => {
          if (typeof File !== 'undefined' && p instanceof File) return null;
          return typeof p === 'object' && 'url' in p ? p.url : null;
        })
        .filter((p) => p !== null),
    })),
    suggested_parts: suggestedParts.map((p) => ({
      part_number: p.partNumber,
      description: p.description,
      quantity: Number(p.quantity) || 1,
    })),
  });

  const buildFormData = (
    options: {
      componentList?: typeof components;
      photoFilesByIndex?: Map<number, File[]>;
      videoFilesByIndex?: Map<number, File[]>;
    } = {}
  ): FormData => {
    const componentList = options.componentList || components;
    const formData = new FormData();
    formData.append('reportData', JSON.stringify(buildReportPayload(componentList)));

    if (options.photoFilesByIndex) {
      options.photoFilesByIndex.forEach((files, componentIndex) => {
        files.forEach((photo) => {
          formData.append(`photos_${componentIndex}`, photo, photo.name);
        });
      });
    }

    if (options.videoFilesByIndex) {
      options.videoFilesByIndex.forEach((files, componentIndex) => {
        files.forEach((video) => {
          formData.append(`videos_${componentIndex}`, video, video.name);
        });
      });
    }

    return formData;
  };

  const collectAndCompressNewPhotos = async (): Promise<Map<number, File[]>> => {
    const byIndex = new Map<number, File[]>();
    for (let i = 0; i < components.length; i++) {
      const files = components[i].photos.filter(
        (p): p is File => typeof File !== 'undefined' && p instanceof File
      );
      if (files.length === 0) continue;
      const compressed = await compressImageFiles(files);
      byIndex.set(i, compressed);
    }
    return byIndex;
  };

  const collectAndCompressNewVideos = async (): Promise<Map<number, File[]>> => {
    const byIndex = new Map<number, File[]>();
    for (let i = 0; i < components.length; i++) {
      const files = (components[i].videos || []).filter(
        (p): p is File => typeof File !== 'undefined' && p instanceof File
      );
      if (files.length === 0) continue;
      const compressed = await compressVideoFiles(files);
      byIndex.set(i, compressed);
    }
    return byIndex;
  };

  const uploadVideosInBatches = async (
    reportId: string,
    videoFilesByIndex: Map<number, File[]>,
    componentList: typeof components
  ) => {
    const queue: { componentIndex: number; file: File }[] = [];
    videoFilesByIndex.forEach((files, componentIndex) => {
      files.forEach((file) => queue.push({ componentIndex, file }));
    });

    const pending = [...queue];
    const concurrency = 2;
    const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
      while (pending.length > 0) {
        const item = pending.shift();
        if (!item) return;
        const componentId = componentList[item.componentIndex]?.id;
        if (!componentId) {
          const batchMap = new Map<number, File[]>();
          batchMap.set(item.componentIndex, [item.file]);
          const formData = buildFormData({ componentList, videoFilesByIndex: batchMap });
          await apiService.updateReport(reportId, formData);
          continue;
        }
        await apiService.uploadComponentVideo(reportId, componentId, item.file);
      }
    });
    await Promise.all(workers);
  };

  /** Upload compressed photos in small batches to avoid serverless body/timeout limits. */
  const uploadPhotosInBatches = async (
    reportId: string,
    photoFilesByIndex: Map<number, File[]>,
    componentList: typeof components
  ) => {
    const queue: { componentIndex: number; file: File }[] = [];
    photoFilesByIndex.forEach((files, componentIndex) => {
      files.forEach((file) => queue.push({ componentIndex, file }));
    });

    for (let offset = 0; offset < queue.length; offset += PHOTO_UPLOAD_BATCH_SIZE) {
      const slice = queue.slice(offset, offset + PHOTO_UPLOAD_BATCH_SIZE);
      const batchMap = new Map<number, File[]>();
      slice.forEach(({ componentIndex, file }) => {
        const list = batchMap.get(componentIndex) || [];
        list.push(file);
        batchMap.set(componentIndex, list);
      });
      const formData = buildFormData({ componentList, photoFilesByIndex: batchMap });
      await apiService.updateReport(reportId, formData);
    }
  };

  /** Progress save: only header fields required so user can continue later. */
  const validateProgressSave = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!reportData.clientName) newErrors.clientName = 'Client name is required to save progress';
    if (!reportData.machineType) newErrors.machineType = 'Machine type is required to save progress';
    if (!reportData.model) newErrors.model = 'Model is required to save progress';
    if (!reportData.serialNumber) newErrors.serialNumber = 'Serial number is required to save progress';
    if (!reportData.hourmeter || Number.isNaN(Number(reportData.hourmeter))) {
      newErrors.hourmeter = 'Hourmeter is required to save progress';
    }
    if (!reportData.ott) newErrors.ott = 'OTT is required to save progress';
    if (!reportData.date) newErrors.date = 'Report date is required to save progress';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setCurrentStep(1);
      return false;
    }
    return true;
  };

  const handleSave = async (options: { finalize: boolean }) => {
    const { finalize } = options;
    setSaveSuccess(null);
    setErrors({});

    if (!authState.user) {
      setErrors({ submit: 'User not authenticated' });
      return;
    }

    if (finalize) {
      if (!validateAllSteps()) {
        if (
          !reportData.clientName ||
          !reportData.machineType ||
          !reportData.model ||
          !reportData.serialNumber ||
          !reportData.hourmeter ||
          !reportData.ott ||
          !reportData.reasonOfService
        ) {
          setCurrentStep(1);
        } else if (components.length === 0 || components.some((c) => !c.findings)) {
          setCurrentStep(2);
        } else {
          setCurrentStep(3);
        }
        return;
      }
    } else if (!validateProgressSave()) {
      return;
    }

    // Snapshot local fields so a failed photo batch never blanks the form
    const localComponentsSnapshot = components;
    const localReportSnapshot = reportData;
    const localPartsSnapshot = suggestedParts;

    setIsSaving(true);
    try {
      const photoFilesByIndex = await collectAndCompressNewPhotos();

      // 1) Save text/metadata first (no photo binaries) â€” survives even if photo upload fails
      const metaFormData = buildFormData({ componentList: localComponentsSnapshot });
      let reportId = id;

      if (isEditMode && id) {
        await updateReportMutation.mutateAsync({ id, updates: metaFormData });
        reportId = id;
      } else {
        const created = await createReportMutation.mutateAsync(metaFormData);
        reportId = created?.data?.id;
        if (draftStorageKey) localStorage.removeItem(draftStorageKey);
        if (!reportId) {
          setErrors({ submit: 'Report saved but id was not returned. Open it from the reports list.' });
          navigate('/reports');
          return;
        }
      }

      // 2) Sync component ids from server (needed for stable photo attachment)
      const afterMeta = await apiService.getReport(reportId);
      if (afterMeta?.success && afterMeta.data) {
        patchComponentIdsFromServer(afterMeta.data);
        queryClient.setQueryData(['report', reportId], afterMeta);
      }

      const serverComponents = Array.isArray(afterMeta?.data?.components)
        ? afterMeta.data.components
        : [];
      const componentsWithIds = localComponentsSnapshot.map((c, index) => {
        const matched =
          (c.id && serverComponents.find((s: { id?: string }) => s.id === c.id)) ||
          serverComponents[index];
        return matched?.id ? { ...c, id: matched.id } : c;
      });

      // 3) Upload photos in small batches
      if (photoFilesByIndex.size > 0 && reportId) {
        try {
          await uploadPhotosInBatches(reportId, photoFilesByIndex, componentsWithIds);
          // Prevent duplicate re-upload if sync is slow/fails
          setComponents(
            componentsWithIds.map((c) => ({
              ...c,
              photos: c.photos.filter(
                (p) => !(typeof File !== 'undefined' && p instanceof File)
              ),
            }))
          );
        } catch (photoErr) {
          console.error('Photo batch upload error:', photoErr);
          setReportData(localReportSnapshot);
          setComponents(localComponentsSnapshot);
          setSuggestedParts(localPartsSnapshot);
          const msg = photoErr instanceof Error ? photoErr.message : 'Photo upload failed';
          setErrors({
            submit: `Report text was saved, but some photos failed (${msg}). You can try Save Progress again.`,
          });
          if (!isEditMode && reportId) {
            sessionStorage.setItem(STEP_STORAGE_KEY, String(currentStep));
            navigate(`/reports/${reportId}/edit`, { replace: true });
          }
          return;
        }
      }

      const videoFilesByIndex = await collectAndCompressNewVideos();
      if (videoFilesByIndex.size > 0 && reportId) {
        try {
          await uploadVideosInBatches(reportId, videoFilesByIndex, componentsWithIds);
          setComponents(
            componentsWithIds.map((c) => ({
              ...c,
              photos: c.photos.filter((p) => !(typeof File !== 'undefined' && p instanceof File)),
              videos: (c.videos || []).filter((p) => !(typeof File !== 'undefined' && p instanceof File)),
            }))
          );
        } catch (videoErr) {
          console.error('Video batch upload error:', videoErr);
          setReportData(localReportSnapshot);
          setComponents(localComponentsSnapshot);
          setSuggestedParts(localPartsSnapshot);
          const msg = videoErr instanceof Error ? videoErr.message : 'Video upload failed';
          setErrors({
            submit: `Report text was saved, but a video failed (${msg}). You can try Save Progress again.`,
          });
          if (!isEditMode && reportId) {
            sessionStorage.setItem(STEP_STORAGE_KEY, String(currentStep));
            navigate(`/reports/${reportId}/edit`, { replace: true });
          }
          return;
        }
      }

      // 4) Replace File previews with server URLs â€” do not wipe text fields
      try {
        await syncPhotosFromServer(reportId);
      } catch (syncErr) {
        console.warn('Saved OK but photo sync failed:', syncErr);
        setReportData(localReportSnapshot);
        setSuggestedParts(localPartsSnapshot);
      }

      if (finalize) {
        if (draftStorageKey) localStorage.removeItem(draftStorageKey);
        navigate('/reports');
        return;
      }

      setSaveSuccess('Progress saved. You can keep editing or leave and come back later.');
      if (!isEditMode && reportId) {
        sessionStorage.setItem(STEP_STORAGE_KEY, String(currentStep));
        navigate(`/reports/${reportId}/edit`, { replace: true });
      }
    } catch (error) {
      console.error('Error saving report:', error);
      // Never clear the form on error â€” restore snapshot
      setReportData(localReportSnapshot);
      setComponents(localComponentsSnapshot);
      setSuggestedParts(localPartsSnapshot);

      if (error instanceof Error) {
        if (error.message.includes('not authorized') || error.message.includes('not found')) {
          setErrors({ submit: 'You are not authorized to edit this report or the report was not found.' });
        } else if (error.message.includes('CLOSED')) {
          setErrors({ submit: 'This report is closed and cannot be edited.' });
        } else if (
          error.message.includes('Request too large') ||
          error.message.includes('413')
        ) {
          setErrors({
            submit: `The request is too large. Photos are compressed automatically â€” try fewer photos (max ${MAX_PHOTOS_PER_COMPONENT} per component).`,
          });
        } else if (error.message.includes('Too many files')) {
          setErrors({ submit: 'Too many photos. Please reduce the number of photos.' });
        } else if (error.message.includes('File too large')) {
          setErrors({ submit: 'One or more photos are too large. Maximum size is 30MB per photo.' });
        } else if (
          error.message.includes('Failed to parse response') ||
          error.message.includes('Server timeout')
        ) {
          setErrors({
            submit:
              'Server could not complete the response (timeout or size limit). Your text may already be saved â€” refresh the page, then add remaining photos with Save Progress.',
          });
        } else {
          setErrors({ submit: `Error saving report: ${error.message}` });
        }
      } else {
        setErrors({ submit: 'Error saving report. Please try again.' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    await handleSave({ finalize: true });
  };

  const handleSaveProgress = async () => {
    await handleSave({ finalize: false });
  };

  if (isLoadingReport) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
      </DashboardLayout>
    );
  }

  const renderStep1 = () => (
    <div className="space-y-8 min-h-[400px]">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-slate-900">Header Section</h2>
        <p className="text-slate-600 mt-1">Fill in the basic information about the machinery inspection</p>
      </div>
      
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 min-h-[80px] border border-gray-200 p-2 rounded">
            <Input
              label="Client Name"
              value={reportData.clientName}
              onChange={(e) => setReportData(prev => ({ ...prev, clientName: e.target.value }))}
              error={errors.clientName}
              placeholder="Enter client name"
              required
            />
          </div>
          
          <div className="space-y-2 min-h-[80px] border border-gray-200 p-2 rounded">
            <Select
              label="Machine Type"
              options={machineTypeOptions}
              value={reportData.machineType}
              onChange={(e) => setReportData(prev => ({ ...prev, machineType: e.target.value }))}
              error={errors.machineType}
              placeholder="Select machine type"
              required
            />
          </div>
          
          <div className="space-y-2 min-h-[80px] border border-gray-200 p-2 rounded">
            <Select
              label="Model"
              options={modelOptions}
              value={reportData.model}
              onChange={(e) => setReportData(prev => ({ ...prev, model: e.target.value }))}
              error={errors.model}
              placeholder="Select model"
              required
            />
          </div>
          
          <div className="space-y-2 min-h-[80px] border border-gray-200 p-2 rounded">
            <Input
              label="Serial Number"
              value={reportData.serialNumber}
              onChange={(e) => setReportData(prev => ({ ...prev, serialNumber: e.target.value }))}
              error={errors.serialNumber}
              placeholder="Enter serial number"
              required
            />
          </div>
          
          <div className="space-y-2 min-h-[80px] border border-gray-200 p-2 rounded">
            <Input
              label="Hourmeter"
              type="number"
              value={reportData.hourmeter}
              onChange={(e) => setReportData(prev => ({ ...prev, hourmeter: e.target.value }))}
              error={errors.hourmeter}
              placeholder="Enter hourmeter reading"
              required
            />
          </div>
          
          <div className="space-y-2 min-h-[80px] border border-gray-200 p-2 rounded">
            <Input
              label="Report Date"
              type="date"
              value={reportData.date}
              onChange={(e) => setReportData(prev => ({ ...prev, date: e.target.value }))}
              required
            />
          </div>
          
          <div className="space-y-2 min-h-[80px] border border-gray-200 p-2 rounded">
            <Input
              label="OTT"
              value={reportData.ott}
              onChange={(e) => setReportData(prev => ({ ...prev, ott: e.target.value }))}
              error={errors.ott}
              placeholder="Enter OTT"
              required
            />
          </div>
          
          <div className="space-y-2 min-h-[80px] border border-gray-200 p-2 rounded">
            <Textarea
              label="Reason of Service"
              value={reportData.reasonOfService}
              onChange={(e) => setReportData(prev => ({ ...prev, reasonOfService: e.target.value }))}
              error={errors.reasonOfService}
              placeholder="Enter the reason for the service"
              rows={4}
              required
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6 min-h-[400px]">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-slate-900">Component Assessment</h2>
        <p className="text-slate-600 mt-1">Assess the condition of each component</p>
      </div>

      {errors.components && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
            <p className="text-red-800">{errors.components}</p>
          </div>
        </div>
      )}

      {errors.photos && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
            <p className="text-red-800">{errors.photos}</p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {components.map((component, index) => (
          <div key={index} className="bg-slate-50 rounded-lg border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-900">Component {index + 1}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeComponent(index)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Select
                label="Component Selection"
                options={componentTypeOptions}
                value={component.type}
                onChange={(e) => updateComponent(index, 'type', e.target.value)}
                required
              />
              <Select
                label="Status"
                options={statusOptions}
                value={component.status}
                onChange={(e) => updateComponent(index, 'status', e.target.value)}
                required
              />
            </div>

            <div className="space-y-4">
              <Textarea
                label="Findings"
                value={component.findings}
                onChange={(e) => updateComponent(index, 'findings', e.target.value)}
                error={errors[`component_${index}_findings`]}
                placeholder="Describe the findings for this component"
                required
              />

              {/* Parameters Table */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-md font-semibold text-slate-800">Parameters</h4>
                  <Button type="button" size="sm" variant="outline" onClick={() => addParameter(index)}>
                    <Plus className="w-4 h-4 mr-1" /> Add Parameter
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full border text-sm">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border px-2 py-1">Name</th>
                        <th className="border px-2 py-1">Min Value</th>
                        <th className="border px-2 py-1">Max Value</th>
                        <th className="border px-2 py-1">Measured Value</th>
                        <th className="border px-2 py-1">Corrected</th>
                        <th className="border px-2 py-1">Observation</th>
                        <th className="border px-2 py-1">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(component.parameters || []).map((param, paramIdx) => (
                        <tr key={paramIdx}>
                          <td className="border px-2 py-1">
                            <Input
                              value={param.name}
                              onChange={e => updateParameter(index, paramIdx, 'name', e.target.value)}
                              placeholder="Parameter name"
                            />
                          </td>
                          <td className="border px-2 py-1">
                            <Input
                              type="number"
                              value={param.minValue}
                              onChange={e => updateParameter(index, paramIdx, 'minValue', Number(e.target.value))}
                              placeholder="Min"
                            />
                          </td>
                          <td className="border px-2 py-1">
                            <Input
                              type="number"
                              value={param.maxValue}
                              onChange={e => updateParameter(index, paramIdx, 'maxValue', Number(e.target.value))}
                              placeholder="Max"
                            />
                          </td>
                          <td className="border px-2 py-1">
                            <Input
                              type="number"
                              value={param.measuredValue}
                              onChange={e => updateParameter(index, paramIdx, 'measuredValue', Number(e.target.value))}
                              placeholder="Measured"
                            />
                          </td>
                          <td className="border px-2 py-1 text-center">
                            <input
                              type="checkbox"
                              checked={param.corrected}
                              onChange={e => updateParameter(index, paramIdx, 'corrected', e.target.checked)}
                            />
                          </td>
                          <td className="border px-2 py-1">
                            <Input
                              value={param.observation}
                              onChange={e => updateParameter(index, paramIdx, 'observation', e.target.value)}
                              placeholder="Observation"
                            />
                          </td>
                          <td className="border px-2 py-1 text-center">
                            <Button type="button" size="sm" variant="ghost" className="text-red-600" onClick={() => removeParameter(index, paramIdx)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(component.parameters || []).length === 0 && (
                    <div className="text-slate-400 text-xs py-2 text-center">No parameters added</div>
                  )}
                </div>
              </div>

              <Textarea
                label="Suggestions"
                value={component.suggestions || ''}
                onChange={(e) => updateComponent(index, 'suggestions', e.target.value)}
                placeholder="Provide suggestions for this component"
              />

              {/* Photo Upload Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-start">
                  <AlertCircle className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Photo Upload Guidelines:</p>
                    <ul className="text-xs space-y-1">
                      <li>â€¢ Maximum 30MB per photo</li>
                      <li>â€¢ Maximum {MAX_PHOTOS_PER_COMPONENT} photos per component section</li>
                      <li>â€¢ Supported formats: JPEG, PNG, GIF, WebP</li>
                      <li>â€¢ Photos are compressed in the browser before upload</li>
                      <li>â€¢ Photos will be resized to ~1280px max for reliable saving</li>
                    </ul>
                  </div>
                </div>
              </div>

              <PhotoUpload
                label="Photos"
                photos={component.photos}
                onPhotosChange={(photos) => updateComponent(index, 'photos', photos)}
                onDeleteExistingPhoto={deleteExistingPhoto}
                onPhotoNameChange={updatePhotoName}
                maxPhotos={MAX_PHOTOS_PER_COMPONENT}
              />

              <VideoUpload
                videos={component.videos || []}
                onVideosChange={(videos) => updateComponent(index, 'videos', videos)}
                onDeleteExistingVideo={deleteExistingVideo}
                maxVideos={MAX_VIDEOS_PER_COMPONENT}
              />
            </div>
          </div>
        ))}
      </div>

      <Button onClick={addComponent} variant="outline">
        <Plus className="w-4 h-4 mr-2" />
        Add Component
      </Button>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-8 min-h-[400px]">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold text-slate-900">Conclusions & Parts</h2>
        <p className="text-slate-600 mt-1">Provide conclusions and suggested parts</p>
      </div>

      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
        <div className="space-y-6">
          <Textarea
            label="Conclusions"
            value={reportData.conclusions}
            onChange={(e) => setReportData(prev => ({ ...prev, conclusions: e.target.value }))}
            error={errors.conclusions}
            placeholder="Provide overall conclusions about the machinery inspection"
            required
          />

          <Textarea
            label="Overall Suggestions"
            value={reportData.overallSuggestions}
            onChange={(e) => setReportData(prev => ({ ...prev, overallSuggestions: e.target.value }))}
            placeholder="Provide overall suggestions for the machinery"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-slate-900">Suggested Parts and Activities</h3>
          <Button onClick={addPart} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Part
          </Button>
        </div>

        <div className="space-y-4">
          {suggestedParts.map((part, index) => (
            <div key={index} className="flex items-center space-x-4 p-4 border border-slate-200 rounded-lg">
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  placeholder="Part Number"
                  value={part.partNumber}
                  onChange={(e) => updatePart(index, 'partNumber', e.target.value)}
                  error={errors[`part_${index}_partNumber`]}
                />
                <Input
                  placeholder="Description"
                  value={part.description}
                  onChange={(e) => updatePart(index, 'description', e.target.value)}
                  error={errors[`part_${index}_description`]}
                />
                <Input
                  type="number"
                  placeholder="Quantity"
                  value={part.quantity.toString()}
                  onChange={(e) => updatePart(index, 'quantity', parseInt(e.target.value) || 1)}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removePart(index)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            {isEditMode ? 'Edit Report' : 'New Report'}
          </h1>
          <p className="text-slate-600 mt-1">
            {isEditMode ? 'Update the technical inspection report' : 'Create a new technical inspection report'}
          </p>
        </div>

        {errors.submit && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
              <p className="text-red-800">{errors.submit}</p>
            </div>
          </div>
        )}

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {step}
                </div>
                {step < 3 && (
                  <div
                    className={`w-16 h-1 mx-2 ${
                      currentStep > step ? 'bg-blue-600' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm text-slate-600">
            <span>Header</span>
            <span>Components</span>
            <span>Conclusions</span>
          </div>
        </div>

        {/* Step Content */}
        {renderStepContent()}

        {/* Navigation */}
        <div className="flex flex-wrap justify-between gap-3 mt-8">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap gap-3 justify-end items-start">
            <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveProgress}
              disabled={isSaving || createReportMutation.isPending || updateReportMutation.isPending}
              title="Save progress and keep editing"
            >
              {isSaving || createReportMutation.isPending || updateReportMutation.isPending ? (
                <LoadingSpinner />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Progress
            </Button>
            {saveSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 max-w-xs text-right">
                <p className="text-green-800 text-sm">{saveSuccess}</p>
              </div>
            )}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 max-w-xs text-right">
                <p className="text-red-800 text-sm">{errors.submit}</p>
              </div>
            )}
            </div>

            {currentStep < 3 ? (
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSaving || createReportMutation.isPending || updateReportMutation.isPending}
              >
                {isSaving || createReportMutation.isPending || updateReportMutation.isPending ? (
                  <LoadingSpinner />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isEditMode ? 'Finish & Exit' : 'Save & Finish'}
              </Button>
            )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};