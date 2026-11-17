import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { backend, signedIn } from './helpers';
import { MEDIA, mediaError } from '../shared/media.js';
import { videoSource } from '../shared/post-purchase.js';

const ADMIN = 'uploads@example.com';
beforeEach(() => vi.stubEnv('ADMIN_EMAILS', ADMIN));
afterEach(() => vi.unstubAllEnvs());

// convex-test omits contentType when storing a Blob; supply the metadata that
// Convex records from the upload's Content-Type header.
async function stored(t, contentType, size = 16) {
  return t.run(async ctx => {
    const id = await ctx.storage.store(new Blob(['test upload'], { type: contentType }));
    await ctx.db.patch(id, { contentType, size });
    return id;
  });
}

describe('Convex file uploads', () => {
  it('restricts upload URLs and finalization to administrators', async () => {
    const t = backend(), admin = await signedIn(t, ADMIN), stranger = await signedIn(t, 'visitor@example.com');
    const storageId = await stored(t, 'video/mp4');
    for (const client of [t, stranger]) {
      await expect(client.mutation(api.media.uploadUrl, {})).rejects.toThrow();
      await expect(client.mutation(api.media.finalize, { storageId, kind: 'video' })).rejects.toThrow();
    }
    expect(await admin.mutation(api.media.uploadUrl, {})).toEqual(expect.any(String));
    expect(await t.run(ctx => ctx.storage.getUrl(storageId))).not.toBeNull();
  });

  it('returns the stored file URL for images, videos and deliverables', async () => {
    const t = backend(), admin = await signedIn(t, ADMIN);
    for (const [kind, rule] of Object.entries(MEDIA)) {
      for (const contentType of rule.types) {
        const storageId = await stored(t, contentType);
        const expected = await t.run(ctx => ctx.storage.getUrl(storageId));
        expect(await admin.mutation(api.media.finalize, { storageId, kind })).toEqual({ url: expected });
      }
    }
  });

  it('deletes invalid uploads without touching previously uploaded files', async () => {
    const t = backend(), admin = await signedIn(t, ADMIN);
    const previous = await stored(t, 'video/mp4');
    for (const [type, size] of [['text/html', 16], ['image/png', 16], ['video/mp4', 0], ['video/mp4', MEDIA.video.maxBytes + 1]]) {
      const storageId = await stored(t, type, size);
      expect(await admin.mutation(api.media.finalize, { storageId, kind: 'video' })).toEqual({ error: expect.any(String) });
      expect(await t.run(ctx => ctx.storage.getUrl(storageId))).toBeNull();
    }
    expect(await t.run(ctx => ctx.storage.getUrl(previous))).not.toBeNull();
  });

  it('shares file limits with the browser and recognizes extensionless storage videos', () => {
    for (const [kind, rule] of Object.entries(MEDIA)) {
      expect(mediaError(kind, { type: rule.types[0], size: rule.maxBytes })).toBe('');
      expect(mediaError(kind, { type: rule.types[0], size: rule.maxBytes + 1 })).not.toBe('');
      expect(mediaError(kind, { type: 'text/html', size: 10 })).not.toBe('');
    }
    const url = 'https://example-123.convex.cloud/api/storage/4e364f57-c5e6-4e8f-a3cb-0d97e097b5dc';
    expect(videoSource(url)).toEqual({ kind: 'video', src: url });
    expect(videoSource(url.replace('.convex.cloud/', '.convex.cloud.evil.example/'))).toBeNull();
    expect(videoSource(url.replace('/api/storage/', '/arbitrary/'))).toBeNull();
  });
});
