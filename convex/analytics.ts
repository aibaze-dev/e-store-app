import { ConvexError, v } from 'convex/values';
import { makeFunctionReference, paginationOptsValidator } from 'convex/server';
import { action, internalQuery, mutation } from './lib/functions';
import { requireAdmin } from './lib/permissions';
import { hashIp, requestIp } from './lib/analytics_ip';
import { createReport, dateKey, validRange } from '../shared/analytics';
import business from '../src/config/businessData.json';

export const recordView = mutation({
  args: { subdomain: v.string(), page: v.union(v.literal('landing'), v.literal('checkout')), eventId: v.string() },
  handler: async (ctx, { subdomain, page, eventId }) => {
    if (!/^[a-z0-9-]{1,63}$/.test(subdomain) || !/^[a-zA-Z0-9-]{16,64}$/.test(eventId)) return null;
    const landing = await ctx.db.query('landings').withIndex('by_subdomain', q => q.eq('subdomain', subdomain)).first();
    const store = landing?.published ? await ctx.db.get(landing.storeId) : null;
    if (!store || store.status !== 'active') return null;
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
    await ctx.db.insert('pageViews', { storeId: store._id, page, day, ipHash, eventId });
    return { status: 'recorded' as const, day };
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
    return { ...report.finish(), timeZone: business.timeZone, asOf: before };
  },
});
