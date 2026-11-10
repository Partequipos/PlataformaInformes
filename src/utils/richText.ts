const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'BR', 'P', 'DIV', 'SPAN']);

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const looksLikeHtml = (value: string): boolean => /<\/?[a-z][\s\S]*>/i.test(value);

export const stripRichText = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export const isRichTextEmpty = (value?: string | null): boolean => {
  if (!value) return true;
  return stripRichText(value) === '';
};

const sanitizeNode = (node: Node, targetDoc: Document): Node | null => {
  if (node.nodeType === Node.TEXT_NODE) {
    return targetDoc.createTextNode(node.textContent || '');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toUpperCase();
  if (!ALLOWED_TAGS.has(tag)) {
    const fragment = targetDoc.createDocumentFragment();
    Array.from(element.childNodes).forEach((child) => {
      const sanitized = sanitizeNode(child, targetDoc);
      if (sanitized) fragment.appendChild(sanitized);
    });
    return fragment;
  }

  const clean = targetDoc.createElement(tag === 'STRONG' ? 'b' : tag === 'EM' ? 'i' : tag.toLowerCase());
  Array.from(element.childNodes).forEach((child) => {
    const sanitized = sanitizeNode(child, targetDoc);
    if (sanitized) clean.appendChild(sanitized);
  });
  return clean;
};

export const sanitizeRichText = (html: string): string => {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') {
    return html
      .replace(/<(?!\/?(?:b|strong|i|em|u|ul|ol|li|br|p|div|span)\b)[^>]*>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s(?:href|src|style|class)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const output = document.implementation.createHTMLDocument('').createElement('div');
  Array.from(root.childNodes).forEach((child) => {
    const sanitized = sanitizeNode(child, output.ownerDocument);
    if (sanitized) output.appendChild(sanitized);
  });
  return output.innerHTML;
};

export const normalizeRichText = (html: string): string => {
  const sanitized = sanitizeRichText(html || '');
  return isRichTextEmpty(sanitized) ? '' : sanitized;
};

/** Safe HTML for PDF / preview. Plain text keeps line breaks. */
export const formatStoredText = (value?: string | null): string => {
  if (!value) return '';
  if (looksLikeHtml(value)) {
    return sanitizeRichText(value);
  }
  return escapeHtml(value)
    .replace(/\n/g, '<br>')
    .replace(/\s{2,}/g, (match) => '&nbsp;'.repeat(match.length));
};
