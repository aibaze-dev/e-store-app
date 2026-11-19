import { checkoutRecord, forStore } from './lib/landing_records';
import { ConvexError, v } from 'convex/values';
import { makeFunctionReference, paginationOptsValidator } from 'convex/server';
import { action, internalQuery, mutation, query } from './lib/functions';
import { requireAdmin } from './lib/permissions';
import { hashIp, requestIp } from './lib/analytics_ip';
import { createReport, dateKey, validRange, PRESENCE_WINDOW_MS } from '../shared/analytics';
import business from '../src/config/businessData.json';

export const recordView = mutation({
  args: { subdomain: v.string(), page: v.union(v.literal('landing'), v.literal('checkout')), eventId: v.string(), origin:v.optional(v.union(v.literal('classic'),v.literal('quiz'),v.literal('direct'))) },
  handler: async (ctx, { subdomain, page, eventId, origin }) => {
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
    await ctx.db.insert('pageViews', { storeId: store._id, page, day, ipHash, eventId, origin:origin ?? (page==='landing'?'classic':'direct') });
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
    const landing = active.filter(row => row.page === 'landing').length;
    return { total: active.length, landing, checkout: active.length - landing };
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
// the order was created. Only payment dates leave this private query.
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
      return day >= from && day <= to ? { day } : null;
    }));
    return { ...result, page: dates.filter((row): row is { day: string } => row !== null) };
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
      return { ...result, page: result.page.map(row => row._creationTime) };
    }
    const result = await ctx.db.query('transactions')
      .withIndex('by_status_paid_at', q => q.eq('status', 'paid').gte('paidAt', start).lt('paidAt', end))
      .paginate(paginationOpts);
    const times = await Promise.all(result.page.map(async row => {
      const order = await ctx.db.get(row.orderId);
      return order?.storeId === storeId && order.status === 'paid' ? row.paidAt : undefined;
    }));
    return { ...result, page: times.filter((at): at is number => at !== undefined) };
  },
});

export const rollingActivity = action({
  args: { storeId: v.id('stores') },
  handler: async (ctx, { storeId }) => {
    await requireAdmin(ctx);
    const end = Date.now();
    const hour = 3_600_000;
    const start = end - 12 * hour;
    const hours = Array.from({ length: 12 }, (_, i) => ({
      start: start + i * hour, end: start + (i + 1) * hour, visits: 0, purchases: 0,
    }));
    const read = makeFunctionReference<'query'>('analytics:readActivityTimes');
    for (const series of ['visits', 'purchases'] as const) {
      let cursor: string | null = null;
      for (;;) {
        const result = await ctx.runQuery(read, { storeId, start, end, series, paginationOpts: { cursor, numItems: 250 } });
        for (const at of result.page) hours[Math.floor((at - start) / hour)][series]++;
        if (result.isDone) break;
        cursor = result.continueCursor;
      }
    }
    return { asOf: end, hours };
  },
});
