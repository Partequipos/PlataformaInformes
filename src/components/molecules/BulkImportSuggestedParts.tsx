import React, { useRef, useState } from 'react';
import { AlertCircle, CheckCircle, Download, Upload, X } from 'lucide-react';
import { Button } from '../atoms/Button';
import {
  parseSuggestedPartsFile,
  SUGGESTED_PARTS_TEMPLATE_CSV,
  type SuggestedPartRow,
} from '../../utils/suggestedPartsImport';

type BulkImportSuggestedPartsProps = {
  onImport: (parts: SuggestedPartRow[]) => void;
};

export const BulkImportSuggestedParts: React.FC<BulkImportSuggestedPartsProps> = ({ onImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  const clearFeedback = () => {
    setError(null);
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const blob = new Blob([SUGGESTED_PARTS_TEMPLATE_CSV], {
      type: 'text/csv;charset=utf-8',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'suggested_parts_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError(null);
    setSummary(null);

    try {
      const result = await parseSuggestedPartsFile(file);
      if (result.parts.length === 0) {
        setError(result.errors[0] || 'No se encontraron filas válidas en el archivo');
        return;
      }

      onImport(result.parts);
      const skippedLabel = result.skipped > 0 ? ` · ${result.skipped} omitidas` : '';
      const errorLabel = result.errors.length > 0 ? ` · ${result.errors.length} con error` : '';
      setSummary(`Se agregaron ${result.parts.length} filas${skippedLabel}${errorLabel}.`);
      if (result.errors.length > 0) {
        setError(result.errors.slice(0, 5).join(' | '));
      }
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'No se pudo leer el archivo');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">Cargar desde Excel / CSV</p>
          <p className="mt-1 text-xs text-slate-600">
            Columnas: <strong>part_number</strong>, <strong>description</strong>, <strong>quantity</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-1 h-4 w-4" />
            Plantilla
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={isImporting}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1 h-4 w-4" />
            Cargar Excel
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileChange}
        disabled={isImporting}
      />

      {summary && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{summary}</p>
          <button type="button" onClick={clearFeedback} className="text-green-700 hover:text-green-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="flex-1">{error}</p>
          <button type="button" onClick={clearFeedback} className="text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};
