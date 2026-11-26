import { Request, Response } from 'express';
import pool from '../config/database';
import { Report, CreateReportRequest, ApiResponse } from '../types';
import { PDFService } from '../services/pdfService';
import { EmailService } from '../services/emailService';
import { uploadFileToSupabase } from '../utils/supabaseStorage';

const MAX_VIDEOS_PER_COMPONENT = 10;

const storeVideoFile = async (
  db: { query: (text: string, params?: unknown[]) => Promise<unknown> },
  reportId: string,
  componentId: string,
  video: Express.Multer.File
): Promise<void> => {
  const uniqueFileName = `video_${reportId}_${componentId}_${Date.now()}_${video.originalname}`;
  const { publicUrl, size, mimetype, storedFileName } = await uploadFileToSupabase(
    video.buffer,
    uniqueFileName,
    video.mimetype || 'video/mp4'
  );
  try {
    await db.query(
      `INSERT INTO videos (component_id, filename, original_name, file_path, file_size, mime_type, video_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        componentId,
        storedFileName || uniqueFileName,
        video.originalname,
        publicUrl,
        size,
        mimetype,
        video.originalname,
      ]
    );
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === '42P01') {
      throw new Error('Videos table is missing. Run add-videos-table.sql on the database.');
    }
    throw err;
  }
};

const insertComponentVideos = async (
  db: { query: (text: string, params?: unknown[]) => Promise<unknown> },
  reportId: string,
  componentId: string,
  files: Express.Multer.File[],
  index: number
): Promise<void> => {
  const newVideos = files.filter((file) => file.fieldname === `videos_${index}`);
  for (const video of newVideos) {
    await storeVideoFile(db, reportId, componentId, video);
  }
};

export const createReport = async (req: Request, res: Response) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = (req as any).user.id;
    const reportDataRaw = req.body.reportData;
    if (!reportDataRaw) {
      throw new Error('Missing reportData in request');
    }
    let reportData;
    try {
      reportData = JSON.parse(reportDataRaw);
    } catch (err) {
      throw new Error('Invalid JSON in reportData');
    }
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    
    // hourmeter is INTEGER in DB; coerce decimals (e.g. "64.7") to integer
    const hourmeter =
      reportData.hourmeter != null && reportData.hourmeter !== ''
        ? Math.round(Number(reportData.hourmeter))
        : 0;

    // Create report
    const reportResult = await client.query(
      `INSERT INTO reports (
        user_id, client_name, machine_type, model, serial_number, 
        hourmeter, report_date, ott, reason_of_service, conclusions, overall_suggestions, general_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
      RETURNING *`,
      [
        userId,
        reportData.client_name,
        reportData.machine_type,
        reportData.model,
        reportData.serial_number,
        hourmeter,
        reportData.report_date,
        reportData.ott,
        reportData.reason_of_service || null,
        reportData.conclusions || null,
        reportData.overall_suggestions || null,
        reportData.general_status || 'PENDING'
      ]
    );
    
    const report = reportResult.rows[0];
    
    // Create components
    if (reportData.components && reportData.components.length > 0) {
      for (const [index, component] of reportData.components.entries()) {
        const componentResult = await client.query(
          `INSERT INTO components (
            report_id, type, findings, parameters, status, suggestions, priority
          ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
          RETURNING *`,
          [
            report.id,
            component.type,
            component.findings,
            component.parameters ? JSON.stringify(component.parameters) : null,
            component.status,
            component.suggestions || null,
            component.priority
          ]
        );
        
        const componentId = componentResult.rows[0].id;
        
        // Handle photos if any
        const componentPhotos = files.filter(
          (file) => file.fieldname === `photos_${index}`
        );

        if (componentPhotos.length > 0) {
          for (const photo of componentPhotos) {
            // Generar nombre único para el archivo en Supabase Storage
            const timestamp = Date.now();
            const uniqueFileName = `report_${report.id}_component_${componentId}_${timestamp}_${photo.originalname}`;
            
            // Subir a Supabase Storage y obtener info de la imagen comprimida
            const { publicUrl, size, mimetype, storedFileName } = await uploadFileToSupabase(
              photo.buffer,
              uniqueFileName,
              photo.mimetype
            );
            await client.query(
              `INSERT INTO photos (
                component_id, filename, original_name, file_path, file_size, mime_type, photo_name
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [
                componentId,
                storedFileName || uniqueFileName,
                photo.originalname,
                publicUrl,
                size,
                mimetype,
                photo.originalname, // Default photo name is the original filename
              ]
            );
          }
        }
        await insertComponentVideos(client, report.id, componentId, files, index);
      }
    }
    
    // Create suggested parts
    if (reportData.suggested_parts && reportData.suggested_parts.length > 0) {
      for (const part of reportData.suggested_parts) {
        await client.query(
          `INSERT INTO suggested_parts (
            report_id, part_number, description, quantity
          ) VALUES ($1, $2, $3, $4)`,
          [report.id, part.part_number, part.description, part.quantity]
        );
      }
    }
    
    await client.query('COMMIT');
    
    const response: ApiResponse<Report> = {
      success: true,
      data: report,
      message: 'Report created successfully'
    };
    
    res.status(201).json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create report error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    client.release();
  }
};

/** Insert one clip without rewriting the whole report. Used so several videos can save faster. */
export const addComponentVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const reportId = req.params.id;
    const componentId = typeof req.body.componentId === 'string' ? req.body.componentId.trim() : '';
    const file = req.file;
    const currentUser = (req as any).user;

    if (!componentId || !file) {
      res.status(400).json({ success: false, error: 'Component and video file are required' });
      return;
    }

    const reportResult = await pool.query(
      'SELECT user_id, general_status FROM reports WHERE id = $1',
      [reportId]
    );
    if (reportResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Report not found' });
      return;
    }
    const report = reportResult.rows[0];
    const isOwner = currentUser.id === report.user_id;
    const isAdmin = currentUser.role === 'admin';
    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, error: 'You are not authorized to edit this report' });
      return;
    }
    if (report.general_status === 'CLOSED') {
      res.status(403).json({ success: false, error: 'Report is CLOSED and cannot be edited' });
      return;
    }

    const componentResult = await pool.query(
      'SELECT id FROM components WHERE id = $1 AND report_id = $2',
      [componentId, reportId]
    );
    if (componentResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Component not found' });
      return;
    }

    const countResult = await pool.query(
      'SELECT COUNT(*)::int AS total FROM videos WHERE component_id = $1',
      [componentId]
    );
    if (countResult.rows[0].total >= MAX_VIDEOS_PER_COMPONENT) {
      res.status(400).json({
        success: false,
        error: `Maximum of ${MAX_VIDEOS_PER_COMPONENT} videos per component`,
      });
      return;
    }

    await storeVideoFile(pool, reportId, componentId, file);
    res.json({ success: true, message: 'Video saved' });
  } catch (error) {
    console.error('Add component video error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message.includes('add-videos-table')) {
      res.status(500).json({ success: false, error: message });
      return;
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getReports = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    
    let query = '';
    let countQuery = '';
    let filterClauses: string[] = [];
    let params: any[] = [];

    // Filtros dinámicos
    if (req.query.machineType) {
      filterClauses.push('LOWER(r.machine_type) = $' + (params.length + 1));
      params.push(String(req.query.machineType).toLowerCase());
    }
    if (req.query.clientName) {
      const clientName = Array.isArray(req.query.clientName) ? req.query.clientName[0] : req.query.clientName;
      filterClauses.push('LOWER(r.client_name) LIKE $' + (params.length + 1));
      params.push(`%${String(clientName).toLowerCase()}%`);
    }
    if (req.query.userFullName) {
      filterClauses.push('LOWER(u.full_name) LIKE $' + (params.length + 1));
      params.push(`%${String(req.query.userFullName).toLowerCase()}%`);
    }
    if (req.query.serialNumber) {
      filterClauses.push('LOWER(r.serial_number) LIKE $' + (params.length + 1));
      params.push(`%${String(req.query.serialNumber).toLowerCase()}%`);
    }
    if (req.query.general_status) {
      filterClauses.push('r.general_status = $' + (params.length + 1));
      params.push(req.query.general_status);
    }

    // Construir WHERE
    const whereClause = filterClauses.length ? 'WHERE ' + filterClauses.join(' AND ') : '';

    // Construir countQuery correctamente
    if (userRole === 'admin') {
      // LIMIT y OFFSET siempre al final
      params.push(limit, offset);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;
      
      query = `SELECT r.*, u.full_name as user_full_name 
               FROM reports r 
               JOIN users u ON r.user_id = u.id 
               ${whereClause}
               ORDER BY r.created_at DESC 
               LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
      // Si hay filtro por userFullName, el JOIN debe estar en countQuery
      if (req.query.userFullName) {
        countQuery = `SELECT COUNT(*) FROM reports r JOIN users u ON r.user_id = u.id ${whereClause}`;
      } else {
        countQuery = `SELECT COUNT(*) FROM reports r ${whereClause}`;
      }
    } else if (userRole === 'viewer') {
      // Los viewers solo ven sus propios reportes
      filterClauses.push('r.user_id = $' + (params.length + 1));
      params.push(userId);
      const viewerWhereClause = filterClauses.length ? 'WHERE ' + filterClauses.join(' AND ') : '';
      
      // LIMIT y OFFSET siempre al final
      params.push(limit, offset);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;
      
      query = `SELECT r.*, u.full_name as user_full_name 
               FROM reports r 
               JOIN users u ON r.user_id = u.id 
               ${viewerWhereClause}
               ORDER BY r.created_at DESC 
               LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
      if (req.query.userFullName) {
        countQuery = `SELECT COUNT(*) FROM reports r JOIN users u ON r.user_id = u.id ${viewerWhereClause}`;
      } else {
        countQuery = `SELECT COUNT(*) FROM reports r ${viewerWhereClause}`;
      }
    } else {
      // Usuarios regulares ven todos los reportes
      // LIMIT y OFFSET siempre al final
      params.push(limit, offset);
      const limitIdx = params.length - 1;
      const offsetIdx = params.length;
      
      query = `SELECT r.*, u.full_name as user_full_name 
               FROM reports r 
               JOIN users u ON r.user_id = u.id 
               ${whereClause}
               ORDER BY r.created_at DESC 
               LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
      if (req.query.userFullName) {
        countQuery = `SELECT COUNT(*) FROM reports r JOIN users u ON r.user_id = u.id ${whereClause}`;
      } else {
        countQuery = `SELECT COUNT(*) FROM reports r ${whereClause}`;
      }
    }
    
    console.log('--- SQL DEBUG ---');
    console.log('Query:', query);
    console.log('Params:', params);
    const reportsResult = await pool.query(query, params);
    
    // Solo pasar los parámetros de filtro a countQuery (sin limit/offset)
    let countParams;
    if (userRole === 'viewer') {
      // Para viewers, incluir el filtro de user_id pero sin limit/offset
      countParams = params.slice(0, params.length - 2);
    } else {
      // Para admin y user, solo los parámetros de filtro
      countParams = params.slice(0, params.length - 2);
    }
    const countResult = await pool.query(countQuery, countParams.length > 0 ? countParams : undefined);
    
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);
    
    const response: ApiResponse<{
      reports: Report[];
      pagination: {
        page: number;
        limit: number;
        totalCount: number;
        totalPages: number;
      };
    }> = {
      success: true,
      data: {
        reports: reportsResult.rows,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages
        }
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('Get reports error:', error);
    if (error instanceof Error && (error as any).stack) {
      console.error('Stack:', (error as any).stack);
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const getReportById = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const reportId = req.params.id;
    
    // Get report with components, photos, and suggested parts
    let reportResult;
    if (userRole === 'viewer') {
      // Los viewers solo pueden ver sus propios reportes
      reportResult = await pool.query(
        `SELECT r.*, u.full_name as user_full_name FROM reports r JOIN users u ON r.user_id = u.id WHERE r.id = $1 AND r.user_id = $2`,
        [reportId, userId]
      );
    } else {
      // Admin y usuarios regulares pueden ver cualquier reporte
      reportResult = await pool.query(
        `SELECT r.*, u.full_name as user_full_name FROM reports r JOIN users u ON r.user_id = u.id WHERE r.id = $1`,
        [reportId]
      );
    }
    
    if (reportResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Report not found'
      });
      return;
    }
    
    const report = reportResult.rows[0];
    
    // Get components (stable order so photos_N indices stay aligned with UI)
    const componentsResult = await pool.query(
      'SELECT * FROM components WHERE report_id = $1 ORDER BY created_at ASC, id ASC',
      [reportId]
    );
    
    // Get photos for each component
    const components = await Promise.all(
      componentsResult.rows.map(async (component) => {
        const photosResult = await pool.query(
          'SELECT * FROM photos WHERE component_id = $1 ORDER BY created_at ASC, id ASC',
          [component.id]
        );
        // No sobrescribir file_path, devolver tal cual está en la base de datos
        const photos = photosResult.rows;
        let videos: unknown[] = [];
        try {
          const videosResult = await pool.query(
            'SELECT * FROM videos WHERE component_id = $1 ORDER BY created_at ASC, id ASC',
            [component.id]
          );
          videos = videosResult.rows;
        } catch (videoErr: unknown) {
          const code = (videoErr as { code?: string })?.code;
          if (code !== '42P01') throw videoErr;
        }
        return {
          ...component,
          parameters: component.parameters ? JSON.parse(component.parameters) : [],
          photos,
          videos
        };
      })
    );
    
    // Get suggested parts
    const partsResult = await pool.query(
      'SELECT * FROM suggested_parts WHERE report_id = $1',
      [reportId]
    );
    
    const fullReport = {
      ...report,
      components,
      suggested_parts: partsResult.rows
    };
    
    const response: ApiResponse<Report> = {
      success: true,
      data: fullReport
    };
    
    res.json(response);
  } catch (error) {
    console.error('Get report by id error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export const updateReport = async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  
  try {
    const reportId = req.params.id;
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    
    // Verificar estado actual
    const { rows } = await client.query('SELECT general_status, user_id FROM reports WHERE id = $1', [reportId]);
    if (!rows[0]) {
      res.status(404).json({ success: false, error: 'Report not found' });
      return;
    }
    
    if (rows[0].general_status === 'CLOSED') {
      res.status(403).json({ success: false, error: 'Report is CLOSED and cannot be edited' });
      return;
    }

    // Check if user is admin or owner of the report
    const reportOwnerId = rows[0].user_id;
    const isOwner = userId === reportOwnerId;
    const isAdmin = userRole === 'admin';

    if (!isOwner && !isAdmin) {
      res.status(403).json({ success: false, error: 'You are not authorized to edit this report' });
      return;
    }

    const reportDataRaw = req.body.reportData;
    if (!reportDataRaw) {
      res.status(400).json({ success: false, error: 'Missing reportData in request' });
      return;
    }
    
    let reportData;
    try {
      reportData = JSON.parse(reportDataRaw);
    } catch (err) {
      res.status(400).json({ success: false, error: 'Invalid JSON in reportData' });
      return;
    }
    
    const files = (req.files as Express.Multer.File[] | undefined) || [];

    // hourmeter is INTEGER in DB; coerce decimals to integer
    const hourmeter =
      reportData.hourmeter != null && reportData.hourmeter !== ''
        ? Math.round(Number(reportData.hourmeter))
        : 0;

    // Start transaction after all validations
    await client.query('BEGIN');

    // 1. Update the main report details
    const updatedReportResult = await client.query(
      `UPDATE reports SET 
        client_name = $1, machine_type = $2, model = $3, serial_number = $4,
        hourmeter = $5, report_date = $6, ott = $7, reason_of_service = $8, conclusions = $9,
        overall_suggestions = $10, status = $11, general_status = COALESCE($12, general_status)
      WHERE id = $13 RETURNING *`,
      [
        reportData.client_name, reportData.machine_type, reportData.model,
        reportData.serial_number, hourmeter, reportData.report_date,
        reportData.ott, reportData.reason_of_service, reportData.conclusions, reportData.overall_suggestions,
        reportData.status, reportData.general_status, reportId,
      ]
    );

    if (updatedReportResult.rows.length === 0) {
      throw new Error('Failed to update report.');
    }

    // --- Components and Photos Synchronization ---
    const feComponents = reportData.components || [];
    const feComponentIds = feComponents.map((c: any) => c.id).filter(Boolean);

    // Delete components that are no longer in the frontend
    if (feComponentIds.length === 0) {
      await client.query('DELETE FROM components WHERE report_id = $1', [reportId]);
    } else {
      await client.query(
        'DELETE FROM components WHERE report_id = $1 AND NOT (id = ANY($2::uuid[]))',
        [reportId, feComponentIds]
      );
    }
    
    for (const [index, componentData] of feComponents.entries()) {
      let componentId = componentData.id;

      // Upsert component (create if no id, update if id exists)
      if (componentId) {
        // Update existing component
        await client.query(
          `UPDATE components SET type=$1, findings=$2, parameters=$3, status=$4, suggestions=$5, priority=$6 
           WHERE id=$7`,
          [componentData.type, componentData.findings, componentData.parameters ? JSON.stringify(componentData.parameters) : null, componentData.status, componentData.suggestions, componentData.priority, componentId]
        );
      } else {
        // Create new component
        const newCompResult = await client.query(
          `INSERT INTO components (report_id, type, findings, parameters, status, suggestions, priority)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [reportId, componentData.type, componentData.findings, componentData.parameters ? JSON.stringify(componentData.parameters) : null, componentData.status, componentData.suggestions, componentData.priority]
        );
        componentId = newCompResult.rows[0].id;
      }
      
      // --- Photos Synchronization for this component ---
      // Mantener todas las fotos existentes y solo agregar las nuevas
      // No eliminamos fotos existentes para evitar pérdida accidental de datos
      
      // Si el componente ya existe, mantener todas las fotos existentes
      // Solo agregar las nuevas fotos subidas
      
      // Add new photos
      const newPhotos = files.filter(file => file.fieldname === `photos_${index}`);
      for (const photo of newPhotos) {
        // Generar nombre único para el archivo en Supabase Storage
        const timestamp = Date.now();
        const uniqueFileName = `report_${reportId}_component_${componentId}_${timestamp}_${photo.originalname}`;
        
        // Subir a Supabase Storage y obtener info de la imagen comprimida
        const { publicUrl, size, mimetype, storedFileName } = await uploadFileToSupabase(
          photo.buffer,
          uniqueFileName,
          photo.mimetype
        );
        await client.query(
          `INSERT INTO photos (component_id, filename, original_name, file_path, file_size, mime_type, photo_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            componentId,
            storedFileName || uniqueFileName,
            photo.originalname,
            publicUrl,
            size,
            mimetype,
            photo.originalname
          ]
        );
      }
      await insertComponentVideos(client, reportId, componentId, files, index);
    }

    // --- Suggested Parts Synchronization (simple delete and recreate) ---
    await client.query('DELETE FROM suggested_parts WHERE report_id = $1', [reportId]);
    if (reportData.suggested_parts && reportData.suggested_parts.length > 0) {
      for (const part of reportData.suggested_parts) {
        await client.query(
          `INSERT INTO suggested_parts (report_id, part_number, description, quantity)
           VALUES ($1, $2, $3, $4)`,
          [reportId, part.part_number, part.description, part.quantity]
        );
      }
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      data: updatedReportResult.rows[0],
      message: 'Report updated successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update report error:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('not authorized')) {
        res.status(404).json({ success: false, error: error.message });
      } else if (error.message.includes('add-videos-table')) {
        res.status(500).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: 'Internal server error' });
      }
    } else {
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  } finally {
    client.release();
  }
};

export const deleteReport = async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const reportId = req.params.id;
    
    // Only admin users can delete reports
    if (userRole !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Only administrators can delete reports'
      });
      return;
    }
    
    // Check if report exists
    const existingReport = await client.query(
      'SELECT id, client_name FROM reports WHERE id = $1',
      [reportId]
    );
    
    if (existingReport.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Report not found'
      });
      return;
    }
    
    // Get all photos associated with this report for deletion from Supabase
    const componentsResult = await client.query(
      'SELECT id FROM components WHERE report_id = $1',
      [reportId]
    );
    
    const componentIds = componentsResult.rows.map(row => row.id);
    let photosToDelete: any[] = [];
    
    if (componentIds.length > 0) {
      const photosResult = await client.query(
        'SELECT file_path FROM photos WHERE component_id = ANY($1)',
        [componentIds]
      );
      photosToDelete = photosResult.rows;
      try {
        const videosResult = await client.query(
          'SELECT file_path FROM videos WHERE component_id = ANY($1)',
          [componentIds]
        );
        photosToDelete = photosToDelete.concat(videosResult.rows);
      } catch (videoErr: unknown) {
        const code = (videoErr as { code?: string })?.code;
        if (code !== '42P01') throw videoErr;
      }
    }
    
    // Delete photos from Supabase Storage
    if (photosToDelete.length > 0) {
      try {
        const { deleteFilesFromSupabase } = await import('../utils/supabaseStorage');
        for (const photo of photosToDelete) {
          if (photo.file_path && photo.file_path.startsWith('http')) {
            await deleteFilesFromSupabase(photo.file_path);
          }
        }
      } catch (error) {
        console.error('Error deleting photos from Supabase:', error);
        // Continue with deletion even if photo deletion fails
      }
    }
    
    // Delete report (cascade will handle related records)
    await client.query(
      'DELETE FROM reports WHERE id = $1',
      [reportId]
    );
    
    await client.query('COMMIT');
    
    const response: ApiResponse = {
      success: true,
      message: 'Report and all associated data deleted successfully'
    };
    
    res.json(response);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete report error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  } finally {
    client.release();
  }
};

// Función para sanitizar nombres de archivo (remover caracteres especiales)
const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[áäâà]/g, 'a')
    .replace(/[éëêè]/g, 'e')
    .replace(/[íïîì]/g, 'i')
    .replace(/[óöôò]/g, 'o')
    .replace(/[úüûù]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[ÁÄÂÀ]/g, 'A')
    .replace(/[ÉËÊÈ]/g, 'E')
    .replace(/[ÍÏÎÌ]/g, 'I')
    .replace(/[ÓÖÔÒ]/g, 'O')
    .replace(/[ÚÜÛÙ]/g, 'U')
    .replace(/[Ñ]/g, 'N')
    .replace(/[^a-zA-Z0-9\s\-_\.]/g, '_') // Reemplazar caracteres especiales con _
    .replace(/\s+/g, '_') // Reemplazar espacios con _
    .replace(/_+/g, '_') // Reemplazar múltiples _ con uno solo
    .trim();
};

export const downloadPDF = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const reportId = req.params.id;
    
    // Get report with all related data
    const reportResult = await pool.query(
      `SELECT r.*, u.full_name as user_full_name FROM reports r JOIN users u ON r.user_id = u.id WHERE r.id = $1`,
      [reportId]
    );
    
    if (reportResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Report not found'
      });
      return;
    }
    
    const report = reportResult.rows[0];
    
    // Get components
    const componentsResult = await pool.query(
      'SELECT * FROM components WHERE report_id = $1',
      [reportId]
    );
    
    // Get photos for each component
    const components = await Promise.all(
      componentsResult.rows.map(async (component) => {
        const photosResult = await pool.query(
          'SELECT * FROM photos WHERE component_id = $1',
          [component.id]
        );
        return {
          ...component,
          parameters: component.parameters ? JSON.parse(component.parameters) : [],
          photos: photosResult.rows
        };
      })
    );
    
    // Get suggested parts
    const suggestedPartsResult = await pool.query(
      'SELECT * FROM suggested_parts WHERE report_id = $1',
      [reportId]
    );
    
    // Flatten photos array
    const allPhotos = components.flatMap(component => component.photos);
    
    // Generate PDF based on user role (viewers must not receive company logo)
    const role = String(userRole || '').toLowerCase().trim();
    let pdfBuffer: Buffer;
    if (role === 'viewer') {
      pdfBuffer = await PDFService.generatePDFWithoutLogo(
        report,
        components,
        allPhotos,
        suggestedPartsResult.rows
      );
    } else {
      pdfBuffer = await PDFService.generatePDF(
        report,
        components,
        allPhotos,
        suggestedPartsResult.rows
      );
    }
    
    // Set response headers
    const filename = `Reporte_${report.client_name}_${report.machine_type}_${new Date(report.report_date).toISOString().split('T')[0]}.pdf`;
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(filename)}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Download PDF error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF'
    });
  }
};

export const sendReportEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const userRole = String((req as any).user?.role || '').toLowerCase().trim();
    const reportId = req.params.id;
    const { emails, subject, message } = req.body;
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Email addresses are required'
      });
      return;
    }
    
    // Get report with all related data
    const reportResult = await pool.query(
      'SELECT * FROM reports WHERE id = $1 AND user_id = $2',
      [reportId, userId]
    );
    
    if (reportResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Report not found'
      });
      return;
    }
    
    const report = reportResult.rows[0];
    
    // Get components
    const componentsResult = await pool.query(
      'SELECT * FROM components WHERE report_id = $1',
      [reportId]
    );
    
    // Get photos for each component
    const components = await Promise.all(
      componentsResult.rows.map(async (component) => {
        const photosResult = await pool.query(
          'SELECT * FROM photos WHERE component_id = $1',
          [component.id]
        );
        return {
          ...component,
          parameters: component.parameters ? JSON.parse(component.parameters) : [],
          photos: photosResult.rows
        };
      })
    );
    
    // Get suggested parts
    const suggestedPartsResult = await pool.query(
      'SELECT * FROM suggested_parts WHERE report_id = $1',
      [reportId]
    );
    
    // Flatten photos array
    const allPhotos = components.flatMap(component => component.photos);
    
    // Viewers must not receive company logo in emailed PDFs either
    const pdfBuffer = userRole === 'viewer'
      ? await PDFService.generatePDFWithoutLogo(
          report,
          components,
          allPhotos,
          suggestedPartsResult.rows
        )
      : await PDFService.generatePDF(
          report,
          components,
          allPhotos,
          suggestedPartsResult.rows
        );
    
    // Send emails
    const emailResults = await EmailService.sendMultipleEmails(
      emails,
      report,
      pdfBuffer,
      subject,
      message
    );
    
    const response: ApiResponse<{
      success: string[];
      failed: string[];
      totalSent: number;
      totalFailed: number;
    }> = {
      success: true,
      data: {
        success: emailResults.success,
        failed: emailResults.failed,
        totalSent: emailResults.success.length,
        totalFailed: emailResults.failed.length
      },
      message: `Email sent to ${emailResults.success.length} recipients${emailResults.failed.length > 0 ? `, ${emailResults.failed.length} failed` : ''}`
    };
    
    res.json(response);
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send email'
    });
  }
};

export const testEmailService = async (req: Request, res: Response): Promise<void> => {
  try {
    const isConnected = await EmailService.testConnection();
    
    if (isConnected) {
      res.json({
        success: true,
        message: 'Email service is working correctly'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Email service connection failed'
      });
    }
  } catch (error) {
    console.error('Test email service error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test email service'
    });
  }
}; 

// Endpoint para cerrar el reporte
export const closeReport = async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const reportId = req.params.id;
    const { rows } = await client.query('SELECT general_status FROM reports WHERE id = $1', [reportId]);
    if (!rows[0]) {
      res.status(404).json({ success: false, error: 'Report not found' });
      return;
    }
    if (rows[0].general_status === 'CLOSED') {
      res.status(400).json({ success: false, error: 'Report is already CLOSED' });
      return;
    }
    await client.query('UPDATE reports SET general_status = $1 WHERE id = $2', ['CLOSED', reportId]);
    res.json({ success: true, message: 'Report closed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  } finally {
    client.release();
  }
}; 