import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { api } from './api';
import { landingContent } from '../convex/schema';
import { normalizeContent } from '../src/templates/content.js';
import { checkoutConfig } from '../shared/checkout-copy.js';
import { createAdvancedQuizTemplate, newStep } from '../shared/quiz.js';
import { backend, signedIn, product, content } from './helpers';

const ADMIN = 'owner@example.com';
beforeEach(() => { vi.stubEnv('ADMIN_EMAILS', ADMIN); });
afterEach(() => { vi.unstubAllEnvs(); });

// A value for every field the schema allows, optional ones included.
function sample(validator, key = '') {
  switch (validator.kind) {
    case 'object': return Object.fromEntries(Object.entries(validator.fields).map(([name, field]) => [name, sample(field, name)]));
    case 'array': return [sample(validator.element, key)];
    case 'union': { const literal = validator.members.find(member => member.kind === 'literal'); return literal ? literal.value : sample(validator.members.at(-1), key); }
    case 'literal': return validator.value;
    case 'boolean': return true;
    case 'float64': return 1;
    case 'string': return /url$/i.test(key) ? 'https://example.com/file.mp4' : key === 'accentColor' ? '#aabbcc' : `Texto de ${key}`;
    default: throw new Error(`Sin valor de ejemplo para ${validator.kind} (${key})`);
  }
}

// Every leaf of a document as `path = value`, so a dropped or changed field is named.
function leaves(value, path = '') {
  if (Array.isArray(value)) return value.flatMap((item, index) => leaves(item, `${path}[${index}]`));
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => leaves(item, path ? `${path}.${key}` : key));
  return [`${path} = ${JSON.stringify(value)}`];
}

// The schema shares one set of optional fields (label, button, note) across all sections.
// No screen edits these and no template shows them, so the save does not keep them.
const UNUSED = [
  'about.ctaText', 'about.note', 'comparison.note', 'faq.ctaText', 'faq.eyebrow', 'faq.note',
  'introduction.ctaText', 'introduction.note', 'postPurchaseBenefits.ctaText', 'postPurchaseBenefits.eyebrow', 'postPurchaseBenefits.note',
  'showcase.ctaText', 'showcase.note', 'transformation.ctaText', 'transformation.note',
];
const used = lines => lines.filter(line => !UNUSED.includes(line.split(' = ')[0])).sort();

function quiz() {
  const value = createAdvancedQuizTemplate('Guía');
  value.steps = [newStep('single', 'choice'), { ...newStep('contact', 'contact'), required: true }];
  value.calculations = [];
  value.results = [{ id: 'general', default: true, title: 'Resultado', blocks: [{ id: 'offer', type: 'offer' }] }];
  return value;
}

async function fixture() {
  const t = backend();
  const admin = await signedIn(t, ADMIN);
  const main = await admin.mutation(api.products.create, product('Ebook', 'main'));
  const store = { name: 'Tienda', status: 'active', currency: 'usd', offer: { mainProductId: main, price: 2700, bonuses: [], upsells: [] }, postPurchase: { enabled: false, price: 0 }, tracking: { metaPixelIds: [] } };
  const storeId = await admin.mutation(api.stores.create, store);
  return { t, admin, store, storeId };
}

describe('saving a landing', () => {
  it('keeps every field of the content, on the first save and when the editor saves it again', async () => {
    const { t, admin, storeId } = await fixture();
    const full = sample(landingContent);
    const save = draft => admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'completa', template: 'classic', draft });
    const stored = async () => (await admin.query(api.landings.getForStore, { storeId })).draft;

    await save(full);
    const first = await stored();
    expect(leaves(first).sort()).toEqual(used(leaves(full)));

    // The editor loads the draft through these two functions and sends the result back.
    const store = await admin.query(api.stores.get, { id: storeId });
    await save(normalizeContent({ ...first, checkout: checkoutConfig({ content: first, checkout: store.checkout }) }));
    expect(leaves(await stored()).sort()).toEqual(leaves(first).sort());
    expect((await t.run(ctx => ctx.db.get(storeId))).purchaseDraft).toEqual(await stored());
  });

  it('each save changes only its own fields of the store and its landings', async () => {
    const { t, admin, store, storeId } = await fixture();
    const state = () => t.run(async ctx => {
      const rows = await ctx.db.query('landings').collect();
      return { store: await ctx.db.get(storeId), classic: rows.find(row => row.template !== 'quiz'), quiz: rows.find(row => row.template === 'quiz') };
    });
    // Names of the top-level fields that differ between two versions of a document.
    const changed = (before, after) => [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key])).sort();
    const step = async (run, expected) => {
      const before = await state();
      await run();
      const after = await state();
      expect({ store: changed(before.store, after.store), classic: changed(before.classic, after.classic), quiz: changed(before.quiz, after.quiz) }).toEqual({ store: [], classic: [], quiz: [], ...expected });
    };
    const downsell = { enabled: true, percent: 20, modalTitle: 'Esperá', modalSubtitle: 'Una oferta', acceptText: 'Quiero', declineText: 'No', pageTitle: 'Oferta', pageSubtitle: 'Solo hoy' };
    const saveClassic = title => admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'inversion', template: 'classic', draft: { ...content, hero: { ...content.hero, title } } });

    // A store with everything in place: classic landing and quiz published, checkout and downsell set.
    await saveClassic('Primera versión');
    await admin.mutation(api.landings.publish, { storeId });
    await admin.mutation(api.quizzes.save, { storeId, subdomain: 'inversion', quiz: quiz() });
    await admin.mutation(api.quizzes.publish, { storeId });
    await admin.mutation(api.stores.updateCheckout, { id: storeId, checkout: { notifications: false, liveVisitors: true, upsellTitle: 'Extras', upsellReferences: [] } });
    await admin.mutation(api.stores.update, { id: storeId, ...store, downsell });
    expect(Object.keys((await state()).store).sort()).toEqual(['_creationTime', '_id', 'checkout', 'currency', 'downsell', 'name', 'offer', 'postPurchase', 'purchaseDraft', 'purchasePublished', 'status', 'subdomain', 'tracking']);

    // Store settings: the address, the purchase pages, the checkout and the downsell stay.
    await step(() => admin.mutation(api.stores.update, { id: storeId, ...store, name: 'Otro nombre', tracking: { metaPixelIds: ['1234567890', '9876543210'] } }), { store: ['name', 'tracking'] });
    await step(() => admin.mutation(api.stores.updateCheckout, { id: storeId, checkout: { notifications: true, liveVisitors: false, upsellTitle: 'Sumá', upsellReferences: [] } }), { store: ['checkout'] });

    // Classic landing: its draft and the purchase pages' draft; what is published stays.
    await step(() => saveClassic('Segunda versión'), { store: ['purchaseDraft'], classic: ['draft'] });
    await step(() => admin.mutation(api.landings.publish, { storeId }), { store: ['purchasePublished'], classic: ['published', 'publishedAt'] });

    // Quiz: only the quiz landing.
    const edited = quiz(); edited.steps[0].title = 'Otra pregunta';
    await step(() => admin.mutation(api.quizzes.save, { storeId, subdomain: 'inversion', quiz: edited }), { quiz: ['quizDraft'] });
    await step(() => admin.mutation(api.quizzes.publish, { storeId }), { quiz: ['publicationId', 'publishedAt'] });

    // With the classic landing unpublished, the quiz checkout keeps the published purchase pages,
    // also after the store settings are saved again.
    await step(() => admin.mutation(api.landings.unpublish, { storeId, type: 'classic' }), { classic: ['published', 'publishedAt'] });
    await step(() => admin.mutation(api.stores.update, { id: storeId, ...store, name: 'Tercer nombre' }), { store: ['name', 'tracking'] });
    expect((await t.query(api.storefront.getCheckout, { subdomain: 'inversion' })).content.hero.title).toBe('Segunda versión');
  });
});
