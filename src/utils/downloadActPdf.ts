import { apiService } from '../services/api';
import { sanitizeFilename } from './filenameSanitizer';

export async function downloadActPdf(actId: string, fileLabel: string): Promise<void> {
  const response = await fetch(`${apiService.getBaseUrl()}/acts/${actId}/pdf`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiService.getToken() || ''}`,
    },
  });
  if (!response.ok) {
    throw new Error('No se pudo generar el PDF del acta');
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilename(fileLabel) || 'Acta'}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
