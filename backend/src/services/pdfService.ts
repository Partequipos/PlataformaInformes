import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { Report, Component, Photo, SuggestedPart } from '../types';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { formatStoredText } from '../utils/richText';

export class PDFService {
  private static processTextWithLineBreaks(text: string): string {
    return formatStoredText(text);
  }

  private static async getLogoBase64(): Promise<string> {
    const logoUrl = 'https://res.cloudinary.com/dbufrzoda/image/upload/v1750457354/Captura_de_pantalla_2025-06-20_170819_wzmyli.png';
    try {
      const response = await axios.get(logoUrl, { responseType: 'arraybuffer' });
      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      return `data:image/png;base64,${base64}`;
    } catch (error) {
      console.error('Error downloading logo for PDF:', error);
      return '';
    }
  }

  /** Resolve component type label whether it is a string or { name }. */
  private static getTypeLabel(type: unknown): string {
    if (typeof type === 'string') return type;
    if (type && typeof type === 'object' && 'name' in (type as Record<string, unknown>)) {
      return String((type as { name: unknown }).name ?? '');
    }
    return String(type ?? '');
  }

  /** Full normalized label (both languages) for matching. */
  private static normalizeTypeFull(type: unknown): string {
    return this.getTypeLabel(type)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Job Site / Sitio de trabajo, Operation / Operación,
   * Appearance / Apariencia, General / General → Información General 2
   */
  private static isGeneralInfoComponent(type: unknown): boolean {
    const full = this.normalizeTypeFull(type);
    if (!full) return false;

    // Exact bilingual names (either language order)
    const exactNames = [
      'job site / sitio de trabajo',
      'sitio de trabajo / job site',
      'job site',
      'sitio de trabajo',
      'operation / operacion',
      'operacion / operation',
      'operation',
      'operacion',
      'appearance / apariencia',
      'apariencia / appearance',
      'appearance',
      'apariencia',
      'general / general',
      'general',
    ];
    if (exactNames.includes(full)) return true;

    // Segment match (e.g. "Job Site / Sitio de trabajo")
    const segments = full.split('/').map((s) => s.trim()).filter(Boolean);
    if (segments.some((s) => s === 'general')) return true;
    if (segments.some((s) => s === 'job site' || s === 'sitio de trabajo')) return true;
    if (segments.some((s) => s === 'operation' || s === 'operacion')) return true;
    if (segments.some((s) => s === 'appearance' || s === 'apariencia')) return true;

    // Substring fallback for slight naming variants
    if (full.includes('job site') || full.includes('sitio de trabajo')) return true;
    if (full.includes('appearance') || full.includes('apariencia')) return true;
    // Operation: avoid matching unrelated types that merely contain the letters
    if (
      full.startsWith('operation') ||
      full.startsWith('operacion') ||
      full.includes('/ operation') ||
      full.includes('/ operacion') ||
      full.includes('operation /') ||
      full.includes('operacion /')
    ) {
      return true;
    }

    return false;
  }

  private static generalInfoOrder(type: unknown): number {
    const full = this.normalizeTypeFull(type);
    if (full.includes('job site') || full.includes('sitio de trabajo')) return 0;
    if (
      full.startsWith('operation') ||
      full.startsWith('operacion') ||
      full.includes('operation') ||
      full.includes('operacion')
    ) {
      return 1;
    }
    if (full.includes('appearance') || full.includes('apariencia')) return 2;
    if (full === 'general' || full.startsWith('general /') || full.endsWith('/ general')) return 3;
    return 99;
  }

  private static splitComponentsForPdf(components: Component[]): {
    generalInfo: Component[];
    assessment: Component[];
  } {
    const generalInfo = components
      .filter((c) => this.isGeneralInfoComponent(c.type))
      .sort((a, b) => {
        const orderDiff = this.generalInfoOrder(a.type) - this.generalInfoOrder(b.type);
        if (orderDiff !== 0) return orderDiff;
        return this.getTypeLabel(a.type).localeCompare(this.getTypeLabel(b.type), 'es', {
          sensitivity: 'base',
        });
      });

    const assessment = components
      .filter((c) => !this.isGeneralInfoComponent(c.type))
      .sort((a, b) =>
        this.getTypeLabel(a.type).localeCompare(this.getTypeLabel(b.type), 'es', {
          sensitivity: 'base',
        })
      );

    return { generalInfo, assessment };
  }

  private static async renderComponentCard(
    component: Component,
    photos: Photo[],
    maxPhotoHeightPx: number
  ): Promise<string> {
    const componentPhotos = photos.filter((photo) => photo.component_id === component.id);

    const photosHTMLPromises = componentPhotos.map(async (photo) => {
      if ((photo.mime_type || '').toLowerCase().startsWith('video/')) {
        return '';
      }
      let imageBase64 = '';
      const mimeType = photo.mime_type || 'image/jpeg';

      try {
        if (photo.file_path.startsWith('http')) {
          const response = await axios.get(photo.file_path, { responseType: 'arraybuffer' });
          imageBase64 = Buffer.from(response.data, 'binary').toString('base64');
        } else {
          const imagePath = path.join(__dirname, '..', '..', photo.file_path);
          const imageBuffer = await fs.promises.readFile(imagePath);
          imageBase64 = imageBuffer.toString('base64');
        }

        const photoName = photo.photo_name || photo.original_name || 'Photo';
        return `
            <div style="text-align: center; margin-bottom: 10px;">
              <img src="data:${mimeType};base64,${imageBase64}" alt="${photoName}" class="photo-item" style="max-width: 100%; max-height: ${maxPhotoHeightPx}px; width: auto; height: auto; object-fit: contain; display: block; margin: 0 auto;">
              <div style="font-size: 11px; color: #666; margin-top: 5px; text-align: center;">${photoName}</div>
            </div>`;
      } catch (error) {
        console.error(`Error reading image file for PDF: ${photo.file_path}`, error);
        return `<div class="photo-item" style="border: 1px dashed #ccc; text-align: center; padding: 10px; display: flex; align-items: center; justify-content: center;">Image not found</div>`;
      }
    });

    const photosHTML = (await Promise.all(photosHTMLPromises)).join('');

    return `
        <div style="margin: 12px 0; padding: 8px; border: 1px solid #ddd; border-radius: 5px; page-break-inside: avoid;">
          <h3 style="color: #2563eb; margin-bottom: 10px;">${this.getTypeLabel(component.type)}</h3>
          <p><strong>Hallazgos / Findings:</strong> ${this.processTextWithLineBreaks(component.findings)}</p>
          ${
            component.parameters && Array.isArray(component.parameters) && component.parameters.length > 0
              ? `
  <div style="margin: 10px 0;">
    <strong>Parámetros / Parameters:</strong>
    <table style="width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 13px;">
      <thead>
        <tr style="background: #f1f5f9;">
          <th style="border: 1px solid #ccc; padding: 4px;">Nombre / Name</th>
          <th style="border: 1px solid #ccc; padding: 4px;">Valor Mín / Min Value</th>
          <th style="border: 1px solid #ccc; padding: 4px;">Valor Máx / Max Value</th>
          <th style="border: 1px solid #ccc; padding: 4px;">Valor Medido / Measured Value</th>
          <th style="border: 1px solid #ccc; padding: 4px;">Corregido / Corrected</th>
          <th style="border: 1px solid #ccc; padding: 4px;">Observación / Observation</th>
        </tr>
      </thead>
      <tbody>
        ${component.parameters
          .map(
            (param: any) => `
          <tr>
            <td style="border: 1px solid #ccc; padding: 4px;">${param.name ?? ''}</td>
            <td style="border: 1px solid #ccc; padding: 4px; text-align: right;">${param.minValue ?? ''}</td>
            <td style="border: 1px solid #ccc; padding: 4px; text-align: right;">${param.maxValue ?? ''}</td>
            <td style="border: 1px solid #ccc; padding: 4px; text-align: right;">${param.measuredValue ?? ''}</td>
            <td style="border: 1px solid #ccc; padding: 4px; text-align: center;">${param.corrected ? 'Sí / Yes' : 'No'}</td>
            <td style="border: 1px solid #ccc; padding: 4px;">${param.observation ?? ''}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>
`
              : ''
          }
          ${component.suggestions ? `<p><strong>Sugerencias / Suggestions:</strong> ${this.processTextWithLineBreaks(component.suggestions)}</p>` : ''}
          ${photosHTML ? `<div style="margin-top: 10px;"><strong>Fotos / Photos:</strong><div class="photos-container">${photosHTML}</div></div>` : ''}
        </div>
      `;
  }

  private static async renderComponentSections(
    components: Component[],
    photos: Photo[],
    maxPhotoHeightPx: number
  ): Promise<{ generalInfo2HTML: string; assessmentHTML: string }> {
    const { generalInfo, assessment } = this.splitComponentsForPdf(components);

    const generalCards = await Promise.all(
      generalInfo.map((c) => this.renderComponentCard(c, photos, maxPhotoHeightPx))
    );
    const assessmentCards = await Promise.all(
      assessment.map((c) => this.renderComponentCard(c, photos, maxPhotoHeightPx))
    );

    const generalInfo2HTML =
      generalCards.length > 0
        ? `
        <div class="section">
          <h2>📋 Información General 2 / General Information 2</h2>
          <p style="color:#64748b;font-size:13px;margin:0 0 12px 0;">
            Sitio de trabajo / Job Site · Operación / Operation · Apariencia / Appearance · General
          </p>
          ${generalCards.join('')}
        </div>`
        : '';

    // Always render assessment after Información General 2 (remaining components, A–Z)
    const assessmentHTML = `
        <div class="section">
          <h2>🔧 Evaluación de Componentes / Component Assessment</h2>
          ${
            assessmentCards.length > 0
              ? assessmentCards.join('')
              : '<p>No hay componentes evaluados / No components assessed</p>'
          }
        </div>`;

    return { generalInfo2HTML, assessmentHTML };
  }

  private static async generateHTML(report: Report, components: Component[], photos: Photo[], suggestedParts: SuggestedPart[]): Promise<string> {
    const logoBase64 = await this.getLogoBase64();
    const { generalInfo2HTML, assessmentHTML } = await this.renderComponentSections(
      components,
      photos,
      200
    );
    const suggestedPartsHTML = suggestedParts.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="border: 1px solid #ccc; padding: 6px;">Parte / Part</th>
            <th style="border: 1px solid #ccc; padding: 6px;">Descripción / Description</th>
            <th style="border: 1px solid #ccc; padding: 6px;">Cantidad / Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${suggestedParts.map(part => `
            <tr>
              <td style="border: 1px solid #ccc; padding: 6px;">${part.part_number}</td>
              <td style="border: 1px solid #ccc; padding: 6px;">${part.description}</td>
              <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${part.quantity}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Maquinaria - ${report.client_name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
          .logo-container { width: 100%; display: flex; justify-content: center; align-items: center; margin-bottom: 10px; }
          .logo-img { width: 100%; max-width: 600px; height: auto; object-fit: contain; display: block; margin: 0 auto; }
          .section { margin: 20px 0; }
          .section h2 { color: #2563eb; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 15px 0; }
          .info-item { padding: 10px; background-color: #f8f9fa; border-radius: 5px; }
          .info-item strong { color: #2563eb; }
          .status-badge { padding: 5px 10px; border-radius: 15px; font-weight: bold; }
          .status-draft { background-color: #fef3c7; color: #92400e; }
          .status-completed { background-color: #d1fae5; color: #065f46; }
          .status-archived { background-color: #e5e7eb; color: #374151; }
          .photos-container { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
          .photo-item { max-width: 200px; max-height: 200px; margin: 0; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }
          ul, ol { margin: 6px 0 6px 20px; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="logo-container">
          <img class="logo-img" src="${logoBase64}" alt="Company Logo" />
        </div>
        <div class="header">
          <h1>Reporte de Inspección de Maquinaria / Machinery Inspection Report</h1>
          <p><strong>Cliente / Client:</strong> ${report.client_name}</p>
          <p><strong>Fecha del Reporte / Report Date:</strong> ${new Date(report.report_date).toLocaleDateString('es-ES')}</p>
        </div>

        <div class="section">
          <h2>📋 Información General / General Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <strong>Tipo de Máquina / Machine Type:</strong><br>${report.machine_type}
            </div>
            <div class="info-item">
              <strong>Modelo / Model:</strong><br>${report.model}
            </div>
            <div class="info-item">
              <strong>Número de Serie / Serial Number:</strong><br>${report.serial_number}
            </div>
            <div class="info-item">
              <strong>Horómetro / Hourmeter:</strong><br>${report.hourmeter} horas
            </div>
            <div class="info-item">
              <strong>OTT:</strong><br>${report.ott || 'No especificado'}
            </div>
            ${report.reason_of_service ? `
            <div class="info-item">
              <strong>Razón del Servicio / Reason of Service:</strong><br>${this.processTextWithLineBreaks(report.reason_of_service)}
            </div>
            ` : ''}
            <div class="info-item">
              <strong>Estado / Status:</strong><br>
              <span class="status-badge" style="background-color: ${report.general_status === 'CLOSED' ? '#fee2e2' : '#fef9c3'}; color: ${report.general_status === 'CLOSED' ? '#b91c1c' : '#92400e'};">${report.general_status ? report.general_status.toUpperCase() : 'N/A'}</span>
            </div>
          </div>
        </div>

        ${generalInfo2HTML}

        ${assessmentHTML}

        ${suggestedParts.length > 0 ? `
        <div class="section">
          <h2>🛠️ Partes Sugeridas y Actividades / Suggested Parts and Activities</h2>
          ${suggestedPartsHTML}
        </div>
        ` : ''}

        ${report.conclusions ? `
        <div class="section">
          <h2>📝 Conclusiones / Conclusions</h2>
          <p>${this.processTextWithLineBreaks(report.conclusions)}</p>
        </div>
        ` : ''}

        ${report.overall_suggestions ? `
        <div class="section">
          <h2>💡 Sugerencias Generales / Overall Suggestions</h2>
          <p>${this.processTextWithLineBreaks(report.overall_suggestions)}</p>
        </div>
        ` : ''}

        <div class="footer">
          <p>Reporte generado el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')} / Report generated on ${new Date().toLocaleDateString('en-US')} at ${new Date().toLocaleTimeString('en-US')}</p>
          <p>Generado por / Generated by: ${report.user_full_name || report.user_id || 'Usuario no especificado / Unspecified user'}</p>
          <p>Plataforma de Informes de Maquinaria - Sistema de Gestión Técnica / Machinery Reports Platform - Technical Management System</p>
        </div>
      </body>
      </html>
    `;
  }

  private static async generateHTMLWithoutLogo(report: Report, components: Component[], photos: Photo[], suggestedParts: SuggestedPart[]): Promise<string> {
    const { generalInfo2HTML, assessmentHTML } = await this.renderComponentSections(
      components,
      photos,
      150
    );
    const suggestedPartsHTML = suggestedParts.length > 0 ? `
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="border: 1px solid #ccc; padding: 6px;">Parte / Part</th>
            <th style="border: 1px solid #ccc; padding: 6px;">Descripción / Description</th>
            <th style="border: 1px solid #ccc; padding: 6px;">Cantidad / Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${suggestedParts.map(part => `
            <tr>
              <td style="border: 1px solid #ccc; padding: 6px;">${part.part_number}</td>
              <td style="border: 1px solid #ccc; padding: 6px;">${part.description}</td>
              <td style="border: 1px solid #ccc; padding: 6px; text-align: right;">${part.quantity}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Maquinaria - ${report.client_name}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
          .section { margin: 20px 0; }
          .section h2 { color: #2563eb; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 15px 0; }
          .info-item { padding: 10px; background-color: #f8f9fa; border-radius: 5px; }
          .info-item strong { color: #2563eb; }
          .status-badge { padding: 5px 10px; border-radius: 15px; font-weight: bold; }
          .status-draft { background-color: #fef3c7; color: #92400e; }
          .status-completed { background-color: #d1fae5; color: #065f46; }
          .status-archived { background-color: #e5e7eb; color: #374151; }
          .photos-container { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
          .photo-item { max-width: 200px; max-height: 150px; margin: 0; border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }
          ul, ol { margin: 6px 0 6px 20px; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Reporte de Inspección de Maquinaria / Machinery Inspection Report</h1>
          <p><strong>Cliente / Client:</strong> ${report.client_name}</p>
          <p><strong>Fecha del Reporte / Report Date:</strong> ${new Date(report.report_date).toLocaleDateString('es-ES')}</p>
        </div>

        <div class="section">
          <h2>📋 Información General / General Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <strong>Tipo de Máquina / Machine Type:</strong><br>${report.machine_type}
            </div>
            <div class="info-item">
              <strong>Modelo / Model:</strong><br>${report.model}
            </div>
            <div class="info-item">
              <strong>Número de Serie / Serial Number:</strong><br>${report.serial_number}
            </div>
            <div class="info-item">
              <strong>Horómetro / Hourmeter:</strong><br>${report.hourmeter} horas
            </div>
            <div class="info-item">
              <strong>OTT:</strong><br>${report.ott || 'No especificado'}
            </div>
            ${report.reason_of_service ? `
            <div class="info-item">
              <strong>Razón del Servicio / Reason of Service:</strong><br>${this.processTextWithLineBreaks(report.reason_of_service)}
            </div>
            ` : ''}
            <div class="info-item">
              <strong>Estado / Status:</strong><br>
              <span class="status-badge" style="background-color: ${report.general_status === 'CLOSED' ? '#fee2e2' : '#fef9c3'}; color: ${report.general_status === 'CLOSED' ? '#b91c1c' : '#92400e'};">${report.general_status ? report.general_status.toUpperCase() : 'N/A'}</span>
            </div>
          </div>
        </div>

        ${generalInfo2HTML}

        ${assessmentHTML}

        ${suggestedParts.length > 0 ? `
        <div class="section">
          <h2>🛠️ Partes Sugeridas y Actividades / Suggested Parts and Activities</h2>
          ${suggestedPartsHTML}
        </div>
        ` : ''}

        ${report.conclusions ? `
        <div class="section">
          <h2>📝 Conclusiones / Conclusions</h2>
          <p>${this.processTextWithLineBreaks(report.conclusions)}</p>
        </div>
        ` : ''}

        ${report.overall_suggestions ? `
        <div class="section">
          <h2>💡 Sugerencias Generales / Overall Suggestions</h2>
          <p>${this.processTextWithLineBreaks(report.overall_suggestions)}</p>
        </div>
        ` : ''}

        <div class="footer">
          <p>Reporte generado el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')} / Report generated on ${new Date().toLocaleDateString('en-US')} at ${new Date().toLocaleTimeString('en-US')}</p>
          <p>Generado por / Generated by: ${report.user_full_name || report.user_id || 'Usuario no especificado / Unspecified user'}</p>
          <p>Plataforma de Informes de Maquinaria - Sistema de Gestión Técnica / Machinery Reports Platform - Technical Management System</p>
        </div>
      </body>
      </html>
    `;
  }

  static async generatePDF(report: Report, components: Component[], photos: Photo[], suggestedParts: SuggestedPart[]): Promise<Buffer> {
    try {
      const executablePath = await chromium.executablePath();
      if (!executablePath) {
        throw new Error('Chromium executablePath not found. PDF generation is not supported in this environment.');
      }
      const browser = await puppeteer.launch({
        args: chromium.args,
        executablePath,
        headless: true,
        ignoreDefaultArgs: ['--disable-extensions'],
      });

      const page = await browser.newPage();
      const html = await this.generateHTML(report, components, photos, suggestedParts);
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '10mm', right: '10mm', bottom: '12mm', left: '10mm' },
        printBackground: true,
        displayHeaderFooter: false
      });
      await browser.close();
      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF');
    }
  }

  static async generatePDFWithoutLogo(report: Report, components: Component[], photos: Photo[], suggestedParts: SuggestedPart[]): Promise<Buffer> {
    try {
      const executablePath = await chromium.executablePath();
      if (!executablePath) {
        throw new Error('Chromium executablePath not found. PDF generation is not supported in this environment.');
      }
      const browser = await puppeteer.launch({
        args: chromium.args,
        executablePath,
        headless: true,
        ignoreDefaultArgs: ['--disable-extensions'],
      });

      const page = await browser.newPage();
      const html = await this.generateHTMLWithoutLogo(report, components, photos, suggestedParts);
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: '10mm', right: '10mm', bottom: '12mm', left: '10mm' },
        printBackground: true,
        displayHeaderFooter: false
      });
      await browser.close();
      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF without logo:', error);
      throw new Error('Failed to generate PDF without logo');
    }
  }
} 