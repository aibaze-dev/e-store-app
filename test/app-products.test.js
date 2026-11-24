import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { api } from './api';
import { backend, signedIn, mockStripe, mockResend, mockDiscord, stripeEvent, sendWebhook, content, product, WEBHOOK_SECRET } from './helpers';

const ADMIN = 'owner@example.com';
beforeEach(() => {
  vi.stubEnv('ADMIN_EMAILS', ADMIN);
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_only');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const APP_URL = 'https://app.example.com/entrar';
const app = (overrides = {}) => ({
  name: 'Mi App', description: 'Una web-app externa', coverUrl: '', status: 'active', type: 'app',
  deliverables: [{ title: 'ignored', url: APP_URL, kind: 'link' }], ...overrides,
});

describe('app products', () => {
  it('saves an app whose only deliverable is its link, named after the product', async () => {
    const t = backend();
    const admin = await signedIn(t, ADMIN);
    const id = await admin.mutation(api.products.create, app());
    expect(await admin.query(api.products.get, { id })).toMatchObject({
      type: 'app', name: 'Mi App', deliverables: [{ title: 'Mi App', url: APP_URL, kind: 'link' }],
    });
    // A rename keeps the delivered link in step with the name.
    await admin.mutation(api.products.update, { id, ...app({ name: 'Mi App Pro' }) });
    expect((await admin.query(api.products.get, { id })).deliverables).toEqual([{ title: 'Mi App Pro', url: APP_URL, kind: 'link' }]);
  });

  it('requires exactly one valid link', async () => {
    const t = backend();
    const admin = await signedIn(t, ADMIN);
    for (const deliverables of [
      [], [{ title: 'PDF', url: 'https://files.example.com/a.pdf', kind: 'file' }],
      [{ title: 'a', url: APP_URL, kind: 'link' }, { title: 'b', url: APP_URL, kind: 'link' }],
      [{ title: 'a', url: '', kind: 'link' }], [{ title: 'a', url: 'javascript:alert(1)', kind: 'link' }],
    ]) await expect(admin.mutation(api.products.create, app({ deliverables }))).rejects.toThrow();
    expect(await admin.query(api.products.list, {})).toEqual([]);
  });

  it('keeps the saved type when a client omits it, and defaults new products to ebooks', async () => {
    const t = backend();
    const admin = await signedIn(t, ADMIN);
    const appId = await admin.mutation(api.products.create, app());
    const { type: _type, ...withoutType } = app({ description: 'Editada' });
    await admin.mutation(api.products.update, { id: appId, ...withoutType });
    expect(await admin.query(api.products.get, { id: appId })).toMatchObject({ type: 'app', description: 'Editada' });
    const ebookId = await admin.mutation(api.products.create, product('Ebook', 'ebook'));
    expect((await admin.query(api.products.get, { id: ebookId })).type).toBe('e-book');
  });

  it('is sold as the main product and delivers the app link once paid', async () => {
    const t = backend();
    const admin = await signedIn(t, ADMIN);
    const main = await admin.mutation(api.products.create, app());
    const post = await admin.mutation(api.products.create, product('Curso', 'post'));
    const storeId = await admin.mutation(api.stores.create, {
      name: 'App', status: 'active', currency: 'usd',
      offer: { mainProductId: main, price: 2700, bonuses: [], upsells: [] },
      postPurchase: { enabled: false, productId: post, price: 4700 }, tracking: { metaPixelIds: [] },
    });
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'miapp', template: 'classic', draft: content });
    await admin.mutation(api.landings.publish, { storeId });
    mockStripe(); mockResend(); mockDiscord();
    const { sessionId } = await t.action(api.checkout.start, { subdomain: 'miapp', upsellProductIds: [], attemptId: crypto.randomUUID(), via: 'path', elements: true });
    await sendWebhook(t, stripeEvent('checkout.session.completed', {
      id: sessionId, payment_status: 'paid', payment_intent: `pi_${sessionId}`, amount_total: 2700, currency: 'usd',
      customer_details: { email: 'ana@example.com', name: 'Ana' },
    }));
    const [transaction] = await t.run(ctx => ctx.db.query('transactions').collect());
    expect(transaction).toMatchObject({ status: 'paid', deliveries: [{ productName: 'Mi App', title: 'Mi App', url: APP_URL }] });
  });
});
