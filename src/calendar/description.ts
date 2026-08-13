const HTML_ENTITY_VALUES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

const LIKELY_HTML_TAG =
  /<\/?(?:a|b|blockquote|br|div|em|h[1-6]|i|li|ol|p|script|span|strong|style|table|tbody|td|th|thead|tr|ul)\b[^>]*>/i;

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith('#x')) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (normalized.startsWith('#')) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return HTML_ENTITY_VALUES[normalized] ?? match;
  });
}

export function normalizeCalendarDescription(value?: string | null) {
  if (!value) return '';
  if (!LIKELY_HTML_TAG.test(value)) return value;

  const text = value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    .replace(/<\/li\s*>/gi, '\n')
    .replace(/<\/(?:blockquote|div|h[1-6]|ol|p|table|tr|ul)\s*>/gi, '\n\n')
    .replace(/<(?:blockquote|div|h[1-6]|ol|p|table|tbody|td|th|thead|tr|ul)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '');

  return decodeHtmlEntities(text)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
