import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { api } from './api';
import { backend, signedIn, product } from './helpers';

const ADMIN = 'owner@example.com';
beforeEach(() => vi.stubEnv('ADMIN_EMAILS', ADMIN));
afterEach(() => vi.unstubAllEnvs());

describe('product language', () => {
  it('saves, keeps and clears the language of an ebook', async () => {
    const t = backend();
    const admin = await signedIn(t, ADMIN);
    const id = await admin.mutation(api.products.create, { ...product('Libro', 'libro'), language: 'en' });
    expect((await admin.query(api.products.get, { id })).language).toBe('en');

    const { language, ...withoutLanguage } = { ...product('Libro', 'libro') };
    await admin.mutation(api.products.update, { id, ...withoutLanguage });
    expect((await admin.query(api.products.get, { id })).language).toBe('en');

    await admin.mutation(api.products.update, { id, ...product('Libro', 'libro'), language: null });
    expect((await admin.query(api.products.get, { id })).language).toBeUndefined();
  });

  it('rejects languages outside the list', async () => {
    const t = backend();
    const admin = await signedIn(t, ADMIN);
    await expect(admin.mutation(api.products.create, { ...product('Libro', 'libro'), language: 'xx' })).rejects.toThrow(/Idioma/);
  });
});
