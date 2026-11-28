import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { backend, signedIn, content, product, mockResend } from './helpers';
import { postLabels, POST_LABEL_GROUPS } from '../shared/purchase-copy.js';
import { clientIp } from '../convex/lib/request_ip';

// convex-test does not implement getRequestMetadata: only the transport address is replaced.
vi.mock('../convex/lib/request_ip', () => ({ clientIp: vi.fn(async () => '192.0.2.1') }));

const ADMIN = 'support-owner@example.com';
beforeEach(() => { vi.stubEnv('ADMIN_EMAILS', ADMIN); vi.stubEnv('BETTER_AUTH_SECRET', 'test-only-secret'); clientIp.mockResolvedValue('192.0.2.1'); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

async function store(subdomain = 'soporte-test', status = 'active') {
  const t = backend();
  const admin = await signedIn(t, ADMIN);
  const productId = await admin.mutation(api.products.create, product('Libro', subdomain));
  const storeId = await admin.mutation(api.stores.create, { name: 'Ateneo', status, currency: 'USD', offer: { mainProductId: productId, price: 1000, bonuses: [], upsells: [] }, postPurchase: { enabled: false, price: 0 }, tracking: { metaPixelIds: [] } });
  await admin.mutation(api.landings.saveDraft, { storeId, subdomain, template: 'classic', draft: content });
  await admin.mutation(api.landings.publish, { storeId });
  return { t, admin, storeId, subdomain };
}
const rows = t => t.run(ctx => ctx.db.query('contactRequests').collect());

describe('public support form', () => {
  it('saves a request with the purchase email and links it to that buyer’s paid order', async () => {
    const { t, storeId, subdomain } = await store();
    const orderId = await t.run(async ctx => {
      const landing = await ctx.db.query('landings').withIndex('by_store', q => q.eq('storeId', storeId)).first();
      await ctx.db.insert('orders', { storeId, landingId: landing._id, attemptId: 'other', status: 'paid', currency: 'USD', total: 1000, items: [], buyer: { email: 'other@example.com', name: '' } });
      return ctx.db.insert('orders', { storeId, landingId: landing._id, attemptId: 'mine', status: 'paid', currency: 'USD', total: 1000, items: [], buyer: { email: 'Ana@Example.com', name: 'Ana' } });
    });
    expect(await t.mutation(api.contact_requests.create, { subdomain, email: ' ana@example.com ', message: '  I can’t open the PDF on my phone.  ' })).toEqual({ ok: true });
    const [row] = await rows(t);
    expect(row).toMatchObject({ storeId, email: 'ana@example.com', message: 'I can’t open the PDF on my phone.', status: 'open', orderId });

    await t.mutation(api.contact_requests.create, { subdomain, email: 'new@example.com', message: 'A question before buying.' });
    expect((await rows(t))[1].orderId).toBeUndefined();
  });

  it('validates every field on the server', async () => {
    const { t, subdomain } = await store();
    await expect(t.mutation(api.contact_requests.create, { subdomain, email: 'not-an-email', message: 'Hello, I need help.' })).rejects.toThrow(/Email/);
    await expect(t.mutation(api.contact_requests.create, { subdomain, email: 'a@example.com', message: 'Help' })).rejects.toThrow(/Mensaje/);
    await expect(t.mutation(api.contact_requests.create, { subdomain, email: 'a@example.com', message: 'x'.repeat(2001) })).rejects.toThrow(/Mensaje/);
    await expect(t.mutation(api.contact_requests.create, { subdomain: 'missing-store', email: 'a@example.com', message: 'Hello, I need help.' })).rejects.toThrow(/tienda/);
    expect(await rows(t)).toHaveLength(0);
  });

  it('ignores bots that fill the hidden field and limits repeated messages from one email', async () => {
    const { t, subdomain } = await store();
    expect(await t.mutation(api.contact_requests.create, { subdomain, email: 'bot@example.com', message: 'Buy cheap things now!!', website: 'https://spam.example' })).toEqual({ ok: true });
    expect(await rows(t)).toHaveLength(0);
    for (let i = 0; i < 3; i++) await t.mutation(api.contact_requests.create, { subdomain, email: 'a@example.com', message: `Message number ${i} for support.` });
    await expect(t.mutation(api.contact_requests.create, { subdomain, email: 'A@example.com', message: 'One more message for support.' })).rejects.toThrow(/Esperá/);
    expect(await rows(t)).toHaveLength(3);
  });

  it('limits how many messages one network address can send per hour', async () => {
    const { t, subdomain } = await store();
    for (let i = 0; i < 10; i++) await t.mutation(api.contact_requests.create, { subdomain, email: `buyer${i}@example.com`, message: 'Hello, I need some help.' });
    await expect(t.mutation(api.contact_requests.create, { subdomain, email: 'late@example.com', message: 'Hello, I need some help.' })).rejects.toThrow(/Demasiados/);
    clientIp.mockResolvedValue('198.51.100.7');
    await t.mutation(api.contact_requests.create, { subdomain, email: 'late@example.com', message: 'Hello, I need some help.' });
    const saved = await rows(t);
    expect(saved).toHaveLength(11);
    expect(saved.every(row => /^[0-9a-f]{64}$/.test(row.ipHash))).toBe(true);
  });

  it('shows the store presentation only for active stores', async () => {
    const { t, subdomain } = await store();
    const page = await t.query(api.contact_requests.page, { subdomain });
    expect(page.storeName).toBe('Ateneo');
    expect(page.presentation).toHaveProperty('postLabels');
    expect(await t.query(api.contact_requests.page, { subdomain: 'missing-store' })).toBeNull();
    const draft = await store('draft-store', 'draft');
    expect(await draft.t.query(api.contact_requests.page, { subdomain: 'draft-store' })).toBeNull();
  });

  it('has editable default texts in their own panel group', () => {
    const labels = postLabels({});
    expect(POST_LABEL_GROUPS.support).toBe('Soporte');
    expect(labels.supportTitle).toBe('Need help?');
    expect(labels.supportLink).toBe('Contact support');
    expect(postLabels({ postLabels: { supportTitle: '¿Necesitás ayuda?' } }).supportTitle).toBe('¿Necesitás ayuda?');
  });
});

describe('support inbox in the panel', () => {
  it('lists the store’s messages for admins only, with the linked order and status filters', async () => {
    const { t, admin, storeId, subdomain } = await store();
    const other = await store('otra-tienda');
    await other.t.mutation(api.contact_requests.create, { subdomain: 'otra-tienda', email: 'x@example.com', message: 'Other store message.' });
    await t.run(async ctx => {
      const landing = await ctx.db.query('landings').withIndex('by_store', q => q.eq('storeId', storeId)).first();
      await ctx.db.insert('orders', { storeId, landingId: landing._id, attemptId: 'a', status: 'paid', currency: 'USD', total: 1000, items: [{ productId: (await ctx.db.query('products').first())._id, name: 'Libro', role: 'main', price: 1000 }], buyer: { email: 'ana@example.com', name: 'Ana' } });
    });
    await t.mutation(api.contact_requests.create, { subdomain, email: 'ana@example.com', message: 'First message here.' });
    await t.mutation(api.contact_requests.create, { subdomain, email: 'new@example.com', message: 'Second message here.' });

    const open = await admin.query(api.contact_requests.list, { storeId });
    expect(open.map(row => row.email)).toEqual(['new@example.com', 'ana@example.com']);
    expect(open[1].order).toMatchObject({ status: 'paid', total: 1000, buyerName: 'Ana', items: ['Libro'] });
    expect(open[0].order).toBeNull();
    expect(await admin.query(api.contact_requests.counts, { storeId })).toEqual({ open: 2, closed: 0, limit: 100 });

    await admin.mutation(api.contact_requests.setStatus, { id: open[1]._id, status: 'closed' });
    expect((await admin.query(api.contact_requests.list, { storeId })).map(row => row.email)).toEqual(['new@example.com']);
    const closed = await admin.query(api.contact_requests.list, { storeId, status: 'closed' });
    expect(closed).toHaveLength(1);
    expect(closed[0].closedAt).toEqual(expect.any(Number));
    expect(await admin.query(api.contact_requests.list, { storeId, status: 'all' })).toHaveLength(2);
    await admin.mutation(api.contact_requests.setStatus, { id: open[1]._id, status: 'open' });
    expect((await admin.query(api.contact_requests.list, { storeId, status: 'open' }))[1].closedAt).toBeNull();

    await expect(t.query(api.contact_requests.list, { storeId })).rejects.toThrow();
    const stranger = await signedIn(t, 'stranger@example.com');
    await expect(stranger.query(api.contact_requests.list, { storeId })).rejects.toThrow(/acceso/);
    await expect(stranger.query(api.contact_requests.counts, { storeId })).rejects.toThrow(/acceso/);
    await expect(stranger.mutation(api.contact_requests.setStatus, { id: open[0]._id, status: 'closed' })).rejects.toThrow(/acceso/);
  });
});

describe('replying by email from the panel', () => {
  const settle = t => t.finishAllScheduledFunctions(vi.runAllTimers);
  const configure = () => { vi.stubEnv('RESEND_API_KEY', 're_test_only'); vi.stubEnv('EMAIL_FROM', 'Tienda <ventas@example.com>'); vi.stubEnv('SITE_URL', 'https://shop.example.com'); };
  async function inbox() {
    const context = await store();
    await context.t.mutation(api.contact_requests.create, { subdomain: context.subdomain, email: 'ana@example.com', message: 'I can’t open <b>the PDF</b>.\nPlease help.' });
    const [request] = await context.admin.query(api.contact_requests.list, { storeId: context.storeId });
    return { ...context, request };
  }

  it('emails the answer to the buyer with their message quoted and saves it in the inbox', async () => {
    configure();
    const { t, admin, storeId, request } = await inbox();
    expect(await admin.query(api.contact_requests.canReply, {})).toBe(true);
    vi.useFakeTimers();
    const resend = mockResend();
    await admin.mutation(api.contact_requests.reply, { id: request._id, message: '  Hi Ana,\ntry <this> link.  ' });
    expect((await admin.query(api.contact_requests.list, { storeId }))[0].replies[0]).toMatchObject({ status: 'pending', message: 'Hi Ana,\ntry <this> link.', authorEmail: ADMIN });
    await settle(t);

    expect(resend.emails).toHaveLength(1);
    const [{ headers, body }] = resend.emails;
    expect(headers['Idempotency-Key']).toMatch(/^support-reply-/);
    expect(body).toMatchObject({ from: 'Tienda <ventas@example.com>', to: ['ana@example.com'], subject: 'Re: your message to Ateneo' });
    // The admin's own address never reaches the buyer.
    expect(body).not.toHaveProperty('reply_to');
    expect(JSON.stringify(body)).not.toContain(ADMIN);
    expect(body.html).toContain('Hi Ana,<br>try &lt;this&gt; link.');
    expect(body.html).toContain('Your message');
    expect(body.html).toContain('I can’t open &lt;b&gt;the PDF&lt;/b&gt;.<br>Please help.');
    expect(body.html).not.toContain('<b>the PDF</b>');
    // Asks not to answer the email and links the store's support form instead.
    const form = 'https://shop.example.com/l/soporte-test/soporte';
    expect(body.html).toContain('Please don’t reply to this email');
    expect(body.html).toContain(`href="${form}"`);
    expect(body.html).toContain('Reply here');
    expect(body.text).toContain(`Reply here: ${form}`);
    expect(body.text).toContain('Hi Ana,\ntry <this> link.');
    expect(body.text).toContain('> Please help.');

    const [row] = await admin.query(api.contact_requests.list, { storeId });
    expect(row.status).toBe('open');
    expect(row.replies).toEqual([expect.objectContaining({ status: 'sent', error: '' })]);
  });

  it('uses EMAIL_REPLY_TO when set and resolves the message only once the email went out', async () => {
    configure();
    vi.stubEnv('EMAIL_REPLY_TO', 'ayuda@example.com');
    const { t, admin, storeId, request } = await inbox();
    vi.useFakeTimers();
    const resend = mockResend([500, 200]);
    await admin.mutation(api.contact_requests.reply, { id: request._id, message: 'Here is a new link.', close: true });
    expect((await admin.query(api.contact_requests.list, { storeId }))[0].status).toBe('open');
    await expect(admin.mutation(api.contact_requests.reply, { id: request._id, message: 'Same answer again.' })).rejects.toThrow(/todavía se está enviando/);
    await settle(t);

    expect(resend.emails).toHaveLength(2);
    expect(new Set(resend.emails.map(email => email.headers['Idempotency-Key'])).size).toBe(1);
    expect(resend.emails[1].body.reply_to).toBe('ayuda@example.com');
    expect(await admin.query(api.contact_requests.list, { storeId })).toHaveLength(0);
    const [closed] = await admin.query(api.contact_requests.list, { storeId, status: 'closed' });
    expect(closed.closedAt).toEqual(expect.any(Number));
    expect(closed.replies[0].status).toBe('sent');
  });

  it('keeps the message open and reports the failure when the provider rejects the email', async () => {
    configure();
    const { t, admin, storeId, request } = await inbox();
    vi.useFakeTimers();
    const resend = mockResend([422]);
    await admin.mutation(api.contact_requests.reply, { id: request._id, message: 'An answer that fails.', close: true });
    await settle(t);
    expect(resend.emails).toHaveLength(1);
    const [row] = await admin.query(api.contact_requests.list, { storeId });
    expect(row.status).toBe('open');
    expect(row.replies[0]).toMatchObject({ status: 'failed', error: 'application_error' });
    // A new attempt is a new reply with its own idempotency key.
    await admin.mutation(api.contact_requests.reply, { id: request._id, message: 'An answer that fails.' });
    await settle(t);
    expect(resend.emails).toHaveLength(2);
    expect(resend.emails[1].headers['Idempotency-Key']).not.toBe(resend.emails[0].headers['Idempotency-Key']);
    expect((await admin.query(api.contact_requests.list, { storeId }))[0].replies.map(reply => reply.status)).toEqual(['failed', 'sent']);
  });

  it('validates the answer, needs the email settings and is for admins only', async () => {
    const { t, admin, request } = await inbox();
    const resend = mockResend();
    expect(await admin.query(api.contact_requests.canReply, {})).toBe(false);
    await expect(admin.mutation(api.contact_requests.reply, { id: request._id, message: 'Hello there.' })).rejects.toThrow(/no está configurado/);
    configure();
    await expect(admin.mutation(api.contact_requests.reply, { id: request._id, message: '   ' })).rejects.toThrow(/Respuesta/);
    await expect(admin.mutation(api.contact_requests.reply, { id: request._id, message: 'x'.repeat(5001) })).rejects.toThrow(/Respuesta/);
    await expect(t.mutation(api.contact_requests.reply, { id: request._id, message: 'Hello there.' })).rejects.toThrow();
    const stranger = await signedIn(t, 'stranger@example.com');
    await expect(stranger.mutation(api.contact_requests.reply, { id: request._id, message: 'Hello there.' })).rejects.toThrow(/acceso/);
    await expect(stranger.query(api.contact_requests.canReply, {})).rejects.toThrow(/acceso/);
    expect(await t.run(ctx => ctx.db.query('contactReplies').collect())).toHaveLength(0);
    expect(resend.emails).toHaveLength(0);
  });
});

describe('support link in the purchase email', async () => {
  const { deliveryEmail, supportUrl } = await import('../convex/emails.ts');
  const base = {
    status: 'paid', email: { status: 'pending', attempts: 0 }, storeName: 'Ateneo', buyer: { email: 'a@example.com', name: '' },
    currency: 'USD', total: 2000, charged: null, reviewReason: 'amount', paymentIntentId: '',
    items: [{ name: 'Ebook', role: 'main', price: 2000 }],
    deliveries: [{ productName: 'Ebook', title: 'PDF', url: 'https://files.example.com/book.pdf', kind: 'file', role: 'main' }],
  };
  it('builds the public address from SITE_URL', () => {
    expect(supportUrl('ateneo', 'https://shop.example.com/some/path')).toBe('https://shop.example.com/l/ateneo/soporte');
    expect(supportUrl('', 'https://shop.example.com')).toBe('');
    expect(supportUrl('ateneo', '')).toBe('');
  });
  it('adds a “Need help?” section with the link in HTML and text', () => {
    const url = 'https://shop.example.com/l/ateneo/soporte';
    const { html, text } = deliveryEmail({ ...base, supportUrl: url });
    expect(html).toContain('Need help?');
    expect(html).toContain(`href="${url}"`);
    expect(html.indexOf('Total paid')).toBeLessThan(html.indexOf('Need help?'));
    expect(text).toContain(`Contact support: ${url}`);
    const without = deliveryEmail(base);
    expect(without.html).not.toContain('Need help?');
    expect(without.text).not.toContain('Contact support');
  });
});
