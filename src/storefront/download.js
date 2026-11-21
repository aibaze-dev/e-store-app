// Download button of the thank-you page. Pure helpers are exported for the tests.

const EXTENSIONS = {
  'application/pdf': '.pdf', 'application/epub+zip': '.epub', 'application/zip': '.zip',
  'audio/mpeg': '.mp3', 'video/mp4': '.mp4', 'text/plain': '.txt',
  'application/msword': '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};
const FILE_PATH = /\.(pdf|epub|mobi|zip|mp3|mp4|m4a|docx?|txt|pptx?|xlsx?)$/i;

// Files can be downloaded; pages (artifacts, external links) are only opened.
// Old orders keep links without `kind`: those count as files when the URL looks like one.
export function isDownloadable(link) {
  if (link?.kind === 'file') return true;
  if (link?.kind === 'link' || !link?.url) return false;
  try {
    const { pathname } = new URL(link.url);
    return pathname.includes('/api/storage/') || FILE_PATH.test(pathname);
  } catch { return false; }
}

export function downloadName(title, type = '', url = '') {
  const base = (title || 'download').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'download';
  if (FILE_PATH.test(base)) return base;
  const mime = type.split(';')[0].trim().toLowerCase();
  let extension = EXTENSIONS[mime] ?? '';
  if (!extension) { try { extension = new URL(url).pathname.match(FILE_PATH)?.[0] ?? ''; } catch { /* no extension */ } }
  return base + extension.toLowerCase();
}

// Saves the file with a readable name. Browsers ignore `download` on other origins, so the
// file is fetched first; if that fails (CORS, network), it opens like the «Open» button.
export async function downloadFile(url, title) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = downloadName(title, blob.type, url);
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 30_000);
  } catch {
    // `noopener` would make window.open return null, so the opener is cut by hand.
    const tab = window.open(url, '_blank');
    if (tab) tab.opener = null;
    else window.location.assign(url);
  }
}
