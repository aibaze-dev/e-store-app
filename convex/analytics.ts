import { checkoutRecord, forStore } from './lib/landing_records';
import { ConvexError, v } from 'convex/values';
import { makeFunctionReference, paginationOptsValidator } from 'convex/server';
import { action, internalQuery, mutation, query } from './lib/functions';
import { requireAdmin } from './lib/permissions';
import { hashIp, requestIp } from './lib/analytics_ip';
import { createIntervalReport, createReport, dateKey, shiftDate, startOfDate, validRange, PRESENCE_WINDOW_MS } from '../shared/analytics';
import business from '../src/config/businessData.json';
import { cleanAttribution } from '../shared/attribution.js';
import { attribution as attributionArg } from './schema';

export const recordView = mutation({
  args: { subdomain: v.string(), page: v.union(v.literal('landing'), v.literal('checkout')), eventId: v.string(), origin:v.optional(v.union(v.literal('classic'),v.literal('quiz'),v.literal('direct'))), attribution: v.optional(attributionArg) },
  handler: async (ctx, { subdomain, page, eventId, origin, attribution }) => {
    if (!/^[a-z0-9-]{1,63}$/.test(subdomain) || !/^[a-zA-Z0-9-]{16,64}$/.test(eventId)) return null;
    const store=(await checkoutRecord(ctx,subdomain))?.store;
    if(!store)return null;
    if(page==='landing'){const landing=await forStore(ctx,store._id,origin==='quiz'?'quiz':'classic');if(!landing || !(landing.published || landing.publicationId))return null;}
    const exists = await ctx.db.query('pageViews').withIndex('by_store_event', q => q.eq('storeId', store._id).eq('eventId', eventId)).first();
    if (exists) return { status: 'duplicate' as const, day: exists.day };
    // A separate key is optional; the existing server secret is domain-separated above.
    const secret = process.env.ANALYTICS_IP_SECRET || process.env.BETTER_AUTH_SECRET;
    if (!secret) throw new ConvexError('La medición de visitas no está configurada.');
    const ipHash = await hashIp(await requestIp(ctx), store._id, secret);
    const now = Date.now();
    // Bound accidental loops/abuse without a second table. Missing IPs share a bucket.
    const recent = await ctx.db.query('pageViews').withIndex('by_store_ip', q => q.eq('storeId', store._id).eq('ipHash', ipHash).gte('_creationTime', now - 60_000)).take(120);
    if (recent.length >= 120) return null;
    const day = dateKey(now, business.timeZone);
    const campaign = cleanAttribution(attribution);
    await ctx.db.insert('pageViews', { storeId: store._id, page, day, ipHash, eventId, origin:origin ?? (page==='landing'?'classic':'direct'), ...(campaign ? { attribution: campaign } : {}) });
    return { status: 'recorded' as const, day };
  },
});

// A new sample key also refreshes the query after all visitors stop sending heartbeats.
export const liveSessions = query({
  args: { storeId: v.id('stores'), sample: v.number() },
  handler: async (ctx, { storeId }) => {
    await requireAdmin(ctx);
    const cutoff = Date.now() - PRESENCE_WINDOW_MS;
    const active = await ctx.db.query('checkoutPresence')
      .withIndex('by_store_seen', q => q.eq('storeId', storeId).gt('seenAt', cutoff)).collect();
    const counts = { total: active.length, landing: 0, checkout: 0, offer: 0, thanks: 0 };
    for (const row of active) counts[row.page ?? 'checkout']++;
    return counts;
  },
});

// Small reads avoid Convex's per-query read limit. Only aggregates leave the action.
export const readPage = internalQuery({
  args: { storeId: v.id('stores'), from: v.string(), to: v.string(), before: v.number(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { storeId, from, to, before, paginationOpts }) => {
    await requireAdmin(ctx);
    if (!await ctx.db.get(storeId)) throw new ConvexError('La tienda ya no está disponible.');
    const result = await ctx.db.query('pageViews').withIndex('by_store_day', q => q.eq('storeId', storeId).gte('day', from).lte('day', to)).paginate(paginationOpts);
    return { ...result, page: result.page.filter(row => row._creationTime < before) };
  },
});

// Scan each store's orders in bounded pages: a payment may settle long after
// the order was created.
export const readPurchases = internalQuery({
  args: { storeId: v.id('stores'), from: v.string(), to: v.string(), before: v.number(), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { storeId, from, to, before, paginationOpts }) => {
    await requireAdmin(ctx);
    if (!await ctx.db.get(storeId)) throw new ConvexError('La tienda ya no está disponible.');
    const result = await ctx.db.query('orders').withIndex('by_store', q => q.eq('storeId', storeId).lt('_creationTime', before)).paginate(paginationOpts);
    const dates = await Promise.all(result.page.map(async order => {
      if (order.status !== 'paid') return null;
      const transaction = await ctx.db.query('transactions').withIndex('by_order', q => q.eq('orderId', order._id)).first();
      if (transaction?.status !== 'paid' || transaction.paidAt === undefined || transaction.paidAt >= before) return null;
      const day = dateKey(transaction.paidAt, business.timeZone);
      return day >= from && day <= to ? { day, amount: transaction.amount, currency: transaction.currency, postPurchase: Boolean(order.parentOrderId), attribution: order.attribution } : null;
    }));
    return { ...result, page: dates.filter(row => row !== null) };
  },
});

export const report = action({
  args: { storeId: v.id('stores'), from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (!validRange(args.from, args.to)) throw new ConvexError('Elegí un rango válido de hasta 366 días.');
    const before = Date.now();
    const report = createReport(args.from, args.to);
    let cursor: string | null = null;
    for (;;) {
      const result = await ctx.runQuery(makeFunctionReference<'query'>('analytics:readPage'), { ...args, before, paginationOpts: { cursor, numItems: 1000 } });
      report.add(result.page);
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    cursor = null;
    for (;;) {
      const result = await ctx.runQuery(makeFunctionReference<'query'>('analytics:readPurchases'), { ...args, before, paginationOpts: { cursor, numItems: 100 } });
      report.addPurchases(result.page);
      if (result.isDone) break;
      cursor = result.continueCursor;
    }
    return { ...report.finish(), timeZone: business.timeZone, asOf: before };
  },
});

// Use payment time even for orders opened before the window. The time index
// also covers existing transactions that predate this dashboard.
export const readActivityTimes = internalQuery({
  args: {
    storeId: v.id('stores'), start: v.number(), end: v.number(),
    series: v.union(v.literal('visits'), v.literal('purchases')), paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { storeId, start, end, series, paginationOpts }) => {
    await requireAdmin(ctx);
    if (series === 'visits') {
      const result = await ctx.db.query('pageViews')
        .withIndex('by_store', q => q.eq('storeId', storeId).gte('_creationTime', start).lt('_creationTime', end))
        .paginate(paginationOpts);
      return { ...result, page: result.page };
    }
    const result = await ctx.db.query('transactions')
      .withIndex('by_status_paid_at', q => q.eq('status', 'paid').gte('paidAt', start).lt('paidAt', end))
      .paginate(paginationOpts);
    const times = await Promise.all(result.page.map(async row => {
      const order = await ctx.db.get(row.orderId);
      return order?.storeId === storeId && order.status === 'paid'
        ? { at: row.paidAt, amount: row.amount, currency: row.currency, postPurchase: Boolean(order.parentOrderId), attribution: order.attribution } : null;
    }));
    return { ...result, page: times.filter(row => row !== null) };
  },
});

export const rollingActivity = action({
  args: { storeId: v.id('stores'), day: v.optional(v.string()) },
  handler: async (ctx, { storeId, day }) => {
    await requireAdmin(ctx);
    if (day !== undefined && !validRange(day, day)) throw new ConvexError('Elegí una fecha válida.');
    const asOf = Date.now();
    const hour = 3_600_000;
    const start = day ? startOfDate(day, business.timeZone) : asOf - 12 * hour;
    const end = day ? Math.min(asOf, startOfDate(shiftDate(day, 1), business.timeZone)) : asOf;
    const starts = Array.from({ length: Math.max(0, Math.ceil((end - start) / hour)) }, (_, i) => start + i * hour);
    const hourStart = (at: number) => start + Math.floor((at - start) / hour) * hour;
    const report = createIntervalReport(starts,
      (view: { _creationTime: number }) => hourStart(view._creationTime),
      (payment: { at: number }) => hourStart(payment.at),
    );
    const read = makeFunctionReference<'query'>('analytics:readActivityTimes');
    for (const series of ['visits', 'purchases'] as const) {
      if (!starts.length) break;
      let cursor: string | null = null;
      for (;;) {
        const result = await ctx.runQuery(read, { storeId, start, end, series, paginationOpts: { cursor, numItems: 250 } });
        if (series === 'visits') report.add(result.page);
        else report.addPurchases(result.page);
        if (result.isDone) break;
        cursor = result.continueCursor;
      }
    }
    const { total, buckets, sources } = report.finish();
    const hours = buckets.map(({ key, ...counts }) => ({ ...counts, start: key, end: Math.min(end, key + hour), visits: counts.views }));
    return { asOf, hours, total, sources, day: day ?? null };
  },
});
