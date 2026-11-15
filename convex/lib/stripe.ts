// Minimal Stripe REST client. It relies only on fetch and Web Crypto, both available in
// the Convex runtime, and pins the API version these parameters were written against.
const API = 'https://api.stripe.com/v1';
const API_VERSION = '2026-10-28.endive';
const SIGNATURE_TOLERANCE_SECONDS = 300;

export type LineItem = { name: string; amount: number };

export async function createEmbeddedCheckoutSession(secretKey: string, input: {
  orderId: string; currency: string; lineItems: LineItem[]; returnUrl: string; elements?: boolean;
}) {
  const body = new URLSearchParams({
    mode: 'payment',
    ui_mode: input.elements ? 'elements' : 'embedded_page',
    locale: 'es',
    return_url: input.returnUrl,
    client_reference_id: input.orderId,
    'metadata[orderId]': input.orderId,
  });
  if (input.elements) {
    body.set('name_collection[individual][enabled]', 'true');
    body.set('phone_number_collection[enabled]', 'true');
  }
  input.lineItems.forEach((item, index) => {
    body.set(`line_items[${index}][quantity]`, '1');
    body.set(`line_items[${index}][price_data][currency]`, input.currency.toLowerCase());
    body.set(`line_items[${index}][price_data][unit_amount]`, String(item.amount));
    body.set(`line_items[${index}][price_data][product_data][name]`, item.name);
  });
  const response = await fetch(`${API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': API_VERSION,
      // A retry of the same order returns the same session instead of a new charge.
      'Idempotency-Key': `order-${input.orderId}`,
    },
    body,
  });
  const session = await response.json().catch(() => null);
  if (!response.ok || !session?.id || !session?.client_secret) {
    console.error('Stripe checkout session failed', response.status, session?.error?.type, session?.error?.code);
    return null;
  }
  return { id: session.id as string, clientSecret: session.client_secret as string };
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signPayload(payload: string, secret: string, timestamp: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)));
}

// Verifies the Stripe-Signature header (scheme v1) against the raw request body.
export async function verifyWebhookSignature(payload: string, header: string | null, secret: string, now = Date.now()) {
  if (!header) return false;
  const parts = header.split(',').map(part => part.trim().split('='));
  const timestamp = Number(parts.find(([name]) => name === 't')?.[1]);
  const signatures = parts.filter(([name]) => name === 'v1').map(([, value]) => value);
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = await signPayload(payload, secret, timestamp);
  return signatures.some(signature => timingSafeEqual(signature, expected));
}
