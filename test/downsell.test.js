import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { api } from './api';
import { backend, signedIn, mockStripe, stripeEvent, sendWebhook, content, product, WEBHOOK_SECRET } from './helpers';
import { DOWNSELL_DEFAULTS, discountedPrice, downsellCopy, watchBackIntent } from '../src/storefront/downsell.js';

const ADMIN = 'owner@example.com';
beforeEach(() => {
  vi.stubEnv('ADMIN_EMAILS', ADMIN);
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_only');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const texts = { ...DOWNSELL_DEFAULTS, modalTitle: '  Un regalo  ', pageSubtitle: '' };

// Main ebook $27 with one bonus and one extra, 25% downsell; post-purchase $47 with 30%.
async function campaign(change = {}) {
  const t = backend();
  const admin = await signedIn(t, ADMIN);
  const ids = {};
  for (const [key, name] of [['main', 'Ebook principal'], ['bonus', 'Plantillas'], ['upsell', 'Audiolibro'], ['post', 'Curso avanzado']]) {
    ids[key] = await admin.mutation(api.products.create, product(name, key));
  }
  const store = {
    name: 'Campaña', status: 'active', currency: 'usd',
    offer: { mainProductId: ids.main, price: 2700, bonuses: [{ productId: ids.bonus }], upsells: [{ productId: ids.upsell, price: 900, displayOrder: 0 }] },
    postPurchase: { enabled: true, productId: ids.post, price: 4700, downsellPercent: 30 },
    downsell: { enabled: true, percent: 25, ...texts },
    tracking: { metaPixelId: '' },
    ...change,
  };
  const storeId = await admin.mutation(api.stores.create, store);
  await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: content });
  await admin.mutation(api.landings.publish, { storeId });
  return { t, admin, ids, store, storeId };
}

const start = (t, extra = {}) => t.action(api.checkout.start, { subdomain: 'inversion', upsellProductIds: [], attemptId: crypto.randomUUID(), via: 'path', ...extra });
const startPost = (t, extra = {}) => t.action(api.checkout.startPostPurchase, { parentSessionId: 'cs_test_1', attemptId: crypto.randomUUID(), via: 'path', ...extra });
const paid = (sessionId, amount) => stripeEvent('checkout.session.completed', {
  id: sessionId, payment_status: 'paid', payment_intent: `pi_${sessionId}`, amount_total: amount, currency: 'usd', customer_details: { email: 'buyer@example.com', name: 'Ana' },
});
const rows = (t, table) => t.run(ctx => ctx.db.query(table).collect());

describe('main product downsell', () => {
  it('publishes the discounted price and texts only while the store has it on', async () => {
    const { t, admin, store, storeId } = await campaign();
    const view = await t.query(api.storefront.getLanding, { subdomain: 'inversion' });
    expect(view.downsell).toMatchObject({ percent: 25, price: 2025, modalTitle: 'Un regalo', pageSubtitle: '' });
    expect(view.offer.main.price).toBe(2700);
    await admin.mutation(api.stores.update, { id: storeId, ...store, downsell: { ...store.downsell, enabled: false } });
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).downsell).toBeNull();
    await expect(start(t, { downsell: true })).rejects.toThrow();
    expect(await rows(t, 'orders')).toHaveLength(0);
  });

  it('charges the discounted main product with its bonuses and never with extras', async () => {
    const { t, admin, ids } = await campaign();
    const stripe = mockStripe();
    await expect(start(t, { downsell: true, upsellProductIds: [ids.upsell] })).rejects.toThrow();
    await start(t, { downsell: true });
    expect(stripe.requests[0].body['line_items[0][price_data][unit_amount]']).toBe('2025');
    const [order] = await rows(t, 'orders');
    expect(order).toMatchObject({ downsell: true, total: 2025 });
    expect(order.items.map(item => [item.role, item.price])).toEqual([['main', 2025], ['bonus', 0]]);

    // A charge at the regular price does not deliver the discounted order: it is held for review.
    await sendWebhook(t, paid('cs_test_1', 2700));
    expect(await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).toMatchObject({ status: 'needs_review', deliveries: [] });
    await start(t, { downsell: true });
    await sendWebhook(t, paid('cs_test_2', 2025));
    const delivery = await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_2' });
    expect(delivery.deliveries.map(link => link.url)).toEqual(['https://files.example.com/main.pdf', 'https://files.example.com/bonus.pdf']);
    expect((await admin.query(api.orders.list, {}))[0]).toMatchObject({ downsell: true, total: 2025, status: 'paid' });
  });

  it('opens the discounted order in a Payment Element session that asks for contact details', async () => {
    const { t } = await campaign();
    const stripe = mockStripe();
    await start(t, { downsell: true, elements: true });
    expect(stripe.requests[0].body).toMatchObject({ ui_mode: 'elements', 'name_collection[individual][enabled]': 'true', 'phone_number_collection[enabled]': 'true', 'line_items[0][price_data][unit_amount]': '2025' });
    expect(stripe.requests[0].body.customer_email).toBeUndefined();
  });

  it('leaves the regular checkout at full price', async () => {
    const { t } = await campaign();
    mockStripe();
    await start(t);
    const [order] = await rows(t, 'orders');
    expect(order.total).toBe(2700);
    expect(order.downsell).toBeUndefined();
  });

  it('validates the percentage and keeps the saved downsell when an update omits it', async () => {
    const { admin, store, storeId } = await campaign();
    const create = change => admin.mutation(api.stores.create, { ...store, ...change });
    for (const percent of [0, 91, 12.5]) await expect(create({ downsell: { ...store.downsell, percent } })).rejects.toThrow();
    await expect(create({ postPurchase: { ...store.postPurchase, downsellPercent: 95 } })).rejects.toThrow();
    await expect(create({ downsell: { ...store.downsell, enabled: false, percent: 0 } })).resolves.toBeTruthy();
    const { downsell, ...withoutDownsell } = store;
    await admin.mutation(api.stores.update, { id: storeId, ...withoutDownsell });
    expect((await admin.query(api.stores.get, { id: storeId })).downsell).toMatchObject({ enabled: true, percent: 25 });
  });
});

describe('post-purchase downsell', () => {
  it('offers the discount after the first payment and charges it only when asked', async () => {
    const { t } = await campaign();
    const stripe = mockStripe();
    await start(t);
    await sendWebhook(t, paid('cs_test_1', 2700));
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).postPurchaseOffer).toMatchObject({ price: 4700, downsellPercent: 30, downsellPrice: 3290 });

    await startPost(t);
    await startPost(t, { downsell: true });
    expect(stripe.requests.slice(1).map(request => request.body['line_items[0][price_data][unit_amount]'])).toEqual(['4700', '3290']);
    const [, regular, discounted] = await rows(t, 'orders');
    expect(regular.downsell).toBeUndefined();
    expect(discounted).toMatchObject({ downsell: true, total: 3290 });
    expect(discounted.items.map(item => [item.role, item.price])).toEqual([['post_purchase', 3290]]);
  });

  it('has no discounted price when the store did not set one', async () => {
    const { t, admin, ids, store, storeId } = await campaign();
    await admin.mutation(api.stores.update, { id: storeId, ...store, postPurchase: { enabled: true, productId: ids.post, price: 4700 } });
    mockStripe();
    await start(t);
    await sendWebhook(t, paid('cs_test_1', 2700));
    const offer = (await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).postPurchaseOffer;
    expect(offer).toMatchObject({ price: 4700 });
    expect(offer.downsellPrice).toBeUndefined();
    await expect(startPost(t, { downsell: true })).rejects.toThrow();
  });
});

describe('downsell copy and prices', () => {
  it('falls back to the default texts and rounds to the minor unit', () => {
    expect(downsellCopy({ modalTitle: ' ', acceptText: 'Quiero verla' })).toEqual({ ...DOWNSELL_DEFAULTS, acceptText: 'Quiero verla' });
    expect(downsellCopy(null)).toEqual(DOWNSELL_DEFAULTS);
    expect(discountedPrice(1699000, 25)).toBe(1274250);
    expect(discountedPrice(999, 25)).toBe(749);
  });
});

describe('back intent', () => {
  function fakeWindow(hasBeenActive) {
    const listeners = new Map();
    const win = {
      navigator: hasBeenActive === undefined ? {} : { userActivation: { hasBeenActive } },
      history: { state: { idx: 3 }, pushed: [], pushState(state, title) { this.pushed.push([state, title]); } },
      addEventListener: (name, handler) => listeners.set(name, handler),
      removeEventListener: (name, handler) => { if (listeners.get(name) === handler) listeners.delete(name); },
      fire: name => listeners.get(name)?.(),
      listeners,
    };
    return win;
  }

  it('adds one entry for the same address and reports the first back only', () => {
    const win = fakeWindow(true);
    const onBack = vi.fn();
    watchBackIntent(win, onBack);
    expect(win.history.pushed).toEqual([[{ idx: 3 }, '']]);
    win.fire('popstate');
    win.fire('popstate');
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(win.listeners.size).toBe(0);
  });

  it('waits for the first interaction before adding the entry', () => {
    const win = fakeWindow(false);
    const onBack = vi.fn();
    watchBackIntent(win, onBack);
    win.fire('pointerdown');
    win.fire('popstate');
    expect(win.history.pushed).toHaveLength(0);
    expect(onBack).not.toHaveBeenCalled();
    win.navigator.userActivation.hasBeenActive = true;
    win.fire('pointerup');
    win.fire('keydown');
    expect(win.history.pushed).toHaveLength(1);
    win.fire('popstate');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('works without the activation API and stops listening on cleanup', () => {
    const win = fakeWindow();
    const onBack = vi.fn();
    const stop = watchBackIntent(win, onBack);
    expect(win.history.pushed).toHaveLength(1);
    stop();
    expect(win.listeners.size).toBe(0);
  });
});
