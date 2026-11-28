import { v } from 'convex/values';
import { internal } from './_generated/api';
import { internalAction, internalMutation, internalQuery, type Id, type MutationCtx } from './lib/functions';
import { adminEmails } from './lib/admin_emails';
import { liveDeliveries } from './lib/deliveries';
import { escapeHtml, resendSettings, safeUrl, sendEmail, type EmailMessage } from './lib/resend';
import { emailStatus } from './schema';
import { purchaseContent } from './lib/landing_records';
import brand from '../src/config/brandData.json';
import { classicTheme } from '../shared/classic-design.js';
import { postLabels, purchaseText } from '../shared/purchase-copy.js';
import { groupDeliveries } from '../src/storefront/delivery-groups.js';
import { isDownloadable } from '../src/storefront/download.js';
import { storefrontMoney } from '../src/lib/storefront-money.js';
import { formatCurrency } from '../shared/currencies.js';

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
    const landing = await ctx.db.get(order.landingId);
    // The same texts, color and legal links as the thank-you page.
    const content = store ? await purchaseContent(ctx, store) : null;
    return {
      supportUrl: supportUrl(landing?.subdomain || store?.subdomain || ''),
      status: transaction.status,
      email: transaction.email ?? null,
      storeName: store?.name ?? '',
      presentation: {
        postLabels: content?.postLabels ?? {},
        accentColor: content?.style?.accentColor ?? '',
        brandName: content?.footer?.brandName ?? '',
        termsUrl: content?.footer?.termsUrl ?? '',
        privacyUrl: content?.footer?.privacyUrl ?? '',
      },
      buyer: order.buyer ?? null,
      currency: order.currency,
      total: order.total,
      items: order.items.map(item => ({ name: item.name, role: item.role, price: item.price })),
      deliveries: await liveDeliveries(ctx, order, transaction.deliveries),
      charged: transaction.charged ?? null,
      reviewReason: transaction.reviewReason ?? 'amount',
      paymentIntentId: transaction.stripePaymentIntentId ?? '',
    };
  },
});

// The store's public support form. Built from SITE_URL on the server; the /l/<subdomain>
// address works with or without the landing's own subdomain.
export function supportUrl(subdomain: string, siteUrl = process.env.SITE_URL) {
  if (!subdomain || !siteUrl) return '';
  try { return `${new URL(siteUrl).origin}/l/${encodeURIComponent(subdomain)}/soporte`; } catch { return ''; }
}

export const record = internalMutation({
  args: { transactionId: v.id('transactions'), status: emailStatus, attempts: v.number(), error: v.optional(v.string()), retryInMs: v.optional(v.number()) },
  handler: async (ctx, { transactionId, status, attempts, error, retryInMs }) => {
    await ctx.db.patch(transactionId, { email: { status, attempts, updatedAt: Date.now(), ...(error ? { error } : {}) } });
    if (retryInMs !== undefined) await ctx.scheduler.runAfter(retryInMs, internal.emails.send, { transactionId });
  },
});

type Delivery = { productName: string; title: string; url: string; kind?: 'file' | 'link'; coverUrl?: string; role?: string };
type Presentation = { postLabels?: Record<string, string>; accentColor?: string; brandName?: string; termsUrl?: string; privacyUrl?: string };
type Context = {
  status: string; email: { status: string; attempts: number } | null; storeName: string; buyer: { email: string; name: string } | null;
  presentation?: Presentation; supportUrl?: string;
  currency: string; total: number; items: { name: string; role?: string; price: number }[]; deliveries: Delivery[];
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

// Amounts are integers in the currency's minor unit. Admin alerts show the ISO code.
export function money(amount: number, currency: string) {
  return formatCurrency(amount, currency, { code: true });
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

// ---------------------------------------------------------------------------------------
// Delivery email: the thank-you page in email form. Orange hero with the product cover, the
// buyer's library (main product, free bonuses, added products) and a receipt. Tables and
// inline styles only; gradients and rounded corners degrade to solid colors in Outlook.

const hex = (value: string) => (/^#[0-9a-f]{6}$/i.test(value) ? value : '#f56b20');
// Mixes `color` toward `other`: amount 0 keeps the color, 1 gives `other`.
function mix(color: string, other: string, amount: number) {
  const a = hex(color); const b = hex(other);
  return '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - amount) + parseInt(b.slice(i, i + 2), 16) * amount).toString(16).padStart(2, '0')).join('');
}

function palette(accentColor = '') {
  // Same rule as the page: the store's accent, or the landing's default when it has none.
  const theme = classicTheme(accentColor);
  const accent = theme['--sales-accent'];
  return {
    accent, action: theme['--classic-action'], onAction: theme['--classic-on-action'],
    heroStart: theme['--classic-banner-start'], heroMid: theme['--classic-banner-mid'], heroEnd: theme['--classic-cta-end'], heroText: theme['--classic-cta-text'],
    pill: mix(theme['--classic-banner-mid'], '#ffffff', .2), pillLine: mix(theme['--classic-banner-mid'], '#ffffff', .42), heroSoftText: mix(theme['--classic-cta-text'], theme['--classic-banner-mid'], .08),
    cream: '#fffaf5', paper: '#ffffff', soft: '#fff5eb', peach: mix(accent, '#ffffff', .91), peachLine: mix(accent, '#f0e3d7', .76),
    kicker: mix(accent, '#ffffff', .89), ink: '#30251f', muted: '#71635a', line: '#f0e3d7', night: '#27170e', nightEnd: '#743407',
  };
}

const FONT = "'Nunito Sans','Segoe UI',Helvetica,Arial,sans-serif";
const GROUP_GLYPH: Record<string, string> = { main: '&#9733;', bonus: '&#127873;', extras: '+' };
const THUMB_GLYPH: Record<string, string> = { main: '&#128214;', bonus: '&#127873;', extras: '&#10010;', web: '&#127760;' };

function button(href: string, label: string, c: ReturnType<typeof palette>, variant: 'solid' | 'outline' | 'white', size: 'lg' | 'md' = 'md') {
  const pad = size === 'lg' ? '16px 32px' : '11px 20px';
  const font = size === 'lg' ? 16 : 14;
  const look = variant === 'white' ? { bg: '#ffffff', fg: c.action, border: '#ffffff' } : variant === 'solid' ? { bg: c.action, fg: c.onAction, border: c.action } : { bg: '#ffffff', fg: c.action, border: c.peachLine };
  const gradient = variant === 'solid' ? `background-image:linear-gradient(135deg,${c.heroStart},${c.heroEnd});` : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr><td align="center" bgcolor="${look.bg}" style="border-radius:12px;${gradient}mso-padding-alt:${pad}"><a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:${pad};border:1px solid ${look.border};border-radius:12px;font-family:${FONT};font-size:${font}px;line-height:20px;font-weight:800;text-decoration:none;color:${look.fg};mso-padding-alt:0">${label}</a></td></tr></table>`;
}

// The cover as a book: the product image, or a designed dark cover with its name.
function cover(link: Delivery | undefined, name: string, c: ReturnType<typeof palette>, width: number) {
  const height = Math.round(width * 1.386);
  if (link?.coverUrl && safeUrl(link.coverUrl)) {
    return `<img src="${escapeHtml(link.coverUrl)}" width="${width}" alt="${escapeHtml(name)}" style="display:block;width:${width}px;max-width:${width}px;height:auto;border:0;border-radius:4px 10px 10px 4px;box-shadow:10px 14px 28px rgba(42,18,5,.35)">`;
  }
  return `<table role="presentation" width="${width}" cellpadding="0" cellspacing="0" style="width:${width}px;border-collapse:separate"><tr><td width="${width}" height="${height}" valign="bottom" bgcolor="${c.night}" style="height:${height}px;padding:0 16px 18px 20px;border-radius:4px 10px 10px 4px;background-image:linear-gradient(160deg,${c.night},${c.nightEnd});box-shadow:10px 14px 28px rgba(42,18,5,.35);text-align:left">
<div style="font-size:${width > 100 ? 26 : 18}px;line-height:1;margin-bottom:${width > 100 ? 14 : 8}px">&#128214;</div>
<div style="font-family:${FONT};font-size:${width > 100 ? 17 : 11}px;line-height:1.15;font-weight:900;color:#ffffff;overflow-wrap:anywhere">${escapeHtml(name)}</div>
<div style="width:40px;height:3px;margin-top:${width > 100 ? 14 : 8}px;background:${c.accent};font-size:0;line-height:0">&nbsp;</div></td></tr></table>`;
}

function deliveryRow(link: Delivery, group: string, labels: Record<string, string>, c: ReturnType<typeof palette>, first: boolean) {
  const main = group === 'main';
  const file = isDownloadable(link);
  const thumbWidth = main ? 64 : 48;
  const glyph = file ? THUMB_GLYPH[group] ?? THUMB_GLYPH.main : THUMB_GLYPH.web;
  const thumb = link.coverUrl && safeUrl(link.coverUrl)
    ? cover(link, link.productName, c, thumbWidth)
    : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="${thumbWidth}" height="${thumbWidth}" align="center" bgcolor="${main ? '#ffffff' : c.soft}" style="width:${thumbWidth}px;height:${thumbWidth}px;border-radius:14px;font-size:${main ? 28 : 22}px;line-height:1">${glyph}</td></tr></table>`;
  const free = group === 'bonus' && labels.free ? ` <span style="display:inline-block;padding:2px 8px;border-radius:99px;background:${c.kicker};color:${c.action};font-size:10px;line-height:16px;font-weight:800;letter-spacing:1px;text-transform:uppercase;vertical-align:2px">${escapeHtml(labels.free)}</span>` : '';
  // Pages (artifacts, external links) are named as a site, so nobody waits for a file.
  const web = !file && labels.webBadge ? ` <span style="display:inline-block;padding:2px 8px;border:1px solid ${c.peachLine};border-radius:99px;background:#ffffff;color:${c.action};font-size:10px;line-height:14px;font-weight:800;letter-spacing:1px;text-transform:uppercase;vertical-align:2px">&#127760; ${escapeHtml(labels.webBadge)}</span>` : '';
  const action = button(link.url, file ? `&#8595;&nbsp; ${escapeHtml(labels.download)}` : `${escapeHtml(labels.openSite)} &nbsp;&#8599;`, c, 'solid');
  const inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed"><tr>
<td width="${thumbWidth}" valign="top" style="width:${thumbWidth}px">${thumb}</td>
<td valign="top" style="padding-left:16px;font-family:${FONT};overflow-wrap:anywhere;word-wrap:break-word">
<div style="font-size:${main ? 18 : 16}px;line-height:1.3;font-weight:800;color:${c.ink}">${escapeHtml(link.productName)}${free}${web}</div>
${link.title && link.title !== link.productName ? `<div style="margin-top:3px;font-size:13px;line-height:1.5;color:${c.muted}">${escapeHtml(link.title)}</div>` : ''}
<div style="margin-top:12px">${action}</div></td></tr></table>`;
  if (main) return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;margin-top:4px"><tr><td bgcolor="${c.peach}" style="padding:16px;border:1px solid ${c.peachLine};border-radius:16px;background-image:linear-gradient(120deg,${c.peach},${c.cream})">${inner}</td></tr></table>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse"><tr><td style="padding:14px 0;${first ? '' : `border-top:1px solid ${c.line};`}">${inner}</td></tr></table>`;
}

function library(links: Delivery[], labels: Record<string, string>, c: ReturnType<typeof palette>) {
  const groups = groupDeliveries(links) as { key: string; links: Delivery[] }[];
  const titles: Record<string, string> = { main: labels.groupMain, bonus: labels.groupBonus, extras: labels.groupExtras };
  if (groups.length === 0) return `<p style="margin:20px 0 0;padding:20px;border:1px dashed ${c.line};border-radius:14px;background:${c.soft};font-family:${FONT};font-size:15px;line-height:1.6;text-align:center;color:${c.ink}">${escapeHtml(labels.emptyLinks)}</p>`;
  return groups.map(({ key, links: rows }) => {
    const group = key === 'all' ? 'main' : key;
    const title = titles[key];
    const heading = title ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;border-collapse:separate"><tr>
<td width="28" height="28" align="center" bgcolor="${c.soft}" style="width:28px;height:28px;border-radius:9px;font-size:13px;line-height:1;color:${c.action};font-weight:800">${GROUP_GLYPH[key] ?? '&#9733;'}</td>
<td style="padding-left:10px;font-family:${FONT};font-size:12px;line-height:1;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${c.muted}">${escapeHtml(title)}</td>
<td style="padding-left:8px"><span style="display:inline-block;min-width:8px;padding:3px 8px;border-radius:99px;background:${c.soft};font-family:${FONT};font-size:12px;line-height:16px;font-weight:800;color:${c.action}">${rows.length}</span></td></tr></table>` : '<div style="height:20px;line-height:20px;font-size:0">&nbsp;</div>';
    return heading + rows.map((link, index) => deliveryRow(link, group, labels, c, index === 0)).join('');
  }).join('');
}

const ROLE_ORDER: Record<string, number> = { main: 0, bonus: 1, upsell: 2, post_purchase: 3 };

function receipt(data: Context, labels: Record<string, string>, c: ReturnType<typeof palette>) {
  const price = (amount: number) => escapeHtml(storefrontMoney(amount, data.currency));
  const items = [...data.items].sort((a, b) => (ROLE_ORDER[a.role ?? ''] ?? 9) - (ROLE_ORDER[b.role ?? ''] ?? 9));
  const rows = items.map(item => `<tr><td style="padding:7px 12px 7px 0;font-family:${FONT};font-size:14px;line-height:1.4;color:${c.ink};overflow-wrap:anywhere;word-wrap:break-word">${escapeHtml(item.name)}</td>
<td align="right" style="padding:7px 0;font-family:${FONT};white-space:nowrap;${item.price > 0 ? `font-size:14px;font-weight:800;color:${c.ink}` : `font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${c.action}`}">${item.price > 0 ? price(item.price) : escapeHtml(labels.free)}</td></tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;margin-top:16px"><tr><td class="email-pad" bgcolor="${c.paper}" style="padding:28px 32px;border:1px solid ${c.line};border-radius:24px">
<div style="margin:0 0 14px;font-family:${FONT};font-size:18px;line-height:1.3;font-weight:800;color:${c.ink}">&#129534;&nbsp; ${escapeHtml(labels.summaryTitle)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;table-layout:fixed"><col><col width="110">${rows}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:16px;border-top:2px dashed ${c.line}"><tr>
<td style="padding-top:18px;font-family:${FONT};font-size:14px;font-weight:700;color:${c.muted}">${escapeHtml(labels.summaryTotal)}</td>
<td align="right" style="padding-top:14px;font-family:${FONT};font-size:28px;line-height:1;font-weight:900;letter-spacing:-.5px;color:${c.ink};white-space:nowrap">${price(data.total)}</td></tr></table>
</td></tr></table>`;
}

// "Need help?": a card with a link to the store's public support form.
function support(url: string, labels: Record<string, string>, c: ReturnType<typeof palette>, variant: 'solid' | 'outline' = 'outline') {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;margin-top:16px"><tr><td class="email-pad" bgcolor="${c.paper}" style="padding:24px 32px;border:1px solid ${c.line};border-radius:24px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse"><tr>
<td width="52" valign="top" style="width:52px;padding-right:16px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="52" height="52" align="center" bgcolor="${c.soft}" style="width:52px;height:52px;border-radius:16px;font-size:24px;line-height:1">&#128172;</td></tr></table></td>
<td valign="middle" style="font-family:${FONT}"><p style="margin:0;font-size:18px;line-height:1.3;font-weight:850;color:${c.ink}">${escapeHtml(labels.supportTitle)}</p>${labels.supportText ? `<p style="margin:4px 0 0;font-size:14px;line-height:1.55;color:${c.muted}">${escapeHtml(labels.supportText)}</p>` : ''}</td>
</tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr><td>${button(url, `${escapeHtml(labels.supportLink)} &nbsp;&#8594;`, c, variant)}</td></tr></table>
</td></tr></table>`;
}

export function deliveryEmail(data: Context): Omit<EmailMessage, 'from'> {
  const presentation = data.presentation ?? {};
  const labels = postLabels(presentation) as Record<string, string>;
  const c = palette(presentation.accentColor);
  const store = presentation.brandName || data.storeName || '';
  const name = data.buyer?.name?.trim() ?? '';
  // Without a name the greeting drops it: "Hi {nombre}," becomes "Hi,".
  const greeting = purchaseText(labels, 'emailGreeting', { nombre: name }).replace(/\s+([,!.])/g, '$1').trim();
  const intro = purchaseText(labels, 'emailIntro', { tienda: store }).replace(/\s+([,!.])/g, '$1');
  const subject = purchaseText(labels, 'emailSubject', { tienda: store }).replace(/\s+$/, '');
  const preheader = purchaseText(labels, 'emailPreheader', { tienda: store });
  const links = data.deliveries.filter(link => safeUrl(link.url));
  const ordered = (groupDeliveries(links) as { links: Delivery[] }[]).flatMap(group => group.links);
  const main = ordered[0];
  const mainName = main?.productName ?? data.items[0]?.name ?? '';
  const mainAction = main ? button(main.url, isDownloadable(main) ? `&#8595;&nbsp; ${escapeHtml(labels.download)}` : `${escapeHtml(labels.openSite)} &nbsp;&#8599;`, c, 'white', 'lg') : '';
  const year = new Date().getFullYear();
  const legal = [presentation.termsUrl && safeUrl(presentation.termsUrl) ? `<a href="${escapeHtml(presentation.termsUrl)}" style="color:${c.muted};text-decoration:underline">${escapeHtml(labels.terms)}</a>` : '', presentation.privacyUrl && safeUrl(presentation.privacyUrl) ? `<a href="${escapeHtml(presentation.privacyUrl)}" style="color:${c.muted};text-decoration:underline">${escapeHtml(labels.privacy)}</a>` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ');

  const html = `<!doctype html>
<html lang="${/^[\x00-\x7F]*$/.test(labels.paidTitle) ? 'en' : 'es'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(subject)}</title>
<style>@media only screen and (max-width:600px){.email-shell{padding:16px 10px!important}.email-pad{padding:26px 20px!important}.email-hero{padding:34px 20px 36px!important}.email-title{font-size:30px!important;line-height:1.08!important}}</style></head>
<body style="margin:0;padding:0;background-color:${c.cream};font-family:${FONT};color:${c.ink};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${c.cream}" style="width:100%;border-collapse:collapse"><tr><td class="email-shell" align="center" style="padding:32px 16px 40px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:separate;table-layout:fixed">
${store ? `<tr><td align="center" style="padding:0 0 16px;font-family:${FONT};font-size:12px;line-height:1;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${c.muted}">${escapeHtml(store)}</td></tr>` : ''}
<tr><td class="email-hero" align="center" bgcolor="${c.heroMid}" style="padding:44px 36px 46px;border-radius:24px 24px 0 0;background-image:linear-gradient(125deg,${c.heroStart},${c.heroMid} 52%,${c.heroEnd});text-align:center;color:${c.heroText}">
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 28px"><tr><td>${cover(main, mainName, c, 150)}</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;border-collapse:separate"><tr><td bgcolor="${c.pill}" style="padding:5px 14px 5px 5px;border:1px solid ${c.pillLine};border-radius:99px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="24" height="24" align="center" bgcolor="#ffffff" style="width:24px;height:24px;border-radius:12px;font-size:13px;line-height:24px;font-weight:900;color:${c.action}">&#10003;</td>
<td style="padding-left:9px;font-family:${FONT};font-size:11px;line-height:1;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${c.heroText}">${escapeHtml(labels.paidEyebrow)}</td></tr></table></td></tr></table>
<h1 class="email-title" style="margin:20px 0 14px;font-family:${FONT};font-size:38px;line-height:1.05;font-weight:900;letter-spacing:-1px;color:${c.heroText}">${escapeHtml(labels.paidTitle)}</h1>
<p style="margin:0 auto;max-width:440px;font-family:${FONT};font-size:16px;line-height:1.6;color:${c.heroSoftText}">${greeting ? `<strong style="color:${c.heroText}">${escapeHtml(greeting)}</strong><br>` : ''}${escapeHtml(intro)}</p>
${mainAction ? `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 0"><tr><td>${mainAction}</td></tr></table>` : ''}
</td></tr>
<tr><td class="email-pad" bgcolor="${c.paper}" style="padding:34px 32px 32px;border:1px solid ${c.line};border-top:0;border-radius:0 0 24px 24px;overflow-wrap:anywhere;word-wrap:break-word">
${labels.linksEyebrow ? `<span style="display:inline-block;padding:4px 12px;border-radius:6px;background:${c.kicker};font-family:${FONT};font-size:11px;line-height:16px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:${c.action}">${escapeHtml(labels.linksEyebrow)}</span>` : ''}
<h2 style="margin:12px 0 0;font-family:${FONT};font-size:28px;line-height:1.15;font-weight:850;letter-spacing:-.6px;color:${c.ink}">${escapeHtml(labels.linksTitle)}</h2>
${labels.linksSubtitle ? `<p style="margin:8px 0 0;font-family:${FONT};font-size:15px;line-height:1.6;color:${c.muted}">${escapeHtml(labels.linksSubtitle)}</p>` : ''}
${library(links, labels, c)}
</td></tr>
<tr><td>${data.items.length ? receipt(data, labels, c) : ''}</td></tr>
${data.supportUrl && safeUrl(data.supportUrl) ? `<tr><td>${support(data.supportUrl, labels, c)}</td></tr>` : ''}
<tr><td align="center" style="padding:28px 24px 0;font-family:${FONT};font-size:13px;line-height:1.7;color:${c.muted}">
${labels.emailKeep ? `<p style="margin:0 0 14px">${escapeHtml(labels.emailKeep)}</p>` : ''}
<p style="margin:0">&copy; ${year} ${escapeHtml(store)}. ${escapeHtml(labels.rights)}</p>
${legal ? `<p style="margin:6px 0 0">${legal}</p>` : ''}
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;

  const groups = groupDeliveries(links) as { key: string; links: Delivery[] }[];
  const titles: Record<string, string> = { main: labels.groupMain, bonus: labels.groupBonus, extras: labels.groupExtras };
  const text = [
    labels.paidTitle, '',
    ...(greeting ? [greeting] : []), intro, '',
    labels.linksTitle.toUpperCase(),
    ...groups.flatMap(group => [
      ...(titles[group.key] ? ['', `${titles[group.key]}:`] : ['']),
      ...group.links.map(link => `- ${link.productName}${link.title && link.title !== link.productName ? ` · ${link.title}` : ''}${group.key === 'bonus' ? ` (${labels.free})` : ''}${isDownloadable(link) ? '' : ` [${labels.webBadge}]`}: ${link.url}`),
    ]),
    '', labels.summaryTitle.toUpperCase(),
    ...[...data.items].sort((a, b) => (ROLE_ORDER[a.role ?? ''] ?? 9) - (ROLE_ORDER[b.role ?? ''] ?? 9)).map(item => `${item.name}: ${item.price > 0 ? storefrontMoney(item.price, data.currency) : labels.free}`),
    `${labels.summaryTotal}: ${storefrontMoney(data.total, data.currency)}`, '',
    ...(data.supportUrl && safeUrl(data.supportUrl) ? [`${labels.supportTitle} ${labels.supportText}`.trim(), `${labels.supportLink}: ${data.supportUrl}`, ''] : []),
    labels.emailKeep,
  ].join('\n');
  return { to: data.buyer?.email ? [data.buyer.email] : [], subject, html, text };
}

// ---------------------------------------------------------------------------------------
// Support reply: what an admin answered in the panel's inbox, followed by the buyer's own
// message. Same palette as the delivery email (the store's accent, or the landing default).
// The buyer is asked not to answer the email: the button opens the store's support form,
// the same page as "Contact support" in the delivery email, so the answer lands in the inbox.

export type SupportReply = { to: string; reply: string; question: string; storeName: string; presentation?: Presentation; supportUrl?: string };

const paragraphs = (value: string) => escapeHtml(value).replace(/\r?\n/g, '<br>');

export function supportReplyEmail(data: SupportReply): Omit<EmailMessage, 'from'> {
  const presentation = data.presentation ?? {};
  const labels = postLabels(presentation) as Record<string, string>;
  const c = palette(presentation.accentColor);
  const store = presentation.brandName || data.storeName || '';
  const subject = purchaseText(labels, 'supportReplySubject', { tienda: store }).replace(/\s+([,!.:])/g, '$1').trim();
  const preheader = data.reply.replace(/\s+/g, ' ').slice(0, 140);
  const help = data.supportUrl && safeUrl(data.supportUrl) ? data.supportUrl : '';
  const year = new Date().getFullYear();
  const legal = [presentation.termsUrl && safeUrl(presentation.termsUrl) ? `<a href="${escapeHtml(presentation.termsUrl)}" style="color:${c.muted};text-decoration:underline">${escapeHtml(labels.terms)}</a>` : '', presentation.privacyUrl && safeUrl(presentation.privacyUrl) ? `<a href="${escapeHtml(presentation.privacyUrl)}" style="color:${c.muted};text-decoration:underline">${escapeHtml(labels.privacy)}</a>` : ''].filter(Boolean).join(' &nbsp;·&nbsp; ');

  const html = `<!doctype html>
<html lang="${/^[\x00-\x7F]*$/.test(labels.supportReplyQuote) ? 'en' : 'es'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escapeHtml(subject)}</title>
<style>@media only screen and (max-width:600px){.email-shell{padding:16px 10px!important}.email-pad{padding:26px 20px!important}}</style></head>
<body style="margin:0;padding:0;background-color:${c.cream};font-family:${FONT};color:${c.ink};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${c.cream}" style="width:100%;border-collapse:collapse"><tr><td class="email-shell" align="center" style="padding:32px 16px 40px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:separate;table-layout:fixed">
${store ? `<tr><td align="center" style="padding:0 0 16px;font-family:${FONT};font-size:12px;line-height:1;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:${c.muted}">${escapeHtml(store)}</td></tr>` : ''}
<tr><td class="email-pad" bgcolor="${c.paper}" style="padding:34px 32px 32px;border:1px solid ${c.line};border-top:6px solid ${c.accent};border-radius:24px;overflow-wrap:anywhere;word-wrap:break-word">
<p style="margin:0;font-family:${FONT};font-size:16px;line-height:1.7;color:${c.ink}">${paragraphs(data.reply)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;margin-top:28px"><tr><td bgcolor="${c.soft}" style="padding:16px 18px;border-left:4px solid ${c.peachLine};border-radius:0 12px 12px 0">
<p style="margin:0 0 6px;font-family:${FONT};font-size:11px;line-height:1.4;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${c.muted}">${escapeHtml(labels.supportReplyQuote)}</p>
<p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${c.muted}">${paragraphs(data.question)}</p>
</td></tr></table>
</td></tr>
${help ? `<tr><td>${support(help, { supportTitle: labels.supportReplyTitle, supportText: labels.supportReplyNote, supportLink: labels.supportReplyButton }, c, 'solid')}</td></tr>` : ''}
<tr><td align="center" style="padding:28px 24px 0;font-family:${FONT};font-size:13px;line-height:1.7;color:${c.muted}">
<p style="margin:0">&copy; ${year} ${escapeHtml(store)}. ${escapeHtml(labels.rights)}</p>
${legal ? `<p style="margin:6px 0 0">${legal}</p>` : ''}
</td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;

  const text = [
    data.reply, '',
    `${labels.supportReplyQuote}:`,
    ...data.question.split(/\r?\n/).map(line => `> ${line}`),
    ...(help ? ['', `${labels.supportReplyTitle}. ${labels.supportReplyNote}`.trim(), `${labels.supportReplyButton}: ${help}`] : []),
  ].join('\n');
  return { to: data.to ? [data.to] : [], subject, html, text };
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
