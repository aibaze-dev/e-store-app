import { CHECKOUT_DEFAULTS, checkoutConfig } from '../shared/checkout-copy.js';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { api } from './api';
import { normalizeContent, mergeGeneratedContent } from '../src/templates/content.js';
import { backend, signedIn, mockStripe, mockResend, mockDiscord, stripeEvent, sendWebhook, content, product, WEBHOOK_SECRET, claudeReply } from './helpers';

const ADMIN = 'owner@example.com';
beforeEach(() => {
  vi.stubEnv('ADMIN_EMAILS', ` ${ADMIN.toUpperCase()} , second@example.com`);
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_only');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

// A published, active campaign: main ebook $27, one bonus, two extras and a post-purchase offer.
async function campaign() {
  const t = backend();
  const admin = await signedIn(t, ADMIN);
  const ids = {};
  for (const [key, name] of [['main', 'Ebook principal'], ['bonus', 'Plantillas'], ['upsellA', 'Audiolibro'], ['upsellB', 'Checklist'], ['post', 'Curso avanzado'], ['other', 'Producto ajeno']]) {
    ids[key] = await admin.mutation(api.products.create, product(name, key));
  }
  const store = {
    name: 'Campaña inversión', status: 'active', currency: 'usd',
    offer: {
      mainProductId: ids.main, price: 2700,
      bonuses: [{ productId: ids.bonus }],
      upsells: [{ productId: ids.upsellA, price: 900, displayOrder: 0 }, { productId: ids.upsellB, price: 500, displayOrder: 1 }],
    },
    postPurchase: { enabled: true, productId: ids.post, price: 4700 },
    tracking: { metaPixelIds: ['1234567890'] },
  };
  const storeId = await admin.mutation(api.stores.create, store);
  await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: content });
  await admin.mutation(api.landings.publish, { storeId });
  return { t, admin, ids, store, storeId };
}

const attempt = () => crypto.randomUUID();
const start = (t, upsellProductIds = [], attemptId = attempt()) =>
  t.action(api.checkout.start, { subdomain: 'inversion', upsellProductIds, attemptId, via: 'path' });
const paidSession = (sessionId, amount, extra = {}) => stripeEvent('checkout.session.completed', {
  id: sessionId, payment_status: 'paid', payment_intent: `pi_${sessionId}`, amount_total: amount, currency: 'usd',
  customer_details: { email: 'buyer@example.com', name: 'Compradora' }, ...extra,
});
const rows = (t, table) => t.run(ctx => ctx.db.query(table).collect());

describe('panel access', () => {
  it('rejects anonymous visitors and accounts outside ADMIN_EMAILS on every panel function', async () => {
    const { t, admin, ids, store, storeId } = await campaign();
    const stranger = await signedIn(t, 'stranger@example.com');
    const calls = client => [
      () => client.query(api.products.list, {}),
      () => client.query(api.products.get, { id: ids.main }),
      () => client.mutation(api.products.create, product('Intruso', 'x')),
      () => client.mutation(api.products.update, { id: ids.main, ...product('Intruso', 'x') }),
      () => client.query(api.stores.list, {}),
      () => client.query(api.stores.get, { id: storeId }),
      () => client.mutation(api.stores.create, store),
      () => client.mutation(api.stores.update, { id: storeId, ...store }),
      () => client.query(api.landings.getForStore, { storeId }),
      () => client.query(api.landings.preview, { storeId }),
      () => client.mutation(api.landings.saveDraft, { storeId, subdomain: 'otra', template: 'classic', draft: content }),
      () => client.mutation(api.landings.publish, { storeId }),
      () => client.query(api.orders.list, {}),
      () => client.query(api.orders.list, { storeId }),
    ];
    for (const call of [...calls(t), ...calls(stranger)]) await expect(call()).rejects.toThrow();
    for (const call of calls(admin).filter((_, index) => [0, 1, 4, 5, 8, 9, 12].includes(index))) await expect(call()).resolves.toBeDefined();
    expect((await admin.query(api.auth.getCurrentUser, {})).isAdmin).toBe(true);
    expect((await stranger.query(api.auth.getCurrentUser, {})).isAdmin).toBe(false);
    expect(await rows(t, 'products')).toHaveLength(6);
  });

  it('does not expose internal checkout functions through public names', async () => {
    const { t } = await campaign();
    // Order creation and event handling are internal; a browser can only call the actions.
    const modules = await import('../convex/checkout.ts');
    for (const name of ['createOrder', 'createPostPurchaseOrder', 'attachSession', 'handleStripeEvent']) {
      expect(modules[name].isInternal).toBe(true);
    }
    expect(t).toBeDefined();
  });
});

describe('checkout configuration publication', () => {
  it('keeps legacy settings, persists all checkout fields and publishes only on request', async () => {
    const { t, admin, storeId } = await campaign();
    await admin.mutation(api.stores.updateCheckout, { id: storeId, checkout: { upsellTitle: 'Extras anteriores', notifications: false, upsellReferences: [] } });
    const publicView = () => t.query(api.storefront.getCheckout, { subdomain: 'inversion' });
    const legacy = await publicView();
    expect(checkoutConfig(legacy)).toMatchObject({ upsellTitle: 'Extras anteriores', notifications: false, secure: 'Secure checkout' });
    const draft = normalizeContent(content);
    draft.checkout = { ...CHECKOUT_DEFAULTS, secure: 'Compra protegida', guaranteeFallback: '', pay: 'Comprar por {importe}', upsellTitle: 'Completá tu kit', showActivity: false, showExit: false, notifications: true, paymentLocale: 'en' };
    const save = value => admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: value });
    await save(draft);
    expect((await admin.query(api.landings.getForStore, { storeId })).draft.checkout).toEqual(draft.checkout);
    expect((await admin.query(api.landings.preview, { storeId })).content.checkout).toEqual(draft.checkout);
    expect(checkoutConfig(await publicView()).secure).toBe('Secure checkout');
    await admin.mutation(api.landings.publish, { storeId });
    const published = await publicView();
    expect(checkoutConfig(published)).toEqual(draft.checkout);
    expect(published.offer).toEqual(legacy.offer);
    expect(await t.run(ctx => ctx.db.query('orders').collect())).toHaveLength(0);
    for (const checkout of [{ secure: 'x'.repeat(601) }, { secure: '   ' }, { showActivity: 'false' }, { paymentLocale: 'invalid' }]) {
      await expect(save({ ...draft, checkout })).rejects.toThrow();
    }
    await expect(t.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', draft })).rejects.toThrow();
    expect(checkoutConfig(await publicView())).toEqual(draft.checkout);
  });
});

describe('public landing', () => {
  it('persists editable problem subtitles and landing labels without publishing the draft early', async () => {
    const { t, admin, storeId } = await campaign();
    const draft = normalizeContent(content);
    draft.painPoints.items = [{ title: 'Your first question', description: 'Start with a clear goal.', icon: 'check' }];
    draft.labels = { ...draft.labels, savings: 'Save {importe}', free: 'Included', customers: 'Readers', rights: '' };
    draft.about.subtitle = 'Meet the team';
    draft.faq.subtitle = 'Before you start';
    const save = value => admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: value });
    await save(draft);
    const saved = (await admin.query(api.landings.getForStore, { storeId })).draft;
    expect(saved.painPoints.items).toEqual(draft.painPoints.items);
    expect(saved.labels).toEqual(draft.labels);
    expect(saved.about.subtitle).toBe('Meet the team');
    expect(saved.faq.subtitle).toBe('Before you start');
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).content.labels.free).toBe('Free');
    await admin.mutation(api.landings.publish, { storeId });
    const published = (await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).content;
    expect(published.painPoints.items).toEqual(draft.painPoints.items);
    expect(published.labels).toEqual(draft.labels);
    await expect(save({ ...draft, labels: { ...draft.labels, free: 'x'.repeat(241) } })).rejects.toThrow();
    await expect(save({ ...draft, labels: { ...draft.labels, unknownLabel: 'Unsupported' } })).rejects.toThrow();
    draft.painPoints.items[0].description = '';
    await save(draft);
    expect((await admin.query(api.landings.getForStore, { storeId })).draft.painPoints.items[0].description).toBe('');
  });

  it('serves only published content of active stores and never the deliverables', async () => {
    const { t, admin, store, storeId } = await campaign();
    const landing = await t.query(api.storefront.getLanding, { subdomain: 'inversion' });
    expect(landing.offer.main).toMatchObject({ name: 'Ebook principal', price: 2700 });
    expect(landing.offer.bonuses.map(item => item.name)).toEqual(['Plantillas']);
    expect(landing.offer.upsells.map(item => item.price)).toEqual([900, 500]);
    expect(JSON.stringify(landing)).not.toContain('files.example.com');
    expect(JSON.stringify(landing)).not.toContain('deliverables');

    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: { ...content, hero: { ...content.hero, title: 'Borrador nuevo' } } });
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).content.hero.title).toBe('Aprendé a invertir');
    expect((await admin.query(api.landings.preview, { storeId })).content.hero.title).toBe('Borrador nuevo');

    await admin.mutation(api.stores.update, { id: storeId, ...store, status: 'draft' });
    expect(await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).toBeNull();
    expect(await t.query(api.storefront.getLanding, { subdomain: 'no-existe' })).toBeNull();
  });


  it('keeps conversation messages and custom activity copy in draft until publication', async () => {
    const { t, admin, storeId } = await campaign();
    const draft = normalizeContent(content);
    draft.socialProof = { ...draft.socialProof, eyebrow: 'Experiencias compartidas', items: [{ name: 'Ana', format: 'chat', quote: 'Ahora tengo un plan.', openingMessage: '¿Cómo te fue?', closingMessage: 'Gracias por contarnos.' }] };
    draft.promotion = { ...draft.promotion, title: 'Título propio de esta campaña', timerLabel: 'Tiempo disponible', spotsText: 'Disponibles: {cantidad}', remainingSpots: 8 };
    draft.activity = { ...draft.activity, viewersText: 'Ahora: {cantidad} lectores', salesText: 'Compras: {cantidad}', purchaseText: '{nombre} eligió esta guía', purchaseLocationText: 'Ubicación: {ciudad}' };
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft });
    const preview = await admin.query(api.landings.preview, { storeId });
    expect(preview.content.socialProof).toMatchObject(draft.socialProof);
    expect(preview.content.activity).toEqual(draft.activity);
    expect(preview.content.promotion.title).toBe(draft.promotion.title);
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).content.promotion.title).toBe('');
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).content.socialProof.items).toEqual([]);
    await admin.mutation(api.landings.publish, { storeId });
    const live = await t.query(api.storefront.getLanding, { subdomain: 'inversion' });
    expect(live.content.socialProof).toMatchObject(draft.socialProof);
    expect(live.content.promotion).toEqual(draft.promotion);
    expect(live.content.activity).toEqual(draft.activity);
    for (const patch of [
      { socialProof: { ...draft.socialProof, items: [{ name: 'Ana', format: 'chat', quote: '', imageUrl: 'https://example.com/image.png' }] } },
      { socialProof: { ...draft.socialProof, eyebrow: 'x'.repeat(121) } },
      { promotion: { ...draft.promotion, timerLabel: 'x'.repeat(121) } },
      { promotion: { ...draft.promotion, title: 'x'.repeat(161) } },
      { activity: { ...draft.activity, viewersText: 'x'.repeat(241) } },
    ]) await expect(admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: { ...draft, ...patch } })).rejects.toThrow();
  });
  it('accepts only currencies from the shared list', async () => {
    const { admin, store } = await campaign();
    for (const currency of ['XYZ', 'JPY', 'US']) await expect(admin.mutation(api.stores.create, { ...store, currency })).rejects.toThrow('Moneda');
    const id = await admin.mutation(api.stores.create, { ...store, currency: ' ars ' });
    expect((await admin.query(api.stores.get, { id })).currency).toBe('ARS');
  });
  it('does not serve a landing that was never published and keeps subdomains unique', async () => {
    const { t, admin, store } = await campaign();
    const second = await admin.mutation(api.stores.create, store);
    await expect(admin.mutation(api.landings.saveDraft, { storeId: second, subdomain: 'inversion', template: 'classic', draft: content })).rejects.toThrow();
    await expect(admin.mutation(api.landings.saveDraft, { storeId: second, subdomain: 'www', template: 'classic', draft: content })).rejects.toThrow();
    await admin.mutation(api.landings.saveDraft, { storeId: second, subdomain: 'segunda', template: 'classic', draft: content });
    expect(await t.query(api.storefront.getLanding, { subdomain: 'segunda' })).toBeNull();
  });
});

describe('checkout', () => {
  it('charges the amounts stored in the store for the selected extras', async () => {
    const { t, ids } = await campaign();
    const stripe = mockStripe();
    expect(await start(t, [ids.upsellB])).toMatchObject({ clientSecret: 'secret_1', sessionId: 'cs_test_1' });
    const [order] = await rows(t, 'orders');
    expect(order).toMatchObject({ status: 'pending', currency: 'USD', total: 3200 });
    expect(order.items.map(item => [item.role, item.name, item.price])).toEqual([
      ['main', 'Ebook principal', 2700], ['bonus', 'Plantillas', 0], ['upsell', 'Checklist', 500],
    ]);
    const { body, headers } = stripe.requests[0];
    expect(body).toMatchObject({
      mode: 'payment', ui_mode: 'embedded_page', client_reference_id: order._id,
      'line_items[0][price_data][unit_amount]': '2700', 'line_items[0][price_data][currency]': 'usd',
      'line_items[1][price_data][unit_amount]': '500',
      return_url: 'https://auth-test.convex.site/l/inversion/gracias?session_id={CHECKOUT_SESSION_ID}',
    });
    expect(body['line_items[2][quantity]']).toBeUndefined();
    expect(headers['Idempotency-Key']).toBe(`order-${order._id}`);
    const [transaction] = await rows(t, 'transactions');
    expect(transaction).toMatchObject({ status: 'pending', amount: 3200, stripeCheckoutSessionId: 'cs_test_1' });
    expect(transaction.deliveries.map(link => link.url)).toEqual([
      'https://files.example.com/main.pdf', 'https://files.example.com/bonus.pdf', 'https://files.example.com/upsellB.pdf',
    ]);
  });

  it('opens an Elements session in English with the same server prices and retry protection', async () => {
    const { t, ids } = await campaign();
    const stripe = mockStripe();
    const args = { subdomain: 'inversion', upsellProductIds: [ids.upsellA], attemptId: attempt(), via: 'path', elements: true };
    const first = await t.action(api.checkout.start, args);
    expect(await t.action(api.checkout.start, args)).toEqual(first);
    expect(await rows(t, 'orders')).toHaveLength(1);
    expect(stripe.requests[0].body).toMatchObject({ ui_mode: 'elements', locale: 'en', 'name_collection[individual][enabled]': 'true', 'line_items[1][price_data][unit_amount]': '900' });
    expect(stripe.requests[0].headers['Idempotency-Key']).toBe(stripe.requests[1].headers['Idempotency-Key']);
  });

  it('uses the published Stripe language for new orders and retains it on retries', async () => {
    const { t, admin, storeId } = await campaign();
    const stripe = mockStripe();
    const args = { subdomain: 'inversion', upsellProductIds: [], attemptId: attempt(), via: 'path', elements: true };
    await t.action(api.checkout.start, args);
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: { ...content, checkout: { paymentLocale: 'pt' } } });
    await admin.mutation(api.landings.publish, { storeId });
    await t.action(api.checkout.start, args);
    await t.action(api.checkout.start, { ...args, attemptId: attempt() });
    expect(stripe.requests.map(request => request.body.locale)).toEqual(['en', 'en', 'pt']);
  });

  it('builds the return address on the landing subdomain when the visit came through it', async () => {
    const { t } = await campaign();
    const stripe = mockStripe();
    await t.action(api.checkout.start, { subdomain: 'inversion', upsellProductIds: [], attemptId: attempt(), via: 'subdomain' });
    expect(stripe.requests[0].body.return_url).toBe('https://inversion.auth-test.convex.site/gracias?session_id={CHECKOUT_SESSION_ID}');
  });

  it('rejects extras that are not part of the offer, repeated extras and unknown arguments', async () => {
    const { t, ids } = await campaign();
    mockStripe();
    await expect(start(t, [ids.other])).rejects.toThrow();
    await expect(start(t, [ids.upsellA, ids.upsellA])).rejects.toThrow();
    await expect(t.action(api.checkout.start, { subdomain: 'inversion', upsellProductIds: [], attemptId: attempt(), via: 'path', total: 1 })).rejects.toThrow();
    await expect(t.action(api.checkout.start, { subdomain: 'no-existe', upsellProductIds: [], attemptId: attempt(), via: 'path' })).rejects.toThrow();
    expect(await rows(t, 'orders')).toHaveLength(0);
  });

  it('creates a single order and Stripe session when the same attempt is retried', async () => {
    const { t, ids } = await campaign();
    const stripe = mockStripe();
    const attemptId = attempt();
    const first = await start(t, [ids.upsellA], attemptId);
    expect(await start(t, [ids.upsellA], attemptId)).toEqual(first);
    expect(await rows(t, 'orders')).toHaveLength(1);
    expect(await rows(t, 'transactions')).toHaveLength(1);
    expect(new Set(stripe.requests.map(request => request.headers['Idempotency-Key'])).size).toBe(1);
  });

  it('keeps the sold prices and links when the store or product changes afterwards', async () => {
    const { t, admin, ids, store, storeId } = await campaign();
    mockStripe();
    await start(t);
    await admin.mutation(api.stores.update, { id: storeId, ...store, offer: { ...store.offer, price: 9900 } });
    await admin.mutation(api.products.update, { id: ids.main, ...product('Renombrado', 'nuevo') });
    const [order] = await rows(t, 'orders');
    expect(order.total).toBe(2700);
    expect(order.items[0].name).toBe('Ebook principal');
    expect((await rows(t, 'transactions'))[0].deliveries[0].url).toBe('https://files.example.com/main.pdf');
  });

  it('stays blocked without Stripe credentials and reports a Stripe failure without confirming anything', async () => {
    const { t } = await campaign();
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    await expect(start(t)).rejects.toThrow();
    expect(await rows(t, 'orders')).toHaveLength(0);
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_only');
    mockStripe({ fail: true });
    await expect(start(t)).rejects.toThrow();
    expect((await rows(t, 'orders')).map(order => order.status)).toEqual(['pending']);
  });
});

describe('checkout retries', () => {
  const retryStart = (t, attemptId) => t.action(api.checkout.start, { subdomain: 'inversion', upsellProductIds: [], attemptId, via: 'path', retry: true });

  it('gets past a Stripe error that Stripe replays for the same key, keeping a single order', async () => {
    const { t } = await campaign();
    const stripe = mockStripe({ failFirst: 1 });
    const attemptId = attempt();
    await expect(start(t, [], attemptId)).rejects.toThrow();
    await expect(start(t, [], attemptId)).rejects.toThrow();
    expect(await retryStart(t, attemptId)).toMatchObject({ clientSecret: 'secret_1', sessionId: 'cs_test_1' });
    // Once a session is linked, retries reuse its key instead of opening another session.
    expect(await retryStart(t, attemptId)).toMatchObject({ clientSecret: 'secret_1', sessionId: 'cs_test_1' });
    expect(await rows(t, 'orders')).toHaveLength(1);
    expect(stripe.requests.map(request => request.headers['Idempotency-Key'])).toEqual([
      expect.stringMatching(/^order-[^-]+$/), expect.stringMatching(/^order-[^-]+$/), expect.stringMatching(/-retry-1$/), expect.stringMatching(/-retry-1$/),
    ]);
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    expect((await rows(t, 'orders'))[0].status).toBe('paid');
  });

  it('never replaces a linked session when Stripe has forgotten the key', async () => {
    const { t } = await campaign();
    const stripe = mockStripe();
    const attemptId = attempt();
    expect(await start(t, [], attemptId)).toMatchObject({ clientSecret: 'secret_1', sessionId: 'cs_test_1' });
    stripe.forget();
    await expect(start(t, [], attemptId)).rejects.toThrow();
    await expect(retryStart(t, attemptId)).rejects.toThrow();
    const [transaction] = await rows(t, 'transactions');
    expect(transaction).toMatchObject({ stripeCheckoutSessionId: 'cs_test_1' });
    expect(transaction.sessionAttempt).toBeUndefined();
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    expect((await rows(t, 'orders'))[0].status).toBe('paid');
  });
});

describe('payment session expiry', () => {
  const startPost = (t, parentSessionId, attemptId = attempt()) =>
    t.action(api.checkout.startPostPurchase, { parentSessionId, attemptId, via: 'path' });

  it('asks Stripe for a 30 minute session and returns when it ends', async () => {
    const { t } = await campaign();
    const stripe = mockStripe();
    const before = Date.now();
    const session = await start(t);
    const sent = Number(stripe.requests[0].body.expires_at) * 1000;
    // Stripe needs at least 30 minutes from when it receives the request: one more is asked.
    expect(sent - before).toBeGreaterThanOrEqual(31 * 60_000 - 1000);
    expect(sent - before).toBeLessThanOrEqual(31 * 60_000 + 1000);
    expect(session).toEqual({ clientSecret: 'secret_1', sessionId: 'cs_test_1', expiresAt: sent });
    expect((await rows(t, 'transactions'))[0].stripeSessionExpiresAt).toBe(sent);
  });

  it('replays a key with the same expiry and gives a new key a fresh one', async () => {
    const { t } = await campaign();
    const stripe = mockStripe({ failFirst: 1 });
    const attemptId = attempt();
    await expect(start(t, [], attemptId)).rejects.toThrow();
    await expect(start(t, [], attemptId)).rejects.toThrow();
    const [first, replay] = stripe.requests.map(request => request.body.expires_at);
    expect(replay).toBe(first);
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 5 * 60_000 });
    try {
      await t.action(api.checkout.start, { subdomain: 'inversion', upsellProductIds: [], attemptId, via: 'path', retry: true });
    } finally { vi.useRealTimers(); }
    const moved = Number(stripe.requests[2].body.expires_at) - Number(first);
    expect(moved).toBeGreaterThanOrEqual(5 * 60);
    expect(moved).toBeLessThanOrEqual(5 * 60 + 2);
  });

  it('tells the checkout when its session can no longer be paid', async () => {
    const { t } = await campaign();
    mockStripe();
    await start(t);
    await start(t);
    expect(await t.query(api.checkout.sessionStatus, { sessionId: 'cs_test_1' })).toBe('open');
    await sendWebhook(t, stripeEvent('checkout.session.expired', { id: 'cs_test_1', payment_status: 'unpaid' }));
    expect(await t.query(api.checkout.sessionStatus, { sessionId: 'cs_test_1' })).toBe('ended');
    await sendWebhook(t, stripeEvent('checkout.session.async_payment_failed', { id: 'cs_test_2', payment_status: 'unpaid', payment_intent: 'pi_2' }));
    expect(await t.query(api.checkout.sessionStatus, { sessionId: 'cs_test_2' })).toBe('ended');
    expect(await t.query(api.checkout.sessionStatus, { sessionId: 'cs_test_404' })).toBeNull();
    expect(await t.query(api.checkout.sessionStatus, { sessionId: 'not-a-session' })).toBeNull();
  });

  it('keeps a paid session open so the buyer is never offered a second payment', async () => {
    const { t } = await campaign();
    mockStripe();
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    expect(await t.query(api.checkout.sessionStatus, { sessionId: 'cs_test_1' })).toBe('open');
  });

  it('opens a new post-purchase order once the previous session ran out', async () => {
    const { t } = await campaign();
    mockStripe();
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    expect(await startPost(t, 'cs_test_1')).toMatchObject({ sessionId: 'cs_test_2' });
    // Another tab still within the session shares it.
    expect(await startPost(t, 'cs_test_1')).toMatchObject({ sessionId: 'cs_test_2' });
    // The time ran out but Stripe has not sent the expired event yet.
    await t.run(async ctx => {
      const transaction = (await ctx.db.query('transactions').collect()).find(row => row.stripeCheckoutSessionId === 'cs_test_2');
      await ctx.db.patch(transaction._id, { stripeSessionExpiresAt: Date.now() + 60_000 });
    });
    expect(await startPost(t, 'cs_test_1')).toMatchObject({ sessionId: 'cs_test_3' });
    const children = (await rows(t, 'orders')).filter(order => order.parentOrderId);
    expect(children.map(order => order.status)).toEqual(['pending', 'pending']);
    await sendWebhook(t, paidSession('cs_test_3', 4700));
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_3' })).status).toBe('paid');
  });

  it('asks a tab still holding a session from before expiries were saved to reload', async () => {
    const { t } = await campaign();
    mockStripe();
    const attemptId = attempt();
    await start(t, [], attemptId);
    await t.run(async ctx => {
      const [transaction] = await ctx.db.query('transactions').collect();
      await ctx.db.patch(transaction._id, { stripeSessionExpiresAt: undefined });
    });
    await expect(start(t, [], attemptId)).rejects.toThrow(/Recargá la página/);
  });
});

describe('checkout countdown', () => {
  it('ends one minute before Stripe closes the session', async () => {
    const { sessionDeadline, sessionTimeLeft } = await import('../shared/checkout-session.js');
    const expiresAt = Date.UTC(2026, 0, 1, 12, 31);
    const deadline = sessionDeadline(expiresAt);
    expect(deadline).toBe(Date.UTC(2026, 0, 1, 12, 30));
    expect(sessionTimeLeft(deadline, Date.UTC(2026, 0, 1, 12, 0))).toBe('30:00');
    expect(sessionTimeLeft(deadline, Date.UTC(2026, 0, 1, 12, 29, 0, 500))).toBe('01:00');
    expect(sessionTimeLeft(deadline, deadline + 5000)).toBe('00:00');
    expect(sessionDeadline(undefined)).toBeNull();
  });

  it('stops offering a remembered session once its countdown ended', async () => {
    const { sessionEnded } = await import('../shared/checkout-session.js');
    const expiresAt = Date.UTC(2026, 0, 1, 12, 31);
    expect(sessionEnded(expiresAt, Date.UTC(2026, 0, 1, 12, 29, 59))).toBe(false);
    expect(sessionEnded(expiresAt, Date.UTC(2026, 0, 1, 12, 30))).toBe(true);
    expect(sessionEnded(undefined)).toBe(false);
  });
});

describe('stripe webhook and delivery', () => {
  it('shows links only after a verified payment and applies a repeated event once', async () => {
    const { t, admin } = await campaign();
    mockStripe();
    await start(t);
    const pending = await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' });
    expect(pending).toMatchObject({ status: 'pending', deliveries: [], postPurchaseOffer: null });

    const event = paidSession('cs_test_1', 2700);
    expect((await sendWebhook(t, event)).status).toBe(200);
    expect((await sendWebhook(t, event)).status).toBe(200);
    expect(await rows(t, 'webhookEvents')).toHaveLength(1);

    const paid = await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' });
    expect(paid.status).toBe('paid');
    expect(paid.deliveries.map(link => link.url)).toEqual(['https://files.example.com/main.pdf', 'https://files.example.com/bonus.pdf']);
    expect(paid.postPurchaseOffer).toMatchObject({ name: 'Curso avanzado', price: 4700 });
    expect(JSON.stringify(paid.postPurchaseOffer)).not.toContain('files.example.com');

    const [order] = await admin.query(api.orders.list, {});
    expect(order).toMatchObject({ status: 'paid', total: 2700, buyer: { email: 'buyer@example.com', name: 'Compradora' }, stripePaymentIntentId: 'pi_cs_test_1' });
    expect(await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_unknown' })).toBeNull();
    expect(await t.query(api.storefront.getDelivery, { sessionId: '' })).toBeNull();
  });

  it('delivers the current links of an edited product to past buyers, keeping the sold names', async () => {
    const { t, admin, ids } = await campaign();
    mockStripe();
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    await admin.mutation(api.products.update, { id: ids.main, ...product('Renombrado', 'nuevo') });

    const paid = await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' });
    expect(paid.deliveries.map(link => link.url)).toEqual(['https://files.example.com/nuevo.pdf', 'https://files.example.com/bonus.pdf']);
    expect(paid.deliveries[0].productName).toBe('Ebook principal');
    expect(paid.items[0].name).toBe('Ebook principal');
    const [order] = await admin.query(api.orders.list, {});
    expect(order.deliveries[0].url).toBe('https://files.example.com/nuevo.pdf');
  });

  it('rejects unsigned, wrongly signed and stale events without changing the order', async () => {
    const { t } = await campaign();
    mockStripe();
    await start(t);
    const event = paidSession('cs_test_1', 2700);
    expect((await sendWebhook(t, event, { secret: 'whsec_wrong' })).status).toBe(400);
    expect((await sendWebhook(t, event, { timestamp: Math.floor(Date.now() / 1000) - 3600 })).status).toBe(400);
    expect((await t.fetch('/api/stripe/webhook', { method: 'POST', body: JSON.stringify(event) })).status).toBe(400);
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
    expect((await sendWebhook(t, event)).status).toBe(503);
    expect((await rows(t, 'orders'))[0].status).toBe('pending');
    expect(await rows(t, 'webhookEvents')).toHaveLength(0);
  });

  it('waits for delayed payments and confirms them once Stripe reports them paid', async () => {
    const { t } = await campaign();
    mockStripe();
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 2700, { payment_status: 'unpaid' }));
    expect((await rows(t, 'orders'))[0].status).toBe('pending');
    await sendWebhook(t, stripeEvent('checkout.session.async_payment_succeeded', paidSession('cs_test_1', 2700).data.object));
    expect((await rows(t, 'orders'))[0].status).toBe('paid');
    expect((await rows(t, 'webhookEvents')).map(event => event.status)).toEqual(['ignored', 'processed']);
  });

  it('marks declined delayed payments as failed instead of leaving them pending', async () => {
    const { t, admin } = await campaign();
    mockStripe();
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 2700, { payment_status: 'unpaid' }));
    await sendWebhook(t, stripeEvent('checkout.session.async_payment_failed', { id: 'cs_test_1', payment_status: 'unpaid', payment_intent: 'pi_cs_test_1', amount_total: 2700, currency: 'usd' }));
    await sendWebhook(t, stripeEvent('checkout.session.async_payment_succeeded', paidSession('cs_test_1', 2700).data.object));
    expect(await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).toMatchObject({ status: 'failed', deliveries: [] });
    expect((await admin.query(api.orders.list, {}))[0].status).toBe('failed');
  });

  it('holds charges that differ from the order for review until they are refunded', async () => {
    const { t, admin } = await campaign();
    mockStripe();
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 100));
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    const review = await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' });
    expect(review).toMatchObject({ status: 'needs_review', deliveries: [], postPurchaseOffer: null });
    const [order] = await admin.query(api.orders.list, {});
    expect(order).toMatchObject({ status: 'needs_review', charged: { amount: 100, currency: 'USD' }, stripePaymentIntentId: 'pi_cs_test_1', buyer: { email: 'buyer@example.com' }, email: { status: 'skipped', error: 'not_configured' } });
    expect((await rows(t, 'webhookEvents')).map(event => event.status)).toEqual(['rejected', 'ignored']);

    await start(t);
    await sendWebhook(t, paidSession('cs_test_2', 2700, { currency: 'eur' }));
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_2' })).status).toBe('needs_review');

    await sendWebhook(t, stripeEvent('charge.refunded', { id: 'ch_1', payment_intent: 'pi_cs_test_1', refunded: true }));
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).status).toBe('refunded');
  });

  it('expires abandoned sessions and hides links again after a full refund', async () => {
    const { t } = await campaign();
    mockStripe();
    await start(t);
    await start(t);
    await sendWebhook(t, stripeEvent('checkout.session.expired', { id: 'cs_test_1', payment_status: 'unpaid' }));
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).status).toBe('expired');

    await sendWebhook(t, paidSession('cs_test_2', 2700));
    await sendWebhook(t, stripeEvent('charge.refunded', { id: 'ch_1', payment_intent: 'pi_cs_test_2', refunded: false }));
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_2' })).deliveries).toHaveLength(2);
    await sendWebhook(t, stripeEvent('charge.refunded', { id: 'ch_1', payment_intent: 'pi_cs_test_2', refunded: true }));
    const refunded = await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_2' });
    expect(refunded).toMatchObject({ status: 'refunded', deliveries: [], postPurchaseOffer: null });
  });
});

describe('stripe events out of order', () => {
  it('applies a refund that arrives before its payment instead of delivering the links', async () => {
    const { t, admin } = await campaign();
    mockStripe();
    await start(t);
    await sendWebhook(t, stripeEvent('charge.refunded', { id: 'ch_1', payment_intent: 'pi_cs_test_1', refunded: true }));
    expect((await rows(t, 'orders'))[0].status).toBe('pending');
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    expect(await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).toMatchObject({ status: 'refunded', deliveries: [], postPurchaseOffer: null });
    expect((await admin.query(api.orders.list, {}))[0]).toMatchObject({ status: 'refunded', stripePaymentIntentId: 'pi_cs_test_1', buyer: { email: 'buyer@example.com' }, email: null });
    expect((await rows(t, 'webhookEvents')).map(event => event.status)).toEqual(['processed', 'processed']);
  });

  it('ignores partial refunds and refunds of other payments that arrive first', async () => {
    const { t } = await campaign();
    mockStripe();
    await start(t);
    await sendWebhook(t, stripeEvent('charge.refunded', { id: 'ch_1', payment_intent: 'pi_cs_test_1', refunded: false }));
    await sendWebhook(t, stripeEvent('charge.refunded', { id: 'ch_2', payment_intent: 'pi_other', refunded: true }));
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).status).toBe('paid');
  });

  it('holds a payment reported for an order that had already expired', async () => {
    const { t, admin } = await campaign();
    mockStripe();
    await start(t);
    await sendWebhook(t, stripeEvent('checkout.session.expired', { id: 'cs_test_1', payment_status: 'unpaid' }));
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    expect(await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).toMatchObject({ status: 'needs_review', deliveries: [] });
    expect((await admin.query(api.orders.list, {}))[0]).toMatchObject({ reviewReason: 'late', charged: { amount: 2700, currency: 'USD' } });
  });
});

describe('purchase emails through Resend', () => {
  beforeEach(() => {
    vi.stubEnv('RESEND_API_KEY', 're_test_only');
    vi.stubEnv('EMAIL_FROM', 'Tienda <ventas@example.com>');
  });
  afterEach(() => { vi.useRealTimers(); });
  // Scheduled jobs only run under fake timers, so they are switched on after the campaign exists.
  const settle = t => t.finishAllScheduledFunctions(vi.runAllTimers);

  it('emails the delivery links to the buyer once, after the verified payment', async () => {
    const { t, admin, ids } = await campaign();
    mockStripe();
    vi.useFakeTimers();
    const resend = mockResend();
    await start(t, [ids.upsellA]);
    const event = paidSession('cs_test_1', 3600, { customer_details: { email: 'buyer@example.com', name: '<b>Ana</b>' } });
    await sendWebhook(t, event);
    await sendWebhook(t, event);
    await settle(t);

    expect(resend.emails).toHaveLength(1);
    const [{ headers, body }] = resend.emails;
    expect(headers.Authorization).toBe('Bearer re_test_only');
    expect(headers['Idempotency-Key']).toMatch(/^paid-/);
    expect(body).toMatchObject({ from: 'Tienda <ventas@example.com>', to: ['buyer@example.com'], subject: 'Your access to Campaña inversión' });
    // Same design and texts as the thank-you page.
    for (const text of ['Thank you for your purchase!', 'Your access links', 'Order summary', 'Total paid', 'Download']) expect(body.html).toContain(text);
    for (const url of ['main.pdf', 'bonus.pdf', 'upsellA.pdf']) {
      expect(body.html).toContain(`https://files.example.com/${url}`);
      expect(body.text).toContain(`https://files.example.com/${url}`);
    }
    expect(body.html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    expect(body.html).not.toContain('<b>Ana</b>');
    expect((await admin.query(api.orders.list, {}))[0].email).toEqual({ status: 'sent', error: '' });
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).emailed).toBe(true);
  });

  it('retries temporary Resend failures and gives up on permanent ones', async () => {
    const { t, admin } = await campaign();
    mockStripe();
    vi.useFakeTimers();
    const resend = mockResend([500, 429, 200, 422]);
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    await settle(t);
    expect(resend.emails).toHaveLength(3);
    expect(new Set(resend.emails.map(email => email.headers['Idempotency-Key'])).size).toBe(1);
    expect((await admin.query(api.orders.list, {}))[0].email.status).toBe('sent');

    await start(t);
    await sendWebhook(t, paidSession('cs_test_2', 2700));
    await settle(t);
    expect(resend.emails).toHaveLength(4);
    expect((await admin.query(api.orders.list, {}))[0].email).toEqual({ status: 'failed', error: 'application_error' });
  });

  it('alerts the admins instead of the buyer when the charge needs review', async () => {
    const { t } = await campaign();
    mockStripe();
    vi.useFakeTimers();
    const resend = mockResend();
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 100));
    await settle(t);
    expect(resend.emails).toHaveLength(1);
    expect(resend.emails[0].body.to).toEqual(['owner@example.com', 'second@example.com']);
    expect(resend.emails[0].body.subject).toBe('Revisar cobro en Campaña inversión');
    expect(resend.emails[0].body.text).not.toContain('files.example.com');
  });

  it('does not email a purchase that was refunded before the email went out', async () => {
    const { t, admin } = await campaign();
    mockStripe();
    vi.useFakeTimers();
    const resend = mockResend();
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    await sendWebhook(t, stripeEvent('charge.refunded', { id: 'ch_1', payment_intent: 'pi_cs_test_1', refunded: true }));
    await settle(t);
    expect(resend.emails).toHaveLength(0);
    expect((await admin.query(api.orders.list, {}))[0].email).toEqual({ status: 'skipped', error: 'status_changed' });
  });
});

describe('post-purchase offer', () => {
  const startPost = (t, parentSessionId, attemptId = attempt()) =>
    t.action(api.checkout.startPostPurchase, { parentSessionId, attemptId, via: 'path' });

  it('is a second order linked to the first one that never alters the first purchase', async () => {
    const { t } = await campaign();
    const stripe = mockStripe();
    await start(t);
    await expect(startPost(t, 'cs_test_1')).rejects.toThrow();
    await sendWebhook(t, paidSession('cs_test_1', 2700));

    expect(await startPost(t, 'cs_test_1')).toMatchObject({ clientSecret: 'secret_2', sessionId: 'cs_test_2' });
    expect(stripe.requests[1].body['line_items[0][price_data][unit_amount]']).toBe('4700');
    const [parent, child] = await rows(t, 'orders');
    expect(child).toMatchObject({ parentOrderId: parent._id, status: 'pending', total: 4700 });
    expect(child.items.map(item => item.role)).toEqual(['post_purchase']);
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_2' })).deliveries).toEqual([]);

    // Abandoning the second checkout leaves the first purchase and its links untouched.
    await sendWebhook(t, stripeEvent('checkout.session.expired', { id: 'cs_test_2', payment_status: 'unpaid' }));
    const first = await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' });
    expect(first.status).toBe('paid');
    expect(first.deliveries).toHaveLength(2);
    expect(first.postPurchaseOffer).not.toBeNull();

    await startPost(t, 'cs_test_1');
    await sendWebhook(t, paidSession('cs_test_3', 4700));
    const second = await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_3' });
    expect(second).toMatchObject({ status: 'paid', isPostPurchase: true, postPurchaseOffer: null });
    expect(second.deliveries.map(link => link.url)).toEqual([
      'https://files.example.com/main.pdf', 'https://files.example.com/bonus.pdf', 'https://files.example.com/post.pdf',
    ]);
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).postPurchaseOffer).toBeNull();
    await expect(startPost(t, 'cs_test_1')).rejects.toThrow();
    await expect(startPost(t, 'cs_test_3')).rejects.toThrow();
  });

  it('opens a Payment Element session that reuses the buyer of the first purchase', async () => {
    const { t, admin } = await campaign();
    const stripe = mockStripe();
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    await t.action(api.checkout.startPostPurchase, { parentSessionId: 'cs_test_1', attemptId: attempt(), via: 'path', elements: true });
    const { body } = stripe.requests[1];
    expect(body).toMatchObject({ ui_mode: 'elements', customer_email: 'buyer@example.com' });
    expect(body['name_collection[individual][enabled]']).toBeUndefined();
    expect(body['phone_number_collection[enabled]']).toBeUndefined();

    // Stripe does not ask the name again, so the order keeps the one from the first purchase.
    await sendWebhook(t, paidSession('cs_test_2', 4700, { customer_details: { email: 'buyer@example.com', name: null } }));
    expect((await admin.query(api.orders.list, {}))[0]).toMatchObject({ isPostPurchase: true, status: 'paid', buyer: { email: 'buyer@example.com', name: 'Compradora' } });
  });

  it('shares one order between tabs so the offer can only be paid once', async () => {
    const { t } = await campaign();
    const stripe = mockStripe();
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    const first = await startPost(t, 'cs_test_1');
    expect(await startPost(t, 'cs_test_1')).toEqual(first);
    expect((await rows(t, 'orders')).filter(order => order.parentOrderId)).toHaveLength(1);
    expect(new Set(stripe.requests.slice(1).map(request => request.headers['Idempotency-Key'])).size).toBe(1);
  });

  it('holds for review a second paid order of the same offer instead of delivering it again', async () => {
    const { t, admin, store, storeId } = await campaign();
    mockStripe();
    await admin.mutation(api.stores.update, { id: storeId, ...store, postPurchase: { ...store.postPurchase, downsellPercent: 50 } });
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    await startPost(t, 'cs_test_1');
    await t.action(api.checkout.startPostPurchase, { parentSessionId: 'cs_test_1', attemptId: attempt(), via: 'path', downsell: true });
    await sendWebhook(t, paidSession('cs_test_2', 4700));
    await sendWebhook(t, paidSession('cs_test_3', 2350));
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_2' })).status).toBe('paid');
    expect(await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_3' })).toMatchObject({ status: 'needs_review', deliveries: [] });
    const held = (await admin.query(api.orders.list, {})).find(order => order.status === 'needs_review');
    expect(held).toMatchObject({ downsell: true, reviewReason: 'duplicate', charged: { amount: 2350, currency: 'USD' } });
    await expect(startPost(t, 'cs_test_1')).rejects.toThrow();
  });

  it('is not offered when the store has it disabled', async () => {
    const { t, admin, store, storeId } = await campaign();
    mockStripe();
    await admin.mutation(api.stores.update, { id: storeId, ...store, postPurchase: { enabled: false, price: 0 } });
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).postPurchaseOffer).toBeNull();
    await expect(startPost(t, 'cs_test_1')).rejects.toThrow();
  });
});

describe('product deliverables', () => {
  it('saves a product without deliverables, adds documents and web links later, and allows removing them all', async () => {
    const t = backend();
    const admin = await signedIn(t, ADMIN);
    const data = { ...product('Recurso pendiente', 'pending'), deliverables: [] };
    const id = await admin.mutation(api.products.create, data);
    expect((await admin.query(api.products.get, { id })).deliverables).toEqual([]);
    const deliverables = [
      { title: 'Documento', url: 'https://files.example.com/guia.pdf', kind: 'file' },
      { title: 'Acceso al curso', url: 'https://example.com/curso?acceso=abc#inicio', kind: 'link' },
    ];
    await admin.mutation(api.products.update, { id, ...data, deliverables });
    expect((await admin.query(api.products.get, { id })).deliverables).toEqual(deliverables);
    const linkedId = await admin.mutation(api.products.create, { ...data, deliverables: [deliverables[1]] });
    expect((await admin.query(api.products.get, { id: linkedId })).deliverables).toEqual([deliverables[1]]);
    await admin.mutation(api.products.update, { id, ...data });
    expect((await admin.query(api.products.get, { id })).deliverables).toEqual([]);
    for (const url of ['', 'no-es-un-enlace', 'javascript:alert(1)', 'data:text/html,hello']) {
      await expect(admin.mutation(api.products.update, { id, ...data, deliverables: [{ title: 'Acceso', url }] })).rejects.toThrow();
    }
    expect((await admin.query(api.products.get, { id })).deliverables).toEqual([]);
  });
});

describe('store validation', () => {
  it('rejects invalid prices, repeated products and activation without deliverables', async () => {
    const { admin, ids, store } = await campaign();
    const create = change => admin.mutation(api.stores.create, { ...store, ...change });
    await expect(create({ offer: { ...store.offer, price: 0 } })).rejects.toThrow();
    await expect(create({ offer: { ...store.offer, price: 19.99 } })).rejects.toThrow();
    await expect(create({ offer: { ...store.offer, bonuses: [{ productId: ids.main }] } })).rejects.toThrow();
    await expect(create({ postPurchase: { enabled: true, price: 100 } })).rejects.toThrow();
    await expect(create({ currency: 'dolar' })).rejects.toThrow();
    await expect(create({ tracking: { metaPixelIds: ['<script>'] } })).rejects.toThrow();
    const empty = await admin.mutation(api.products.create, { ...product('Sin links', 'x'), deliverables: [] });
    await expect(create({ offer: { ...store.offer, mainProductId: empty } })).rejects.toThrow();
    await expect(create({ status: 'draft', offer: { ...store.offer, mainProductId: empty } })).resolves.toBeDefined();
    await expect(admin.mutation(api.products.create, { ...product('Link malo', 'x'), deliverables: [{ title: 'PDF', url: 'javascript:alert(1)' }] })).rejects.toThrow();
  });

  it('serves every Meta Pixel of a store, including the single id of older stores', async () => {
    const { t, admin, store, storeId } = await campaign();
    const pixels = async () => (await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).store.metaPixelIds;
    expect(await pixels()).toEqual(['1234567890']);

    await admin.mutation(api.stores.update, { id: storeId, ...store, tracking: { metaPixelIds: [' 1234567890 ', '', '9876543210', '1234567890'] } });
    expect(await pixels()).toEqual(['1234567890', '9876543210']);
    // The first pixel stays in the field the previous release reads and requires.
    expect((await admin.query(api.stores.get, { id: storeId })).tracking).toEqual({ metaPixelId: '1234567890', metaPixelIds: ['1234567890', '9876543210'] });
    mockStripe();
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).metaPixelIds).toEqual(['1234567890', '9876543210']);

    await expect(admin.mutation(api.stores.update, { id: storeId, ...store, tracking: { metaPixelIds: ['11111', '22222', '33333', '44444', '55555', '66666'] } })).rejects.toThrow(/hasta 5/);
    await admin.mutation(api.stores.update, { id: storeId, ...store, tracking: { metaPixelIds: [] } });
    expect(await pixels()).toEqual([]);
    expect((await admin.query(api.stores.get, { id: storeId })).tracking).toEqual({ metaPixelId: '', metaPixelIds: [] });

    // A store saved before the list existed.
    await t.run(ctx => ctx.db.patch(storeId, { tracking: { metaPixelId: '5555555555' } }));
    expect(await pixels()).toEqual(['5555555555']);
    expect((await admin.query(api.stores.get, { id: storeId })).tracking).toEqual({ metaPixelId: '5555555555' });
  });
});


describe('store workspace', () => {
  it('filters orders by store before applying the latest-100 limit', async () => {
    const { t, admin, store, storeId } = await campaign();
    const secondId = await admin.mutation(api.stores.create, { ...store, name: 'Segunda campaña' });
    mockStripe();
    await start(t);
    const [first] = await rows(t, 'orders');
    await t.run(async ctx => {
      const { _id, _creationTime, ...data } = first;
      for (let i = 0; i < 105; i++) await ctx.db.insert('orders', { ...data, storeId: secondId, attemptId: `second-${i}` });
    });
    const firstOrders = await admin.query(api.orders.list, { storeId });
    expect(firstOrders.map(order => order._id)).toEqual([first._id]);
    const secondOrders = await admin.query(api.orders.list, { storeId: secondId });
    expect(secondOrders).toHaveLength(100);
    expect(secondOrders.every(order => order.storeId === secondId)).toBe(true);
  });

  it('publishes pain points and testimonials separately from the live store offer', async () => {
    const { t, admin, store, storeId } = await campaign();
    const draft = { ...content, painPoints: { title: ' Tus desafíos ', items: [' No sé por dónde empezar '] }, socialProof: { rating: 4.9, customers: 500, satisfaction: 100, title: 'Lectores', items: [{ name: ' Ana ', quote: ' Me ayudó a ordenar mis ideas. ' }] } };
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft });
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).content.socialProof.items).toEqual([]);
    expect((await admin.query(api.landings.preview, { storeId })).content.painPoints.items).toEqual(['No sé por dónde empezar']);
    await admin.mutation(api.landings.publish, { storeId });
    await admin.mutation(api.stores.update, { id: storeId, ...store, offer: { ...store.offer, price: 4200, bonuses: [] } });
    const view = await t.query(api.storefront.getLanding, { subdomain: 'inversion' });
    expect(view.content.socialProof.items).toMatchObject([{ name: 'Ana', quote: 'Me ayudó a ordenar mis ideas.' }]);
    expect(view.offer.main.price).toBe(4200);
    expect(view.offer.bonuses).toEqual([]);
    expect(JSON.stringify(view)).not.toContain('files.example.com');
  });

  it('accepts legacy landing content and rejects excessive or incomplete new sections', async () => {
    const { admin, storeId } = await campaign();
    const save = draft => admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft });
    await expect(save(content)).resolves.toBeDefined();
    await expect(save({ ...content, painPoints: { title: '', items: Array(13).fill('Problema') } })).rejects.toThrow();
    await expect(save({ ...content, socialProof: { title: '', items: [{ name: '', quote: 'Texto' }] } })).rejects.toThrow();
    await expect(save({ ...content, socialProof: { title: '', items: Array(13).fill({ name: 'Ana', quote: 'Texto' }) } })).rejects.toThrow();
  });
});

describe('section-based sales template', () => {
  it('keeps new sections in the draft until publication and accepts legacy documents', async () => {
    const { t, admin, storeId } = await campaign();
    const draft = {
      ...content,
      benefits: { title: 'Contenido', enabled: false, subtitle: 'A tu ritmo', items: [{ title: 'Un plan', description: 'Paso a paso', icon: 'target' }] },
      socialProof: { rating: 4.9, customers: 500, satisfaction: 100, title: 'Lectores', items: [{ name: 'Ana', quote: '', imageUrl: 'https://example.com/review.png' }] },
      promotion: { enabled: true, message: 'Lanzamiento', timerMode: 'date', remainingSpots: 7, endsAt: 1_900_000_000_000 },
      steps: { title: 'Cómo funciona', items: [{ title: 'Leé', description: 'Empezá por el primer capítulo', icon: 'book' }] },
      guarantee: { title: 'Garantía', text: 'Podés solicitar un reembolso.', days: 7 },
      closing: { title: 'Empezá hoy', enabled: true, ctaText: 'Comprar', stickyEnabled: false },
      footer: { brandName: 'Mi marca', termsUrl: 'https://example.com/terms', privacyUrl: '' },
    };
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft });
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).content.promotion.message).not.toBe('Lanzamiento');
    expect((await admin.query(api.landings.preview, { storeId })).content.steps.items).toEqual(draft.steps.items);
    await admin.mutation(api.landings.publish, { storeId });
    const published = (await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).content;
    expect(published.benefits).toMatchObject(draft.benefits);
    expect(published.socialProof).toMatchObject(draft.socialProof);
    expect(published.promotion).toMatchObject(draft.promotion);
    expect(published.guarantee.days).toBe(7);
    expect(published.closing.stickyEnabled).toBe(false);
    expect(published.footer.termsUrl).toBe('https://example.com/terms');
  });

  it('saves the texts and photos of each section and fills the ones a legacy landing lacks', async () => {
    const { t, admin, storeId } = await campaign();
    const save = draft => admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft });
    await save(content);
    const legacy = (await admin.query(api.landings.preview, { storeId })).content;
    expect(legacy.combo).toMatchObject({ enabled: true, title: 'Your order', ctaText: 'Go to checkout' });
    expect(legacy.bonuses).toMatchObject({ eyebrow: 'Free bonus', chips: [], ctaText: '' });
    expect(legacy.hero).toMatchObject({ headerCtaText: '', trustText: '', footnote: '' });

    await save({
      ...content,
      hero: { ...content.hero, title: 'Aprendé y *delegá*', headerCtaText: ' Quiero empezar ', ratingText: 'Edición 2026', noteTitle: '¿Es digital?', footnote: 'Incluye versión para imprimir' },
      bonuses: { title: 'Anexos', eyebrow: 'Bono gratis', chips: ['12 profesiones', ' ', 'Incluido gratis'], ctaText: 'Quiero mi kit', note: 'Descarga inmediata' },
      benefits: { ...content.benefits, imageUrl: 'https://example.com/kit.png', videoUrl: 'https://example.com/kit.mp4' },
      showcase: { enabled: true, title: 'Todo lo que recibís', imageUrl: 'https://example.com/inside.png', videoUrl: 'https://example.com/inside.mp4' },
      socialProof: { title: 'Opiniones', ctaText: 'Quiero mi resultado', items: [{ name: 'Marta S. · Córdoba', quote: 'Me sirvió.', photoUrl: 'https://example.com/marta.jpg', verified: true }, { name: 'Ana', quote: 'Clara.', verified: false }] },
      comparison: { title: 'Tres caminos', badge: 'El camino corto', ctaText: 'Elijo este', items: [{ title: 'Solo', description: 'Sin método', highlighted: false }, { title: 'Con la guía', description: 'Paso a paso\nEn español', highlighted: true }] },
      closing: { enabled: true, title: 'Empezá hoy', ctaText: 'Comprar', stickyEnabled: true, text: 'La diferencia la marcás vos.', note: 'Garantía 7 días' },
      combo: { enabled: false, title: 'Tu pedido', eyebrow: 'Armá tu combo', upsellText: 'Sumá extras', allText: 'Llevar todo', ctaText: 'Pagar', note: 'Pago seguro' },
    });
    await admin.mutation(api.landings.publish, { storeId });
    const saved = (await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).content;
    expect(saved.hero).toMatchObject({ title: 'Aprendé y *delegá*', headerCtaText: 'Quiero empezar', ratingText: 'Edición 2026', noteTitle: '¿Es digital?' });
    expect(saved.bonuses).toMatchObject({ chips: ['12 profesiones', 'Incluido gratis'], ctaText: 'Quiero mi kit', note: 'Descarga inmediata' });
    expect(saved.benefits).toMatchObject({ imageUrl: 'https://example.com/kit.png', videoUrl: 'https://example.com/kit.mp4' });
    expect(saved.showcase).toMatchObject({ imageUrl: 'https://example.com/inside.png', videoUrl: 'https://example.com/inside.mp4' });
    expect(saved.socialProof.items).toMatchObject([{ photoUrl: 'https://example.com/marta.jpg', verified: true }, { name: 'Ana' }]);
    expect(saved.socialProof.items[1].verified).toBeUndefined();
    expect(saved.comparison).toMatchObject({ badge: 'El camino corto', ctaText: 'Elijo este' });
    expect(saved.closing).toMatchObject({ text: 'La diferencia la marcás vos.', note: 'Garantía 7 días' });
    expect(saved.combo).toMatchObject({ enabled: false, title: 'Tu pedido', ctaText: 'Pagar' });

    for (const patch of [
      { bonuses: { title: '', chips: ['a', 'b', 'c', 'd', 'e'] } },
      { benefits: { ...content.benefits, videoUrl: 'https://example.com/kit.pdf' } },
      { showcase: { enabled: true, title: 'Adentro', videoUrl: 'https://example.com/inside.pdf' } },
      { benefits: { ...content.benefits, imageUrl: 'javascript:alert(1)' } },
      { socialProof: { title: '', items: [{ name: 'Ana', quote: 'Texto', photoUrl: 'data:image/png;base64,x' }] } },
      { hero: { ...content.hero, headerCtaText: 'x'.repeat(61) } },
      { hero: { ...content.hero, titleAccent: 'x'.repeat(161) } },
    ]) await expect(save({ ...content, ...patch })).rejects.toThrow();
  });

  it('keeps the hero accent in draft until publication and allows clearing it', async () => {
    const { t, admin, storeId } = await campaign();
    const draft = normalizeContent(content);
    draft.hero = { ...draft.hero, title: 'Aprendé en 7 días y', titleAccent: 'tené el trabajo hecho' };
    const save = () => admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft });
    await save();
    expect((await admin.query(api.landings.preview, { storeId })).content.hero).toMatchObject(draft.hero);
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).content.hero.titleAccent).toBeUndefined();
    await admin.mutation(api.landings.publish, { storeId });
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).content.hero).toMatchObject(draft.hero);
    draft.hero.titleAccent = '';
    await save();
    await admin.mutation(api.landings.publish, { storeId });
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).content.hero.titleAccent).toBe('');
  });

  it('rejects invalid section content on the server', async () => {
    const { admin, storeId } = await campaign();
    for (const patch of [
      { socialProof: { title: '', items: [], rating: 6 } },
      { socialProof: { title: '', items: [], satisfaction: 101 } },
      { socialProof: { title: '', items: [], customers: -1 } },
      { promotion: { enabled: true, message: '', remainingSpots: 1.5 } },
      { promotion: { enabled: true, message: '', timerMode: 'date' } },
      { guarantee: { ...content.guarantee, days: -1 } },
      { promotion: { enabled: true, message: 'Oferta', endsAt: -1 } },
      { socialProof: { title: '', items: [{ name: 'Ana', quote: '', imageUrl: 'javascript:alert(1)' }] } },
      { faq: { title: '', items: [{ question: '¿Cómo?', answer: '' }] } },
      { benefits: { title: '', items: Array.from({ length: 13 }, () => ({ title: 'a', description: '', icon: 'book' })) } },
      { footer: { brandName: '', termsUrl: 'data:text/html,x', privacyUrl: '' } },
    ]) await expect(admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: { ...content, ...patch } })).rejects.toThrow();
  });

  it('publishes reference values without charging them or exposing deliveries', async () => {
    const { t, admin, storeId, store, ids } = await campaign();
    const offer = { ...store.offer, compareAtPrice: 8500, bonuses: [{ productId: ids.bonus, referenceValue: 1500 }] };
    await admin.mutation(api.stores.update, { id: storeId, ...store, offer });
    const view = await t.query(api.storefront.getLanding, { subdomain: 'inversion' });
    expect(view.offer.main.compareAtPrice).toBe(8500);
    expect(view.offer.bonuses[0].referenceValue).toBe(1500);
    expect(JSON.stringify(view)).not.toContain('deliverables');
    mockStripe();
    await start(t);
    expect((await rows(t, 'orders'))[0].total).toBe(2700);
    for (const invalid of [{ ...offer, compareAtPrice: 2500 }, { ...offer, bonuses: [{ productId: ids.bonus, referenceValue: -1 }] }]) {
      await expect(admin.mutation(api.stores.update, { id: storeId, ...store, offer: invalid })).rejects.toThrow();
    }
  });
});

describe('post-purchase landing content', () => {
  it('previews drafts but delivers only published post-purchase copy after a confirmed payment', async () => {
    const { t, admin, storeId, store } = await campaign();
    const draft = normalizeContent(content);
    draft.postPurchase = { ...draft.postPurchase, title: 'Continuá con el curso', ctaText: 'Agregar a mi compra' };
    draft.postLabels = { paidTitle: 'Tu compra está lista', open: 'Acceder', pendingText: 'Estamos preparando tus accesos', discount: 'Ahorro {porcentaje}%', close: 'Cerrar oferta' };
    draft.postOptions = { showCover: false, showPaymentNote: true };
    draft.popupOptions = { landingExit: false, postOnReturn: false, postFinal: false };
    draft.landingExit = { exitTitle: 'Antes de salir', exitIntro: 'Llevate {producto}' };
    draft.backPopup = { modalTitle: 'Un precio para vos', cta: 'Comprar ahora' };
    draft.checkout = { paymentTitle: 'Tu medio de pago', paymentLocale: 'en' };
    draft.postPurchaseBenefits = { enabled: true, title: 'Tu siguiente paso', items: [{ title: 'Profundizá', description: 'Contenido adicional', icon: 'book' }] };
    draft.postPurchaseVideo = { enabled: true, format: 'reel', title: 'Presentación del curso', url: 'https://example-123.convex.cloud/api/storage/4e364f57-c5e6-4e8f-a3cb-0d97e097b5dc' };
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft });
    const preview = await admin.query(api.landings.preview, { storeId });
    expect(preview.postPurchaseOffer.content.postPurchase.title).toBe('Continuá con el curso');
    expect(preview.postPurchaseOffer.price).toBe(4700);
    expect(preview.postPurchaseOffer.content.postLabels).toEqual(draft.postLabels);
    expect(preview.content.landingExit).toEqual(draft.landingExit);
    expect(preview.content.backPopup).toEqual(draft.backPopup);
    expect(JSON.stringify(preview.postPurchaseOffer)).not.toContain('files.example.com');
    mockStripe();
    await start(t);
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).postPurchaseOffer).toBeNull();
    await sendWebhook(t, paidSession('cs_test_1', 2700));
    const beforePublish = await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' });
    expect(beforePublish.postPurchaseOffer.content.postPurchase.title).toBe('');
    expect(beforePublish.postPurchaseOffer.content.postPurchaseVideo.enabled).toBe(false);
    expect(beforePublish.presentation.postLabels).toEqual({});
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).content.landingExit).toEqual({});
    await admin.mutation(api.landings.publish, { storeId });
    const afterPublish = await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' });
    expect(afterPublish.postPurchaseOffer.content.postPurchase).toMatchObject(draft.postPurchase);
    expect(afterPublish.postPurchaseOffer.content.postPurchaseVideo).toEqual(draft.postPurchaseVideo);
    expect(afterPublish.postPurchaseOffer.content.postPurchaseBenefits).toMatchObject(draft.postPurchaseBenefits);
    expect(afterPublish.postPurchaseOffer.price).toBe(4700);
    expect(afterPublish.presentation.postLabels).toEqual(draft.postLabels);
    for (const key of ['postLabels', 'postOptions', 'popupOptions', 'checkout']) expect(afterPublish.postPurchaseOffer.content[key]).toEqual(draft[key]);
    const publicView = await t.query(api.storefront.getLanding, { subdomain: 'inversion' });
    expect(publicView.content.landingExit).toEqual(draft.landingExit);
    expect(publicView.content.backPopup).toEqual(draft.backPopup);
    expect(publicView.offer.main.price).toBe(2700);
    await admin.mutation(api.stores.update, { id: storeId, ...store, postPurchase: { enabled: false, price: 0 } });
    expect((await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' })).postPurchaseOffer).toBeNull();
    expect((await admin.query(api.landings.preview, { storeId })).postPurchaseOffer).toBeNull();
  });

  it('validates popup options and copy and protects draft updates', async () => {
    const { t, admin, storeId } = await campaign();
    for (const patch of [{ postLabels: { paidTitle: 'x'.repeat(1201) } }, { landingExit: { exitTitle: 5 } }, { popupOptions: { postEnabled: 'false' } }, { postOptions: { showCover: null } }, { backPopup: { modalTitle: 'x'.repeat(1201) } }]) {
      await expect(admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', draft: { ...content, ...patch } })).rejects.toThrow();
    }
    await expect(t.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', draft: { ...content, popupOptions: { postEnabled: false } } })).rejects.toThrow();
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).content.popupOptions).toEqual({});
    // Titles and actions are required and the error names the screen; descriptions may be empty.
    await expect(admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', draft: { ...content, landingExit: { exitTitle: ' ' } } })).rejects.toThrow('Salida de la landing · Título del popup');
    await expect(admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', draft: { ...content, checkout: { exitTitle: '' } } })).rejects.toThrow('Salida del checkout · Título del popup');
    await expect(admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', draft: { ...content, postLabels: { open: '' } } })).rejects.toThrow('Post-compra');
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', draft: { ...content, postLabels: { linksSubtitle: '', paymentNote: '' }, backPopup: { modalSubtitle: '' }, landingExit: { exitEmoji: '' } } });
  });

  it('rejects invalid video settings and overlong copy without publishing changes', async () => {
    const { admin, storeId } = await campaign();
    const draft = normalizeContent(content);
    const save = patch => admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: { ...draft, ...patch } });
    for (const url of ['', 'javascript:alert(1)', 'https://example.com/page', 'http://example.com/video.mp4', 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ']) {
      await expect(save({ postPurchaseVideo: { enabled: true, title: '', url } })).rejects.toThrow();
    }
    await expect(save({ postPurchase: { ...draft.postPurchase, title: 'x'.repeat(161) } })).rejects.toThrow();
    await expect(save({ postPurchaseBenefits: { ...draft.postPurchaseBenefits, items: Array(7).fill({ title: 'a', description: '', icon: 'check' }) } })).rejects.toThrow();
    await expect(save({ postPurchaseVideo: { enabled: false, title: '', url: 'https://example.com/video.mp4' } })).resolves.toBeDefined();
  });
});

describe('landing copy assistant', () => {
  const answers = { audience: 'Personas que nunca invirtieron', problem: 'No saben por dónde empezar', result: 'Hacen su primera inversión', differentiator: '', tone: 'cercano' };
  const copy = {
    hero: { title: ' Tu primera inversión ', subtitle: 'Paso a paso', ctaText: 'Quiero empezar' },
    benefits: { title: 'Qué incluye', subtitle: '', items: [{ title: 'Presupuesto', description: 'Ordená tus números', icon: 'rocket' }, { title: '', description: 'vacío', icon: 'check' }] },
    painPoints: { title: '¿Te pasa?', subtitle: '', items: [{ title: 'No llegás a fin de mes', description: '' }] },
    steps: { title: 'Cómo', subtitle: '', items: Array.from({ length: 9 }, (_, i) => ({ title: `Paso ${i + 1}`, description: '', icon: 'target' })) },
    faq: { items: [{ question: '¿Es digital?', answer: 'Sí.' }, { question: '¿Sin respuesta?', answer: '' }] },
    guarantee: { title: 'Garantía', text: 'Probalo 7 días.' },
    closing: { title: 'Empezá hoy', ctaText: 'x'.repeat(200) },
    socialProof: { eyebrow: 'Experiencias', title: 'Lo que cuentan los lectores', subtitle: '', items: Array.from({ length: 4 }, (_, i) => ({ name: `Lector ${i + 1}`, quote: 'Me ayudó a ordenar mis ideas.', openingMessage: '¿Cómo te fue?', closingMessage: 'Gracias por compartir.' })), rating: 5 },
    promotion: { message: 'Conseguí tu guía', timerLabel: 'Tiempo disponible', spotsText: 'Disponibles: {cantidad}', enabled: false, remainingSpots: 999 },
    activity: { viewersText: '{cantidad} lectores mirando la guía', salesText: '{cantidad} compras confirmadas', purchaseText: '{nombre} eligió esta guía', purchaseLocationText: 'En {ciudad}', notifications: false },
    postPurchase: { eyebrow: 'Seguí aprendiendo', title: 'Avanzá con el curso', subtitle: 'Un paso más', description: 'Profundizá lo aprendido.', ctaText: 'Sumar el curso', declineText: 'Seguir sin el curso', downsellTitle: 'Tu curso con descuento', downsellText: 'Una oportunidad adicional', downsellCtaText: 'Aceptar descuento', price: 1 },
    postPurchaseBenefits: { enabled: false, title: 'Qué incluye el curso', subtitle: '', items: [{ title: 'Contenido avanzado', description: 'Para seguir aprendiendo', icon: 'book' }] },
    postPurchaseVideo: { title: 'Conocé el curso', enabled: true, url: 'https://evil.example/video.mp4' },
  };
  function mockClaude(reply = () => claudeReply(JSON.stringify(copy))) {
    const realFetch = globalThis.fetch;
    const requests = [];
    vi.stubGlobal('fetch', async (url, init) => {
      if (!String(url).startsWith('https://api.anthropic.com/')) return realFetch(url, init);
      requests.push({ headers: new Headers(init.headers), body: JSON.parse(init.body) });
      return reply();
    });
    return requests;
  }
  beforeEach(() => { vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-only'); });

  it('writes saveable copy from the answers and the store offer without saving or inventing sections', async () => {
    const { t, admin, storeId } = await campaign();
    const requests = mockClaude();
    const before = await rows(t, 'landings');
    const draft = await admin.action(api.landing_wizard.generate, { storeId, answers: { ...answers, guaranteeDays: 7 } });
    expect(requests).toHaveLength(1);
    expect(requests[0].headers.get('authorization')).toBe('Bearer sk-ant-test-only');
    expect(requests[0].body.model).toBe('claude-sonnet-5-5');
    expect(requests[0].body.output_config.format.type).toBe('json_schema');
    const sent = requests[0].body.messages[0].content;
    expect(sent).toContain('Ebook principal');
    expect(sent).toContain('Plantillas');
    expect(sent).toContain('Producto post-compra (se paga aparte): Curso avanzado');
    expect(sent).toContain('Descripción de Curso avanzado');
    expect(sent).toContain('Garantía: 7 días');
    expect(sent).not.toContain('files.example.com');
    expect(draft.hero.title).toBe('Tu primera inversión');
    expect(draft.postPurchase.title).toBe('Avanzá con el curso');
    expect(draft.postPurchase.price).toBeUndefined();
    expect(draft.postPurchase.downsellTitle).toBeUndefined();
    expect(draft.postPurchaseVideo).toEqual({ title: 'Conocé el curso' });
    expect(draft.postPurchaseBenefits.enabled).toBeUndefined();
    expect(draft.benefits.items).toEqual([{ title: 'Presupuesto', description: 'Ordená tus números', icon: 'check' }]);
    expect(draft.steps.items).toHaveLength(6);
    expect(draft.faq.items).toEqual([{ question: '¿Es digital?', answer: 'Sí.' }]);
    expect(draft.guarantee).toEqual({ title: 'Garantía', text: 'Probalo 7 días.', days: 7 });
    expect(draft.closing.ctaText).toHaveLength(60);
    expect(draft.socialProof).toMatchObject({ eyebrow: 'Experiencias', title: 'Lo que cuentan los lectores', subtitle: '' });
    expect(draft.socialProof.items).toHaveLength(4);
    expect(draft.socialProof.items.every(item => item.isExample && item.format === 'chat')).toBe(true);
    expect(draft.socialProof.rating).toBeUndefined();
    expect(requests[0].body.output_config.format.schema.properties.socialProof.required).toContain('items');
    expect(draft.promotion).toEqual({ message: 'Conseguí tu guía', timerLabel: 'Tiempo disponible', spotsText: 'Disponibles: {cantidad}' });
    expect(draft.activity).toEqual({ viewersText: '{cantidad} lectores mirando la guía', salesText: '{cantidad} compras confirmadas', purchaseText: '{nombre} eligió esta guía', purchaseLocationText: 'En {ciudad}' });
    expect(await rows(t, 'landings')).toEqual(before);
    // The result merged over the current draft is accepted by saveDraft.
    const current = normalizeContent(content);
    current.promotion = { ...current.promotion, enabled: false, remainingSpots: 7, timerMode: 'date', endsAt: 1_900_000_000_000 };
    current.activity = { ...current.activity, notifications: false, salesCount: false, viewers: false };
    current.postPurchaseVideo = { enabled: false, url: 'https://example.com/my-video.mp4', title: 'Mi video' };
    current.postPurchaseBenefits.enabled = false;
    current.socialProof.items = [{ name: 'Ana', quote: 'Me ayudó.', format: 'chat', openingMessage: '¿Cómo te fue?', closingMessage: 'Gracias.' }];
    const merged = mergeGeneratedContent(current, draft);
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: merged });
    const saved = await admin.query(api.landings.getForStore, { storeId });
    expect(saved.draft.socialProof.items).toEqual([...current.socialProof.items, ...draft.socialProof.items]);
    expect(saved.published.socialProof.items).toEqual([]);
    await admin.mutation(api.landings.publish, { storeId });
    const live = await t.query(api.storefront.getLanding, { subdomain: 'inversion' });
    expect(live.content.socialProof.items).toEqual(saved.draft.socialProof.items);
    expect(saved.draft.postPurchaseVideo).toEqual({ ...current.postPurchaseVideo, title: 'Conocé el curso' });
    expect(saved.draft.postPurchaseBenefits.enabled).toBe(false);
    expect(saved.draft.promotion).toMatchObject({ enabled: false, remainingSpots: 7, timerMode: 'date', endsAt: 1_900_000_000_000 });
    expect(saved.draft.activity).toMatchObject({ viewers: false, notifications: false, salesCount: false });
  });

  it('writes every section of the landing and turns the optional ones on only the first time', async () => {
    const { admin, storeId } = await campaign();
    const full = {
      ...copy,
      hero: { ...copy.hero, title: 'Tu *primera inversión*', eyebrow: 'En 7 días', headerCtaText: 'Quiero mi guía', trustText: 'Acceso inmediato · Pago seguro', noteTitle: '¿Necesito experiencia?', note: 'No.', footnote: 'Guía digital' },
      introduction: { title: '¿Y si invertir fuera simple?', text: 'Primer párrafo.\nSegundo párrafo.', badge: 'Empezá hoy' },
      transformation: { eyebrow: 'La transformación', title: 'De dudar a *invertir*', subtitle: 'Un cambio por semana' },
      about: { eyebrow: 'Quiénes somos', title: 'Detrás hay un equipo', text: 'Somos Tienda.', signature: 'El equipo' },
      showcase: { eyebrow: 'Qué viene adentro', title: 'Todo lo que recibís', subtitle: '' },
      bonuses: { eyebrow: 'Bono gratis', title: 'Tus bonos', subtitle: 'Incluidos', chips: ['1 bono', 'Incluido gratis', 'Listo para usar', 'Sobra'], ctaText: 'Quiero mis bonos', note: '' },
      summary: { ctaText: 'Quiero el kit', note: 'Pago único' },
      comparison: { title: 'Tres caminos', badge: 'El camino corto', ctaText: 'Elijo este', alternatives: [{ title: 'Videos sueltos', drawbacks: ['Sin orden', 'Sin método'] }, { title: 'Probar solo', drawbacks: ['Lleva meses'] }, { title: 'Sobra', drawbacks: ['x'] }], product: { title: 'Ebook principal', advantages: ['Paso a paso', 'En español'] } },
      painPoints: { ...copy.painPoints, eyebrow: 'Si te pasa esto', ctaText: 'Quiero resolverlo' },
      guarantee: { ...copy.guarantee, ctaText: 'Probar sin riesgo' },
      closing: { title: 'Empezá hoy', ctaText: 'Comprar', text: 'La diferencia la marcás vos.', note: 'Garantía 7 días' },
      socialProof: { ...copy.socialProof, ctaText: 'Quiero mi resultado' },
    };
    const requests = mockClaude(() => claudeReply(JSON.stringify(full)));
    const draft = await admin.action(api.landing_wizard.generate, { storeId, answers: { ...answers, about: 'Somos dos docentes', guaranteeDays: 7 } });
    const sent = requests[0].body.messages[0].content;
    expect(sent).toContain('Quién está detrás del producto: Somos dos docentes');
    expect(requests[0].body.output_config.format.schema.required).toEqual(expect.arrayContaining(['introduction', 'transformation', 'about', 'showcase', 'bonuses', 'comparison', 'summary']));
    expect(draft.hero).toMatchObject({ title: 'Tu', titleAccent: 'primera inversión', eyebrow: 'En 7 días', headerCtaText: 'Quiero mi guía', noteTitle: '¿Necesito experiencia?' });
    expect(draft.introduction).toEqual(full.introduction);
    expect(draft.about).toEqual(full.about);
    expect(draft.showcase).toEqual({ eyebrow: 'Qué viene adentro', title: 'Todo lo que recibís' });
    expect(draft.bonuses.chips).toEqual(['1 bono', 'Incluido gratis', 'Listo para usar']);
    expect(draft.bonuses.note).toBeUndefined();
    expect(draft.comparison.items).toEqual([
      { title: 'Videos sueltos', description: 'Sin orden\nSin método', highlighted: false },
      { title: 'Probar solo', description: 'Lleva meses', highlighted: false },
      { title: 'Ebook principal', description: 'Paso a paso\nEn español', highlighted: true },
    ]);
    expect(draft.guarantee).toEqual({ title: 'Garantía', text: 'Probalo 7 días.', ctaText: 'Probar sin riesgo', days: 7 });
    expect(draft.closing).toMatchObject({ text: 'La diferencia la marcás vos.', note: 'Garantía 7 días' });

    // First generation: the optional sections appear. Photos and metrics stay untouched.
    const current = normalizeContent({ ...content, transformation: { imageUrl: 'https://example.com/antes.png' }, socialProof: { title: '', items: [], rating: 4.8, customers: 300 } });
    const merged = mergeGeneratedContent(current, draft);
    for (const key of ['introduction', 'transformation', 'about', 'showcase', 'comparison']) expect(merged[key].enabled).toBe(true);
    expect(merged.transformation.imageUrl).toBe('https://example.com/antes.png');
    expect(merged.socialProof).toMatchObject({ rating: 4.8, customers: 300, ctaText: 'Quiero mi resultado' });
    await expect(admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: merged })).resolves.toBeDefined();

    // Regenerating keeps a section the seller switched off, and empty answers erase nothing.
    const hidden = { ...merged, about: { ...merged.about, enabled: false, text: 'Texto del vendedor' } };
    expect(mergeGeneratedContent(hidden, draft).about).toMatchObject({ enabled: false, text: 'Somos Tienda.' });
    const { draftFromModel } = await import('../convex/landing_wizard');
    const sparse = draftFromModel({ ...copy, about: { eyebrow: '', title: '', text: '', signature: '' }, comparison: { title: 'Caminos', alternatives: [{ title: 'Solo', drawbacks: ['Lento'] }], product: { title: '', advantages: [] } } }, undefined, undefined, false);
    expect(sparse.about).toBeUndefined();
    expect(sparse.comparison).toBeUndefined();
    expect(sparse.bonuses).toBeUndefined();
    expect(sparse.hero.eyebrow).toBeUndefined();
    expect(mergeGeneratedContent(hidden, sparse).about.text).toBe('Texto del vendedor');
  });

  it('falls back to dynamic templates when generated tokens are missing or invalid', async () => {
    const { draftFromModel } = await import('../convex/landing_wizard');
    const generated = draftFromModel({ ...copy, promotion: { spotsText: 'Quedan 500 cupos' }, activity: {
      viewersText: 'Hay {count} personas', salesText: '{cantidad} {extra}', purchaseText: 'Ana compró', purchaseLocationText: 'x'.repeat(240) + '{ciudad}',
    } });
    expect(generated.promotion.spotsText).toContain('{cantidad}');
    expect(generated.activity.viewersText).toContain('{cantidad}');
    expect(generated.activity.salesText).not.toContain('{extra}');
    expect(generated.activity.purchaseText).toContain('{nombre}');
    expect(generated.activity.purchaseLocationText).toContain('{ciudad}');
    expect(generated.activity.purchaseLocationText.length).toBeLessThanOrEqual(240);
  });

  it('generates post-purchase downsell copy only for an active configured offer', async () => {
    const { admin, storeId, store } = await campaign();
    const requests = mockClaude();
    await admin.mutation(api.stores.update, { id: storeId, ...store, postPurchase: { ...store.postPurchase, downsellPercent: 20 } });
    const withPost = await admin.action(api.landing_wizard.generate, { storeId, answers });
    expect(withPost.postPurchase.downsellTitle).toBe('Tu curso con descuento');
    expect(requests[0].body.messages[0].content).toContain('Downsell post-compra: configurado');
    await admin.mutation(api.stores.update, { id: storeId, ...store, postPurchase: { enabled: false, price: 0 } });
    const withoutPost = await admin.action(api.landing_wizard.generate, { storeId, answers });
    expect(withoutPost.postPurchase).toBeUndefined();
    expect(withoutPost.postPurchaseBenefits).toBeUndefined();
    expect(requests[1].body.messages[0].content).not.toContain('Curso avanzado');
  });

  it('leaves the guarantee out when the seller did not state one', async () => {
    const { admin, storeId } = await campaign();
    const requests = mockClaude();
    const draft = await admin.action(api.landing_wizard.generate, { storeId, answers });
    expect(requests[0].body.messages[0].content).toContain('Garantía: no informa');
    expect(draft.guarantee).toBeUndefined();
  });

  it('is limited to panel admins and never calls Claude for anyone else or for invalid answers', async () => {
    const { t, admin, storeId } = await campaign();
    const requests = mockClaude();
    const stranger = await signedIn(t, 'stranger@example.com');
    await expect(t.action(api.landing_wizard.generate, { storeId, answers })).rejects.toThrow();
    await expect(stranger.action(api.landing_wizard.generate, { storeId, answers })).rejects.toThrow('no tiene acceso');
    await expect(admin.action(api.landing_wizard.generate, { storeId, answers: { ...answers, audience: '  ' } })).rejects.toThrow('Público');
    await expect(admin.action(api.landing_wizard.generate, { storeId, answers: { ...answers, problem: 'x'.repeat(601) } })).rejects.toThrow('Problema');
    await expect(admin.action(api.landing_wizard.generate, { storeId, answers: { ...answers, guaranteeDays: 0 } })).rejects.toThrow('Garantía');
    expect(requests).toHaveLength(0);
  });

  it('builds a copyable prompt with the store data and the exact JSON structure, only for admins', async () => {
    const { t, admin, storeId } = await campaign();
    const stranger = await signedIn(t, 'stranger@example.com');
    const prompt = await admin.query(api.landing_wizard.importPrompt, { storeId });
    expect(prompt).toContain('Tienda: ');
    expect(prompt).toContain('Instrucciones de redacción');
    const template = JSON.parse(prompt.slice(prompt.lastIndexOf('\n{\n') + 1));
    expect(template.guaranteeDays).toBe(0);
    expect(Object.keys(template)).toEqual(expect.arrayContaining(['hero', 'faq', 'socialProof', 'promotion', 'activity', 'postPurchase']));
    expect(template.benefits.items[0]).toEqual({ title: '', description: '', icon: 'check' });
    await expect(stranger.query(api.landing_wizard.importPrompt, { storeId })).rejects.toThrow('no tiene acceso');
    await expect(t.query(api.landing_wizard.importPrompt, { storeId })).rejects.toThrow();
  });

  it('imports pasted JSON through the same cleaning as the assistant, without calling Claude or saving', async () => {
    const { t, admin, storeId } = await campaign();
    const requests = mockClaude();
    const before = await rows(t, 'landings');
    const pasted = `Acá tenés tu JSON:\n\`\`\`json\n${JSON.stringify({ ...copy, guaranteeDays: 14 })}\n\`\`\``;
    const draft = await admin.action(api.landing_wizard.importJson, { storeId, json: pasted });
    expect(requests).toHaveLength(0);
    expect(await rows(t, 'landings')).toEqual(before);
    expect(draft.hero.title).toBe('Tu primera inversión');
    expect(draft.closing.ctaText).toHaveLength(60);
    expect(draft.guarantee).toMatchObject({ title: 'Garantía', days: 14 });
    expect(draft.socialProof.items.every(item => item.isExample)).toBe(true);
    expect(draft.postPurchaseVideo).toEqual({ title: 'Conocé el curso' });

    const noGuarantee = await admin.action(api.landing_wizard.importJson, { storeId, json: JSON.stringify({ ...copy, guaranteeDays: 0 }) });
    expect(noGuarantee.guarantee).toBeUndefined();
  });

  it('rejects invalid pasted JSON with a readable message and only for admins', async () => {
    const { t, admin, storeId } = await campaign();
    const stranger = await signedIn(t, 'stranger@example.com');
    const json = JSON.stringify(copy);
    await expect(t.action(api.landing_wizard.importJson, { storeId, json })).rejects.toThrow();
    await expect(stranger.action(api.landing_wizard.importJson, { storeId, json })).rejects.toThrow('no tiene acceso');
    await expect(admin.action(api.landing_wizard.importJson, { storeId, json: '{ "hero": ' })).rejects.toThrow('no es un JSON válido');
    await expect(admin.action(api.landing_wizard.importJson, { storeId, json: '[1, 2]' })).rejects.toThrow('no es un JSON válido');
    await expect(admin.action(api.landing_wizard.importJson, { storeId, json: '{"faq": {}}' })).rejects.toThrow('hero.title');
  });

  it('reports a missing key and a Claude failure or refusal with a readable message', async () => {
    const { admin, storeId } = await campaign();
    mockClaude(() => new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'bad' } }), { status: 400, headers: { 'content-type': 'application/json' } }));
    await expect(admin.action(api.landing_wizard.generate, { storeId, answers })).rejects.toThrow('No se pudieron generar');
    vi.unstubAllGlobals();
    mockClaude(() => claudeReply(null, { stopReason: 'refusal' }));
    await expect(admin.action(api.landing_wizard.generate, { storeId, answers })).rejects.toThrow('No se pudieron generar');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    await expect(admin.action(api.landing_wizard.generate, { storeId, answers })).rejects.toThrow('ANTHROPIC_API_KEY');
  });
});

describe('real store activity on the landing', () => {
  it('publishes only paid first purchases, with the first name and never the email', async () => {
    const { t, admin, storeId } = await campaign();
    mockStripe();
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 2700, { customer_details: { email: 'buyer@example.com', name: 'VALENTINA fernández' } }));
    await start(t);
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).activity).toEqual({ sales: 1, recent: [{ name: 'Valentina', at: expect.any(Number) }] });

    const draft = { ...normalizeContent(content), activity: { notifications: true, salesCount: true } };
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft });
    await admin.mutation(api.landings.publish, { storeId });
    const view = await t.query(api.storefront.getLanding, { subdomain: 'inversion' });
    expect(view.activity).toEqual({ sales: 1, recent: [{ name: 'Valentina', at: expect.any(Number) }] });
    expect(JSON.stringify(view)).not.toContain('buyer@example.com');

    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: { ...draft, activity: { notifications: false, salesCount: true } } });
    await admin.mutation(api.landings.publish, { storeId });
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).activity).toEqual({ sales: 1, recent: [] });
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: { ...draft, activity: { notifications: false, salesCount: false } } });
    await admin.mutation(api.landings.publish, { storeId });
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).activity).toBeNull();
  });
});

describe('checkout presentation settings', () => {
  it('inherits landing notifications until checkout settings explicitly override them', async () => {
    const { t, admin, storeId } = await campaign();
    const getView = () => t.query(api.storefront.getLanding, { subdomain: 'inversion' });
    const fresh = await getView();
    expect(fresh.content.activity).toMatchObject({ viewers: true, notifications: true, salesCount: true });
    expect(fresh.content.promotion.enabled).toBe(true);
    expect(fresh.checkout.notifications).toBe(true);
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: { ...normalizeContent(content), activity: { notifications: false, salesCount: false } } });
    await admin.mutation(api.landings.publish, { storeId });
    expect((await getView()).checkout.notifications).toBe(false);
    await admin.mutation(api.landings.saveDraft, {
      storeId, subdomain: 'inversion', template: 'classic',
      draft: { ...normalizeContent(content), activity: { notifications: true, salesCount: false } },
    });
    expect((await getView()).checkout.notifications).toBe(false);
    await admin.mutation(api.landings.publish, { storeId });
    expect((await getView()).checkout.notifications).toBe(true);
    await admin.mutation(api.stores.updateCheckout, {
      id: storeId, checkout: { notifications: false, upsellTitle: '', upsellReferences: [] },
    });
    expect((await getView()).checkout.notifications).toBe(false);
  });

  it('stores reference prices only for extras of the store and above their price, for admins', async () => {
    const { t, admin, ids, store, storeId } = await campaign();
    const settings = { notifications: true, upsellTitle: ' Sumá a tu pedido ', upsellReferences: [{ productId: ids.upsellA, value: 1800 }] };
    const stranger = await signedIn(t, 'stranger@example.com');
    await expect(t.mutation(api.stores.updateCheckout, { id: storeId, checkout: settings })).rejects.toThrow();
    await expect(stranger.mutation(api.stores.updateCheckout, { id: storeId, checkout: settings })).rejects.toThrow('no tiene acceso');
    const invalid = references => admin.mutation(api.stores.updateCheckout, { id: storeId, checkout: { ...settings, upsellReferences: references } });
    await expect(invalid([{ productId: ids.upsellA, value: 900 }])).rejects.toThrow('mayor');
    await expect(invalid([{ productId: ids.other, value: 5000 }])).rejects.toThrow('extra de esta tienda');
    await expect(invalid([{ productId: ids.upsellA, value: 1800 }, { productId: ids.upsellA, value: 1900 }])).rejects.toThrow('una sola vez');

    await admin.mutation(api.stores.updateCheckout, { id: storeId, checkout: settings });
    const view = await t.query(api.storefront.getLanding, { subdomain: 'inversion' });
    expect(view.checkout).toEqual({ upsellTitle: 'Sumá a tu pedido', notifications: true, liveVisitors: false });
    expect(view.offer.upsells.map(upsell => [upsell.price, upsell.compareAtPrice])).toEqual([[900, 1800], [500, undefined]]);
    expect(view.activity).toEqual({ sales: 0, recent: [] });

    // The reference never changes the charge.
    const { requests } = mockStripe();
    await start(t, [ids.upsellA]);
    expect((await rows(t, 'orders'))[0].total).toBe(3600);
    expect(requests).toHaveLength(1);

    // Editing the store keeps the settings, hides a reference the new price reaches and drops removed extras.
    await admin.mutation(api.stores.update, { id: storeId, ...store, offer: { ...store.offer, upsells: [{ productId: ids.upsellA, price: 1800, displayOrder: 0 }, store.offer.upsells[1]] } });
    expect((await t.query(api.storefront.getLanding, { subdomain: 'inversion' })).offer.upsells[0].compareAtPrice).toBeUndefined();
    await admin.mutation(api.stores.update, { id: storeId, ...store, offer: { ...store.offer, upsells: [store.offer.upsells[1]] } });
    expect((await rows(t, 'stores'))[0].checkout).toEqual({ notifications: true, liveVisitors: false, upsellTitle: 'Sumá a tu pedido', upsellReferences: [] });
  });
});

describe('live checkout visitors', () => {
  afterEach(() => vi.useRealTimers());
  const session = n => `session-${String(n).padStart(12, '0')}`;
  const count = t => t.query(api.storefront.checkoutVisitors, { subdomain: 'inversion' });
  const beat = (t, n) => t.mutation(api.storefront.heartbeat, { subdomain: 'inversion', sessionId: session(n) });

  it('counts only tabs that reported in recently, once each, and only when the store enabled it', async () => {
    const { t, admin, storeId } = await campaign();
    await beat(t, 1);
    expect(await count(t)).toBe(0);
    expect(await rows(t, 'checkoutPresence')).toHaveLength(0);

    await admin.mutation(api.stores.updateCheckout, { id: storeId, checkout: { notifications: false, liveVisitors: true, upsellTitle: '', upsellReferences: [] } });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_800_000_000_000);
    await beat(t, 1); await beat(t, 1); await beat(t, 2);
    await t.mutation(api.storefront.heartbeat, { subdomain: 'inversion', sessionId: 'short' });
    await t.mutation(api.storefront.heartbeat, { subdomain: 'no-existe', sessionId: session(9) });
    expect(await count(t)).toBe(2);

    // A tab that stops reporting drops out; one that keeps reporting stays.
    vi.setSystemTime(1_800_000_000_000 + 40_000);
    await beat(t, 2);
    vi.setSystemTime(1_800_000_000_000 + 60_000);
    expect(await count(t)).toBe(1);
    vi.setSystemTime(1_800_000_000_000 + 120_000);
    expect(await count(t)).toBe(0);

    // Old rows are removed by later reports.
    vi.setSystemTime(1_800_000_000_000 + 900_000);
    await beat(t, 3);
    expect((await rows(t, 'checkoutPresence')).map(row => row.sessionId)).toEqual([session(3)]);
  });
});


describe('classic editorial content', () => {
  it('saves and publishes the new sections without dropping promotions or existing content', async () => {
    const { t, admin, storeId } = await campaign();
    const draft = normalizeContent(content);
    Object.assign(draft.hero, { eyebrow: 'Una guía práctica', secondaryImageUrl: 'https://example.com/kit.png', note: 'Formato digital' });
    Object.assign(draft.introduction, { enabled: true, title: 'Empezá con un plan', text: 'Primer párrafo.\nSegundo párrafo.' });
    Object.assign(draft.transformation, { enabled: true, title: 'Antes y después', imageUrl: 'https://example.com/change.png', imageAlt: 'Comparación de resultados' });
    Object.assign(draft.about, { enabled: true, title: 'Nuestro equipo', text: 'Creamos esta guía.', imageUrl: 'https://example.com/team.png', signature: 'El equipo' });
    Object.assign(draft.showcase, { enabled: true, title: 'El kit', imageUrl: 'https://example.com/kit.png' });
    Object.assign(draft.comparison, { enabled: true, title: 'Elegí tu camino', items: [{ title: 'Con una guía', description: 'Un paso a paso.', highlighted: true }] });
    draft.steps.items = Array.from({ length: 7 }, (_, i) => ({ title: `Día ${i + 1}`, description: 'Una actividad', icon: 'book' }));
    draft.promotion = { ...draft.promotion, message: 'Nuestro banner', remainingSpots: 9 };
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', draft });
    const old = await t.query(api.storefront.getLanding, { subdomain: 'inversion' });
    expect(old.content.about.enabled).toBe(false);
    const preview = await admin.query(api.landings.preview, { storeId });
    for (const key of ['hero', 'introduction', 'transformation', 'about', 'showcase', 'comparison', 'steps', 'promotion', 'activity', 'guarantee']) expect(preview.content[key]).toMatchObject(draft[key]);
    await admin.mutation(api.landings.publish, { storeId });
    const published = await t.query(api.storefront.getLanding, { subdomain: 'inversion' });
    expect(published.content.about).toEqual(preview.content.about);
    expect(published.content.promotion.message).toBe('Nuestro banner');
    expect(published.offer).toEqual(old.offer);
  });

  it('rejects unsafe media URLs and oversized or ambiguous comparison sections', async () => {
    const { admin, storeId } = await campaign();
    const base = normalizeContent(content);
    const item = { title: 'Opción', description: 'Texto', highlighted: true };
    const patches = [
      { hero: { ...base.hero, secondaryImageUrl: 'javascript:alert(1)' } },
      { about: { ...base.about, imageUrl: 'data:text/html,x' } },
      { transformation: { ...base.transformation, imageUrl: 'javascript:alert(1)' } },
      { showcase: { ...base.showcase, imageUrl: 'javascript:alert(1)' } },
      { introduction: { ...base.introduction, text: 'a'.repeat(2401) } },
      { comparison: { ...base.comparison, items: [item, item] } },
      { comparison: { ...base.comparison, items: Array.from({ length: 4 }, () => ({ ...item, highlighted: false })) } },
      { steps: { ...base.steps, items: Array.from({ length: 8 }, () => ({ title: 'Paso', description: '', icon: 'book' })) } },
    ];
    for (const patch of patches) await expect(admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', draft: { ...base, ...patch } })).rejects.toThrow();
  });
});

describe('product presentation shared by the purchase cards', () => {
  it('reuses product copy and reference prices in landing and checkout without changing charges', async () => {
    const { t, admin, ids, storeId } = await campaign();
    await admin.mutation(api.stores.updateCheckout, { id: storeId, checkout: { notifications: false, upsellTitle: '', upsellReferences: [{ productId: ids.upsellA, value: 1800 }] } });
    const data = { ...product('Audiolibro', 'upsellA'), shortDescription: ' Resumen para escuchar ', featured: true, referencePrice: { currency: ' usd ', value: 2400 } };
    await admin.mutation(api.products.update, { id: ids.upsellA, ...data });
    await admin.mutation(api.products.update, { id: ids.main, ...product('Ebook principal', 'main'), referencePrice: { currency: 'USD', value: 5400 } });
    for (const query of [api.storefront.getLanding, api.storefront.getCheckout]) {
      const view = await t.query(query, { subdomain: 'inversion' });
      expect(view.offer.main.compareAtPrice).toBe(5400);
      expect(view.offer.upsells[0]).toMatchObject({ shortDescription: 'Resumen para escuchar', featured: true, compareAtPrice: 2400, price: 900 });
      expect(JSON.stringify(view)).not.toContain('deliverables');
    }
    mockStripe();
    await start(t, [ids.upsellA]);
    expect((await rows(t, 'orders'))[0].total).toBe(3600);
    // Old clients can edit general data without deleting the new presentation fields.
    await admin.mutation(api.products.update, { id: ids.upsellA, ...product('Audio actualizado', 'upsellA') });
    expect((await admin.query(api.products.get, { id: ids.upsellA })).referencePrice).toEqual({ currency: 'USD', value: 2400 });
  });

  it('does not invent discounts across currencies or restore legacy prices after an explicit clear', async () => {
    const { t, admin, ids, storeId } = await campaign();
    await admin.mutation(api.stores.updateCheckout, { id: storeId, checkout: { notifications: false, upsellTitle: '', upsellReferences: [{ productId: ids.upsellA, value: 1800 }] } });
    const view = () => t.query(api.storefront.getLanding, { subdomain: 'inversion' });
    expect((await view()).offer.upsells[0].compareAtPrice).toBe(1800);
    for (const referencePrice of [{ currency: 'EUR', value: 5000 }, { currency: 'USD', value: 900 }, { currency: 'USD', value: 800 }, null]) {
      await admin.mutation(api.products.update, { id: ids.upsellA, ...product('Audio', 'upsellA'), referencePrice });
      expect((await view()).offer.upsells[0].compareAtPrice).toBeUndefined();
    }
  });

  it('validates and protects product presentation fields on the server', async () => {
    const { t, admin, ids } = await campaign();
    const data = { id: ids.main, ...product('Ebook', 'main'), shortDescription: 'Resumen', featured: true, referencePrice: { currency: 'USD', value: 4800 } };
    await expect(t.mutation(api.products.update, data)).rejects.toThrow();
    const stranger = await signedIn(t, 'stranger@example.com');
    await expect(stranger.mutation(api.products.update, data)).rejects.toThrow();
    for (const patch of [{ shortDescription: 'x'.repeat(181) }, { referencePrice: { currency: 'US', value: 4800 } }, { referencePrice: { currency: 'USD', value: -10 } }, { referencePrice: { currency: 'USD', value: 1.5 } }]) {
      await expect(admin.mutation(api.products.update, { ...data, ...patch })).rejects.toThrow();
    }
    await admin.mutation(api.products.update, data);
    await admin.mutation(api.products.update, { ...data, shortDescription: '', featured: false, referencePrice: null });
    expect(await admin.query(api.products.get, { id: ids.main })).toMatchObject({ shortDescription: '', featured: false, referencePrice: null });
  });
});

describe('sale alert on Discord', () => {
  const HOOK = 'https://discord.com/api/webhooks/1/test-only';
  afterEach(() => { vi.useRealTimers(); });
  const settle = t => t.finishAllScheduledFunctions(vi.runAllTimers);

  it('posts the product names and the total once per paid sale', async () => {
    vi.stubEnv('DISCORD_SALE_BOT_URL', HOOK);
    const { t, ids } = await campaign();
    mockStripe();
    vi.useFakeTimers();
    const discord = mockDiscord(HOOK);
    await start(t, [ids.upsellA]);
    const event = paidSession('cs_test_1', 3600);
    await sendWebhook(t, event);
    await sendWebhook(t, event);
    await settle(t);

    expect(discord.messages).toHaveLength(1);
    const order = await t.run(async ctx => (await ctx.db.query('orders').collect())[0]);
    expect(discord.messages[0].content).toMatch(/^🔥 NUEVA VENTA 🔥 - .*36[.,]00/);
    for (const item of order.items) expect(discord.messages[0].content).not.toContain(item.name);
    expect(discord.messages[0].allowed_mentions).toEqual({ parse: [] });
  });

  it('stays silent for held charges, failed alerts do not break the payment, and it is optional', async () => {
    vi.stubEnv('DISCORD_SALE_BOT_URL', HOOK);
    const { t } = await campaign();
    mockStripe();
    vi.useFakeTimers();
    const discord = mockDiscord(HOOK, 500);
    await start(t);
    await sendWebhook(t, paidSession('cs_test_1', 100));
    await settle(t);
    expect(discord.messages).toHaveLength(0);

    await start(t, [], 'attempt-discord-2');
    await sendWebhook(t, paidSession('cs_test_2', 2700));
    await settle(t);
    expect(discord.messages).toHaveLength(1);
    expect(await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_2' })).toMatchObject({ status: 'paid' });
  });
});
