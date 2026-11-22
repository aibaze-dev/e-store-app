import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { backend, signedIn, mockStripe, stripeEvent, sendWebhook, content, product, WEBHOOK_SECRET } from './helpers';
import { ATTRIBUTION_MAX_LENGTH, MAX_SOURCE_ROWS, attributionMetadata, cleanAttribution, filterByCampaign, groupSources, parseAttribution, sortSources, topSource } from '../shared/attribution.js';
import { createReport, dateKey } from '../shared/analytics.js';
import { ATTRIBUTION_TTL_MS, attributionStorageKey, createAttributionStore } from '../src/storefront/attribution.js';
import { createQuizTemplate, newStep } from '../shared/quiz.js';
import business from '../src/config/businessData.json';

// convex-test does not implement the native request metadata syscall.
vi.mock('../convex/lib/analytics_ip', async original => ({ ...await original(), requestIp: vi.fn(async () => '192.0.2.1') }));

const ADMIN = 'owner@example.com';
beforeEach(() => {
  vi.stubEnv('ADMIN_EMAILS', ADMIN);
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_only');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

// The link Meta builds from the template, as a visitor's browser receives it.
const LINK = '?utm_source=ig&utm_medium=Conjunto%20Mujeres%2025-34&utm_campaign=Ventas%20%F0%9F%94%A5%20Noviembre&utm_content=Video%20testimonio&utm_term=Instagram_Reels&campaign_id=120210000000001&adset_id=120210000000002&ad_id=120210000000003&fbclid=abc';
const AD = {
  source: 'ig', medium: 'Conjunto Mujeres 25-34', campaign: 'Ventas 🔥 Noviembre', content: 'Video testimonio', term: 'Instagram_Reels',
  campaignId: '120210000000001', adsetId: '120210000000002', adId: '120210000000003',
};
const OTHER_AD = { ...AD, content: 'Carrusel', adId: '120210000000009', term: 'Facebook_Feed', source: 'fb' };

describe('campaign parameters of the ad link', () => {
  it('reads the Meta template and ignores everything else in the address', () => {
    expect(parseAttribution(LINK)).toEqual(AD);
    expect(parseAttribution('?session_id=cs_test_1&fbclid=abc')).toBeUndefined();
    expect(parseAttribution('')).toBeUndefined();
    expect(parseAttribution('?utm_source=newsletter')).toEqual({ source: 'newsletter' });
  });

  it('drops unresolved placeholders, bad IDs and control characters, and bounds the length', () => {
    expect(parseAttribution('?utm_campaign={{campaign.name}}&utm_source=fb&ad_id={{ad.id}}')).toEqual({ source: 'fb' });
    expect(parseAttribution('?utm_campaign=ok&campaign_id=12%2034&adset_id=' + 'a'.repeat(65))).toEqual({ campaign: 'ok' });
    expect(cleanAttribution({ campaign: '  Uno\n\tdos\u0000  ', source: 5, extra: 'x', medium: '   ' })).toEqual({ campaign: 'Uno dos' });
    const long = cleanAttribution({ campaign: '🔥'.repeat(ATTRIBUTION_MAX_LENGTH + 20) }).campaign;
    expect(Array.from(long)).toHaveLength(ATTRIBUTION_MAX_LENGTH);
    expect(long.isWellFormed()).toBe(true);
    for (const value of [null, undefined, 'utm', 7, {}, { other: 'x' }]) expect(cleanAttribution(value)).toBeUndefined();
  });

  it('names Stripe metadata like the link parameters', () => {
    expect(attributionMetadata(AD)).toEqual({
      utm_source: 'ig', utm_medium: 'Conjunto Mujeres 25-34', utm_campaign: 'Ventas 🔥 Noviembre', utm_content: 'Video testimonio', utm_term: 'Instagram_Reels',
      campaign_id: '120210000000001', adset_id: '120210000000002', ad_id: '120210000000003',
    });
    expect(attributionMetadata(undefined)).toEqual({});
  });
});

describe('browser memory of the last ad link', () => {
  const storage = () => {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  };
  function setup(extra = {}) {
    const local = storage();
    let time = Date.parse('2026-11-20T10:00:00Z');
    const options = { getStorage: () => local, now: () => time, ...extra };
    return { local, options, store: createAttributionStore(options), advance: ms => { time += ms; } };
  }

  it('keeps the campaign when the address loses its parameters and across reloads', () => {
    const { store, options, local } = setup();
    expect(store.read('libro')).toBeUndefined();
    store.capture('libro', LINK);
    store.capture('libro', '');
    store.capture('libro', '?session_id=cs_test_1');
    expect(store.read('libro')).toEqual(AD);
    expect(createAttributionStore(options).read('libro')).toEqual(AD);
    expect(JSON.parse(local.getItem(attributionStorageKey('libro'))).value).toEqual(AD);
  });

  it('lets the last ad link win, keeps stores apart and forgets after a week', () => {
    const { store, advance } = setup();
    store.capture('libro', LINK);
    store.capture('libro', '?utm_source=fb&utm_campaign=Remarketing&ad_id=9');
    expect(store.read('libro')).toEqual({ source: 'fb', campaign: 'Remarketing', adId: '9' });
    expect(store.read('otra-tienda')).toBeUndefined();
    advance(ATTRIBUTION_TTL_MS - 1000);
    expect(store.read('libro')).toBeDefined();
    advance(2000);
    expect(store.read('libro')).toBeUndefined();
  });

  it('works for the visit when storage is blocked and never trusts what storage holds', () => {
    const blocked = setup({ getStorage: () => { throw new Error('denied'); } });
    blocked.store.capture('libro', LINK);
    expect(blocked.store.read('libro')).toEqual(AD);
    const { local, options } = setup();
    local.setItem(attributionStorageKey('libro'), '{broken');
    expect(createAttributionStore(options).read('libro')).toBeUndefined();
    local.setItem(attributionStorageKey('libro'), JSON.stringify({ at: options.now(), value: { campaign: 'ok', adId: 'not valid!', injected: '<script>' } }));
    expect(createAttributionStore(options).read('libro')).toEqual({ campaign: 'ok' });
  });
});

describe('campaign report', () => {
  const day = '2026-11-20';
  const view = (page, attribution) => ({ _id: crypto.randomUUID(), _creationTime: 1, day, page, ipHash: 'ip', ...(attribution ? { attribution } : {}) });
  const sale = (amount, attribution, postPurchase = false) => ({ day, amount, currency: 'USD', postPurchase, ...(attribution ? { attribution } : {}) });
  function sources() {
    const report = createReport(day, day);
    report.add([view('landing', AD), view('landing', AD), view('checkout', AD), view('landing', OTHER_AD), view('landing'), view('checkout')]);
    report.addPurchases([sale(2700, AD), sale(4700, AD, true), sale(2700, OTHER_AD), sale(2700)]);
    return report.finish().sources;
  }

  it('groups visits, purchases and revenue by campaign, ad set, ad, placement or source', () => {
    const rows = sources();
    expect(rows).toHaveLength(3);
    expect(groupSources(rows, 'campaign')).toEqual([
      { key: '["120210000000001"]', id: '120210000000001', name: 'Ventas 🔥 Noviembre', parents: [], landingViews: 3, checkoutViews: 1, purchases: 2, revenue: { USD: 10100 } },
      { key: '', id: '', name: '', parents: [], landingViews: 1, checkoutViews: 1, purchases: 1, revenue: { USD: 2700 } },
    ]);
    const ads = groupSources(rows, 'ad');
    expect(ads.map(row => [row.name, row.landingViews, row.checkoutViews, row.purchases, row.revenue.USD])).toEqual([
      ['Video testimonio', 2, 1, 1, 7400], ['Carrusel', 1, 0, 1, 2700], ['', 1, 1, 1, 2700],
    ]);
    expect(ads[0].parents).toEqual(['Ventas 🔥 Noviembre', 'Conjunto Mujeres 25-34']);
    expect(groupSources(rows, 'adset').map(row => row.name)).toEqual(['Conjunto Mujeres 25-34', '']);
    expect(groupSources(rows, 'placement').map(row => row.name)).toEqual(['Instagram_Reels', 'Facebook_Feed', '']);
    expect(groupSources(rows, 'source').map(row => [row.name, row.purchases])).toEqual([['ig', 1], ['fb', 1], ['', 1]]);
  });

  it('answers which ad of one campaign brings more visits, checkouts and purchases', () => {
    const REMARKETING = { ...AD, campaign: 'Remarketing', campaignId: '120210000000050', content: 'Oferta final', adId: '120210000000051' };
    // Same name as an ad of the other campaign and a link whose ad has a name but no ID.
    const SAME_NAME = { ...REMARKETING, content: 'Carrusel', adId: '120210000000052' };
    const NAME_ONLY = { source: 'ig', campaign: 'Ventas 🔥 Noviembre', campaignId: AD.campaignId, content: 'Imagen estática' };
    const report = createReport(day, day);
    report.add([
      view('landing', AD), view('landing', AD), view('checkout', AD),
      view('landing', OTHER_AD), view('landing', OTHER_AD), view('landing', OTHER_AD), view('checkout', OTHER_AD), view('checkout', OTHER_AD),
      view('landing', NAME_ONLY),
      ...Array.from({ length: 9 }, () => view('landing', REMARKETING)), view('landing', SAME_NAME), view('landing'),
    ]);
    report.addPurchases([sale(2700, AD), sale(2700, AD), sale(2700, OTHER_AD), sale(2700, REMARKETING), sale(2700)]);
    const rows = report.finish().sources;

    const campaigns = groupSources(rows, 'campaign');
    expect(campaigns.map(row => [row.name, row.id])).toEqual([['Ventas 🔥 Noviembre', AD.campaignId], ['Remarketing', REMARKETING.campaignId], ['', '']]);
    const ads = groupSources(filterByCampaign(rows, campaigns[0].key), 'ad');
    // Each ad keeps its name and its ID; other campaigns and visits without campaign stay out.
    expect(ads.map(row => [row.name, row.id, row.landingViews, row.checkoutViews, row.purchases])).toEqual([
      ['Video testimonio', AD.adId, 2, 1, 2], ['Carrusel', OTHER_AD.adId, 3, 2, 1], ['Imagen estática', '', 1, 0, 0],
    ]);
    expect(['landingViews', 'checkoutViews', 'purchases'].map(metric => topSource(ads, metric).name)).toEqual(['Carrusel', 'Carrusel', 'Video testimonio']);
    expect(sortSources(ads, 'landingViews').map(row => row.name)).toEqual(['Carrusel', 'Video testimonio', 'Imagen estática']);
    expect(sortSources(ads, 'landingViews', false).map(row => row.name)).toEqual(['Imagen estática', 'Video testimonio', 'Carrusel']);
    expect(sortSources(ads, 'conversion').map(row => row.name)).toEqual(['Video testimonio', 'Carrusel', 'Imagen estática']);
    expect(sortSources(ads, 'revenue').map(row => row.name)).toEqual(['Video testimonio', 'Carrusel', 'Imagen estática']);
    expect(ads.map(row => row.name)).toEqual(['Video testimonio', 'Carrusel', 'Imagen estática']);

    // Without the filter, ads of the same name in different campaigns are different ads.
    const all = groupSources(rows, 'ad');
    expect(all.filter(row => row.name === 'Carrusel').map(row => [row.id, row.parents[0]])).toEqual([[OTHER_AD.adId, 'Ventas 🔥 Noviembre'], [SAME_NAME.adId, 'Remarketing']]);
    expect(topSource(all, 'landingViews').name).toBe('Oferta final');
    // Visits without campaign never lead, and an empty report has no leader.
    expect(topSource(groupSources(filterByCampaign(rows, ''), 'ad'), 'landingViews')).toBeNull();
    expect(topSource(ads, 'revenue').name).toBe('Video testimonio');
    expect(topSource(groupSources(filterByCampaign(rows, campaigns[1].key), 'ad'), 'checkoutViews')).toBeNull();
    expect(filterByCampaign(rows, '["no existe"]')).toEqual([]);
  });

  it('adds up links beyond the limit in one row instead of growing without bound', () => {
    const report = createReport(day, day);
    report.add(Array.from({ length: MAX_SOURCE_ROWS + 25 }, (_, index) => view('landing', { campaign: `spam-${index}` })));
    report.add([view('landing', { campaign: 'spam-3' }), view('landing')]);
    report.addPurchases([sale(2700, { campaign: 'nuevo' })]);
    const rows = report.finish().sources;
    expect(rows).toHaveLength(MAX_SOURCE_ROWS + 2);
    const grouped = groupSources(rows, 'campaign');
    expect(grouped.find(row => row.name === 'Otros enlaces')).toMatchObject({ landingViews: 25, purchases: 1, revenue: { USD: 2700 } });
    expect(grouped.find(row => row.name === 'spam-3').landingViews).toBe(2);
    expect(grouped.find(row => row.key === '').landingViews).toBe(1);
    expect(grouped.reduce((sum, row) => sum + row.landingViews, 0)).toBe(MAX_SOURCE_ROWS + 27);
    for (const dimension of ['adset', 'ad', 'placement', 'source']) expect(groupSources(rows, dimension).map(row => row.name)).toContain('Otros enlaces');
  });

  it('keeps links with partial parameters out of the wrong group', () => {
    const report = createReport(day, day);
    report.add([view('landing', { source: 'newsletter' }), view('landing', { campaign: 'Solo nombre' }), view('landing', { campaign: 'Solo nombre' })]);
    const rows = report.finish().sources;
    expect(groupSources(rows, 'campaign').map(row => [row.name, row.landingViews])).toEqual([['Solo nombre', 2], ['', 1]]);
    expect(groupSources(rows, 'source').map(row => [row.name, row.landingViews])).toEqual([['', 2], ['newsletter', 1]]);
    expect(groupSources(rows, 'ad').map(row => [row.name, row.parents])).toEqual([['—', ['Solo nombre', '—']], ['', []]]);
  });
});

describe('campaign stored with visits, quiz sessions and orders', () => {
  async function campaign() {
    const t = backend();
    const admin = await signedIn(t, ADMIN);
    const main = await admin.mutation(api.products.create, product('Ebook', 'main'));
    const post = await admin.mutation(api.products.create, product('Curso', 'post'));
    const storeId = await admin.mutation(api.stores.create, {
      name: 'Campaña', status: 'active', currency: 'USD',
      offer: { mainProductId: main, price: 2700, bonuses: [], upsells: [] },
      postPurchase: { enabled: true, productId: post, price: 4700 }, tracking: { metaPixelId: '' },
    });
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: content });
    await admin.mutation(api.landings.publish, { storeId });
    return { t, admin, storeId };
  }
  const rows = (t, table) => t.run(ctx => ctx.db.query(table).collect());
  const start = (t, extra = {}) => t.action(api.checkout.start, { subdomain: 'inversion', upsellProductIds: [], attemptId: crypto.randomUUID(), via: 'path', ...extra });
  const paid = (sessionId, amount) => stripeEvent('checkout.session.completed', { id: sessionId, payment_status: 'paid', payment_intent: `pi_${sessionId}`, amount_total: amount, currency: 'usd', customer_details: { email: 'buyer@example.com', name: 'Ana' } });
  const view = (t, page, extra = {}) => t.mutation(api.analytics.recordView, { subdomain: 'inversion', page, eventId: crypto.randomUUID(), ...extra });

  it('stores a cleaned campaign on the visit and nothing when there is none', async () => {
    const { t } = await campaign();
    await view(t, 'landing', { attribution: { ...AD, campaign: `  ${'x'.repeat(400)}  `, adId: 'not valid!' } });
    await view(t, 'checkout');
    await view(t, 'landing', { attribution: { campaign: '{{campaign.name}}' } });
    const [first, second, third] = await rows(t, 'pageViews');
    const { adId, ...withoutAdId } = AD;
    expect(first.attribution).toStrictEqual({ ...withoutAdId, campaign: 'x'.repeat(ATTRIBUTION_MAX_LENGTH) });
    expect('attribution' in second).toBe(false);
    expect('attribution' in third).toBe(false);
    await expect(view(t, 'landing', { attribution: { campaign: 'ok', email: 'someone@example.com' } })).rejects.toThrow();
    await expect(view(t, 'landing', { attribution: 'utm_campaign=x' })).rejects.toThrow();
  });

  it('copies the campaign to the order, its Stripe session and the post-purchase order', async () => {
    const { t, admin, storeId } = await campaign();
    const stripe = mockStripe();
    const attemptId = crypto.randomUUID();
    await start(t, { attemptId, attribution: AD });
    // A retry of the same attempt with another campaign replays the order's own.
    await start(t, { attemptId, attribution: OTHER_AD });
    expect((await rows(t, 'orders')).map(order => order.attribution)).toEqual([AD]);
    for (const request of stripe.requests) {
      expect(request.body).toMatchObject({
        'metadata[utm_source]': 'ig', 'metadata[utm_campaign]': 'Ventas 🔥 Noviembre', 'metadata[utm_medium]': 'Conjunto Mujeres 25-34',
        'metadata[utm_content]': 'Video testimonio', 'metadata[utm_term]': 'Instagram_Reels',
        'metadata[campaign_id]': '120210000000001', 'metadata[adset_id]': '120210000000002', 'metadata[ad_id]': '120210000000003',
        'payment_intent_data[metadata][utm_campaign]': 'Ventas 🔥 Noviembre', 'payment_intent_data[metadata][ad_id]': '120210000000003',
      });
    }
    expect(stripe.requests[1].body).toEqual(stripe.requests[0].body);

    await sendWebhook(t, paid('cs_test_1', 2700));
    await t.action(api.checkout.startPostPurchase, { parentSessionId: 'cs_test_1', attemptId: crypto.randomUUID(), via: 'path' });
    const orders = await rows(t, 'orders');
    expect(orders[1]).toMatchObject({ parentOrderId: orders[0]._id, attribution: AD });
    expect(stripe.requests[2].body['metadata[ad_id]']).toBe('120210000000003');
    await sendWebhook(t, paid('cs_test_2', 4700));

    // A direct buyer: no campaign on the order and no campaign metadata sent to Stripe.
    await start(t);
    expect('attribution' in (await rows(t, 'orders'))[2]).toBe(false);
    expect(Object.keys(stripe.requests[3].body).filter(key => /utm_|_id\]/.test(key))).toEqual([]);
    await sendWebhook(t, paid('cs_test_3', 2700));

    await view(t, 'landing', { attribution: AD });
    await view(t, 'checkout', { attribution: AD });
    await view(t, 'landing');
    // Reports only read what was stored before they started.
    await new Promise(resolve => setTimeout(resolve, 10));
    const today = dateKey(Date.now(), business.timeZone);
    for (const report of [await admin.action(api.analytics.report, { storeId, from: today, to: today }), await admin.action(api.analytics.rollingActivity, { storeId })]) {
      expect(groupSources(report.sources, 'ad')).toEqual([
        { key: '["120210000000001","120210000000002","120210000000003"]', id: '120210000000003', name: 'Video testimonio', parents: ['Ventas 🔥 Noviembre', 'Conjunto Mujeres 25-34'], landingViews: 1, checkoutViews: 1, purchases: 1, revenue: { USD: 7400 } },
        { key: '', id: '', name: '', parents: [], landingViews: 1, checkoutViews: 0, purchases: 1, revenue: { USD: 2700 } },
      ]);
    }
    const listed = await admin.query(api.orders.list, { storeId });
    expect(listed.map(order => order.attribution?.campaign ?? null).sort()).toEqual([null, 'Ventas 🔥 Noviembre', 'Ventas 🔥 Noviembre'].sort());
    await expect(t.action(api.analytics.report, { storeId, from: today, to: today })).rejects.toThrow();
  });

  it('keeps the campaign of the quiz session for a buyer whose browser lost it', async () => {
    const { t, admin, storeId } = await campaign();
    const quiz = createQuizTemplate('Ebook');
    quiz.steps = [newStep('single', 'choice')];
    quiz.calculations = [];
    quiz.results = [{ id: 'general', default: true, title: 'Resultado', blocks: [{ id: 'offer', type: 'offer' }] }];
    await admin.mutation(api.quizzes.save, { storeId, subdomain: 'inversion', quiz });
    await admin.mutation(api.quizzes.publish, { storeId });
    const token = crypto.randomUUID() + crypto.randomUUID();
    let data = await t.mutation(api.quizzes.start, { subdomain: 'inversion', token, attribution: AD });
    // Recovering the session from another link does not rewrite where it came from.
    await t.mutation(api.quizzes.start, { subdomain: 'inversion', token, attribution: OTHER_AD });
    expect((await rows(t, 'quizSessions'))[0].attribution).toEqual(AD);
    data = await t.mutation(api.quizzes.saveAnswer, { token, revision: data.session.revision, commandId: crypto.randomUUID(), direction: 'next', value: data.quiz.steps[0].options[0].id });
    expect(data.session.currentStep).toBeNull();
    mockStripe();
    await start(t, { origin: 'quiz', quizToken: token });
    await start(t, { origin: 'quiz', quizToken: token, attribution: OTHER_AD });
    expect((await rows(t, 'orders')).map(order => order.attribution)).toEqual([AD, OTHER_AD]);
    expect((await admin.query(api.quizzes.detail, { sessionId: (await rows(t, 'quizSessions'))[0]._id })).attribution).toEqual(AD);
  });
});
