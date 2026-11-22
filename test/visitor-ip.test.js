import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { api } from './api';
import { backend, signedIn, mockStripe, mockResend, mockDiscord, stripeEvent, sendWebhook, content, product, WEBHOOK_SECRET } from './helpers';
import { clientIp } from '../convex/lib/request_ip';

// convex-test does not implement the native getRequestMetadata syscall; only the transport
// metadata is replaced, everything else runs.
vi.mock('../convex/lib/request_ip', () => ({ clientIp: vi.fn(async () => null) }));

const ADMIN = 'owner@example.com';
beforeEach(() => {
  vi.stubEnv('ADMIN_EMAILS', ADMIN);
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_only');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
  clientIp.mockResolvedValue('192.0.2.7');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

async function campaign() {
  const t = backend();
  const admin = await signedIn(t, ADMIN);
  const main = await admin.mutation(api.products.create, product('Ebook principal', 'main'));
  const post = await admin.mutation(api.products.create, product('Curso avanzado', 'post'));
  const storeId = await admin.mutation(api.stores.create, {
    name: 'Campaña', status: 'active', currency: 'usd',
    offer: { mainProductId: main, price: 2700, bonuses: [], upsells: [] },
    postPurchase: { enabled: true, productId: post, price: 4700 },
    tracking: { metaPixelId: '' },
  });
  await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: content });
  await admin.mutation(api.landings.publish, { storeId });
  return { t, admin };
}

const start = t => t.action(api.checkout.start, { subdomain: 'inversion', upsellProductIds: [], attemptId: crypto.randomUUID(), via: 'path' });
const orders = t => t.run(ctx => ctx.db.query('orders').collect());

describe('visitor IP on orders', () => {
  it('keeps the IP of the browser that opened the checkout, and the post-purchase order repeats it', async () => {
    const { t, admin } = await campaign();
    mockStripe(); mockResend(); mockDiscord();
    const { sessionId } = await start(t);
    expect((await orders(t))[0].ip).toBe('192.0.2.7');
    await sendWebhook(t, stripeEvent('checkout.session.completed', {
      id: sessionId, payment_status: 'paid', payment_intent: `pi_${sessionId}`, amount_total: 2700, currency: 'usd',
      customer_details: { email: 'buyer@example.com', name: 'Compradora' },
    }));
    clientIp.mockResolvedValue('198.51.100.1');
    await t.action(api.checkout.startPostPurchase, { parentSessionId: sessionId, attemptId: crypto.randomUUID(), via: 'path' });
    expect((await orders(t)).map(order => order.ip)).toEqual(['192.0.2.7', '192.0.2.7']);
    // The panel does not receive it until it is turned into a location.
    expect((await admin.query(api.orders.list, {}))[0].ip).toBeUndefined();
  });

  it('opens the order without an IP when it cannot be read, and never accepts one from the browser', async () => {
    const { t } = await campaign();
    mockStripe();
    clientIp.mockRejectedValue(new Error('no metadata'));
    await start(t);
    clientIp.mockResolvedValue('not-an-ip');
    await start(t);
    expect((await orders(t)).map(order => order.ip)).toEqual([undefined, undefined]);
    await expect(t.action(api.checkout.start, { subdomain: 'inversion', upsellProductIds: [], attemptId: crypto.randomUUID(), via: 'path', ip: '203.0.113.9' })).rejects.toThrow();
  });
});
