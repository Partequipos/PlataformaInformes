import React, { useEffect, useId, useRef } from 'react';
import { Bold, Italic, List, RemoveFormatting, Underline } from 'lucide-react';
import { cn } from '../../utils/cn';
import { normalizeRichText, sanitizeRichText } from '../../utils/richText';

type RichTextAreaProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  className?: string;
  minHeightClassName?: string;
  id?: string;
};

const toEditorHtml = (value: string): string => {
  if (!value) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(value)) return sanitizeRichText(value);
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
};

export const RichTextArea: React.FC<RichTextAreaProps> = ({
  label,
  value,
  onChange,
  placeholder,
  error,
  required,
  className,
  minHeightClassName = 'min-h-[110px]',
  id,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);
  const generatedId = useId();
  const fieldId = id || generatedId;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const nextHtml = toEditorHtml(value);
    if (value === lastEmitted.current && editor.innerHTML) return;
    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
    lastEmitted.current = value;
  }, [value]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = normalizeRichText(editor.innerHTML);
    lastEmitted.current = next;
    onChange(next);
  };

  const runCommand = (command: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false);
    emitChange();
  };

  const clearFormatting = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand('removeFormat', false);
    document.execCommand('unlink', false);
    const plain = (editor.innerText || '').replace(/\u00a0/g, ' ').trim();
    editor.innerHTML = plain
      ? plain
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\n/g, '<br>')
      : '';
    emitChange();
  };

  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label htmlFor={fieldId} className="form-label">
          {label}
          {required ? <span className="text-brand-red ml-1">*</span> : null}
        </label>
      )}
      <div
        className={cn(
          'rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-brand-red focus-within:ring-1 focus-within:ring-brand-red',
          error && 'border-red-300 focus-within:border-red-500 focus-within:ring-red-500'
        )}
      >
        <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-700 hover:bg-white hover:text-brand-red"
            title="Negrita"
            aria-label="Negrita"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand('bold')}
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-700 hover:bg-white hover:text-brand-red"
            title="Cursiva"
            aria-label="Cursiva"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand('italic')}
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-700 hover:bg-white hover:text-brand-red"
            title="Subrayado"
            aria-label="Subrayado"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand('underline')}
          >
            <Underline className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-700 hover:bg-white hover:text-brand-red"
            title="Viñetas"
            aria-label="Viñetas"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand('insertUnorderedList')}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium text-slate-700 hover:bg-white hover:text-brand-red"
            title="Quitar formato"
            aria-label="Quitar formato"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearFormatting}
          >
            <RemoveFormatting className="h-4 w-4" />
            Quitar
          </button>
        </div>
        <div
          id={fieldId}
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder || ''}
          className={cn(
            'rich-text-editor w-full px-3 py-2 text-sm text-slate-800 outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
            minHeightClassName
          )}
          onInput={emitChange}
          onBlur={emitChange}
        />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
};
