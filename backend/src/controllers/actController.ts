import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { uploadFileToSupabase, deleteFilesFromSupabase } from '../utils/supabaseStorage';
import { sanitizeFileName } from '../middleware/fileValidation';

const INTERNAL_ROLES = new Set(['admin', 'user']);

type ActPayload = {
  act_type: 'entry' | 'exit';
  location: string;
  act_date?: string;
  status?: 'draft' | 'completed';
  equipment_type?: string;
  brand?: string;
  line_series?: string;
  model_type?: string;
  pin_serial?: string;
  engine_number?: string;
  internal_code?: string;
  manufacture_date?: string;
  load_capacity?: string;
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
};

function denyIfViewer(req: AuthRequest, res: Response): boolean {
  const role = req.user?.role || '';
  if (!INTERNAL_ROLES.has(role)) {
    res.status(403).json({ success: false, error: 'Actas disponibles solo para personal interno' });
    return true;
  }
  return false;
}

function parseActData(body: Record<string, unknown>): ActPayload {
  const raw = body.actData ?? body;
  if (typeof raw === 'string') {
    return JSON.parse(raw) as ActPayload;
  }
  return raw as ActPayload;
}

function collectFiles(req: AuthRequest): Express.Multer.File[] {
  if (Array.isArray(req.files)) {
    return req.files as Express.Multer.File[];
  }
  if (req.file) {
    return [req.file];
  }
  return [];
}

async function loadActBundle(actId: string) {
  const actResult = await pool.query('SELECT * FROM equipment_acts WHERE id = $1', [actId]);
  if (actResult.rows.length === 0) {
    return null;
  }
  const [photos, videos, attachments] = await Promise.all([
    pool.query('SELECT * FROM equipment_act_photos WHERE act_id = $1 ORDER BY created_at', [actId]),
    pool.query('SELECT * FROM equipment_act_videos WHERE act_id = $1 ORDER BY created_at', [actId]),
    pool.query('SELECT * FROM equipment_act_attachments WHERE act_id = $1 ORDER BY created_at', [actId]),
  ]);
  return {
    ...actResult.rows[0],
    photos: photos.rows,
    videos: videos.rows,
    attachments: attachments.rows,
  };
}

async function storeMediaFiles(
  actId: string,
  files: Express.Multer.File[]
): Promise<void> {
  for (const file of files) {
    const field = file.fieldname || '';
    const isVideo = field === 'video' || field.startsWith('videos_');
    const isPdf =
      field === 'attachment' || field.startsWith('attachments_') || field.startsWith('pdfs_');

    const prefix = isVideo ? 'act_video' : isPdf ? 'act_pdf' : 'act_photo';
    const safe = sanitizeFileName(file.originalname) || `${prefix}_${Date.now()}`;
    const storedName = `${prefix}_${actId}_${Date.now()}_${safe}`;
    const mime = isPdf
      ? 'application/pdf'
      : file.mimetype || (isVideo ? 'video/mp4' : 'image/jpeg');

    const uploaded = await uploadFileToSupabase(file.buffer, storedName, mime);

    if (isVideo) {
      await pool.query(
        `INSERT INTO equipment_act_videos
          (act_id, filename, original_name, file_path, file_size, mime_type, video_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          actId,
          uploaded.storedFileName,
          file.originalname,
          uploaded.publicUrl,
          uploaded.size,
          uploaded.mimetype,
          file.originalname,
        ]
      );
    } else if (isPdf) {
      await pool.query(
        `INSERT INTO equipment_act_attachments
          (act_id, filename, original_name, file_path, file_size, mime_type, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          actId,
          uploaded.storedFileName,
          file.originalname,
          uploaded.publicUrl,
          uploaded.size,
          uploaded.mimetype,
          'upload',
        ]
      );
    } else {
      await pool.query(
        `INSERT INTO equipment_act_photos
          (act_id, filename, original_name, file_path, file_size, mime_type, photo_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          actId,
          uploaded.storedFileName,
          file.originalname,
          uploaded.publicUrl,
          uploaded.size,
          uploaded.mimetype,
          file.originalname,
        ]
      );
    }
  }
}

const ACT_COLUMNS = [
  'act_type',
  'location',
  'act_date',
  'status',
  'equipment_type',
  'brand',
  'line_series',
  'model_type',
  'pin_serial',
  'engine_number',
  'internal_code',
  'manufacture_date',
  'load_capacity',
  'gps_serial',
  'gps_install_date',
  'motive',
  'works',
  'mechanical_state',
  'lubrication',
  'operation_test',
  'deliverer_name',
  'deliverer_cc',
  'deliverer_signature',
  'receiver_name',
  'receiver_cc',
  'receiver_signature',
] as const;

export const createAct = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    if (denyIfViewer(req, res)) return;

    const data = parseActData(req.body as Record<string, unknown>);
    if (!data.act_type || !['entry', 'exit'].includes(data.act_type)) {
      res.status(400).json({ success: false, error: 'act_type debe ser entry o exit' });
      return;
    }
    if (!data.location?.trim()) {
      res.status(400).json({ success: false, error: 'location es requerido' });
      return;
    }

    await client.query('BEGIN');
    const insert = await client.query(
      `INSERT INTO equipment_acts (
        user_id, act_type, location, act_date, status,
        equipment_type, brand, line_series, model_type, pin_serial, engine_number,
        internal_code, manufacture_date, load_capacity, gps_serial, gps_install_date,
        motive, works, mechanical_state, lubrication, operation_test,
        deliverer_name, deliverer_cc, deliverer_signature,
        receiver_name, receiver_cc, receiver_signature
      ) VALUES (
        $1,$2,$3,COALESCE($4::date, CURRENT_DATE),COALESCE($5,'draft'),
        $6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27
      ) RETURNING id`,
      [
        req.user?.id,
        data.act_type,
        data.location.trim(),
        data.act_date || null,
        data.status || 'draft',
        data.equipment_type || null,
        data.brand || null,
        data.line_series || null,
        data.model_type || null,
        data.pin_serial || null,
        data.engine_number || null,
        data.internal_code || null,
        data.manufacture_date || null,
        data.load_capacity || null,
        data.gps_serial || null,
        data.gps_install_date || null,
        data.motive || null,
        data.works || null,
        data.mechanical_state || null,
        data.lubrication || null,
        data.operation_test || null,
        data.deliverer_name || null,
        data.deliverer_cc || null,
        data.deliverer_signature || null,
        data.receiver_name || null,
        data.receiver_cc || null,
        data.receiver_signature || null,
      ]
    );

    const actId = insert.rows[0].id as string;
    await client.query('COMMIT');

    await storeMediaFiles(actId, collectFiles(req));
    const bundle = await loadActBundle(actId);
    res.status(201).json({ success: true, data: bundle });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('createAct error:', error);
    res.status(500).json({ success: false, error: 'Error al crear el acta' });
  } finally {
    client.release();
  }
};

export const getActs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (denyIfViewer(req, res)) return;

    const actType = typeof req.query.act_type === 'string' ? req.query.act_type : null;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const offset = (page - 1) * limit;

    const params: unknown[] = [];
    let where = 'WHERE 1=1';
    if (actType === 'entry' || actType === 'exit') {
      params.push(actType);
      where += ` AND act_type = $${params.length}`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM equipment_acts ${where}`,
      params
    );
    params.push(limit, offset);
    const listResult = await pool.query(
      `SELECT id, act_type, location, act_date, status, equipment_type, brand, model_type,
              pin_serial, internal_code, created_at, updated_at, user_id
       FROM equipment_acts ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      success: true,
      data: {
        items: listResult.rows,
        total: countResult.rows[0].total,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error('getActs error:', error);
    res.status(500).json({ success: false, error: 'Error al listar actas' });
  }
};

export const getActById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (denyIfViewer(req, res)) return;
    const act = await loadActBundle(req.params.id);
    if (!act) {
      res.status(404).json({ success: false, error: 'Acta no encontrada' });
      return;
    }
    res.json({ success: true, data: act });
  } catch (error) {
    console.error('getActById error:', error);
    res.status(500).json({ success: false, error: 'Error al obtener el acta' });
  }
};

export const updateAct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (denyIfViewer(req, res)) return;
    const actId = req.params.id;
    const existing = await pool.query('SELECT id FROM equipment_acts WHERE id = $1', [actId]);
    if (existing.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Acta no encontrada' });
      return;
    }

    const data = parseActData(req.body as Record<string, unknown>);
    const sets: string[] = [];
    const values: unknown[] = [];

    for (const col of ACT_COLUMNS) {
      if (data[col] !== undefined) {
        values.push(data[col]);
        sets.push(`${col} = $${values.length}`);
      }
    }

    if (sets.length > 0) {
      values.push(actId);
      await pool.query(
        `UPDATE equipment_acts SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length}`,
        values
      );
    }

    await storeMediaFiles(actId, collectFiles(req));
    const bundle = await loadActBundle(actId);
    res.json({ success: true, data: bundle });
  } catch (error) {
    console.error('updateAct error:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar el acta' });
  }
};

export const deleteAct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (denyIfViewer(req, res)) return;
    const actId = req.params.id;
    const bundle = await loadActBundle(actId);
    if (!bundle) {
      res.status(404).json({ success: false, error: 'Acta no encontrada' });
      return;
    }

    const urls = [
      ...bundle.photos.map((p: { file_path: string }) => p.file_path),
      ...bundle.videos.map((v: { file_path: string }) => v.file_path),
      ...bundle.attachments.map((a: { file_path: string }) => a.file_path),
    ];
    for (const url of urls) {
      try {
        await deleteFilesFromSupabase(url);
      } catch (err) {
        console.warn('deleteAct storage warn:', err);
      }
    }

    await pool.query('DELETE FROM equipment_acts WHERE id = $1', [actId]);
    res.json({ success: true, data: true });
  } catch (error) {
    console.error('deleteAct error:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar el acta' });
  }
};

async function deleteMediaRow(
  table: 'equipment_act_photos' | 'equipment_act_videos' | 'equipment_act_attachments',
  id: string
): Promise<string | null> {
  const result = await pool.query(`DELETE FROM ${table} WHERE id = $1 RETURNING file_path`, [id]);
  return result.rows[0]?.file_path || null;
}

export const deleteActPhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (denyIfViewer(req, res)) return;
    const path = await deleteMediaRow('equipment_act_photos', req.params.photoId);
    if (!path) {
      res.status(404).json({ success: false, error: 'Foto no encontrada' });
      return;
    }
    await deleteFilesFromSupabase(path).catch(() => undefined);
    res.json({ success: true, data: true });
  } catch (error) {
    console.error('deleteActPhoto error:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar foto' });
  }
};

export const deleteActVideo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (denyIfViewer(req, res)) return;
    const path = await deleteMediaRow('equipment_act_videos', req.params.videoId);
    if (!path) {
      res.status(404).json({ success: false, error: 'Video no encontrado' });
      return;
    }
    await deleteFilesFromSupabase(path).catch(() => undefined);
    res.json({ success: true, data: true });
  } catch (error) {
    console.error('deleteActVideo error:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar video' });
  }
};

export const deleteActAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (denyIfViewer(req, res)) return;
    const path = await deleteMediaRow('equipment_act_attachments', req.params.attachmentId);
    if (!path) {
      res.status(404).json({ success: false, error: 'Adjunto no encontrado' });
      return;
    }
    await deleteFilesFromSupabase(path).catch(() => undefined);
    res.json({ success: true, data: true });
  } catch (error) {
    console.error('deleteActAttachment error:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar adjunto' });
  }
};
