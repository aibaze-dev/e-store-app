import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { api } from './api';
import { backend, signedIn, product } from './helpers';

const ADMIN = 'owner@example.com';
beforeEach(() => vi.stubEnv('ADMIN_EMAILS', ADMIN));
afterEach(() => vi.unstubAllEnvs());

describe('catalog store usage', () => {
  it('blocks deletion for every saved store association, including disabled offers in draft stores', async () => {
    const t = backend();
    const admin = await signedIn(t, ADMIN);
    const [main, bonus, extra, post, disabledPost, unused] = await Promise.all(
      ['Main', 'Bonus', 'Extra', 'Post', 'Off', 'Unused'].map(name => admin.mutation(api.products.create, product(name, name.toLowerCase()))),
    );
    const storeData = (name, postPurchase, status = 'active') => ({
      name, status, currency: 'usd',
      offer: { mainProductId: main, price: 1000, bonuses: [{ productId: bonus }], upsells: [{ productId: extra, price: 500, displayOrder: 0 }] },
      postPurchase, tracking: { metaPixelIds: [] },
    });
    const a = await admin.mutation(api.stores.create, storeData('A', { enabled: true, productId: post, price: 900 }));
    const draft = storeData('B', { enabled: false, productId: disabledPost, price: 900 }, 'draft');
    const b = await admin.mutation(api.stores.create, draft);

    const usage = await admin.query(api.products.storeUsage, {});
    expect(usage[main].map(s => s._id).sort()).toEqual([a, b].sort());
    expect(usage[bonus]).toHaveLength(2);
    expect(usage[extra]).toHaveLength(2);
    expect(usage[post]).toEqual([{ _id: a, name: 'A' }]);
    expect(usage[disabledPost]).toEqual([{ _id: b, name: 'B' }]);
    expect(usage[unused]).toBeUndefined();

    for (const id of [main, bonus, extra, post, disabledPost]) {
      await expect(admin.mutation(api.products.removeEbook, { id })).rejects.toThrow('Quitá el ebook');
      expect(await admin.query(api.products.get, { id })).not.toBeNull();
    }
    expect((await admin.query(api.stores.get, { id: b })).postPurchase).toEqual(draft.postPurchase);
    await admin.mutation(api.stores.update, { ...draft, id: b, postPurchase: { enabled: false, price: 900 } });
    await admin.mutation(api.products.removeEbook, { id: disabledPost });
    expect(await admin.query(api.products.get, { id: disabledPost })).toBeNull();
  });

  it('is only for admins', async () => {
    const t = backend();
    const user = await signedIn(t, 'someone@example.com');
    await expect(user.query(api.products.storeUsage, {})).rejects.toThrow();
  });
});

it('only lets admins delete ebooks, including old records without a type', async () => {
  const t = backend();
  const admin = await signedIn(t, ADMIN);
  const other = await signedIn(t, 'someone@example.com');
  const id = await t.run(ctx => ctx.db.insert('products', product('Anterior', 'old')));
  for (const client of [t, other]) {
    await expect(client.mutation(api.products.removeEbook, { id })).rejects.toThrow();
  }
  for (const type of ['app', 'artifact']) {
    const otherId = await t.run(ctx => ctx.db.insert('products', { ...product(type, type), type }));
    await expect(admin.mutation(api.products.removeEbook, { id: otherId })).rejects.toThrow('Solo se pueden eliminar ebooks');
  }
  await admin.mutation(api.products.removeEbook, { id });
  await admin.mutation(api.products.removeEbook, { id });
  expect(await admin.query(api.products.get, { id })).toBeNull();
});
