// Application limits, shared by the file picker and the storage finalizer.
export const MEDIA = {
  image: { types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'], maxBytes: 5 * 1024 * 1024, formats: 'JPG, PNG, WebP, GIF o AVIF', maxMB: 5 },
  video: { types: ['video/mp4', 'video/webm', 'video/ogg'], maxBytes: 250 * 1024 * 1024, formats: 'MP4, WebM u OGV', maxMB: 250 },
  file: { types: ['application/pdf', 'application/epub+zip', 'application/zip', 'application/x-zip-compressed'], maxBytes: 100 * 1024 * 1024, formats: 'PDF, EPUB o ZIP', maxMB: 100 },
};

export function mediaError(kind, file) {
  const rule = MEDIA[kind];
  return !rule || !rule.types.includes(file.contentType ?? file.type ?? '') || !Number.isFinite(file.size) || file.size <= 0 || file.size > rule.maxBytes
    ? `Elegí un archivo ${rule?.formats ?? 'válido'} de hasta ${rule?.maxMB ?? 0} MB.` : '';
}
