const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const looksLikeHtml = (value: string): boolean => /<\/?[a-z][\s\S]*>/i.test(value);

/** Keep only basic formatting tags used by the report/act editors. */
export const sanitizeRichText = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<(?!\/?(?:b|strong|i|em|u|ul|ol|li|br|p|div|span)\b)[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:href|src|style|class|id)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/<\/?script\b[^>]*>/gi, '');
};

export const formatStoredText = (value?: string | null): string => {
  if (!value) return '';
  if (looksLikeHtml(value)) {
    return sanitizeRichText(value);
  }
  return escapeHtml(value)
    .replace(/\n/g, '<br>')
    .replace(/\s{2,}/g, (match) => '&nbsp;'.repeat(match.length));
};
