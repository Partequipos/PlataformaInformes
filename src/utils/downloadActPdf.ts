import { apiService } from '../services/api';
import { sanitizeFilename } from './filenameSanitizer';

async function savePdf(path: string, filename: string, errorMessage: string): Promise<void> {
  const response = await fetch(`${apiService.getBaseUrl()}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiService.getToken() || ''}`,
    },
  });
  if (!response.ok) {
    throw new Error(errorMessage);
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function downloadActPdf(actId: string, fileLabel: string): Promise<void> {
  const filename = `${sanitizeFilename(fileLabel) || 'Acta'}.pdf`;
  await savePdf(`/acts/${actId}/pdf`, filename, 'No se pudo generar el PDF del acta');
}

export async function downloadBlankDeliveryPdf(): Promise<void> {
  await savePdf(
    '/acts/delivery/blank-pdf',
    'Acta_Entrega_formato_en_blanco.pdf',
    'No se pudo descargar el formato en blanco'
  );
}
