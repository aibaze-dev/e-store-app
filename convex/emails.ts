import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, internalMutation, internalQuery, type Id, type MutationCtx } from './lib/functions';
import { adminEmails } from './lib/admin_emails';
import { escapeHtml, resendSettings, safeUrl, sendEmail, type EmailMessage } from './lib/resend';
import { emailStatus } from './schema';
import brand from '../src/config/brandData.json';
import { classicTheme } from '../shared/classic-design.js';

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
      reviewReason: transaction.reviewReason ?? 'amount',
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
  charged: { amount: number; currency: string } | null; reviewReason: 'amount' | 'duplicate' | 'late'; paymentIntentId: string;
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

// Use the existing brand color and the landing's contrast-aware action palette.
// Inline styles and presentation tables also work when mail clients strip CSS.
const theme = classicTheme(brand.primaryColor);
const colors = {
  accent: theme['--sales-accent'], action: theme['--classic-action'], onAction: theme['--classic-on-action'],
  canvas: '#f6f1eb', paper: '#ffffff', soft: '#fcf6ef', ink: '#30251f', muted: '#746359', line: '#e9ddd1',
};
const layout = (title: string, body: string, label: string, preheader: string) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
<style>@media only screen and (max-width:600px){.email-shell{padding:16px 8px!important}.email-pad{padding:24px 20px!important}.email-title{font-size:28px!important;line-height:1.2!important}}</style></head>
<body style="margin:0;padding:0;background-color:${colors.canvas};font-family:Arial,Helvetica,sans-serif;color:${colors.ink};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${colors.canvas}" style="width:100%;border-collapse:collapse"><tr><td class="email-shell" align="center" style="padding:40px 16px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${colors.paper}" style="width:100%;max-width:600px;border:1px solid ${colors.line};border-top:8px solid ${colors.accent};border-radius:16px;border-spacing:0;table-layout:fixed">
<tr><td class="email-pad" bgcolor="${colors.soft}" style="padding:32px;border-bottom:1px solid ${colors.line};border-radius:8px 8px 0 0;overflow-wrap:anywhere;word-wrap:break-word">
<p style="margin:0 0 16px;font-size:12px;line-height:1.6;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${colors.action}">${escapeHtml(label)}</p>
<h1 class="email-title" style="margin:0;font-size:32px;line-height:1.2;letter-spacing:-0.6px;color:${colors.ink}">${escapeHtml(title)}</h1>
</td></tr><tr><td class="email-pad" style="padding:32px;overflow-wrap:anywhere;word-wrap:break-word">${body}</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;

function itemsTable(data: Context) {
  const rows = data.items.map(item => `<tr><th scope="row" style="padding:12px 12px 12px 0;border-bottom:1px solid ${colors.line};font-weight:normal;text-align:left;vertical-align:top;overflow-wrap:anywhere;word-wrap:break-word">${escapeHtml(item.name)}</th><td style="width:104px;padding:12px 0;border-bottom:1px solid ${colors.line};text-align:right;vertical-align:top;color:${item.price > 0 ? colors.ink : colors.muted}">${item.price > 0 ? escapeHtml(money(item.price, data.currency)) : 'Incluido'}</td></tr>`).join('');
  return `<table aria-label="Detalle de tu compra" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px;line-height:1.6">${rows}<tr><th scope="row" style="padding:20px 0 0;text-align:left;font-size:16px">Total</th><td style="padding:20px 0 0;text-align:right;font-weight:bold;font-size:18px;color:${colors.action}">${escapeHtml(money(data.total, data.currency))}</td></tr></table>`;
}

export function deliveryEmail(data: Context): Omit<EmailMessage, 'from'> {
  const store = data.storeName || 'tu compra';
  const greeting = data.buyer?.name ? `Hola ${data.buyer.name},` : 'Hola,';
  const links = data.deliveries.filter(link => safeUrl(link.url));
  const html = layout('¡Tu compra está lista!', `
<p style="margin:0 0 8px;font-size:16px;line-height:1.7">${escapeHtml(greeting)}</p>
<p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:${colors.muted}">Tu pago se confirmó. Gracias por elegir ${escapeHtml(store)}.</p>
<h2 style="margin:0 0 8px;font-size:20px;line-height:1.4">Tus accesos</h2>
<p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:${colors.muted}">Todo lo que compraste, en un solo lugar. Abrí cada contenido desde su botón.</p>
${links.map(link => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;table-layout:fixed;border-collapse:separate"><tr><td bgcolor="${colors.soft}" style="padding:20px;border:1px solid ${colors.line};border-radius:10px;overflow-wrap:anywhere;word-wrap:break-word">
<h3 style="margin:0 0 6px;font-size:16px;line-height:1.5;color:${colors.ink}">${escapeHtml(link.productName)}</h3>
${link.title !== link.productName ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${colors.muted}">${escapeHtml(link.title)}</p>` : ''}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:12px"><tr><td align="center" bgcolor="${colors.action}" style="border-radius:6px;mso-padding-alt:14px 22px"><a href="${escapeHtml(link.url)}" aria-label="Abrir ${escapeHtml(link.productName)}: ${escapeHtml(link.title)}" style="display:inline-block;padding:14px 22px;border:1px solid ${colors.action};border-radius:6px;font-size:14px;line-height:20px;font-weight:bold;text-decoration:none;color:${colors.onAction};mso-padding-alt:0">Abrir acceso &rarr;</a></td></tr></table>
</td></tr><tr><td height="12" style="height:12px;font-size:0;line-height:0">&nbsp;</td></tr></table>`).join('')}
<h2 style="font-size:18px;line-height:1.4;margin:24px 0 8px">Detalle de tu compra</h2>${itemsTable(data)}
<p style="font-size:13px;color:${colors.muted};line-height:1.7;margin:28px 0 0;padding-top:24px;border-top:1px solid ${colors.line}">Guardá este email: es la forma más simple de volver a tus accesos cuando los necesites.</p>`, store, 'Tu pago está confirmado. Encontrá acá los accesos y el detalle de tu compra.');
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
  const reason = {
    amount: `Stripe cobró ${charged}, pero la orden era de ${expected}.`,
    duplicate: `Stripe cobró ${charged} por una oferta post-compra que este comprador ya había pagado en otra orden.`,
    late: `Stripe cobró ${charged} por una orden que ya figuraba vencida o rechazada.`,
  };
  const lines = [
    reason[data.reviewReason] ?? reason.amount,
    `Comprador: ${buyer}. Pago: ${data.paymentIntentId || 'sin identificador'}.`,
    'No se entregaron los links. Revisá el pago en Stripe: reembolsalo o entregá la compra a mano.',
  ];
  const html = layout(`Revisar cobro en ${data.storeName || 'tu tienda'}`, lines.map(line => `<p style="font-size:15px;line-height:1.7;margin:0 0 16px">${escapeHtml(line)}</p>`).join(''), 'Revisión de pago', lines[0]);
  return { to: adminEmails(), subject: `Revisar cobro en ${data.storeName || 'tu tienda'}`, html, text: lines.join('\n') };
}
