import multer from 'multer';
import { Request } from 'express';

// Configure storage (memory)
const storage = multer.memoryStorage();

const IMAGE_EXT = /\.(jpe?g|jpe|png|gif|webp|bmp|svg|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)$/i;
const PDF_EXT = /\.pdf$/i;

const isVideoUpload = (file: Express.Multer.File): boolean => {
  const field = file.fieldname || '';
  return field === 'video' || field.startsWith('videos_');
};

const isPdfUpload = (file: Express.Multer.File): boolean => {
  const field = file.fieldname || '';
  return field === 'attachment' || field.startsWith('attachments_') || field.startsWith('pdfs_');
};

// File filter — images / videos / PDF attachments (actas)
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const mime = (file.mimetype || '').toLowerCase();
  const name = file.originalname || '';

  if (isVideoUpload(file)) {
    const videoMime = mime.startsWith('video/');
    const videoExt = VIDEO_EXT.test(name);
    const octetVideo = (mime === 'application/octet-stream' || mime === '') && videoExt;
    if (videoMime || videoExt || octetVideo) {
      cb(null, true);
      return;
    }
    cb(new Error('Only video files are allowed'));
    return;
  }

  if (isPdfUpload(file)) {
    const pdfMime = mime === 'application/pdf';
    const pdfExt = PDF_EXT.test(name);
    const octetPdf = (mime === 'application/octet-stream' || mime === '') && pdfExt;
    if (pdfMime || pdfExt || octetPdf) {
      cb(null, true);
      return;
    }
    cb(new Error('Only PDF files are allowed'));
    return;
  }

  const mimeOk = mime.startsWith('image/');
  const extOk = IMAGE_EXT.test(name);
  const octetOk = mime === 'application/octet-stream' && extOk;

  if (mimeOk || extOk || octetOk) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

// Configure upload
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: Number.parseInt(process.env.MAX_FILE_SIZE || '31457280', 10), // 30MB por archivo
    files: 100 // Max 100 archivos por request
  }
});

// Error handling middleware
export const handleUploadError = (error: Error, req: Request, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 30MB per file'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum is 100 files per request'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field in request'
      });
    }
  }
  
  if (
    error.message === 'Only image files are allowed' ||
    error.message === 'Only video files are allowed' ||
    error.message === 'Only PDF files are allowed'
  ) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  
  next(error);
}; 