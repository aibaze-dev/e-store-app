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

async function campaign() {
  const t = backend();
  const admin = await signedIn(t, ADMIN);
  const main = await admin.mutation(api.products.create, product('Ebook principal', 'main'));
  const post = await admin.mutation(api.products.create, product('Curso avanzado', 'post'));
  const storeId = await admin.mutation(api.stores.create, {
    name: 'Campaña', status: 'active', currency: 'usd',
    offer: { mainProductId: main, price: 2700, bonuses: [], upsells: [] },
    postPurchase: { enabled: false, productId: post, price: 4700 },
    tracking: { metaPixelId: '' },
  });
  await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: content });
  await admin.mutation(api.landings.publish, { storeId });
  return { t, admin, storeId };
}

const start = t => t.action(api.checkout.start, { subdomain: 'inversion', upsellProductIds: [], attemptId: crypto.randomUUID(), via: 'path', elements: true });
const save = (t, sessionId, email, name = '') => t.mutation(api.checkout.saveBuyerDraft, { sessionId, email, name });
const orders = t => t.run(ctx => ctx.db.query('orders').collect());

describe('buyer draft on pending orders', () => {
  it('keeps the email typed in an abandoned checkout on its pending order and shows it in the panel', async () => {
    const { t, admin } = await campaign();
    mockStripe();
    const { sessionId } = await start(t);
    await save(t, sessionId, '  ana@example.com ', '  Ana   Pérez ');
    expect((await orders(t))[0]).toMatchObject({ status: 'pending', buyer: { email: 'ana@example.com', name: 'Ana Pérez' } });
    // A correction replaces the previous draft.
    await save(t, sessionId, 'ana.perez@example.com', 'Ana Pérez');
    const [listed] = await admin.query(api.orders.list, {});
    expect(listed).toMatchObject({ status: 'pending', buyer: { email: 'ana.perez@example.com', name: 'Ana Pérez' } });
  });

  it('ignores invalid input and unknown sessions without failing', async () => {
    const { t } = await campaign();
    mockStripe();
    const { sessionId } = await start(t);
    for (const [id, email, name] of [
      [sessionId, 'no-es-un-email', ''], [sessionId, `${'a'.repeat(250)}@example.com`, ''], [sessionId, 'ana@example.com', 'x'.repeat(101)],
      ['cs_test_999', 'ana@example.com', ''], ['otro', 'ana@example.com', ''],
    ]) await expect(save(t, id, email, name)).resolves.toBeNull();
    expect((await orders(t))[0].buyer).toBeUndefined();
  });

  it('never touches an order once it is paid: Stripe details win', async () => {
    const { t } = await campaign();
    mockStripe(); mockResend(); mockDiscord();
    const { sessionId } = await start(t);
    await save(t, sessionId, 'borrador@example.com', 'Borrador');
    await sendWebhook(t, stripeEvent('checkout.session.completed', {
      id: sessionId, payment_status: 'paid', payment_intent: `pi_${sessionId}`, amount_total: 2700, currency: 'usd',
      customer_details: { email: 'buyer@example.com', name: 'Compradora' },
    }));
    await save(t, sessionId, 'tarde@example.com', 'Tarde');
    expect((await orders(t))[0]).toMatchObject({ status: 'paid', buyer: { email: 'buyer@example.com', name: 'Compradora' } });
  });
});
