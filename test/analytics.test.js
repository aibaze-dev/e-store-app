import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { backend, signedIn, content, product } from './helpers';
import { hashIp, normalizeIp, requestIp } from '../convex/lib/analytics_ip';
import { createReport, dateKey, shiftDate, startOfDate, validRange } from '../shared/analytics.js';
import business from '../src/config/businessData.json';
import { createVisitTracker, visitStorageKey } from '../src/storefront/visitTracking.js';

// convex-test 0.0.51 does not implement the native getRequestMetadata syscall.
// Only transport metadata is replaced; hashing, permissions, database and reports run.
vi.mock('../convex/lib/analytics_ip', async importOriginal => ({
  ...await importOriginal(), requestIp: vi.fn(async () => '192.0.2.1'),
}));

const ADMIN = 'analytics-owner@example.com';
beforeEach(() => {
  vi.stubEnv('ADMIN_EMAILS', ADMIN);
  requestIp.mockResolvedValue('192.0.2.1');
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function campaign() {
  const t = backend();
  const admin = await signedIn(t, ADMIN);
  const productId = await admin.mutation(api.products.create, product('Libro', 'libro'));
  const store = { name: 'Analíticas', status: 'active', currency: 'USD', offer: { mainProductId: productId, price: 1000, bonuses: [], upsells: [] }, postPurchase: { enabled: false, price: 0 }, tracking: { metaPixelId: '' } };
  const storeId = await admin.mutation(api.stores.create, store);
  await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'analytics', template: 'classic', draft: content });
  await admin.mutation(api.landings.publish, { storeId });
  return { t, admin, store, storeId };
}
const rows = t => t.run(ctx => ctx.db.query('pageViews').collect());
const record = (t, page = 'landing', eventId = crypto.randomUUID()) => t.mutation(api.analytics.recordView, { subdomain: 'analytics', page, eventId });

describe('live storefront analytics', () => {
  it('counts active sessions by their latest page, separately from visit history and public counters', async () => {
    const { t, admin, store, storeId } = await campaign();
    const other = await admin.mutation(api.stores.create, { ...store, name: 'Other' });
    const sessionId = crypto.randomUUID();
    const beat = (page, id = sessionId) => t.mutation(api.storefront.heartbeat, { subdomain: 'analytics', sessionId: id, page });
    const count = () => admin.query(api.analytics.liveSessions, { storeId, sample: Date.now() });
    await beat('landing');
    await beat('landing');
    expect(await count()).toEqual({ total: 1, landing: 1, checkout: 0, offer: 0, thanks: 0 });
    await beat('checkout');
    await beat('landing', crypto.randomUUID());
    expect(await count()).toEqual({ total: 2, landing: 1, checkout: 1, offer: 0, thanks: 0 });
    await beat('offer');
    expect(await count()).toEqual({ total: 2, landing: 1, checkout: 0, offer: 1, thanks: 0 });
    await beat('thanks');
    await beat('thanks');
    await beat('offer', crypto.randomUUID());
    await t.run(ctx => ctx.db.insert('checkoutPresence', { storeId, sessionId: crypto.randomUUID(), seenAt: Date.now() }));
    expect(await count()).toEqual({ total: 4, landing: 1, checkout: 1, offer: 1, thanks: 1 });
    await admin.mutation(api.stores.updateCheckout, { id: storeId, checkout: { notifications: false, liveVisitors: true, upsellTitle: '', upsellReferences: [] } });
    expect(await t.query(api.storefront.checkoutVisitors, { subdomain: 'analytics' })).toBe(1);
    expect(await rows(t)).toHaveLength(0);
    expect((await admin.query(api.analytics.liveSessions, { storeId: other, sample: 0 })).total).toBe(0);
    await expect(t.query(api.analytics.liveSessions, { storeId, sample: 0 })).rejects.toThrow();
    await t.run(async ctx => {
      for (const row of await ctx.db.query('checkoutPresence').collect()) {
        await ctx.db.patch(row._id, { seenAt: Date.now() - 46_000 });
      }
    });
    expect(await count()).toEqual({ total: 0, landing: 0, checkout: 0, offer: 0, thanks: 0 });
  });
});

describe('rolling 12-hour activity', () => {
  it('fills all twelve hours, paginates visits and counts only the selected store’s confirmed payments by paidAt', async () => {
    const { t, admin, store, storeId } = await campaign();
    const other = await admin.mutation(api.stores.create, store);
    const hour = 3_600_000;
    const end = Date.now() + 60_000;
    const start = end - 12 * hour;
    await t.run(async ctx => {
      const landing = await ctx.db.query('landings').withIndex('by_store', q => q.eq('storeId', storeId)).first();
      for (let i = 0; i < 252; i++) {
        await ctx.db.insert('pageViews', { storeId: i === 251 ? other : storeId, day: '2026-01-01', page: i < 42 ? 'checkout' : 'landing', eventId: String(i) });
      }
      const payment = async (paidAt, owner = storeId, status = 'paid', currency = 'USD') => {
        const orderId = await ctx.db.insert('orders', { storeId: owner, landingId: landing._id, attemptId: crypto.randomUUID(), currency: 'USD', status, total: 1900, items: [] });
        await ctx.db.insert('transactions', { orderId, paidAt, status: 'paid', amount: 1900, currency, deliveries: [] });
      };
      for (const at of [start - 1, start, start + hour, end - 1, end]) await payment(at);
      await payment(start + hour, storeId, 'paid', 'ARS');
      await payment(start, other);
      await payment(start, storeId, 'refunded');
    });
    vi.spyOn(Date, 'now').mockReturnValue(end);
    await expect(t.action(api.analytics.rollingActivity, { storeId })).rejects.toThrow();
    const result = await admin.action(api.analytics.rollingActivity, { storeId });
    expect(result.hours.map(h => h.visits)).toEqual([...Array(11).fill(0), 251]);
    expect(result.hours.map(h => h.purchases)).toEqual([1, 2, ...Array(9).fill(0), 1]);
    expect(result.total).toMatchObject({ landingViews: 209, checkoutViews: 42, purchases: 4, checkoutPurchases: 4, revenue: { USD: 5700, ARS: 1900 } });
    expect(result.hours[1].revenue).toEqual({ USD: 1900, ARS: 1900 });
    const day = dateKey(end - 60_000, business.timeZone);
    const today = await admin.action(api.analytics.rollingActivity, { storeId, day });
    expect(today.day).toBe(day);
    expect(today.hours[0].start).toBe(startOfDate(day, business.timeZone));
    expect(today.hours.at(-1).end).toBe(Math.min(end, startOfDate(shiftDate(day, 1), business.timeZone)));
    expect(today.total.views).toBe(251);
    expect(result.hours[0].start).toBe(start);
    expect(result.hours.at(-1).end).toBe(result.asOf);
  });
});

describe('minimal visit history', () => {
  it('records distinct events, deduplicates retries and only persists a store-scoped IP hash', async () => {
    const { t, storeId } = await campaign();
    const eventId = crypto.randomUUID();
    await Promise.all([record(t, 'landing', eventId), record(t, 'landing', eventId)]);
    await record(t);
    await record(t, 'checkout');
    const history = await rows(t);
    expect(history).toHaveLength(3);
    expect(new Set(history.map(row => row.ipHash)).size).toBe(1);
    expect(history[0]).toMatchObject({ storeId, page: 'landing', day: dateKey(Date.now(), business.timeZone), ipHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(history[0]._creationTime).toBeGreaterThan(0);
    expect(JSON.stringify(history)).not.toContain('192.0.2.1');
    expect(Object.keys(history[0]).sort()).toEqual(['_creationTime', '_id', 'day', 'eventId', 'ipHash', 'origin', 'page', 'storeId'].sort());
  });

  it('deduplicates browser reloads and a lost ACK end-to-end with confirmed server responses', async () => {
    const { t, storeId } = await campaign();
    const values = new Map();
    const options = { timeZone: business.timeZone, getStorage: () => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }) };
    const visit = { storeId, subdomain: 'analytics', page: 'landing' };
    const send = args => t.mutation(api.analytics.recordView, args);
    await expect(createVisitTracker(options).track(visit, async args => { await send(args); throw new Error('lost ACK'); })).rejects.toThrow('lost ACK');
    expect(values.get(visitStorageKey(storeId, 'landing'))).toBeUndefined();
    const retry = vi.fn(send);
    await createVisitTracker(options).track(visit, retry);
    expect(await retry.mock.results[0].value).toMatchObject({ status: 'duplicate' });
    await createVisitTracker(options).track(visit, retry);
    expect(retry).toHaveBeenCalledTimes(1);
    await createVisitTracker(options).track({ ...visit, page: 'checkout' }, send);
    expect(await rows(t)).toHaveLength(2);
  });

  it('rejects caller-supplied IP/date/store, unknown pages, drafts and missing landings', async () => {
    const { t, admin, storeId, store } = await campaign();
    const args = { subdomain: 'analytics', page: 'landing', eventId: crypto.randomUUID() };
    for (const extra of [{ ip: '192.0.2.2' }, { ipHash: 'fake' }, { day: '2000-01-01' }, { storeId }, { page: 'preview' }]) {
      await expect(t.mutation(api.analytics.recordView, { ...args, ...extra })).rejects.toThrow();
    }
    await t.mutation(api.analytics.recordView, { ...args, subdomain: 'missing' });
    await t.mutation(api.analytics.recordView, { ...args, eventId: 'invalid' });
    await admin.mutation(api.stores.update, { id: storeId, ...store, status: 'draft' });
    await record(t);
    expect(await rows(t)).toEqual([]);
  });

  it('keeps views with unavailable IPs out of the unique counts', async () => {
    const { t } = await campaign();
    requestIp.mockResolvedValue(null);
    await record(t);
    await record(t, 'checkout');
    const history = await rows(t);
    expect(history).toHaveLength(2);
    expect(history.every(row => !row.ipHash)).toBe(true);
    const day = history[0].day;
    const report = createReport(day, day); report.add(history);
    expect(report.finish().total).toMatchObject({ views: 2, uniques: 0, unknownIpViews: 2 });
  });

  it('bounds bursts to 120 views per IP/store/minute', async () => {
    const { t, storeId } = await campaign();
    const ipHash = await hashIp('192.0.2.1', storeId, process.env.BETTER_AUTH_SECRET);
    await t.run(async ctx => {
      for (let i = 0; i < 120; i++) await ctx.db.insert('pageViews', { storeId, page: 'landing', day: dateKey(Date.now(), business.timeZone), ipHash, eventId: `seed-${i}` });
    });
    await record(t);
    expect(await rows(t)).toHaveLength(120);
    requestIp.mockResolvedValue('192.0.2.2');
    await record(t);
    expect(await rows(t)).toHaveLength(121);
  });
});

describe('private reports', () => {
  it('checks access, validates dates and includes all pages of the selected store/range', async () => {
    const { t, admin, storeId, store } = await campaign();
    const stranger = await signedIn(t, 'no-access@example.com');
    const args = { storeId, from: '2026-01-01', to: '2026-01-03' };
    await expect(t.action(api.analytics.report, args)).rejects.toThrow();
    await expect(stranger.action(api.analytics.report, args)).rejects.toThrow();
    await expect(admin.action(api.analytics.report, { ...args, to: '2027-01-03' })).rejects.toThrow(/366/);
    await expect(admin.action(api.analytics.report, { ...args, from: '2026-02-30' })).rejects.toThrow();
    const otherStoreId = await admin.mutation(api.stores.create, store);
    await t.run(async ctx => {
      for (let i = 0; i < 1005; i++) await ctx.db.insert('pageViews', { storeId, page: i % 2 ? 'checkout' : 'landing', day: i < 1000 ? '2026-01-01' : '2026-01-03', ipHash: `ip-${i % 3}`, eventId: `seed-${i}` });
      await ctx.db.insert('pageViews', { storeId, page: 'landing', day: '2025-12-31', ipHash: 'excluded', eventId: 'before-range' });
      await ctx.db.insert('pageViews', { storeId: otherStoreId, page: 'landing', day: '2026-01-01', ipHash: 'other-store', eventId: 'other-store' });
    });
    // Convex timestamps can contain sub-millisecond fractions.
    await new Promise(resolve => setTimeout(resolve, 5));
    const report = await admin.action(api.analytics.report, args);
    expect(report.total).toMatchObject({ views: 1005, uniques: 3, landingViews: 503, checkoutViews: 502, landingUniques: 3, checkoutUniques: 3 });
    expect(report.days.map(day => day.views)).toEqual([1000, 0, 5]);
    expect(report.recent).toHaveLength(20);
    expect(report.timeZone).toBe(business.timeZone);
    expect((await admin.action(api.analytics.report, { ...args, from: '2025-01-01', to: '2025-01-01' })).total.views).toBe(0);
    const module = await import('../convex/analytics');
    expect(module.readPage.isInternal).toBe(true);
  });
});

describe('paid purchases in visit reports', () => {
  it('paginates confirmed payments, uses payment date, isolates stores and excludes unpaid/refunded orders', async () => {
    const { t, admin, storeId, store } = await campaign();
    const otherStoreId = await admin.mutation(api.stores.create, store);
    const paidAt = Date.parse('2026-01-02T12:00:00Z');
    await t.run(async ctx => {
      const landing = await ctx.db.query('landings').withIndex('by_store', q => q.eq('storeId', storeId)).first();
      const insert = async (status, at = paidAt, owner = storeId, extra = {}) => {
        const orderId = await ctx.db.insert('orders', { storeId: owner, landingId: landing._id, attemptId: crypto.randomUUID(), status, currency: 'USD', total: 1900, items: [], ...extra });
        await ctx.db.insert('transactions', { orderId, status, amount: 1900, currency: 'USD', paidAt: at, deliveries: [] });
        return orderId;
      };
      const parentOrderId = await insert('paid');
      for (let i = 0; i < 104; i++) await insert('paid');
      await insert('paid', paidAt, storeId, { parentOrderId });
      for (const status of ['pending', 'failed', 'expired', 'refunded', 'needs_review']) await insert(status);
      await insert('paid', Date.parse('2025-12-31T12:00:00Z'));
      await insert('paid', Date.parse('2026-01-04T12:00:00Z'));
      await insert('paid', Date.now() + 60_000);
      await insert('paid', paidAt, otherStoreId);
      const noDate = await ctx.db.insert('orders', { storeId, landingId: landing._id, attemptId: 'no-payment-date', status: 'paid', currency: 'USD', total: 1900, items: [] });
      await ctx.db.insert('transactions', { orderId: noDate, status: 'paid', amount: 1900, currency: 'USD', deliveries: [] });
    });
    await new Promise(resolve => setTimeout(resolve, 5));
    const report = await admin.action(api.analytics.report, { storeId, from: '2026-01-01', to: '2026-01-03' });
    expect(report.total).toMatchObject({ views: 0, purchases: 106, checkoutPurchases: 105, revenue: { USD: 106 * 1900 } });
    expect(report.days.map(day => day.purchases)).toEqual([0, 106, 0]);
    expect((await import('../convex/analytics')).readPurchases.isInternal).toBe(true);
  });
});

describe('IP identity and daily timeline', () => {
  it('reads IP only from native request metadata', async () => {
    const { requestIp: nativeRequestIp } = await vi.importActual('../convex/lib/analytics_ip');
    const getRequestMetadata = vi.fn(async () => ({ ip: '192.0.2.1' }));
    expect(await nativeRequestIp({ meta: { getRequestMetadata } })).toBe('192.0.2.1');
    expect(getRequestMetadata).toHaveBeenCalledOnce();
  });
  it('normalizes IPv4/IPv6 and uses stable keyed hashes isolated by store', async () => {
    expect(normalizeIp('192.0.2.1')).toBe('192.0.2.1');
    expect(normalizeIp('2001:0DB8:0000:0000:0000:0000:0000:0001')).toBe('2001:db8::1');
    expect(normalizeIp('::ffff:192.0.2.1')).toBe('192.0.2.1');
    for (const ip of [null, '', 'bad', '999.1.1.1', '1.2.3.4, 1.2.3.5']) expect(normalizeIp(ip)).toBeNull();
    const hash = await hashIp('192.0.2.1', 'store-a', 'secret');
    expect(await hashIp('::ffff:c000:201', 'store-a', 'secret')).toBe(hash);
    expect(await hashIp('192.0.2.1', 'store-b', 'secret')).not.toBe(hash);
    expect(await hashIp('192.0.2.1', 'store-a', 'other-secret')).not.toBe(hash);
  });

  it('deduplicates across pages/days, includes empty days and separates missing IPs', () => {
    const report = createReport('2026-11-01', '2026-11-03');
    report.add([
      { _id: 'a', _creationTime: 1, day: '2026-11-01', page: 'landing', ipHash: 'same' },
      { _id: 'b', _creationTime: 2, day: '2026-11-01', page: 'checkout', ipHash: 'same' },
      { _id: 'c', _creationTime: 3, day: '2026-11-03', page: 'landing', ipHash: 'same' },
      { _id: 'd', _creationTime: 4, day: '2026-11-03', page: 'checkout', ipHash: 'other' },
      { _id: 'e', _creationTime: 5, day: '2026-11-03', page: 'checkout' },
    ]);
    expect(report.finish().total).toEqual({ views: 5, landingViews: 2, checkoutViews: 3, unknownIpViews: 1, purchases: 0, checkoutPurchases: 0, revenue: {}, uniques: 2, landingUniques: 1, checkoutUniques: 2 });
    expect(report.finish().days.map(day => day.uniques)).toEqual([1, 0, 2]);
  });

  it('respects business midnight, DST and calendar date bounds', () => {
    expect(dateKey(Date.parse('2026-11-01T08:59:59Z'), 'America/Adak')).toBe('2026-10-31');
    expect(dateKey(Date.parse('2026-11-01T09:00:00Z'), 'America/Adak')).toBe('2026-11-01');
    expect(startOfDate('2026-11-02', 'America/Adak') - startOfDate('2026-11-01', 'America/Adak')).toBe(25 * 3_600_000);
    expect(startOfDate('2026-11-02', business.timeZone)).toBe(Date.parse('2026-11-01T17:00:00Z'));
    expect(shiftDate('2026-11-01', 1)).toBe('2026-11-02');
    expect(validRange('2024-02-29', '2024-03-01')).toBe(true);
    expect(validRange('2026-02-29', '2026-03-01')).toBe(false);
    expect(validRange('2026-03-02', '2026-03-01')).toBe(false);
  });
});
