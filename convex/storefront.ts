import { forStore, publicStore, checkoutRecord, purchaseContent } from './lib/landing_records';
import { v } from 'convex/values';
import { mutation, query, type QueryCtx } from './lib/functions';
import { buildLandingView, buildPostPurchaseView } from './lib/landing_view';

// Public functions: no session required, so they only return what a visitor may see.

export const getLanding = query({
  args: { subdomain: v.string() },
  handler: async (ctx, { subdomain }) => {
    const store = await publicStore(ctx, subdomain);
    if (!store || store.status !== 'active') return null;
    const landing = await forStore(ctx, store._id);
    if (!landing?.published) return null;
    return await buildLandingView(ctx, store, landing, landing.published);
  },
});

// A visitor counts as present while their checkout tab reported in during this window.
const PRESENCE_WINDOW_MS = 45_000;
const PRESENCE_KEEP_MS = 600_000;
const PRESENCE_LIMIT = 200;

async function liveStore(ctx: QueryCtx, subdomain: string) {
  const store = (await checkoutRecord(ctx, subdomain))?.store;
  return store && store.status === 'active' && store.checkout?.liveVisitors ? store : null;
}

// Called by each open checkout tab every few seconds. The count below is these reports
// and nothing else: there is no base number, multiplier or minimum.
export const heartbeat = mutation({
  args: { subdomain: v.string(), sessionId: v.string() },
  handler: async (ctx, { subdomain, sessionId }) => {
    if (!/^[A-Za-z0-9-]{16,64}$/.test(sessionId)) return null;
    const store = await liveStore(ctx, subdomain);
    if (!store) return null;
    const now = Date.now();
    const stale = await ctx.db.query('checkoutPresence').withIndex('by_store_seen', q => q.eq('storeId', store._id).lt('seenAt', now - PRESENCE_KEEP_MS)).take(20);
    for (const row of stale) await ctx.db.delete(row._id);
    const row = await ctx.db.query('checkoutPresence').withIndex('by_store_session', q => q.eq('storeId', store._id).eq('sessionId', sessionId)).first();
    if (row) await ctx.db.patch(row._id, { seenAt: now });
    else {
      const present = await ctx.db.query('checkoutPresence').withIndex('by_store_seen', q => q.eq('storeId', store._id).gt('seenAt', now - PRESENCE_WINDOW_MS)).take(PRESENCE_LIMIT);
      if (present.length < PRESENCE_LIMIT) await ctx.db.insert('checkoutPresence', { storeId: store._id, sessionId, seenAt: now });
    }
    return null;
  },
});

// It re-runs whenever a tab reports in, which the asking tab itself does while it is open.
export const checkoutVisitors = query({
  args: { subdomain: v.string() },
  handler: async (ctx, { subdomain }) => {
    const store = await liveStore(ctx, subdomain);
    if (!store) return 0;
    const cutoff = Date.now() - PRESENCE_WINDOW_MS;
    return (await ctx.db.query('checkoutPresence').withIndex('by_store_seen', q => q.eq('storeId', store._id).gt('seenAt', cutoff)).take(PRESENCE_LIMIT)).length;
  },
});

// The Stripe session id from the return URL is the only key to this screen. Links are
// returned only while the server has the payment confirmed.
export const getDelivery = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    if (!sessionId.startsWith('cs_')) return null;
    const transaction = await ctx.db.query('transactions').withIndex('by_session', q => q.eq('stripeCheckoutSessionId', sessionId)).first();
    const order = transaction && await ctx.db.get(transaction.orderId);
    if (!transaction || !order) return null;
    const store = await ctx.db.get(order.storeId);
    const landing = await ctx.db.get(order.landingId);
    const paid = transaction.status === 'paid';
    // Same published palette and brand as the landing, so the thank-you page matches it.
    const content = store ? await purchaseContent(ctx, store) : null;

    let deliveries = paid ? transaction.deliveries : [];
    if (paid && order.parentOrderId) {
      const parentId = order.parentOrderId;
      const parent = await ctx.db.query('transactions').withIndex('by_order', q => q.eq('orderId', parentId)).first();
      if (parent?.status === 'paid') deliveries = [...parent.deliveries, ...deliveries];
    }

    let postPurchaseOffer = null;
    if (paid && !order.parentOrderId && store?.status === 'active' && store.postPurchase.enabled && store.postPurchase.productId) {
      const children = await ctx.db.query('orders').withIndex('by_parent', q => q.eq('parentOrderId', order._id)).collect();
      if (!children.some(child => child.status === 'paid' || child.status === 'refunded')) {
        postPurchaseOffer = await buildPostPurchaseView(ctx, store, content ?? undefined);
      }
    }

    return {
      status: transaction.status,
      emailed: paid && (transaction.email?.status === 'pending' || transaction.email?.status === 'sent'),
      isPostPurchase: Boolean(order.parentOrderId),
      storeName: store?.name ?? '',
      subdomain: landing?.subdomain ?? '',
      metaPixelId: store?.tracking.metaPixelId ?? '',
      currency: order.currency,
      total: order.total,
      items: order.items.map(item => ({ name: item.name, role: item.role, price: item.price })),
      deliveries,
      postPurchaseOffer,
      presentation: {
        postLabels: content?.postLabels ?? {},
        accentColor: content?.style?.accentColor ?? '',
        brandName: content?.footer?.brandName ?? '',
        termsUrl: content?.footer?.termsUrl ?? '',
        privacyUrl: content?.footer?.privacyUrl ?? '',
      },
    };
  },
});

export const getCheckout = query({args:{subdomain:v.string()},handler:async(ctx,{subdomain})=>{
 const record=await checkoutRecord(ctx,subdomain); if(!record)return null;
 return buildLandingView(ctx,record.store,record.landing,await purchaseContent(ctx,record.store));
}});
