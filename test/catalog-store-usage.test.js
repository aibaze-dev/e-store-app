import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { api } from './api';
import { backend, signedIn, product } from './helpers';

const ADMIN = 'owner@example.com';
beforeEach(() => vi.stubEnv('ADMIN_EMAILS', ADMIN));
afterEach(() => vi.unstubAllEnvs());

describe('catalog store usage', () => {
  it('lists the stores that sell each product, in any role', async () => {
    const t = backend();
    const admin = await signedIn(t, ADMIN);
    const [main, bonus, extra, post, disabledPost, unused] = await Promise.all(
      ['Main', 'Bonus', 'Extra', 'Post', 'Off', 'Unused'].map(name => admin.mutation(api.products.create, product(name, name.toLowerCase()))),
    );
    const store = (name, postPurchase) => admin.mutation(api.stores.create, {
      name, status: 'active', currency: 'usd',
      offer: { mainProductId: main, price: 1000, bonuses: [{ productId: bonus }], upsells: [{ productId: extra, price: 500, displayOrder: 0 }] },
      postPurchase, tracking: { metaPixelIds: [] },
    });
    const a = await store('A', { enabled: true, productId: post, price: 900 });
    const b = await store('B', { enabled: false, productId: disabledPost, price: 900 });

    const usage = await admin.query(api.products.storeUsage, {});
    expect(usage[main].map(s => s._id).sort()).toEqual([a, b].sort());
    expect(usage[bonus]).toHaveLength(2);
    expect(usage[extra]).toHaveLength(2);
    expect(usage[post]).toEqual([{ _id: a, name: 'A' }]);
    expect(usage[disabledPost]).toBeUndefined();
    expect(usage[unused]).toBeUndefined();
  });

  it('is only for admins', async () => {
    const t = backend();
    const user = await signedIn(t, 'someone@example.com');
    await expect(user.query(api.products.storeUsage, {})).rejects.toThrow();
  });
});
