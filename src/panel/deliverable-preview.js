// Decides how the panel shows a deliverable. Pure so it can be tested without a browser.
export function safeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

const FORMATS = {
  'application/pdf': 'PDF',
  'application/epub+zip': 'EPUB',
  'application/zip': 'ZIP',
  'application/x-zip-compressed': 'ZIP',
};

// contentType: undefined while checking, null when it could not be read.
export function previewMode(item, contentType) {
  if (!safeUrl(item?.url)) return { mode: 'missing' };
  if (item.kind === 'link') return { mode: 'link' };
  if (contentType === undefined) return { mode: 'checking' };
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (type === 'application/pdf') return { mode: 'pdf', format: 'PDF' };
  return { mode: 'download', format: FORMATS[type] || null };
}
