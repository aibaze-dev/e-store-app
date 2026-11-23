import { internalMutation, internalQuery, query } from './lib/functions';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { requireAdmin } from './lib/permissions';
import { liveDeliveries } from './lib/deliveries';
import { buyerFields, emailKey } from './lib/buyer_email';

// Whether the store has a paid order whose buyer email matches (ignoring case and spaces).
// Only a yes/no leaves: no order, product or buyer data. Called by the HTTP route, which
// authenticates the caller; an unknown or malformed store id is simply "no".
export const hasPaidOrder = internalQuery({
  args: { storeId: v.string(), email: v.string() },
  handler: async (ctx, { storeId, email }): Promise<boolean> => {
    const id = ctx.db.normalizeId('stores', storeId);
    const key = emailKey(email);
    if (!id || !key) return false;
    const order = await ctx.db.query('orders')
      .withIndex('by_store_status_email', q => q.eq('storeId', id).eq('status', 'paid').eq('buyerEmailKey', key))
      .first();
    return order !== null;
  },
});

// One-off: orders saved before `buyerEmailKey` existed. Run until `done`:
//   npx convex run orders:backfillBuyerEmailKey
export const backfillBuyerEmailKey = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, { cursor }): Promise<{ done: boolean; updated: number }> => {
    const page = await ctx.db.query('orders').paginate({ cursor: cursor ?? null, numItems: 200 });
    let updated = 0;
    for (const order of page.page) {
      if (!order.buyer || order.buyerEmailKey === emailKey(order.buyer.email)) continue;
      await ctx.db.patch(order._id, buyerFields(order.buyer));
      updated += 1;
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.orders.backfillBuyerEmailKey, { cursor: page.continueCursor });
    return { done: page.isDone, updated };
  },
});

// "Cobros y entregas" in the panel: the latest orders with their charge and links.
export const list = query({
  args: { storeId: v.optional(v.id('stores')) },
  handler: async (ctx, { storeId }) => {
    await requireAdmin(ctx);
    const orders = await (storeId
      ? ctx.db.query('orders').withIndex('by_store', q => q.eq('storeId', storeId))
      : ctx.db.query('orders')).order('desc').take(100);
    return await Promise.all(orders.map(async order => {
      const store = await ctx.db.get(order.storeId);
      const transaction = await ctx.db.query('transactions').withIndex('by_order', q => q.eq('orderId', order._id)).first();
      return {
        _id: order._id,
        storeId: order.storeId,
        createdAt: order._creationTime,
        storeName: store?.name ?? '',
        isPostPurchase: Boolean(order.parentOrderId),
        downsell: Boolean(order.downsell),
        finalDownsell: Boolean(order.finalDownsell),
        buyer: order.buyer ?? null,
        attribution: order.attribution ?? null,
        status: order.status,
        currency: order.currency,
        total: order.total,
        items: order.items.map(item => ({ name: item.name, role: item.role, price: item.price })),
        paidAt: transaction?.paidAt ?? null,
        stripePaymentIntentId: transaction?.stripePaymentIntentId ?? '',
        deliveries: await liveDeliveries(ctx, order, transaction?.deliveries ?? []),
        charged: transaction?.charged ?? null,
        reviewReason: transaction?.reviewReason ?? null,
        email: transaction?.email ? { status: transaction.email.status, error: transaction.email.error ?? '' } : null,
      };
    }));
  },
});
