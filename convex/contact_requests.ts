import { v } from 'convex/values';
import { mutation, query } from './lib/functions';
import { requireAdmin } from './lib/permissions';
import { checkoutRecord, purchaseContent } from './lib/landing_records';
import { cleanText, fail } from './lib/validation';
import { hashIp } from './lib/analytics_ip';
import { clientIp } from './lib/request_ip';

// Public support form of a store (/soporte). No session: anyone with the link can write,
// so the server validates every field and bounds how often one email or address can send.
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
const EMAIL_LIMIT = 3; // per email, every 10 minutes
const EMAIL_WINDOW_MS = 10 * 60_000;
const IP_LIMIT = 10; // per network address, every hour
const IP_WINDOW_MS = 60 * 60_000;
// Recent orders searched for one bought with the same email.
const ORDER_SCAN = 500;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL.test(email)) fail('Email: ingresá un email válido.');
  return email;
}

// The store's texts, color and brand, like the thank-you page.
export const page = query({
  args: { subdomain: v.string() },
  handler: async (ctx, { subdomain }) => {
    const record = await checkoutRecord(ctx, subdomain);
    if (!record) return null;
    const content = await purchaseContent(ctx, record.store);
    return {
      storeName: record.store.name,
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

export const create = mutation({
  // `website` is a field hidden from people: bots that fill it get a silent success.
  args: { subdomain: v.string(), email: v.string(), message: v.string(), website: v.optional(v.string()) },
  handler: async (ctx, { subdomain, email, message, website }) => {
    const record = await checkoutRecord(ctx, subdomain);
    if (!record) fail('Esta tienda no está disponible.');
    const storeId = record.store._id;
    const address = cleanEmail(email);
    const text = cleanText(message, 'Mensaje', MESSAGE_MAX, true);
    if (text.length < MESSAGE_MIN) fail(`Mensaje: contanos un poco más (al menos ${MESSAGE_MIN} caracteres).`);
    if (website?.trim()) return { ok: true };

    const now = Date.now();
    const sameEmail = await ctx.db.query('contactRequests').withIndex('by_store_email', q => q.eq('storeId', storeId).eq('email', address).gte('_creationTime', now - EMAIL_WINDOW_MS)).take(EMAIL_LIMIT);
    if (sameEmail.length >= EMAIL_LIMIT) fail('Ya recibimos tus mensajes. Esperá unos minutos antes de enviar otro.');
    const secret = process.env.ANALYTICS_IP_SECRET || process.env.BETTER_AUTH_SECRET;
    const ipHash = secret ? await hashIp(await clientIp(ctx), `support:${storeId}`, secret) : undefined;
    if (ipHash) {
      const sameIp = await ctx.db.query('contactRequests').withIndex('by_store_ip', q => q.eq('storeId', storeId).eq('ipHash', ipHash).gte('_creationTime', now - IP_WINDOW_MS)).take(IP_LIMIT);
      if (sameIp.length >= IP_LIMIT) fail('Demasiados mensajes. Probá de nuevo más tarde.');
    }

    const orders = await ctx.db.query('orders').withIndex('by_store', q => q.eq('storeId', storeId)).order('desc').take(ORDER_SCAN);
    const order = orders.find(row => row.status === 'paid' && row.buyer?.email?.trim().toLowerCase() === address);
    await ctx.db.insert('contactRequests', { storeId, email: address, message: text, status: 'open', ...(order ? { orderId: order._id } : {}), ...(ipHash ? { ipHash } : {}) });
    return { ok: true };
  },
});

// Panel: the store's support inbox. Admins only.
const LIST_LIMIT = 200;
const COUNT_LIMIT = 100;
const filter = v.union(v.literal('open'), v.literal('closed'), v.literal('all'));

export const list = query({
  args: { storeId: v.id('stores'), status: v.optional(filter) },
  handler: async (ctx, { storeId, status = 'open' }) => {
    await requireAdmin(ctx);
    const rows = await (status === 'all'
      ? ctx.db.query('contactRequests').withIndex('by_store', q => q.eq('storeId', storeId))
      : ctx.db.query('contactRequests').withIndex('by_store_status', q => q.eq('storeId', storeId).eq('status', status))).order('desc').take(LIST_LIMIT);
    return await Promise.all(rows.map(async row => {
      const order = row.orderId ? await ctx.db.get(row.orderId) : null;
      return {
        _id: row._id,
        createdAt: row._creationTime,
        email: row.email,
        message: row.message,
        status: row.status,
        closedAt: row.closedAt ?? null,
        order: order ? {
          _id: order._id, createdAt: order._creationTime, status: order.status, currency: order.currency, total: order.total,
          buyerName: order.buyer?.name ?? '', items: order.items.map(item => item.name),
        } : null,
      };
    }));
  },
});

// Counts for the filter tabs and the navigation badge (capped: "100+" is enough there).
export const counts = query({
  args: { storeId: v.id('stores') },
  handler: async (ctx, { storeId }) => {
    await requireAdmin(ctx);
    const count = async (status: 'open' | 'closed') => (await ctx.db.query('contactRequests').withIndex('by_store_status', q => q.eq('storeId', storeId).eq('status', status)).take(COUNT_LIMIT + 1)).length;
    return { open: await count('open'), closed: await count('closed'), limit: COUNT_LIMIT };
  },
});

export const setStatus = mutation({
  args: { id: v.id('contactRequests'), status: v.union(v.literal('open'), v.literal('closed')) },
  handler: async (ctx, { id, status }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row) fail('Este mensaje ya no existe.');
    await ctx.db.patch(id, status === 'closed' ? { status, closedAt: Date.now() } : { status, closedAt: undefined });
    return null;
  },
});
