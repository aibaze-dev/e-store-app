import { createHmac } from 'node:crypto';
import { vi } from 'vitest';
import { convexTest } from 'convex-test';
import betterAuth from '@convex-dev/better-auth/test';
import staticHosting from '@convex-dev/static-hosting/test';
import schema from '../convex/schema';

const modules = { ...import.meta.glob('../convex/**/*.ts'), '../convex/_generated/api.js': () => import('./api') };
export const origin = 'https://auth-test.convex.site';
export const WEBHOOK_SECRET = 'whsec_test_only';

export function backend() {
  const t = convexTest(schema, modules);
  betterAuth.register(t);
  staticHosting.register(t);
  return t;
}

// Registers a real account through Better Auth and returns a client acting as that user.
export async function signedIn(t, email) {
  const headers = { 'Content-Type': 'application/json', Origin: origin, 'Better-Auth-Cookie': '', 'Sec-Fetch-Site': 'cross-site' };
  const credentials = { email, password: 'Strong-passphrase-123' };
  await t.fetch('/api/auth/sign-up/email', { method: 'POST', headers, body: JSON.stringify({ ...credentials, name: 'Tester' }) });
  const login = await t.fetch('/api/auth/sign-in/email', { method: 'POST', headers, body: JSON.stringify(credentials) });
  const token = login.headers.get('set-better-auth-cookie').match(/(?:^|,\s*)([^=;,]*session_token)=([^;]+)/);
  const jwt = await t.fetch('/api/auth/convex/token', { headers: { Origin: origin, 'Better-Auth-Cookie': `${token[1]}=${decodeURIComponent(token[2])}` } });
  const claims = JSON.parse(Buffer.from((await jwt.json()).token.split('.')[1], 'base64url').toString());
  return t.withIdentity({ subject: claims.sub, sessionId: claims.sessionId });
}

// Replaces only the Stripe API; every other request keeps using the real fetch.
// `failFirst` makes that many new keys fail with a 500 that, like Stripe, is replayed for
// every later request with the same key. `forget()` drops saved keys (Stripe does so after ~24 h).
export function mockStripe({ fail = false, failFirst = 0 } = {}) {
  const realFetch = globalThis.fetch;
  const requests = [];
  const sessions = new Map();
  let created = 0;
  vi.stubGlobal('fetch', async (url, init) => {
    if (!String(url).startsWith('https://api.stripe.com/')) return realFetch(url, init);
    const body = Object.fromEntries(new URLSearchParams(init.body));
    const key = init.headers['Idempotency-Key'];
    requests.push({ url: String(url), headers: init.headers, body });
    const error = new Response(JSON.stringify({ error: { type: 'api_error' } }), { status: 500 });
    if (fail) return error;
    if (!sessions.has(key)) {
      if (failFirst > 0) { failFirst -= 1; sessions.set(key, 'failed'); }
      else { created += 1; sessions.set(key, { id: `cs_test_${created}`, client_secret: `secret_${created}` }); }
    }
    if (sessions.get(key) === 'failed') return error;
    return new Response(JSON.stringify(sessions.get(key)), { status: 200 });
  });
  return { requests, forget: () => sessions.clear() };
}

// Replaces only the Resend API on top of whatever fetch is installed (for example mockStripe).
export function mockResend(responses = []) {
  const previousFetch = globalThis.fetch;
  const emails = [];
  vi.stubGlobal('fetch', async (url, init) => {
    if (!String(url).startsWith('https://api.resend.com/')) return previousFetch(url, init);
    emails.push({ headers: init.headers, body: JSON.parse(init.body) });
    const status = responses.length ? responses.shift() : 200;
    return new Response(JSON.stringify(status === 200 ? { id: `email_${emails.length}` } : { name: 'application_error' }), { status });
  });
  return { emails };
}

// Replaces only the Discord webhook on top of whatever fetch is installed.
export function mockDiscord(url, status = 204) {
  const previousFetch = globalThis.fetch;
  const messages = [];
  vi.stubGlobal('fetch', async (target, init) => {
    if (String(target) !== url) return previousFetch(target, init);
    messages.push(JSON.parse(init.body));
    return new Response(null, { status });
  });
  return { messages };
}

let eventCounter = 0;
export function stripeEvent(type, object, id = `evt_${++eventCounter}`) {
  return { id, type, data: { object } };
}

export function sendWebhook(t, event, { secret = WEBHOOK_SECRET, timestamp = Math.floor(Date.now() / 1000) } = {}) {
  const payload = JSON.stringify(event);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return t.fetch('/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` }, body: payload });
}

export const content = {
  hero: { title: 'Aprendé a invertir', subtitle: 'Una guía práctica', imageUrl: '', ctaText: 'Quiero mi copia' },
  benefits: { title: 'Qué vas a aprender', items: ['Presupuesto', 'Ahorro'] },
  bonuses: { title: 'Bonos incluidos' },
  faq: { title: 'Preguntas', items: [{ question: '¿Es digital?', answer: 'Sí.' }] },
  guarantee: { title: 'Garantía', text: '7 días.' },
  style: { accentColor: '#c15f3c' },
};

export const product = (name, slug) => ({
  name, description: `Descripción de ${name}`, coverUrl: '', status: 'active',
  deliverables: [{ title: 'PDF', url: `https://files.example.com/${slug}.pdf` }],
});
