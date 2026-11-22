import { checkoutRecord, forStore, purchaseContent } from './lib/landing_records';
import { authorizedSession } from './quizzes';
import { ConvexError, v } from 'convex/values';
import { internal } from './_generated/api';
import { action, internalMutation, mutation, query, type Doc, type Id, type MutationCtx } from './lib/functions';
import { buildDownsellOrder, buildInitialOrder, buildPostPurchaseOrder } from './lib/pricing';
import { createEmbeddedCheckoutSession, type LineItem } from './lib/stripe';
import { queueEmail } from './emails';
import { queueSaleAlert } from './discord';
import { fail } from './lib/validation';
import { clientIp } from './lib/request_ip';
import { normalizeIp } from './lib/analytics_ip';
import { attributionMetadata, cleanAttribution } from '../shared/attribution.js';
import { attribution as attributionArg } from './schema';
import { sessionExpiresAt } from '../shared/checkout-session.js';

const via = v.union(v.literal('subdomain'), v.literal('path'));
const attemptId = v.string();
// Asks for the store's downsell price. The discount itself always comes from the store.
const downsell = v.optional(v.boolean());
// Post-purchase only: the last discount, offered after the downsell. Sent together with `downsell`.
const finalDownsell = v.optional(v.boolean());
const origin = v.optional(v.union(v.literal('classic'),v.literal('quiz'),v.literal('direct')));
const quizToken = v.optional(v.string());
// Address of the browser, read by the action from Convex's own request metadata (never from
// the browser's arguments) and handed to the internal mutation.
const ip = v.optional(v.string());
// Set by the browser when the previous call for this attempt failed.
const retry = v.optional(v.boolean());
// Campaign of the ad link, as the browser remembers it. Cleaned again before it is stored.
const attribution = v.optional(attributionArg);

type OpenOrder = { paymentLocale: NonNullable<Doc<'transactions'>['paymentLocale']>; orderId: Id<'orders'>; transactionId: Id<'transactions'>; currency: string; subdomain: string; lineItems: LineItem[]; idempotencyKey: string; expiresAt: number; customerEmail?: string; attribution?: Doc<'orders'>['attribution'] };
type StartedSession = { clientSecret: string; sessionId: string; expiresAt: number };
type Snapshot = ReturnType<typeof buildInitialOrder>;

const lineItems = (items: { name: string; price: number }[]) =>
  items.filter(item => item.price > 0).map(item => ({ name: item.name, amount: item.price }));

// Stripe replays the saved result of an idempotency key, 500 errors included, so retrying
// with the same key can fail forever. A retry gets a new key only while no session was ever
// attached: a session Stripe created but never returned to a browser cannot be paid.
// The session expiry is saved with each key: Stripe rejects a key replayed with other parameters.
async function idempotencyKey(ctx: MutationCtx, transaction: Doc<'transactions'>, retry?: boolean) {
  let attempt = transaction.sessionAttempt ?? 0;
  let expiresAt = transaction.stripeSessionExpiresAt;
  if ((retry && !transaction.stripeCheckoutSessionId) || expiresAt === undefined) {
    if (retry && !transaction.stripeCheckoutSessionId) attempt += 1;
    expiresAt = sessionExpiresAt() * 1000;
    await ctx.db.patch(transaction._id, { sessionAttempt: attempt, stripeSessionExpiresAt: expiresAt });
  }
  return { key: attempt ? `order-${transaction.orderId}-retry-${attempt}` : `order-${transaction.orderId}`, expiresAt: expiresAt / 1000 };
}

async function reopen(ctx: MutationCtx, order: Doc<'orders'>, subdomain: string, retry?: boolean): Promise<OpenOrder> {
  const transaction = await ctx.db.query('transactions').withIndex('by_order', q => q.eq('orderId', order._id)).first();
  if (!transaction || order.status !== 'pending') fail('Esta compra ya fue procesada. Recargá la página para empezar otra.');
  // Sessions opened before expiries were saved cannot be replayed with the same parameters.
  if (transaction.stripeCheckoutSessionId && transaction.stripeSessionExpiresAt === undefined) fail('Esta compra ya fue procesada. Recargá la página para empezar otra.');
  // Earlier transactions sent Spanish to Stripe. Retries must replay the same parameters.
  const session = await idempotencyKey(ctx, transaction, retry);
  return { paymentLocale: transaction.paymentLocale ?? 'es', orderId: order._id, transactionId: transaction._id, currency: order.currency, subdomain, lineItems: lineItems(order.items), idempotencyKey: session.key, expiresAt: session.expiresAt, attribution: order.attribution };
}

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
  store: Doc<'stores'>; landing: Doc<'landings'>; attemptId: string; ip?: string; parentOrderId?: Id<'orders'>; downsell?: boolean; finalDownsell?: boolean; origin?: 'classic'|'quiz'|'direct'; quizSessionId?: Id<'quizSessions'>; attribution?: Doc<'orders'>['attribution']; retry?: boolean; build: () => Promise<Snapshot>;
}): Promise<OpenOrder> {
  checkAttempt(input.attemptId);
  const existing = await ctx.db.query('orders').withIndex('by_attempt', q => q.eq('attemptId', input.attemptId)).first();
  if (existing) {
    if (Boolean(existing.finalDownsell) !== Boolean(input.finalDownsell) || Boolean(existing.downsell) !== Boolean(input.downsell) || existing.storeId !== input.store._id || existing.parentOrderId !== input.parentOrderId || existing.quizSessionId !== input.quizSessionId || (existing.origin ?? 'direct') !== (input.origin ?? 'direct')) {
      fail('Esta compra ya fue procesada. Recargá la página para empezar otra.');
    }
    return await reopen(ctx, existing, input.landing.subdomain, input.retry);
  }

  const snapshot = await input.build();
  const orderId = await ctx.db.insert('orders', {
    storeId: input.store._id,
    landingId: input.landing._id,
    parentOrderId: input.parentOrderId,
    attemptId: input.attemptId,
    ...(input.ip ? { ip: input.ip } : {}),
    origin: input.origin ?? 'direct',
    quizSessionId: input.quizSessionId,
    ...(input.attribution ? { attribution: input.attribution } : {}),
    ...(input.downsell || input.finalDownsell ? { downsell: true } : {}),
    ...(input.finalDownsell ? { finalDownsell: true } : {}),
    status: 'pending',
    currency: input.store.currency,
    total: snapshot.total,
    items: snapshot.items,
  });
  const content = await purchaseContent(ctx, input.store);
  const checkout = content.checkout;
  const paymentLocale = (checkout && 'paymentLocale' in checkout ? checkout.paymentLocale : undefined) ?? 'en';
  const expiresAt = sessionExpiresAt();
  const transactionId = await ctx.db.insert('transactions', {
    paymentLocale,
    stripeSessionExpiresAt: expiresAt * 1000,
    orderId,
    status: 'pending',
    amount: snapshot.total,
    currency: input.store.currency,
    deliveries: snapshot.deliveries,
  });
  return { paymentLocale, orderId, transactionId, currency: input.store.currency, subdomain: input.landing.subdomain, lineItems: lineItems(snapshot.items), idempotencyKey: `order-${orderId}`, expiresAt, attribution: input.attribution };
}

function checkAttempt(attemptId: string) {
  if (!/^[A-Za-z0-9-]{16,64}$/.test(attemptId)) fail('No se pudo iniciar el pago. Recargá la página e intentá de nuevo.');
}

export const createOrder = internalMutation({
  args: { subdomain: v.string(), upsellProductIds: v.array(v.id('products')), attemptId, downsell, finalDownsell, origin, quizToken, retry, attribution, ip },
  handler: async (ctx, args): Promise<OpenOrder> => {
    if (args.finalDownsell && !args.downsell) fail('La última oferta requiere un descuento activo.');
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
      store, landing, attemptId: args.attemptId, ip: args.ip, downsell: args.downsell, finalDownsell: args.finalDownsell, origin:args.origin ?? 'direct', quizSessionId:session?._id, retry: args.retry,
      // A quiz buyer whose browser lost the campaign keeps the one their quiz started with.
      attribution: cleanAttribution(args.attribution) ?? session?.attribution,
      build: async () => {
        const products = await loadProducts(ctx, [
          store.offer.mainProductId,
          ...store.offer.bonuses.map(bonus => bonus.productId),
          ...store.offer.upsells.map(upsell => upsell.productId),
        ]);
        return args.downsell ? buildDownsellOrder(store, products, args.finalDownsell) : buildInitialOrder(store, products, args.upsellProductIds);
      },
    });
  },
});

export const createPostPurchaseOrder = internalMutation({
  args: { parentSessionId: v.string(), attemptId, downsell, finalDownsell, retry },
  handler: async (ctx, args): Promise<OpenOrder> => {
    checkAttempt(args.attemptId);
    const parentTransaction = await ctx.db.query('transactions')
      .withIndex('by_session', q => q.eq('stripeCheckoutSessionId', args.parentSessionId)).first();
    const parent = parentTransaction && await ctx.db.get(parentTransaction.orderId);
    if (!parentTransaction || !parent || parentTransaction.status !== 'paid' || parent.parentOrderId) fail('Esta oferta ya no está disponible.');
    const store = await ctx.db.get(parent.storeId);
    const landing = await ctx.db.get(parent.landingId);
    if (!store || !landing || store.status !== 'active') fail('Esta oferta ya no está disponible.');
    const children = await ctx.db.query('orders').withIndex('by_parent', q => q.eq('parentOrderId', parent._id)).collect();
    if (children.some(child => child.status === 'paid' || child.status === 'refunded' || child.status === 'needs_review')) fail('Ya compraste esta oferta.');
    // Another tab (or a reload) that already opened this offer shares its order, and with it
    // the same Stripe session, so the buyer can only pay it once.
    const stage = args.finalDownsell ? 'final' : args.downsell ? 'downsell' : 'offer';
    const stageOf = (child: Doc<'orders'>) => child.finalDownsell ? 'final' : child.downsell ? 'downsell' : 'offer';
    // A session that already ran out cannot be paid: that step starts a new order instead.
    let open: Doc<'orders'> | undefined;
    for (const child of children) {
      if (child.status !== 'pending' || stageOf(child) !== stage) continue;
      const transaction = await ctx.db.query('transactions').withIndex('by_order', q => q.eq('orderId', child._id)).first();
      if (transaction?.stripeSessionExpiresAt && transaction.stripeSessionExpiresAt > Date.now() + 2 * 60_000) { open = child; break; }
    }
    const order = open ? await reopen(ctx, open, landing.subdomain, args.retry) : await openOrder(ctx, {
      store, landing, attemptId: args.attemptId, ip: parent.ip, parentOrderId: parent._id, downsell: stage !== 'offer', finalDownsell: stage === 'final', origin:parent.origin, quizSessionId:parent.quizSessionId, attribution: parent.attribution, retry: args.retry,
      build: async () => buildPostPurchaseOrder(store, await loadProducts(ctx, store.postPurchase.productId ? [store.postPurchase.productId] : []), stage),
    });
    // The buyer just paid the parent order: their email is reused instead of asked again.
    return { ...order, customerEmail: parent.buyer?.email || undefined };
  },
});

export const attachSession = internalMutation({
  args: { transactionId: v.id('transactions'), sessionId: v.string(), expiresAt: v.number() },
  // Never replaces a session already linked: the first one may still be paid (delayed
  // methods take days), and losing its link would hide that charge.
  handler: async (ctx, { transactionId, sessionId, expiresAt }): Promise<boolean> => {
    const transaction = await ctx.db.get(transactionId);
    if (!transaction) return false;
    if (transaction.stripeCheckoutSessionId) return transaction.stripeCheckoutSessionId === sessionId;
    await ctx.db.patch(transactionId, { stripeCheckoutSessionId: sessionId, stripeSessionExpiresAt: expiresAt });
    return true;
  },
});

function stripeSettings() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.SITE_URL;
  if (!secretKey || !siteUrl) throw new ConvexError('Los pagos todavía no están habilitados en este sitio.');
  return { secretKey, site: new URL(siteUrl) };
}

async function openSession(ctx: { runMutation: (ref: any, args: any) => Promise<any> }, order: OpenOrder, route: 'subdomain' | 'path', elements = false): Promise<StartedSession> {
  const { secretKey, site } = stripeSettings();
  // The return address is built on the server from SITE_URL, never from a browser value.
  const base = route === 'subdomain' ? `${site.protocol}//${order.subdomain}.${site.host}` : `${site.origin}/l/${order.subdomain}`;
  const session = await createEmbeddedCheckoutSession(secretKey, {
    elements,
    locale: order.paymentLocale,
    collectContact: !order.customerEmail,
    customerEmail: elements ? order.customerEmail : undefined,
    orderId: order.orderId,
    idempotencyKey: order.idempotencyKey,
    expiresAt: order.expiresAt,
    currency: order.currency,
    lineItems: order.lineItems,
    // Always the campaign stored on the order: a retry must send Stripe the same parameters.
    metadata: attributionMetadata(order.attribution),
    returnUrl: `${base}/gracias?session_id={CHECKOUT_SESSION_ID}`,
  });
  if (!session) throw new ConvexError('No se pudo iniciar el pago. Volvé a intentar en unos minutos.');
  // Stripe forgets idempotency keys after about a day; a late retry then gets a different
  // session. It is never handed out, so it expires unpaid.
  if (!(await ctx.runMutation(internal.checkout.attachSession, { transactionId: order.transactionId, sessionId: session.id, expiresAt: session.expiresAt }))) {
    console.error('Stripe returned a different session for an order that already has one', order.orderId);
    throw new ConvexError('Este pago ya se inició en otra ventana. Recargá la página para continuar.');
  }
  return { clientSecret: session.clientSecret, sessionId: session.id, expiresAt: session.expiresAt };
}

export const start = action({
  args: { subdomain: v.string(), upsellProductIds: v.array(v.id('products')), attemptId, via, downsell, finalDownsell, origin, quizToken, retry, attribution, elements: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<StartedSession> => {
    stripeSettings();
    const order: OpenOrder = await ctx.runMutation(internal.checkout.createOrder, {
      subdomain: args.subdomain, upsellProductIds: args.upsellProductIds, attemptId: args.attemptId, downsell: args.downsell, finalDownsell: args.finalDownsell, origin:args.origin, quizToken:args.quizToken, retry: args.retry, attribution: args.attribution,
      // Best effort: not knowing where the buyer is never blocks a sale.
      ip: normalizeIp(await clientIp(ctx).catch(() => null)) ?? undefined,
    });
    return await openSession(ctx, order, args.via, args.elements);
  },
});

export const startPostPurchase = action({
  args: { parentSessionId: v.string(), attemptId, via, downsell, finalDownsell, retry, elements: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<StartedSession> => {
    stripeSettings();
    const order: OpenOrder = await ctx.runMutation(internal.checkout.createPostPurchaseOrder, {
      parentSessionId: args.parentSessionId, attemptId: args.attemptId, downsell: args.downsell, finalDownsell: args.finalDownsell, retry: args.retry,
    });
    return await openSession(ctx, order, args.via, args.elements);
  },
});

// What the visitor typed in the checkout before paying, kept on the still-pending order so an
// abandoned checkout keeps its contact. Only the browser that holds the session id can write it,
// and only while the order is pending: once paid, Stripe's own details replace it.
const DRAFT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const saveBuyerDraft = mutation({
  args: { sessionId: v.string(), email: v.string(), name: v.string() },
  handler: async (ctx, args): Promise<null> => {
    if (!/^cs_(test|live)_[A-Za-z0-9]{1,200}$/.test(args.sessionId)) return null;
    const email = args.email.trim();
    const name = args.name.trim().replace(/\s+/g, ' ');
    if (email.length > 254 || !DRAFT_EMAIL.test(email) || name.length > 100) return null;
    const transaction = await ctx.db.query('transactions').withIndex('by_session', q => q.eq('stripeCheckoutSessionId', args.sessionId)).first();
    if (!transaction || transaction.status !== 'pending') return null;
    const order = await ctx.db.get(transaction.orderId);
    if (!order || order.status !== 'pending') return null;
    if (order.buyer?.email === email && order.buyer?.name === name) return null;
    await ctx.db.patch(order._id, { buyer: { email, name } });
    return null;
  },
});

// The checkout watches its own session: once Stripe reports it expired (or a delayed payment
// failed) it can no longer be paid, and the buyer is offered a new one. Only that is revealed.
export const sessionStatus = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }): Promise<'open' | 'ended' | null> => {
    if (!/^cs_(test|live)_[A-Za-z0-9]{1,200}$/.test(sessionId)) return null;
    const transaction = await ctx.db.query('transactions').withIndex('by_session', q => q.eq('stripeCheckoutSessionId', sessionId)).first();
    if (!transaction) return null;
    return transaction.status === 'expired' || transaction.status === 'failed' ? 'ended' : 'open';
  },
});

async function setStatus(ctx: MutationCtx, transaction: Doc<'transactions'>, status: Doc<'transactions'>['status'], extra: Partial<Doc<'transactions'>> = {}) {
  await ctx.db.patch(transaction._id, { status, ...extra });
  await ctx.db.patch(transaction.orderId, { status });
}

type Outcome = 'processed' | 'ignored' | 'rejected' | 'deferred';
type PaidEvent = { eventId: string; sessionId?: string; paymentIntentId?: string; amountTotal?: number; currency?: string; email?: string; name?: string };

// A post-purchase offer can be bought once. Two tabs can still end up paying two separate
// orders for it, so the second one is held for review (and refunded) instead of delivered.
async function offerAlreadyBought(ctx: MutationCtx, order: Doc<'orders'> | null) {
  if (!order?.parentOrderId) return false;
  const siblings = await ctx.db.query('orders').withIndex('by_parent', q => q.eq('parentOrderId', order.parentOrderId)).collect();
  return siblings.some(sibling => sibling._id !== order._id && (sibling.status === 'paid' || sibling.status === 'refunded' || sibling.status === 'needs_review'));
}

async function applyPayment(ctx: MutationCtx, transaction: Doc<'transactions'>, event: PaidEvent): Promise<Outcome> {
  const stripeIds = { stripeCheckoutSessionId: event.sessionId, stripePaymentIntentId: event.paymentIntentId };
  const charged = { amount: event.amountTotal ?? 0, currency: (event.currency ?? '').toUpperCase() };
  const order = await ctx.db.get(transaction.orderId);
  let status: 'paid' | 'needs_review' | 'refunded';
  let reviewReason: Doc<'transactions'>['reviewReason'];

  if (transaction.status !== 'pending') {
    // The same charge reported again (for example completed + async_payment_succeeded).
    if (transaction.stripePaymentIntentId && transaction.stripePaymentIntentId === event.paymentIntentId) return 'ignored';
    if (transaction.status !== 'expired' && transaction.status !== 'failed') {
      // A second charge on a settled order. Sessions are never replaced, so this is not expected.
      console.error('Stripe reported another charge for an order that is already settled', event.eventId);
      return 'rejected';
    }
    status = 'needs_review'; reviewReason = 'late';
  } else if (event.amountTotal !== transaction.amount || event.currency?.toUpperCase() !== transaction.currency.toUpperCase()) {
    status = 'needs_review'; reviewReason = 'amount';
  } else if (await offerAlreadyBought(ctx, order)) {
    status = 'needs_review'; reviewReason = 'duplicate';
  } else {
    status = 'paid';
  }

  // Stripe does not guarantee event order: a refund may have arrived before this payment.
  const refund = event.paymentIntentId ? (await ctx.db.query('webhookEvents')
    .withIndex('by_payment_intent', q => q.eq('paymentIntentId', event.paymentIntentId)).collect())
    .find(row => row.type === 'charge.refunded' && row.status === 'deferred') : undefined;
  if (refund) {
    status = 'refunded'; reviewReason = undefined;
    await ctx.db.patch(refund._id, { status: 'processed' });
  }

  if (status === 'needs_review') console.error('Stripe charge held for review', reviewReason, event.eventId);
  await setStatus(ctx, transaction, status, {
    ...stripeIds,
    ...(status === 'paid' ? { paidAt: Date.now() } : {}),
    ...(status === 'needs_review' ? { charged, reviewReason } : {}),
  });
  // Post-purchase sessions do not ask for a name again: it is taken from the parent order.
  const parent = !event.name && order?.parentOrderId ? await ctx.db.get(order.parentOrderId) : null;
  await ctx.db.patch(transaction.orderId, { buyer: { email: event.email ?? parent?.buyer?.email ?? '', name: event.name || parent?.buyer?.name || '' } });
  // Links go to the buyer only when paid; a held charge alerts the admins instead.
  if (status !== 'refunded') await queueEmail(ctx, transaction._id);
  if (status === 'paid') await queueSaleAlert(ctx, transaction._id);
  return status === 'needs_review' ? 'rejected' : 'processed';
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
  handler: async (ctx, event): Promise<'duplicate' | Outcome> => {
    const seen = await ctx.db.query('webhookEvents').withIndex('by_event', q => q.eq('stripeEventId', event.eventId)).first();
    if (seen) return 'duplicate';

    let outcome: Outcome = 'ignored';
    if (event.type.startsWith('checkout.session.') && event.sessionId) {
      let transaction = await ctx.db.query('transactions')
        .withIndex('by_session', q => q.eq('stripeCheckoutSessionId', event.sessionId)).first();
      if (!transaction && event.orderId) {
        const orderId = ctx.db.normalizeId('orders', event.orderId);
        transaction = orderId && await ctx.db.query('transactions').withIndex('by_order', q => q.eq('orderId', orderId)).first();
      }
      const paidEvent = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
      if (transaction && paidEvent && event.paymentStatus === 'paid') {
        outcome = await applyPayment(ctx, transaction, event);
      } else if (transaction && event.type === 'checkout.session.async_payment_failed' && transaction.status === 'pending') {
        // A delayed method (ACH, SEPA…) was declined. The session never expires after this.
        await setStatus(ctx, transaction, 'failed', { stripeCheckoutSessionId: event.sessionId, stripePaymentIntentId: event.paymentIntentId });
        outcome = 'processed';
      } else if (transaction && event.type === 'checkout.session.expired' && transaction.status === 'pending') {
        await setStatus(ctx, transaction, 'expired');
        outcome = 'processed';
      }
    } else if (event.type === 'charge.refunded' && event.refunded && event.paymentIntentId) {
      const transaction = await ctx.db.query('transactions')
        .withIndex('by_payment_intent', q => q.eq('stripePaymentIntentId', event.paymentIntentId)).first();
      // A charge under review can also be settled by refunding it in Stripe.
      if (transaction && (transaction.status === 'paid' || transaction.status === 'needs_review')) {
        await setStatus(ctx, transaction, 'refunded');
        outcome = 'processed';
      } else if (!transaction) {
        // The payment is not confirmed yet: kept so it is applied when the payment arrives.
        outcome = 'deferred';
      }
    }

    await ctx.db.insert('webhookEvents', {
      stripeEventId: event.eventId, type: event.type, status: outcome,
      ...(event.type === 'charge.refunded' && event.paymentIntentId ? { paymentIntentId: event.paymentIntentId } : {}),
    });
    return outcome;
  },
});
