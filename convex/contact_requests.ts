import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, internalMutation, internalQuery, mutation, query } from './lib/functions';
import { requireAdmin } from './lib/permissions';
import { checkoutRecord, purchaseContent } from './lib/landing_records';
import { cleanText, fail } from './lib/validation';
import { hashIp } from './lib/analytics_ip';
import { clientIp } from './lib/request_ip';
import { resendSettings, sendEmail } from './lib/resend';
import { supportReplyEmail, supportUrl, type SupportReply } from './emails';
import { emailStatus } from './schema';

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
// Replies shown per message (the latest ones) and the length of one reply.
const REPLY_LIST = 20;
export const REPLY_MAX = 5000;
const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 60_000;

export const list = query({
  args: { storeId: v.id('stores'), status: v.optional(filter) },
  handler: async (ctx, { storeId, status = 'open' }) => {
    await requireAdmin(ctx);
    const rows = await (status === 'all'
      ? ctx.db.query('contactRequests').withIndex('by_store', q => q.eq('storeId', storeId))
      : ctx.db.query('contactRequests').withIndex('by_store_status', q => q.eq('storeId', storeId).eq('status', status))).order('desc').take(LIST_LIMIT);
    return await Promise.all(rows.map(async row => {
      const order = row.orderId ? await ctx.db.get(row.orderId) : null;
      const replies = await ctx.db.query('contactReplies').withIndex('by_request', q => q.eq('requestId', row._id)).order('desc').take(REPLY_LIST);
      return {
        _id: row._id,
        createdAt: row._creationTime,
        email: row.email,
        message: row.message,
        status: row.status,
        closedAt: row.closedAt ?? null,
        // Oldest first, like a conversation.
        replies: replies.reverse().map(reply => ({
          _id: reply._id, createdAt: reply._creationTime, message: reply.message, authorEmail: reply.authorEmail,
          status: reply.email.status, error: reply.email.error ?? '',
        })),
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

// Answering from the panel needs the same Resend variables as the purchase email.
// Without them the inbox keeps the link that opens the admin's own email app.
export const canReply = query({
  args: {},
  handler: async ctx => {
    await requireAdmin(ctx);
    return Boolean(resendSettings());
  },
});

// Saves the answer and queues its email in the same transaction. `close` marks the message
// as resolved only once the email went out, so a failed send stays in the open inbox.
export const reply = mutation({
  args: { id: v.id('contactRequests'), message: v.string(), close: v.optional(v.boolean()) },
  handler: async (ctx, { id, message, close }) => {
    const user = await requireAdmin(ctx);
    const row = await ctx.db.get(id);
    if (!row) fail('Este mensaje ya no existe.');
    const text = cleanText(message, 'Respuesta', REPLY_MAX, true);
    if (!resendSettings()) fail('El envío de emails no está configurado (RESEND_API_KEY y EMAIL_FROM). Respondé desde tu correo.');
    const recent = await ctx.db.query('contactReplies').withIndex('by_request', q => q.eq('requestId', id)).order('desc').take(REPLY_LIST);
    if (recent.some(item => item.email.status === 'pending')) fail('La respuesta anterior todavía se está enviando. Esperá unos segundos.');
    const replyId = await ctx.db.insert('contactReplies', {
      requestId: id, storeId: row.storeId, message: text, authorEmail: user.email.trim().toLowerCase(),
      ...(close ? { closeOnSent: true } : {}),
      email: { status: 'pending', attempts: 0, updatedAt: Date.now() },
    });
    await ctx.scheduler.runAfter(0, internal.contact_requests.sendReply, { replyId });
    return replyId;
  },
});

type ReplyContext = SupportReply & { email: { status: string; attempts: number } };

export const replyContext = internalQuery({
  args: { replyId: v.id('contactReplies') },
  handler: async (ctx, { replyId }): Promise<ReplyContext | null> => {
    const item = await ctx.db.get(replyId);
    const request = item && await ctx.db.get(item.requestId);
    if (!item || !request) return null;
    const store = await ctx.db.get(item.storeId);
    const landing = store ? await ctx.db.query('landings').withIndex('by_store', q => q.eq('storeId', store._id)).first() : null;
    // The same texts, color and legal links as the support page and the purchase email.
    const content = store ? await purchaseContent(ctx, store) : null;
    return {
      email: item.email,
      to: request.email, reply: item.message, question: request.message,
      storeName: store?.name ?? '',
      supportUrl: supportUrl(landing?.subdomain || store?.subdomain || ''),
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

export const recordReply = internalMutation({
  args: { replyId: v.id('contactReplies'), status: emailStatus, attempts: v.number(), error: v.optional(v.string()), retryInMs: v.optional(v.number()) },
  handler: async (ctx, { replyId, status, attempts, error, retryInMs }) => {
    const item = await ctx.db.get(replyId);
    if (!item) return;
    const now = Date.now();
    await ctx.db.patch(replyId, { email: { status, attempts, updatedAt: now, ...(error ? { error } : {}) } });
    if (status === 'sent' && item.closeOnSent) {
      const request = await ctx.db.get(item.requestId);
      if (request?.status === 'open') await ctx.db.patch(item.requestId, { status: 'closed', closedAt: now });
    }
    if (retryInMs !== undefined) await ctx.scheduler.runAfter(retryInMs, internal.contact_requests.sendReply, { replyId });
  },
});

// Same delivery rules as the purchase email: one idempotency key per reply, temporary
// failures (429/5xx/network) retried with a growing wait, permanent ones reported in the inbox.
export const sendReply = internalAction({
  args: { replyId: v.id('contactReplies') },
  handler: async (ctx, { replyId }) => {
    const data: ReplyContext | null = await ctx.runQuery(internal.contact_requests.replyContext, { replyId });
    if (!data || data.email.status !== 'pending') return;
    const attempts = data.email.attempts + 1;
    const done = (status: 'sent' | 'failed' | 'skipped', error?: string) =>
      ctx.runMutation(internal.contact_requests.recordReply, { replyId, status, attempts, error });

    const settings = resendSettings();
    if (!settings) return await done('skipped', 'not_configured');
    const message = supportReplyEmail(data);
    // The email asks the buyer to answer through the support form; a direct answer still
    // goes to EMAIL_REPLY_TO when it is set, like the purchase email.
    const result = await sendEmail(settings.apiKey, { ...message, from: settings.from, replyTo: settings.replyTo }, `support-reply-${replyId}`);
    if (result.ok) return await done('sent');
    console.error('Resend support reply failed', result.error, attempts);
    if (result.retryable && attempts < MAX_ATTEMPTS) {
      return await ctx.runMutation(internal.contact_requests.recordReply, { replyId, status: 'pending', attempts, error: result.error, retryInMs: RETRY_BASE_MS * 2 ** (attempts - 1) });
    }
    return await done('failed', result.error);
  },
});
