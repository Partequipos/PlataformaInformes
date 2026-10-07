import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { upload, handleUploadError } from '../middleware/upload';
import { validateFileUpload } from '../middleware/fileValidation';
import {
  createAct,
  getActs,
  getActById,
  updateAct,
  deleteAct,
  deleteActPhoto,
  deleteActVideo,
  deleteActAttachment,
} from '../controllers/actController';

const router = Router();
const internalOnly = requireRole(['admin', 'user']);

router.use(authenticateToken);
router.use(internalOnly);

router.get('/', getActs);
router.delete('/photos/:photoId', deleteActPhoto);
router.delete('/videos/:videoId', deleteActVideo);
router.delete('/attachments/:attachmentId', deleteActAttachment);
router.get('/:id', getActById);
router.post('/', upload.any(), handleUploadError, validateFileUpload, createAct);
router.put('/:id', upload.any(), handleUploadError, validateFileUpload, updateAct);
router.delete('/:id', deleteAct);

export default router;
