import { httpRouter } from 'convex/server';
import { registerStaticRoutes } from '@convex-dev/static-hosting';
import { components, internal } from './_generated/api';
import { authComponent, createAuth } from './auth';
import { httpAction } from './lib/functions';
import { verifyWebhookSignature } from './lib/stripe';

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

// Register additional HTTP actions explicitly under /api before this catch-all.
registerStaticRoutes(http, components.staticHosting);
export default http;
