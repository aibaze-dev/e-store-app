import { query } from './lib/functions';
import { v } from 'convex/values';
import { requireAdmin } from './lib/permissions';

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
        deliveries: transaction?.deliveries ?? [],
        charged: transaction?.charged ?? null,
        reviewReason: transaction?.reviewReason ?? null,
        email: transaction?.email ? { status: transaction.email.status, error: transaction.email.error ?? '' } : null,
      };
    }));
  },
});
