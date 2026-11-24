import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { backend, signedIn, product, content, mockStripe, stripeEvent, sendWebhook, WEBHOOK_SECRET } from './helpers';

const ADMIN = 'artifact-owner@example.com';
const presentation = { name: 'Meeting confidence kit', description: 'Prepare your next conversation.', shortDescription: 'Your meeting companion', coverUrl: 'https://example.com/cover.jpg', status: 'active', featured: true, referencePrice: { currency: 'USD', value: 1900 } };
const save = (client, slug = 'meeting-prep', overrides = {}) => client.mutation(api.products.saveArtifact, { slug, ...presentation, ...overrides });
beforeEach(() => {
  vi.stubEnv('ADMIN_EMAILS', ADMIN);
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_only');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('artifact commercial records', () => {
  it('restricts reads and writes to admins', async () => {
    const t = backend();
    const stranger = await signedIn(t, 'artifact-stranger@example.com');
    for (const client of [t, stranger]) {
      await expect(save(client)).rejects.toThrow();
      await expect(client.query(api.products.getByArtifactSlug, { slug: 'meeting-prep' })).rejects.toThrow();
    }
    expect(await t.run(ctx => ctx.db.query('products').collect())).toEqual([]);
  });

  it('upserts the same identity, saves presentation, and owns the canonical deliverable', async () => {
    const t = backend();
    const admin = await signedIn(t, ADMIN);
    expect(await admin.query(api.products.getByArtifactSlug, { slug: 'meeting-prep' })).toBeNull();
    vi.stubEnv('SITE_URL', 'https://main.example.com/path?ignored=1');
    const id = await save(admin);
    const first = await admin.query(api.products.get, { id });
    expect(first).toMatchObject({ ...presentation, type: 'artifact', artifactSlug: 'meeting-prep', deliverables: [{ title: presentation.name, url: 'https://main.example.com/a/meeting-prep', kind: 'link' }] });
    expect(await save(admin, 'meeting-prep', { name: 'New name', status: 'archived', referencePrice: null })).toBe(id);
    expect(await admin.query(api.products.getByArtifactSlug, { slug: 'meeting-prep' })).toMatchObject({ _id: id, name: 'New name', status: 'archived', referencePrice: null, deliverables: [{ title: 'New name', url: first.deliverables[0].url, kind: 'link' }] });
    await expect(admin.mutation(api.products.update, { id, ...product('Overwrite', 'other') })).rejects.toThrow('Artefactos');
    expect(await admin.query(api.products.list, {})).toHaveLength(1);
  });

  it('rejects arbitrary slugs, deliverables, invalid fields and invalid domain configuration', async () => {
    const t = backend();
    const admin = await signedIn(t, ADMIN);
    for (const slug of ['unknown', '../meeting-prep', 'Meeting-Prep']) await expect(save(admin, slug)).rejects.toThrow();
    for (const overrides of [{ name: ' ' }, { artifactTitles: { pt: 'x'.repeat(121) } }, { artifactTitles: { fr: 'Titre' } }, { artifactTitles: { en: 'Title' } }, { coverUrl: 'javascript:alert(1)' }, { shortDescription: 'x'.repeat(181) }, { referencePrice: { currency: 'USD', value: -1 } }, { deliverables: [{ title: 'Bad', url: 'https://other.com' }] }]) await expect(save(admin, 'meeting-prep', overrides)).rejects.toThrow();
    for (const value of ['', 'not-a-url', 'file:///tmp']) {
      vi.stubEnv('SITE_URL', value);
      await expect(save(admin)).rejects.toThrow('SITE_URL');
    }
    expect(await admin.query(api.products.list, {})).toEqual([]);
  });

  it('offers artifacts as free bonuses and paid upsells, then delivers their order snapshots', async () => {
    const t = backend();
    const admin = await signedIn(t, ADMIN);
    const main = await admin.mutation(api.products.create, product('Ebook', 'main'));
    const bonus = await save(admin, 'prompt-builder', { name: 'Prompt bonus' });
    const upsell = await save(admin);
    const storeId = await admin.mutation(api.stores.create, {
      name: 'Artifact bundle', status: 'active', currency: 'USD',
      offer: { mainProductId: main, price: 2000, bonuses: [{ productId: bonus }], upsells: [{ productId: upsell, price: 500, displayOrder: 0 }] },
      postPurchase: { enabled: false, price: 0 }, tracking: { metaPixelIds: [] },
    });
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'artifact-bundle', template: 'classic', draft: content });
    await admin.mutation(api.landings.publish, { storeId });
    const landing = await t.query(api.storefront.getLanding, { subdomain: 'artifact-bundle' });
    expect(landing.offer.bonuses[0]).toMatchObject({ name: 'Prompt bonus' });
    expect(landing.offer.upsells[0]).toMatchObject({ name: presentation.name, price: 500 });
    expect(JSON.stringify(landing)).not.toContain('/a/meeting-prep');
    mockStripe();
    await t.action(api.checkout.start, { subdomain: 'artifact-bundle', upsellProductIds: [upsell], attemptId: crypto.randomUUID(), via: 'path' });
    const [order] = await t.run(ctx => ctx.db.query('orders').collect());
    expect(order.items.map(item => [item.role, item.price])).toEqual([['main', 2000], ['bonus', 0], ['upsell', 500]]);
    await save(admin, 'meeting-prep', { name: 'Changed after checkout', status: 'archived' });
    await sendWebhook(t, stripeEvent('checkout.session.completed', { id: 'cs_test_1', payment_status: 'paid', payment_intent: 'pi_artifacts', amount_total: 2500, currency: 'usd', customer_details: { email: 'buyer@example.com', name: 'Buyer' } }));
    const delivery = await t.query(api.storefront.getDelivery, { sessionId: 'cs_test_1' });
    expect(delivery.status).toBe('paid');
    expect(delivery.deliveries).toEqual(expect.arrayContaining([
      { productName: 'Prompt bonus', title: 'Prompt bonus', url: 'https://auth-test.convex.site/a/prompt-builder', kind: 'link', role: 'bonus', coverUrl: 'https://example.com/cover.jpg' },
      // Links come from the product as it is now; the product name stays the one sold.
      { productName: presentation.name, title: 'Changed after checkout', url: 'https://auth-test.convex.site/a/meeting-prep', kind: 'link', role: 'upsell', coverUrl: 'https://example.com/cover.jpg' },
    ]));
  });

  it('uses the store language for checkout and post-purchase artifacts and keeps the titles sold', async () => {
    const t = backend();
    const admin = await signedIn(t, ADMIN);
    const main = await admin.mutation(api.products.create, product('Livro digital', 'livro'));
    const bonus = await save(admin, 'meeting-prep');
    const upsell = await save(admin, 'prompt-builder', { artifactTitles: { pt: '  Oficina de prompts  ' } });
    const post = await save(admin, 'project-brief');
    const store = {
      name: 'Loja', status: 'active', currency: 'USD',
      offer: { mainProductId: main, price: 2000, bonuses: [{ productId: bonus }], upsells: [{ productId: upsell, price: 500, displayOrder: 0 }] },
      postPurchase: { enabled: true, productId: post, price: 300 }, tracking: { metaPixelIds: [] },
    };
    await expect(admin.mutation(api.stores.create, { ...store, language: 'fr' })).rejects.toThrow();
    const storeId = await admin.mutation(api.stores.create, { ...store, language: 'pt' });
    await admin.mutation(api.stores.update, { id: storeId, ...store });
    const subdomain = 'loja';
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain, template: 'classic', draft: content });
    await admin.mutation(api.landings.publish, { storeId });
    const checkout = await t.query(api.storefront.getCheckout, { subdomain });
    expect(checkout.offer.main.name).toBe('Livro digital');
    expect(checkout.offer.bonuses[0].name).toBe('Prepare sua reunião');
    expect(checkout.offer.upsells[0].name).toBe('Oficina de prompts');
    expect(await t.query(api.products.artifactTitle, { slug: 'prompt-builder' })).toEqual({ name: presentation.name, artifactTitles: { pt: 'Oficina de prompts' } });
    expect(await t.query(api.products.artifactTitle, { slug: 'ai-knowledge' })).toBeNull();

    const stripe = mockStripe();
    const pay = (id, amount) => sendWebhook(t, stripeEvent('checkout.session.completed', {
      id, payment_status: 'paid', payment_intent: `pi_${id}`, amount_total: amount, currency: 'usd',
      customer_details: { email: 'buyer@example.com', name: 'Buyer' },
    }));
    const initial = await t.action(api.checkout.start, { subdomain, upsellProductIds: [upsell], attemptId: crypto.randomUUID(), via: 'path' });
    expect(stripe.requests[0].body['line_items[1][price_data][product_data][name]']).toBe('Oficina de prompts');
    await pay(initial.sessionId, 2500);
    const paid = await t.query(api.storefront.getDelivery, { sessionId: initial.sessionId });
    expect(paid.postPurchaseOffer.name).toBe('Seu próprio app sob medida!');
    const extra = await t.action(api.checkout.startPostPurchase, { parentSessionId: initial.sessionId, attemptId: crypto.randomUUID(), via: 'path' });
    expect(stripe.requests[1].body['line_items[0][price_data][product_data][name]']).toBe(paid.postPurchaseOffer.name);
    await pay(extra.sessionId, 300);

    await save(admin, 'prompt-builder', { artifactTitles: { pt: ' ' } });
    expect((await t.query(api.storefront.getLanding, { subdomain })).offer.upsells[0].name).toBe('Construtor de prompts');
    for (const [language, name] of [['es', 'Constructor de prompts'], ['en', presentation.name]]) {
      await admin.mutation(api.stores.update, { id: storeId, ...store, language });
      expect((await t.query(api.storefront.getCheckout, { subdomain })).offer.upsells[0].name).toBe(name);
    }
    const receipt = await t.query(api.storefront.getDelivery, { sessionId: extra.sessionId });
    for (const [role, name, slug] of [
      ['bonus', 'Prepare sua reunião', 'meeting-prep'],
      ['upsell', 'Oficina de prompts', 'prompt-builder'],
      ['post_purchase', 'Seu próprio app sob medida!', 'project-brief'],
    ]) {
      expect(receipt.deliveries.find(link => link.role === role)).toMatchObject({
        productName: name, title: name, url: `https://auth-test.convex.site/a/${slug}?lang=pt`,
      });
    }
    expect(receipt.deliveries.find(link => link.role === 'main')).toMatchObject({ productName: 'Livro digital', title: 'PDF', url: 'https://files.example.com/livro.pdf' });
  });
});
