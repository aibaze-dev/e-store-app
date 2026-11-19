// Photos are resized and re-encoded in the browser before they reach storage: a landing
// shows them at a few hundred pixels, and storage serves the file exactly as uploaded.
export const IMAGE_MAX_SIDE = 1600;
const QUALITY = 0.82;

// GIFs may be animated, and WebP/AVIF files are already compact; those go up untouched.
const COMPRESSIBLE = ['image/jpeg', 'image/png'];

export function fitWithin(width, height, maxSide = IMAGE_MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const encode = (canvas, type) => new Promise(resolve => canvas.toBlob(resolve, type, QUALITY));

// Returns a smaller copy of the file, or the same file when it cannot be improved.
export async function compressImage(file) {
  if (!COMPRESSIBLE.includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    // A browser that cannot write WebP answers with a PNG; then the original format is kept.
    let blob = await encode(canvas, 'image/webp');
    if (blob?.type !== 'image/webp') blob = await encode(canvas, file.type);
    if (!blob || blob.size >= file.size) return file;
    const extension = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.${extension}`, { type: blob.type });
  } catch {
    return file;
  }
}
