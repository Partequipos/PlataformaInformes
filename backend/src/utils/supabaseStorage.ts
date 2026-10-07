import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { sanitizeFileName } from '../middleware/fileValidation';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const bucket = process.env.SUPABASE_BUCKET!;

export async function uploadFileToSupabase(fileBuffer: Buffer, fileName: string, mimetype: string) {
  let bufferToUpload = fileBuffer;
  let uploadMime = mimetype || 'application/octet-stream';
  let safeName = sanitizeFileName(fileName) || `photo_${Date.now()}.jpg`;

  const isPdf = uploadMime === 'application/pdf' || /\.pdf$/i.test(safeName);
  const isRaster =
    !isPdf &&
    (uploadMime === 'image/jpeg' ||
      uploadMime === 'image/jpg' ||
      uploadMime === 'image/pjpeg' ||
      uploadMime === 'image/png' ||
      uploadMime === 'image/webp' ||
      uploadMime === 'image/heic' ||
      uploadMime === 'image/heif' ||
      (uploadMime === 'application/octet-stream' && /\.(jpe?g|png|webp|heic|heif)$/i.test(safeName)) ||
      /\.(jpe?g|png|webp|heic|heif)$/i.test(safeName));

  // Normalize to JPEG when sharp can decode (HEIC may fail on some hosts — then upload original)
  if (isRaster) {
    try {
      bufferToUpload = await sharp(fileBuffer)
        .rotate()
        .resize({ width: 800, height: 800, fit: 'inside' })
        .jpeg({ quality: 60, progressive: true })
        .toBuffer();
      uploadMime = 'image/jpeg';
      if (!/\.jpe?g$/i.test(safeName)) {
        safeName = `${safeName.replace(/\.[^.]+$/, '') || 'photo'}.jpg`;
      }
    } catch (err) {
      console.warn('Sharp compress skipped, uploading original buffer:', err);
    }
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(safeName, bufferToUpload, {
      contentType: uploadMime,
      upsert: true,
    });

  if (error) throw error;

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(safeName);
  return {
    publicUrl: publicUrlData.publicUrl,
    size: bufferToUpload.length,
    mimetype: uploadMime,
    storedFileName: safeName,
  };
}

export async function deleteFilesFromSupabase(fileUrl: string): Promise<void> {
  try {
    const urlParts = fileUrl.split('/');
    const fileName = urlParts[urlParts.length - 1];

    const { error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);

    if (error) {
      console.error('Error deleting file from Supabase:', error);
      throw error;
    }

    console.log(`File ${fileName} deleted successfully from Supabase Storage`);
  } catch (error) {
    console.error('Error in deleteFilesFromSupabase:', error);
    throw error;
  }
} 