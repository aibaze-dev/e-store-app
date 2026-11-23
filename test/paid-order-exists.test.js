import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { api, internal } from './api';
import { backend, signedIn, mockStripe, mockResend, mockDiscord, stripeEvent, sendWebhook, content, product, WEBHOOK_SECRET } from './helpers';

const ADMIN = 'owner@example.com';
const KEY = 'lookup-key-test-only';
beforeEach(() => {
  vi.stubEnv('ADMIN_EMAILS', ADMIN);
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_only');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
  vi.stubEnv('ORDER_LOOKUP_API_KEY', KEY);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function campaign(name = 'Campaña', subdomain = 'inversion') {
  const t = backend();
  const admin = await signedIn(t, ADMIN);
  const main = await admin.mutation(api.products.create, product('Ebook principal', 'main'));
  const post = await admin.mutation(api.products.create, product('Curso avanzado', 'post'));
  const storeId = await admin.mutation(api.stores.create, {
    name, status: 'active', currency: 'usd',
    offer: { mainProductId: main, price: 2700, bonuses: [], upsells: [] },
    postPurchase: { enabled: false, productId: post, price: 4700 },
    tracking: { metaPixelIds: [] },
  });
  await admin.mutation(api.landings.saveDraft, { storeId, subdomain, template: 'classic', draft: content });
  await admin.mutation(api.landings.publish, { storeId });
  return { t, admin, storeId };
}

const start = (t, subdomain = 'inversion') => t.action(api.checkout.start, { subdomain, upsellProductIds: [], attemptId: crypto.randomUUID(), via: 'path', elements: true });
const pay = (t, sessionId, email) => sendWebhook(t, stripeEvent('checkout.session.completed', {
  id: sessionId, payment_status: 'paid', payment_intent: `pi_${sessionId}`, amount_total: 2700, currency: 'usd',
  customer_details: { email, name: 'Compradora' },
}));
const check = (t, body, key = KEY) => t.fetch('/api/orders/paid-exists', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});
const exists = async (t, storeId, email) => (await (await check(t, { storeId, email })).json()).exists;

describe('POST /api/orders/paid-exists', () => {
  it('finds a paid order ignoring case and spaces in the email, and returns only a boolean', async () => {
    const { t, storeId } = await campaign();
    mockStripe(); mockResend(); mockDiscord();
    const { sessionId } = await start(t);
    await pay(t, sessionId, 'Ana.Perez@Example.COM');
    const response = await check(t, { storeId, email: '  ana.perez@example.com ' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ exists: true });
    expect(await exists(t, storeId, 'ANA.PEREZ@EXAMPLE.COM')).toBe(true);
    expect(await exists(t, storeId, 'ana.perez @example.com\n')).toBe(true);
    expect(await exists(t, storeId, 'otra@example.com')).toBe(false);
    expect(await exists(t, storeId, 'ana.perez+1@example.com')).toBe(false);
  });

  it('ignores orders that are not paid, including a draft email on a pending order', async () => {
    const { t, storeId } = await campaign();
    mockStripe();
    const { sessionId } = await start(t);
    await t.mutation(api.checkout.saveBuyerDraft, { sessionId, email: 'borrador@example.com', name: 'Borrador' });
    expect(await exists(t, storeId, 'borrador@example.com')).toBe(false);
  });

  it('is scoped to the store', async () => {
    const { t, admin, storeId } = await campaign();
    mockStripe(); mockResend(); mockDiscord();
    const { sessionId } = await start(t);
    await pay(t, sessionId, 'ana@example.com');
    const main = await admin.mutation(api.products.create, product('Otro ebook', 'main'));
    const other = await admin.mutation(api.stores.create, {
      name: 'Otra', status: 'active', currency: 'usd',
      offer: { mainProductId: main, price: 1000, bonuses: [], upsells: [] },
      postPurchase: { enabled: false, price: 0 }, tracking: { metaPixelIds: [] },
    });
    expect(await exists(t, storeId, 'ana@example.com')).toBe(true);
    expect(await exists(t, other, 'ana@example.com')).toBe(false);
  });

  it('is false again once the order is refunded', async () => {
    const { t, storeId } = await campaign();
    mockStripe(); mockResend(); mockDiscord();
    const { sessionId } = await start(t);
    await pay(t, sessionId, 'ana@example.com');
    await sendWebhook(t, stripeEvent('charge.refunded', { payment_intent: `pi_${sessionId}`, refunded: true }));
    expect(await exists(t, storeId, 'ana@example.com')).toBe(false);
  });

  it('answers false for a malformed or unknown store id', async () => {
    const { t } = await campaign();
    expect(await exists(t, 'no-es-un-id', 'ana@example.com')).toBe(false);
  });

  it('requires the shared key and valid input', async () => {
    const { t, storeId } = await campaign();
    expect((await check(t, { storeId, email: 'a@b.co' }, null)).status).toBe(401);
    expect((await check(t, { storeId, email: 'a@b.co' }, 'otra-clave')).status).toBe(401);
    expect((await check(t, { storeId })).status).toBe(400);
    expect((await check(t, { email: 'a@b.co' })).status).toBe(400);
    expect((await check(t, { storeId, email: 42 })).status).toBe(400);
    expect((await check(t, 'no json')).status).toBe(400);
    vi.stubEnv('ORDER_LOOKUP_API_KEY', '');
    expect((await check(t, { storeId, email: 'a@b.co' })).status).toBe(503);
  });

  it('backfills orders saved before the normalized email existed', async () => {
    const { t, storeId } = await campaign();
    mockStripe(); mockResend(); mockDiscord();
    const { sessionId } = await start(t);
    await pay(t, sessionId, 'Vieja@Example.com');
    await t.run(async ctx => {
      const [order] = await ctx.db.query('orders').collect();
      await ctx.db.patch(order._id, { buyerEmailKey: undefined });
    });
    expect(await exists(t, storeId, 'vieja@example.com')).toBe(false);
    const result = await t.mutation(internal.orders.backfillBuyerEmailKey, {});
    expect(result).toEqual({ done: true, updated: 1 });
    expect(await exists(t, storeId, 'vieja@example.com')).toBe(true);
  });
});
