export type SuggestedPartRow = {
  partNumber: string;
  description: string;
  quantity: number;
};

export type SuggestedPartsImportResult = {
  parts: SuggestedPartRow[];
  skipped: number;
  errors: string[];
};

const normalizeHeader = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_');

const PART_NUMBER_KEYS = new Set([
  'part_number',
  'partnumber',
  'part',
  'parte',
  'numero_de_parte',
  'numero_parte',
  'n_parte',
  'codigo',
  'codigo_parte',
]);

const DESCRIPTION_KEYS = new Set([
  'description',
  'descripcion',
  'actividad',
  'activity',
  'detalle',
]);

const QUANTITY_KEYS = new Set([
  'quantity',
  'cantidad',
  'qty',
  'cant',
]);

const cellText = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const parseQuantity = (value: unknown): number => {
  if (value === undefined || value === null || value === '') return 1;
  const raw = String(value).trim().replace(',', '.');
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed);
};

const mapHeaders = (headerRow: unknown[]): {
  partIndex: number;
  descriptionIndex: number;
  quantityIndex: number;
} => {
  const headers = headerRow.map(normalizeHeader);
  const partIndex = headers.findIndex((header) => PART_NUMBER_KEYS.has(header));
  const descriptionIndex = headers.findIndex((header) => DESCRIPTION_KEYS.has(header));
  const quantityIndex = headers.findIndex((header) => QUANTITY_KEYS.has(header));
  return { partIndex, descriptionIndex, quantityIndex };
};

const rowsToParts = (rows: unknown[][]): SuggestedPartsImportResult => {
  if (rows.length === 0) {
    return { parts: [], skipped: 0, errors: ['El archivo está vacío'] };
  }

  const { partIndex, descriptionIndex, quantityIndex } = mapHeaders(rows[0] || []);
  if (partIndex < 0 || descriptionIndex < 0) {
    return {
      parts: [],
      skipped: 0,
      errors: [
        'Encabezados inválidos. Use: part_number, description, quantity (o Parte, Descripción, Cantidad)',
      ],
    };
  }

  const parts: SuggestedPartRow[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    const isEmpty = row.every((cell) => cellText(cell) === '');
    if (isEmpty) {
      skipped += 1;
      continue;
    }

    const partNumber = cellText(row[partIndex]);
    const description = cellText(row[descriptionIndex]);
    const quantity = parseQuantity(quantityIndex >= 0 ? row[quantityIndex] : 1);
    const rowNumber = index + 1;

    if (!partNumber || !description) {
      errors.push(`Fila ${rowNumber}: part_number y description son obligatorios`);
      skipped += 1;
      continue;
    }
    if (quantity <= 0) {
      errors.push(`Fila ${rowNumber}: quantity debe ser un número mayor que 0`);
      skipped += 1;
      continue;
    }

    parts.push({ partNumber, description, quantity });
  }

  return { parts, skipped, errors };
};

const parseCsv = (text: string): unknown[][] => {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim() !== '');
  return lines.map((line) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === ',' && !inQuotes) {
        cells.push(current);
        current = '';
        continue;
      }
      current += char;
    }
    cells.push(current);
    return cells;
  });
};

const TEMPLATE_ROWS: Array<Array<string | number>> = [
  ['part_number', 'description', 'quantity'],
  ['FILTRO-001', 'Cambio de filtro de aceite', 2],
  ['ACT-MTTO', 'Mantenimiento preventivo 500h', 1],
  ['SELLO-045', 'Sello hidráulico brazo', 4],
];

export async function downloadSuggestedPartsTemplate(): Promise<void> {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.aoa_to_sheet(TEMPLATE_ROWS);
  worksheet['!cols'] = [{ wch: 16 }, { wch: 36 }, { wch: 10 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Suggested Parts');
  XLSX.writeFile(workbook, 'suggested_parts_template.xlsx');
}

export async function parseSuggestedPartsFile(file: File): Promise<SuggestedPartsImportResult> {
  const name = file.name.toLowerCase();
  const isCsv = name.endsWith('.csv');
  const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');

  if (!isCsv && !isExcel) {
    return {
      parts: [],
      skipped: 0,
      errors: ['Seleccione un archivo Excel (.xlsx, .xls) o CSV (.csv)'],
    };
  }

  if (isCsv) {
    const text = await file.text();
    return rowsToParts(parseCsv(text));
  }

  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { parts: [], skipped: 0, errors: ['El Excel no tiene hojas'] };
  }
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: false,
  }) as unknown[][];
  return rowsToParts(rows);
}
