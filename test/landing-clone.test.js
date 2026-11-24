import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { api } from './api';
import { normalizeContent } from '../src/templates/content.js';
import { backend, signedIn, product, content } from './helpers';

const ADMIN = 'owner@example.com';
beforeEach(() => { vi.stubEnv('ADMIN_EMAILS', ADMIN); });
afterEach(() => { vi.unstubAllEnvs(); });

const landing = title => normalizeContent({ ...content, hero: { ...content.hero, title, imageUrl: 'https://cdn.example.com/hero.png' }, style: { accentColor: '#123456' } });

async function fixture() {
  const t = backend();
  const admin = await signedIn(t, ADMIN);
  const main = await admin.mutation(api.products.create, product('Ebook', 'main'));
  const store = name => admin.mutation(api.stores.create, { name, status: 'active', currency: 'usd', offer: { mainProductId: main, price: 2700, bonuses: [], upsells: [] }, postPurchase: { enabled: false, price: 0 }, tracking: { metaPixelIds: [] } });
  const source = await store('Origen'), draftOnly = await store('Solo borrador'), target = await store('Nueva');
  const save = (storeId, subdomain, title) => admin.mutation(api.landings.saveDraft, { storeId, subdomain, template: 'classic', draft: landing(title) });
  await save(source, 'origen', 'Landing publicada');
  await admin.mutation(api.landings.publish, { storeId: source });
  await save(draftOnly, 'borrador', 'Sin publicar');
  return { t, admin, save, source, draftOnly, target };
}

describe('starting a landing from another store', () => {
  it('lists only other stores with a published landing', async () => {
    const { admin, source, target } = await fixture();
    expect(await admin.query(api.landings.cloneSources, { storeId: target })).toEqual([expect.objectContaining({ storeId: source, name: 'Origen', subdomain: 'origen', title: 'Landing publicada' })]);
    expect(await admin.query(api.landings.cloneSources, { storeId: source })).toEqual([]);
  });

  it('copies the published landing as a draft together with everything the store sells', async () => {
    const { t, admin, save, source, target } = await fixture();
    const extra = await admin.mutation(api.products.create, product('Extra', 'extra'));
    const bonus = await admin.mutation(api.products.create, product('Bono', 'bonus'));
    const post = await admin.mutation(api.products.create, product('Post', 'post'));
    const sourceStore = await t.run(ctx => ctx.db.get(source));
    await t.run(ctx => ctx.db.patch(source, {
      currency: 'eur',
      offer: { ...sourceStore.offer, price: 4900, compareAtPrice: 9900, bonuses: [{ productId: bonus, referenceValue: 1500 }], upsells: [{ productId: extra, price: 900, displayOrder: 0 }] },
      postPurchase: { enabled: true, productId: post, price: 1900, downsellPercent: 30 },
      downsell: { enabled: true, percent: 20, modalTitle: 'Esperá', modalSubtitle: 'Oferta', acceptText: 'Sí', declineText: 'No', pageTitle: 'Solo hoy', pageSubtitle: 'Último precio' },
      checkout: { notifications: true, liveVisitors: true, upsellTitle: 'Sumá esto', upsellReferences: [{ productId: extra, value: 2000 }] },
      tracking: { metaPixelIds: ['123456789'] },
    }));
    await save(source, 'origen', 'Cambio sin publicar');
    const published = (await admin.query(api.landings.getForStore, { storeId: source })).published;

    // A new store: its address set in Configuración, no landing yet, and a different name.
    await expect(admin.mutation(api.landings.cloneFrom, { storeId: target, sourceStoreId: source })).rejects.toThrow(/subdominio/);
    await admin.mutation(api.stores.setSubdomain, { id: target, subdomain: 'nueva' });
    const draft = await admin.mutation(api.landings.cloneFrom, { storeId: target, sourceStoreId: source });
    expect(draft).toEqual(published);
    expect(draft.hero.title).toBe('Landing publicada');
    const saved = await admin.query(api.landings.getForStore, { storeId: target });
    expect(saved).toMatchObject({ subdomain: 'nueva', draft: published });
    expect(saved.published).toBeUndefined();

    const [from, to] = await t.run(async ctx => [await ctx.db.get(source), await ctx.db.get(target)]);
    for (const key of ['currency', 'offer', 'postPurchase', 'downsell', 'checkout']) expect(to[key], key).toEqual(from[key]);
    expect(to.purchaseDraft).toEqual(published);
    expect(to).toMatchObject({ name: 'Nueva', subdomain: 'nueva', tracking: { metaPixelIds: [] } });
    expect(to.purchasePublished).toBeUndefined();
  });

  it('refuses stores without a published landing, the same store and non-admins', async () => {
    const { t, admin, source, draftOnly, target } = await fixture();
    await admin.mutation(api.stores.setSubdomain, { id: target, subdomain: 'nueva' });
    await expect(admin.mutation(api.landings.cloneFrom, { storeId: target, sourceStoreId: draftOnly })).rejects.toThrow(/no tiene una landing publicada/);
    // An active store never ends up selling a product with nothing to deliver.
    const empty = await admin.mutation(api.products.create, { ...product('Vacío', 'empty'), deliverables: [] });
    await t.run(async ctx => ctx.db.patch(source, { offer: { ...(await ctx.db.get(source)).offer, mainProductId: empty } }));
    await expect(admin.mutation(api.landings.cloneFrom, { storeId: target, sourceStoreId: source })).rejects.toThrow(/entregables/);
    expect((await t.run(ctx => ctx.db.get(target))).offer.mainProductId).not.toBe(empty);
    await expect(admin.mutation(api.landings.cloneFrom, { storeId: source, sourceStoreId: source })).rejects.toThrow(/otra tienda/);
    const stranger = await signedIn(t, 'stranger@example.com');
    await expect(stranger.query(api.landings.cloneSources, { storeId: target })).rejects.toThrow();
    await expect(stranger.mutation(api.landings.cloneFrom, { storeId: target, sourceStoreId: source })).rejects.toThrow();
  });
});
