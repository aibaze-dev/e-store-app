import { afterEach, describe, expect, it, vi } from 'vitest';
import { IMAGE_MAX_SIDE, compressImage, fitWithin } from '../src/panel/compress-image.js';

afterEach(() => vi.unstubAllGlobals());

const file = (type, size, name = 'cover.png') => new File([new Uint8Array(size)], name, { type });

// A canvas whose encoder answers with a blob of the given type and size.
function stubCanvas(bitmap, output, alpha = 255) {
  const context = { drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray([10, 20, 30, 255, 10, 20, 30, alpha]) }) };
  const canvas = { width: 0, height: 0, getContext: () => context, toBlob: (done, type) => done(output(type)) };
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ ...bitmap, close: vi.fn() })));
  vi.stubGlobal('document', { createElement: () => canvas });
  return canvas;
}

describe('image compression before upload', () => {
  it('keeps the proportions and never enlarges', () => {
    expect(fitWithin(3200, 1600)).toEqual({ width: IMAGE_MAX_SIDE, height: IMAGE_MAX_SIDE / 2 });
    expect(fitWithin(1000, 4000)).toEqual({ width: 400, height: IMAGE_MAX_SIDE });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('leaves animated and already compact formats untouched', async () => {
    for (const type of ['image/gif', 'image/webp', 'image/avif']) {
      const original = file(type, 64);
      expect(await compressImage(original)).toBe(original);
    }
  });

  it('uploads a resized WebP when it is smaller', async () => {
    const canvas = stubCanvas({ width: 3200, height: 1600 }, type => new Blob([new Uint8Array(10)], { type }));
    const result = await compressImage(file('image/png', 100));
    expect([canvas.width, canvas.height]).toEqual([1600, 800]);
    expect(result).toMatchObject({ type: 'image/webp', name: 'cover.webp', size: 10 });
  });

  it('stores photos as JPEG where WebP cannot be written', async () => {
    const withoutWebp = type => new Blob([new Uint8Array(10)], { type: type === 'image/webp' ? 'image/png' : type });
    stubCanvas({ width: 800, height: 600 }, withoutWebp);
    expect(await compressImage(file('image/jpeg', 100, 'photo.jpeg'))).toMatchObject({ type: 'image/jpeg', name: 'photo.jpg' });
    expect(await compressImage(file('image/png', 100))).toMatchObject({ type: 'image/jpeg', name: 'cover.jpg' });
    // Transparency survives only in PNG.
    stubCanvas({ width: 800, height: 600 }, withoutWebp, 120);
    expect(await compressImage(file('image/png', 100, 'logo.png'))).toMatchObject({ type: 'image/png', name: 'logo.png' });
  });

  it('falls back to the original when the copy is not smaller or the photo cannot be read', async () => {
    const original = file('image/png', 100);
    stubCanvas({ width: 800, height: 600 }, type => new Blob([new Uint8Array(200)], { type }));
    expect(await compressImage(original)).toBe(original);
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new Error('unreadable'); }));
    expect(await compressImage(original)).toBe(original);
  });
});
