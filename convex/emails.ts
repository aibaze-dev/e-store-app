import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, internalMutation, internalQuery, type Id, type MutationCtx } from './lib/functions';
import { adminEmails } from './lib/admin_emails';
import { escapeHtml, resendSettings, safeUrl, sendEmail, type EmailMessage } from './lib/resend';
import { emailStatus } from './schema';

// Transactional emails sent after a verified Stripe event:
// - paid: the buyer receives their delivery links.
// - needs_review: the admins learn that Stripe charged an amount that differs from the order.
const MAX_ATTEMPTS = 5;
const RETRY_BASE_MS = 60_000;

// Called inside the webhook mutation, so the email is queued only if the payment state commits.
export async function queueEmail(ctx: MutationCtx, transactionId: Id<'transactions'>) {
  const now = Date.now();
  if (!resendSettings()) {
    await ctx.db.patch(transactionId, { email: { status: 'skipped', attempts: 0, updatedAt: now, error: 'not_configured' } });
    return;
  }
  await ctx.db.patch(transactionId, { email: { status: 'pending', attempts: 0, updatedAt: now } });
  await ctx.scheduler.runAfter(0, internal.emails.send, { transactionId });
}

export const context = internalQuery({
  args: { transactionId: v.id('transactions') },
  handler: async (ctx, { transactionId }) => {
    const transaction = await ctx.db.get(transactionId);
    const order = transaction && await ctx.db.get(transaction.orderId);
    if (!transaction || !order) return null;
    const store = await ctx.db.get(order.storeId);
    return {
      status: transaction.status,
      email: transaction.email ?? null,
      storeName: store?.name ?? '',
      buyer: order.buyer ?? null,
      currency: order.currency,
      total: order.total,
      items: order.items.map(item => ({ name: item.name, price: item.price })),
      deliveries: transaction.deliveries,
      charged: transaction.charged ?? null,
      paymentIntentId: transaction.stripePaymentIntentId ?? '',
    };
  },
});

export const record = internalMutation({
  args: { transactionId: v.id('transactions'), status: emailStatus, attempts: v.number(), error: v.optional(v.string()), retryInMs: v.optional(v.number()) },
  handler: async (ctx, { transactionId, status, attempts, error, retryInMs }) => {
    await ctx.db.patch(transactionId, { email: { status, attempts, updatedAt: Date.now(), ...(error ? { error } : {}) } });
    if (retryInMs !== undefined) await ctx.scheduler.runAfter(retryInMs, internal.emails.send, { transactionId });
  },
});

type Context = {
  status: string; email: { status: string; attempts: number } | null; storeName: string; buyer: { email: string; name: string } | null;
  currency: string; total: number; items: { name: string; price: number }[]; deliveries: { productName: string; title: string; url: string }[];
  charged: { amount: number; currency: string } | null; paymentIntentId: string;
};

export const send = internalAction({
  args: { transactionId: v.id('transactions') },
  handler: async (ctx, { transactionId }) => {
    const data: Context | null = await ctx.runQuery(internal.emails.context, { transactionId });
    if (!data || data.email?.status !== 'pending') return;
    const attempts = data.email.attempts + 1;
    const done = (status: 'sent' | 'failed' | 'skipped', error?: string, retryInMs?: number) =>
      ctx.runMutation(internal.emails.record, { transactionId, status, attempts, error, retryInMs });

    const settings = resendSettings();
    if (!settings) return await done('skipped', 'not_configured');
    // A refund that arrived before this ran cancels the delivery email.
    const message = data.status === 'paid' ? deliveryEmail(data) : data.status === 'needs_review' ? reviewEmail(data) : null;
    if (!message) return await done('skipped', 'status_changed');
    if (message.to.length === 0) return await done('skipped', 'no_recipient');

    const result = await sendEmail(settings.apiKey, { ...message, from: settings.from, replyTo: settings.replyTo }, `${data.status}-${transactionId}`);
    if (result.ok) return await done('sent');
    console.error('Resend email failed', result.error, attempts);
    if (result.retryable && attempts < MAX_ATTEMPTS) {
      return await ctx.runMutation(internal.emails.record, { transactionId, status: 'pending', attempts, error: result.error, retryInMs: RETRY_BASE_MS * 2 ** (attempts - 1) });
    }
    return await done('failed', result.error);
  },
});

// Amounts are integers in the currency's minor unit.
export function money(amount: number, currency: string) {
  try {
    const format = new Intl.NumberFormat('es', { style: 'currency', currency });
    return format.format(amount / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 2));
  } catch {
    return `${amount / 100} ${currency}`;
  }
}

const layout = (title: string, body: string) => `<!doctype html><html lang="es"><body style="margin:0;background:#f4f5f7;font-family:Arial,sans-serif;color:#202a3b">
<div style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border-radius:12px;padding:28px">
<h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(title)}</h1>${body}</div></div></body></html>`;

function itemsTable(data: Context) {
  const rows = data.items.map(item => `<tr><td style="padding:6px 0">${escapeHtml(item.name)}</td><td style="padding:6px 0;text-align:right">${item.price > 0 ? escapeHtml(money(item.price, data.currency)) : 'Incluido'}</td></tr>`).join('');
  return `<table style="width:100%;border-collapse:collapse;font-size:15px">${rows}<tr><td style="padding:10px 0 0;border-top:1px solid #e3e6ea;font-weight:bold">Total</td><td style="padding:10px 0 0;border-top:1px solid #e3e6ea;text-align:right;font-weight:bold">${escapeHtml(money(data.total, data.currency))}</td></tr></table>`;
}

export function deliveryEmail(data: Context): Omit<EmailMessage, 'from'> {
  const store = data.storeName || 'tu compra';
  const greeting = data.buyer?.name ? `Hola ${data.buyer.name},` : 'Hola,';
  const links = data.deliveries.filter(link => safeUrl(link.url));
  const html = layout(`¡Gracias por tu compra en ${store}!`, `
<p style="font-size:15px;line-height:1.6">${escapeHtml(greeting)} tu pago se confirmó. Estos son tus accesos:</p>
<ul style="padding-left:18px;font-size:15px;line-height:1.8">${links.map(link => `<li><strong>${escapeHtml(link.productName)}</strong> · <a href="${escapeHtml(link.url)}" style="color:#075bd8">${escapeHtml(link.title)}</a></li>`).join('')}</ul>
<h2 style="font-size:16px;margin:24px 0 8px">Detalle</h2>${itemsTable(data)}
<p style="font-size:13px;color:#5b6472;line-height:1.6;margin-top:24px">Guardá este email: es la forma más simple de volver a tus links.</p>`);
  const text = [
    `${greeting} tu pago en ${store} se confirmó. Estos son tus accesos:`, '',
    ...links.map(link => `- ${link.productName} · ${link.title}: ${link.url}`), '',
    ...data.items.map(item => `${item.name}: ${item.price > 0 ? money(item.price, data.currency) : 'Incluido'}`),
    `Total: ${money(data.total, data.currency)}`, '',
    'Guardá este email: es la forma más simple de volver a tus links.',
  ].join('\n');
  return { to: data.buyer?.email ? [data.buyer.email] : [], subject: `Tus accesos de ${store}`, html, text };
}

export function reviewEmail(data: Context): Omit<EmailMessage, 'from'> {
  const charged = data.charged ? money(data.charged.amount, data.charged.currency) : 'un importe desconocido';
  const expected = money(data.total, data.currency);
  const buyer = data.buyer?.email || 'sin email';
  const lines = [
    `Stripe cobró ${charged}, pero la orden era de ${expected}.`,
    `Comprador: ${buyer}. Pago: ${data.paymentIntentId || 'sin identificador'}.`,
    'No se entregaron los links. Revisá el pago en Stripe: reembolsalo o entregá la compra a mano.',
  ];
  const html = layout(`Revisar cobro en ${data.storeName || 'tu tienda'}`, lines.map(line => `<p style="font-size:15px;line-height:1.6">${escapeHtml(line)}</p>`).join(''));
  return { to: adminEmails(), subject: `Revisar cobro en ${data.storeName || 'tu tienda'}`, html, text: lines.join('\n') };
}
