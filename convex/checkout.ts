import { checkoutRecord, forStore } from './lib/landing_records';
import { authorizedSession } from './quizzes';
import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { action, internalMutation, type Doc, type Id, type MutationCtx } from './lib/functions';
import { buildDownsellOrder, buildInitialOrder, buildPostPurchaseOrder } from './lib/pricing';
import { createEmbeddedCheckoutSession, type LineItem } from './lib/stripe';
import { fail } from './lib/validation';

const via = v.union(v.literal('subdomain'), v.literal('path'));
const attemptId = v.string();
// Asks for the store's downsell price. The discount itself always comes from the store.
const downsell = v.optional(v.boolean());
const origin = v.optional(v.union(v.literal('classic'),v.literal('quiz'),v.literal('direct')));
const quizToken = v.optional(v.string());

type OpenOrder = { orderId: Id<'orders'>; transactionId: Id<'transactions'>; currency: string; subdomain: string; lineItems: LineItem[] };
type Snapshot = ReturnType<typeof buildInitialOrder>;

const lineItems = (items: { name: string; price: number }[]) =>
  items.filter(item => item.price > 0).map(item => ({ name: item.name, amount: item.price }));

async function loadProducts(ctx: MutationCtx, ids: Id<'products'>[]) {
  const products = new Map<string, Doc<'products'>>();
  for (const id of ids) {
    const product = await ctx.db.get(id);
    if (product) products.set(id, product);
  }
  return products;
}

// Creates the order and its pending transaction once per attempt. A retry of the same
// attempt returns the order already created, so it can never produce a second one.
async function openOrder(ctx: MutationCtx, input: {
  store: Doc<'stores'>; landing: Doc<'landings'>; attemptId: string; parentOrderId?: Id<'orders'>; downsell?: boolean; origin?: 'classic'|'quiz'|'direct'; quizSessionId?: Id<'quizSessions'>; build: () => Promise<Snapshot>;
}): Promise<OpenOrder> {
  if (!/^[A-Za-z0-9-]{16,64}$/.test(input.attemptId)) fail('No se pudo iniciar el pago. Recargá la página e intentá de nuevo.');
  const existing = await ctx.db.query('orders').withIndex('by_attempt', q => q.eq('attemptId', input.attemptId)).first();
  if (existing) {
    const transaction = await ctx.db.query('transactions').withIndex('by_order', q => q.eq('orderId', existing._id)).first();
    if (!transaction || existing.status !== 'pending' || existing.storeId !== input.store._id || existing.parentOrderId !== input.parentOrderId || existing.quizSessionId !== input.quizSessionId || (existing.origin ?? 'direct') !== (input.origin ?? 'direct')) {
      fail('Esta compra ya fue procesada. Recargá la página para empezar otra.');
    }
    return { orderId: existing._id, transactionId: transaction._id, currency: existing.currency, subdomain: input.landing.subdomain, lineItems: lineItems(existing.items) };
  }

  const snapshot = await input.build();
  const orderId = await ctx.db.insert('orders', {
    storeId: input.store._id,
    landingId: input.landing._id,
    parentOrderId: input.parentOrderId,
    attemptId: input.attemptId,
    origin: input.origin ?? 'direct',
    quizSessionId: input.quizSessionId,
    ...(input.downsell ? { downsell: true } : {}),
    status: 'pending',
    currency: input.store.currency,
    total: snapshot.total,
    items: snapshot.items,
  });
  const transactionId = await ctx.db.insert('transactions', {
    orderId,
    status: 'pending',
    amount: snapshot.total,
    currency: input.store.currency,
    deliveries: snapshot.deliveries,
  });
  return { orderId, transactionId, currency: input.store.currency, subdomain: input.landing.subdomain, lineItems: lineItems(snapshot.items) };
}

export const createOrder = internalMutation({
  args: { subdomain: v.string(), upsellProductIds: v.array(v.id('products')), attemptId, downsell, origin, quizToken },
  handler: async (ctx, args): Promise<OpenOrder> => {
    if (args.downsell && args.upsellProductIds.length > 0) fail('La oferta con descuento no incluye extras.');
    const record = await checkoutRecord(ctx,args.subdomain);
    if(!record) fail('Esta oferta no está disponible.');
    const {store}=record; let landing=record.landing;
    const session=args.quizToken ? await authorizedSession(ctx,args.quizToken) : null;
    if(args.origin==='quiz' && (!session || session.storeId!==store._id || !session.completedAt))fail('Completá el quiz antes de iniciar esta compra.');
    if(session && args.origin!=='quiz')fail('Origen de compra inválido.');
    if(args.origin==='classic') {const classic=await forStore(ctx,store._id);if(!classic?.published)fail('Landing no publicada.');landing=classic;}
    if(session) {landing=(await ctx.db.get(session.landingId))!;await ctx.db.patch(session._id,{checkoutAt:session.checkoutAt ?? Date.now()});}
    return await openOrder(ctx, {
      store, landing, attemptId: args.attemptId, downsell: args.downsell, origin:args.origin ?? 'direct', quizSessionId:session?._id,
      build: async () => {
        const products = await loadProducts(ctx, [
          store.offer.mainProductId,
          ...store.offer.bonuses.map(bonus => bonus.productId),
          ...store.offer.upsells.map(upsell => upsell.productId),
        ]);
        return args.downsell ? buildDownsellOrder(store, products) : buildInitialOrder(store, products, args.upsellProductIds);
      },
    });
  },
});

export const createPostPurchaseOrder = internalMutation({
  args: { parentSessionId: v.string(), attemptId, downsell },
  handler: async (ctx, args): Promise<OpenOrder> => {
    const parentTransaction = await ctx.db.query('transactions')
      .withIndex('by_session', q => q.eq('stripeCheckoutSessionId', args.parentSessionId)).first();
    const parent = parentTransaction && await ctx.db.get(parentTransaction.orderId);
    if (!parentTransaction || !parent || parentTransaction.status !== 'paid' || parent.parentOrderId) fail('Esta oferta ya no está disponible.');
    const store = await ctx.db.get(parent.storeId);
    const landing = await ctx.db.get(parent.landingId);
    if (!store || !landing || store.status !== 'active') fail('Esta oferta ya no está disponible.');
    const children = await ctx.db.query('orders').withIndex('by_parent', q => q.eq('parentOrderId', parent._id)).collect();
    if (children.some(child => child.status === 'paid' || child.status === 'refunded')) fail('Ya compraste esta oferta.');
    return await openOrder(ctx, {
      store, landing, attemptId: args.attemptId, parentOrderId: parent._id, downsell: args.downsell, origin:parent.origin, quizSessionId:parent.quizSessionId,
      build: async () => buildPostPurchaseOrder(store, await loadProducts(ctx, store.postPurchase.productId ? [store.postPurchase.productId] : []), args.downsell),
    });
  },
});

export const attachSession = internalMutation({
  args: { transactionId: v.id('transactions'), sessionId: v.string() },
  handler: async (ctx, { transactionId, sessionId }) => {
    const transaction = await ctx.db.get(transactionId);
    if (transaction && transaction.stripeCheckoutSessionId !== sessionId) {
      await ctx.db.patch(transactionId, { stripeCheckoutSessionId: sessionId });
    }
  },
});

function stripeSettings() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.SITE_URL;
  if (!secretKey || !siteUrl) throw new ConvexError('Los pagos todavía no están habilitados en este sitio.');
  return { secretKey, site: new URL(siteUrl) };
}

async function openSession(ctx: { runMutation: (ref: any, args: any) => Promise<any> }, order: OpenOrder, route: 'subdomain' | 'path', elements = false) {
  const { secretKey, site } = stripeSettings();
  // The return address is built on the server from SITE_URL, never from a browser value.
  const base = route === 'subdomain' ? `${site.protocol}//${order.subdomain}.${site.host}` : `${site.origin}/l/${order.subdomain}`;
  const session = await createEmbeddedCheckoutSession(secretKey, {
    elements,
    orderId: order.orderId,
    currency: order.currency,
    lineItems: order.lineItems,
    returnUrl: `${base}/gracias?session_id={CHECKOUT_SESSION_ID}`,
  });
  if (!session) throw new ConvexError('No se pudo iniciar el pago. Volvé a intentar en unos minutos.');
  await ctx.runMutation(internal.checkout.attachSession, { transactionId: order.transactionId, sessionId: session.id });
  return { clientSecret: session.clientSecret };
}

export const start = action({
  args: { subdomain: v.string(), upsellProductIds: v.array(v.id('products')), attemptId, via, downsell, origin, quizToken, elements: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<{ clientSecret: string }> => {
    stripeSettings();
    const order: OpenOrder = await ctx.runMutation(internal.checkout.createOrder, {
      subdomain: args.subdomain, upsellProductIds: args.upsellProductIds, attemptId: args.attemptId, downsell: args.downsell, origin:args.origin, quizToken:args.quizToken,
    });
    return await openSession(ctx, order, args.via, args.elements);
  },
});

export const startPostPurchase = action({
  args: { parentSessionId: v.string(), attemptId, via, downsell },
  handler: async (ctx, args): Promise<{ clientSecret: string }> => {
    stripeSettings();
    const order: OpenOrder = await ctx.runMutation(internal.checkout.createPostPurchaseOrder, {
      parentSessionId: args.parentSessionId, attemptId: args.attemptId, downsell: args.downsell,
    });
    return await openSession(ctx, order, args.via);
  },
});

async function setStatus(ctx: MutationCtx, transaction: Doc<'transactions'>, status: Doc<'transactions'>['status'], extra: Partial<Doc<'transactions'>> = {}) {
  await ctx.db.patch(transaction._id, { status, ...extra });
  await ctx.db.patch(transaction.orderId, { status });
}

// Applies a verified Stripe event exactly once. Receiving an event is not proof of a new
// charge: the transaction only moves forward from the state it is actually in.
export const handleStripeEvent = internalMutation({
  args: {
    eventId: v.string(),
    type: v.string(),
    sessionId: v.optional(v.string()),
    orderId: v.optional(v.string()),
    paymentStatus: v.optional(v.string()),
    paymentIntentId: v.optional(v.string()),
    amountTotal: v.optional(v.number()),
    currency: v.optional(v.string()),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    refunded: v.optional(v.boolean()),
  },
  handler: async (ctx, event): Promise<'duplicate' | 'processed' | 'ignored' | 'rejected'> => {
    const seen = await ctx.db.query('webhookEvents').withIndex('by_event', q => q.eq('stripeEventId', event.eventId)).first();
    if (seen) return 'duplicate';

    let outcome: 'processed' | 'ignored' | 'rejected' = 'ignored';
    if (event.type.startsWith('checkout.session.') && event.sessionId) {
      let transaction = await ctx.db.query('transactions')
        .withIndex('by_session', q => q.eq('stripeCheckoutSessionId', event.sessionId)).first();
      if (!transaction && event.orderId) {
        const orderId = ctx.db.normalizeId('orders', event.orderId);
        transaction = orderId && await ctx.db.query('transactions').withIndex('by_order', q => q.eq('orderId', orderId)).first();
      }
      const paidEvent = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
      if (transaction && paidEvent && event.paymentStatus === 'paid' && transaction.status === 'pending') {
        if (event.amountTotal !== transaction.amount || event.currency?.toUpperCase() !== transaction.currency) {
          console.error('Stripe amount does not match the order', event.eventId);
          outcome = 'rejected';
        } else {
          await setStatus(ctx, transaction, 'paid', {
            stripeCheckoutSessionId: event.sessionId,
            stripePaymentIntentId: event.paymentIntentId,
            paidAt: Date.now(),
          });
          await ctx.db.patch(transaction.orderId, { buyer: { email: event.email ?? '', name: event.name ?? '' } });
          outcome = 'processed';
        }
      } else if (transaction && event.type === 'checkout.session.expired' && transaction.status === 'pending') {
        await setStatus(ctx, transaction, 'expired');
        outcome = 'processed';
      }
    } else if (event.type === 'charge.refunded' && event.refunded && event.paymentIntentId) {
      const transaction = await ctx.db.query('transactions')
        .withIndex('by_payment_intent', q => q.eq('stripePaymentIntentId', event.paymentIntentId)).first();
      if (transaction && transaction.status === 'paid') {
        await setStatus(ctx, transaction, 'refunded');
        outcome = 'processed';
      }
    }

    await ctx.db.insert('webhookEvents', { stripeEventId: event.eventId, type: event.type, status: outcome });
    return outcome;
  },
});
