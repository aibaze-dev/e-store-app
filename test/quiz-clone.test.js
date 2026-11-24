import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { api } from './api';
import { createAdvancedQuizTemplate, newStep } from '../shared/quiz.js';
import { backend, signedIn, product } from './helpers';

const ADMIN = 'owner@example.com';
beforeEach(() => { vi.stubEnv('ADMIN_EMAILS', ADMIN); });
afterEach(() => { vi.unstubAllEnvs(); });

function quiz(name) {
  const value = createAdvancedQuizTemplate('Guía');
  value.identity = { ...value.identity, name, logoUrl: `https://cdn.example.com/${name}.png`, color: '#123456' };
  value.steps = [newStep('single', 'choice'), { ...newStep('contact', 'contact'), required: true }];
  value.calculations = [];
  value.results = [{ id: 'general', default: true, title: `Resultado de ${name}`, blocks: [{ id: 'offer', type: 'offer' }] }];
  return value;
}

async function fixture() {
  const t = backend();
  const admin = await signedIn(t, ADMIN);
  const main = await admin.mutation(api.products.create, product('Ebook', 'main'));
  const store = name => admin.mutation(api.stores.create, { name, status: 'active', currency: 'usd', offer: { mainProductId: main, price: 2700, bonuses: [], upsells: [] }, postPurchase: { enabled: false, price: 0 }, tracking: { metaPixelIds: [] } });
  const source = await store('Origen'), draftOnly = await store('Solo borrador'), target = await store('Nueva');
  await admin.mutation(api.quizzes.save, { storeId: source, subdomain: 'origen', quiz: quiz('Origen') });
  await admin.mutation(api.quizzes.publish, { storeId: source });
  await admin.mutation(api.quizzes.save, { storeId: draftOnly, subdomain: 'borrador', quiz: quiz('Borrador') });
  return { t, admin, source, draftOnly, target };
}

describe('starting a quiz from another store', () => {
  it('lists only other stores with a published quiz', async () => {
    const { admin, source, target } = await fixture();
    const list = await admin.query(api.quizzes.cloneSources, { storeId: target });
    expect(list).toEqual([expect.objectContaining({ storeId: source, name: 'Origen', subdomain: 'origen', steps: 2 })]);
    expect(await admin.query(api.quizzes.cloneSources, { storeId: source })).toEqual([]);
  });

  it('copies the published version with this store\'s name and logo, without saving anything', async () => {
    const { t, admin, source, target } = await fixture();
    // A later draft edit in the source must not leak into the copy.
    await admin.mutation(api.quizzes.save, { storeId: source, quiz: { ...quiz('Origen'), results: [{ ...quiz('Origen').results[0], title: 'Sin publicar' }] } });
    const copy = await admin.query(api.quizzes.cloneProposal, { storeId: target, sourceStoreId: source });
    expect(copy.results[0].title).toBe('Resultado de Origen');
    expect(copy.identity).toMatchObject({ name: 'Tu guía', logoUrl: '', color: '#123456' });
    expect(await t.run(ctx => ctx.db.query('landings').collect())).toHaveLength(2);

    await admin.mutation(api.quizzes.save, { storeId: target, subdomain: 'nueva', quiz: copy });
    const saved = await admin.query(api.quizzes.get, { storeId: target });
    expect(saved.quiz.results[0].title).toBe('Resultado de Origen');
    expect(saved.landing.publicationId).toBeUndefined();
  });

  it('refuses stores without a published quiz, the same store and non-admins', async () => {
    const { t, admin, source, draftOnly, target } = await fixture();
    await expect(admin.query(api.quizzes.cloneProposal, { storeId: target, sourceStoreId: draftOnly })).rejects.toThrow(/no tiene un quiz publicado/);
    await expect(admin.query(api.quizzes.cloneProposal, { storeId: source, sourceStoreId: source })).rejects.toThrow(/otra tienda/);
    const stranger = await signedIn(t, 'stranger@example.com');
    await expect(stranger.query(api.quizzes.cloneSources, { storeId: target })).rejects.toThrow();
    await expect(stranger.query(api.quizzes.cloneProposal, { storeId: target, sourceStoreId: source })).rejects.toThrow();
  });
});
