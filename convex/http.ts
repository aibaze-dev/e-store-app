import { httpRouter } from 'convex/server';
import { registerStaticRoutes } from '@convex-dev/static-hosting';
import { components, internal } from './_generated/api';
import { authComponent, createAuth } from './auth';
import { httpAction } from './lib/functions';
import { timingSafeEqual, verifyWebhookSignature } from './lib/stripe';

const http = httpRouter();
authComponent.registerRoutes(http, createAuth, { cors: true });

// Stripe confirms payments here. Only events with a valid signature change any state.
http.route({
  path: '/api/stripe/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return new Response('Webhook not configured', { status: 503 });
    const payload = await request.text();
    if (!(await verifyWebhookSignature(payload, request.headers.get('stripe-signature'), secret))) {
      return new Response('Invalid signature', { status: 400 });
    }
    let event;
    try { event = JSON.parse(payload); } catch { return new Response('Invalid payload', { status: 400 }); }
    const object = event?.data?.object;
    if (typeof event?.id !== 'string' || typeof event?.type !== 'string' || !object) {
      return new Response('Invalid payload', { status: 400 });
    }
    const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
    const isSession = event.type.startsWith('checkout.session.');
    await ctx.runMutation(internal.checkout.handleStripeEvent, {
      eventId: event.id,
      type: event.type,
      sessionId: isSession ? text(object.id) : undefined,
      orderId: isSession ? text(object.client_reference_id) : undefined,
      paymentStatus: isSession ? text(object.payment_status) : undefined,
      paymentIntentId: text(object.payment_intent),
      amountTotal: isSession && typeof object.amount_total === 'number' ? object.amount_total : undefined,
      currency: text(object.currency),
      email: isSession ? text(object.customer_details?.email) : undefined,
      name: isSession ? text(object.customer_details?.name) : undefined,
      refunded: event.type === 'charge.refunded' ? object.refunded === true : undefined,
    });
    return new Response(null, { status: 200 });
  }),
});

// Server-to-server check: does this store have a paid order for this buyer email? Answers only
// { exists: boolean }. It reveals whether an address is a customer, so it needs the shared key
// (ORDER_LOOKUP_API_KEY) as a bearer token; the email travels in the body, never in the URL.
http.route({
  path: '/api/orders/paid-exists',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const key = process.env.ORDER_LOOKUP_API_KEY;
    if (!key) return json({ error: 'not_configured' }, 503);
    const token = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1] ?? '';
    if (!timingSafeEqual(token, key)) return json({ error: 'unauthorized' }, 401);
    let body: { storeId?: unknown; email?: unknown } | null;
    try { body = await request.json(); } catch { body = null; }
    const { storeId, email } = body ?? {};
    if (typeof storeId !== 'string' || typeof email !== 'string' || !storeId || !email || email.length > 320) {
      return json({ error: 'invalid_request' }, 400);
    }
    return json({ exists: await ctx.runQuery(internal.orders.hasPaidOrder, { storeId, email }) });
  }),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

// Register additional HTTP actions explicitly under /api before this catch-all.
registerStaticRoutes(http, components.staticHosting);
export default http;
