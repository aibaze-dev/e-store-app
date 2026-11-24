import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { api } from './api';
import { normalizeContent, EMPTY_CONTENT } from '../src/templates/content.js';
import { checkoutConfig } from '../shared/checkout-copy.js';
import { createAdvancedQuizTemplate, validateQuiz } from '../shared/quiz.js';
import { applyTexts, collectTexts } from '../shared/translate.js';
import { backend, signedIn, product, content } from './helpers';

const ADMIN = 'owner@example.com';
beforeEach(() => { vi.stubEnv('ADMIN_EMAILS', ADMIN); vi.stubEnv('OPENAI_API_KEY', 'test-only'); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

// A fake translator: prefixes every text and keeps its placeholders, like the model is told to.
function mockOpenAI({ translate = text => `EN ${text}`, broken = false } = {}) {
  const calls = [];
  vi.stubGlobal('fetch', async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    const items = JSON.parse(body.messages[1].content).map(({ index, text }) => ({ index, text: translate(text) }));
    return new Response(JSON.stringify({ choices: [{ message: { content: broken ? 'not json' : JSON.stringify({ items }) } }] }));
  });
  return calls;
}

async function fixture() {
  const t = backend();
  const admin = await signedIn(t, ADMIN);
  const main = await admin.mutation(api.products.create, product('Ebook', 'main'));
  const storeId = await admin.mutation(api.stores.create, { name: 'Tienda', status: 'active', currency: 'usd', offer: { mainProductId: main, price: 2700, bonuses: [], upsells: [] }, postPurchase: { enabled: false, price: 0 }, tracking: { metaPixelIds: [] } });
  return { t, admin, storeId };
}

describe('which texts are translated', () => {
  it('leaves IDs, URLs, colors, rules and enums alone and keeps placeholders', () => {
    const quiz = createAdvancedQuizTemplate('Guía');
    quiz.identity.logoUrl = 'https://cdn.example.com/logo.png';
    const paths = collectTexts(quiz).map(item => item.path.join('.'));
    expect(paths).toContain('identity.backText');
    expect(paths.some(path => /\.(id|type|ref|operator|op|mode|tone|layout|imageLayout|color|background|textColor|logoUrl|icon)$/.test(path))).toBe(false);
    expect(paths.some(path => /conditions\.\d+\.value$/.test(path))).toBe(false);

    const found = [{ path: ['a'], text: '{nombre} compró' }, { path: ['b'], text: 'Hola' }];
    const { document, kept } = applyTexts({ a: '{nombre} compró', b: 'Hola' }, found, ['{name} bought', 'Hello']);
    expect(document).toEqual({ a: '{nombre} compró', b: 'Hello' });
    expect(kept).toBe(1);
  });
});

describe('translating a landing', () => {
  it('returns every visible text translated, with the structure intact, and saves nothing', async () => {
    const { admin, storeId } = await fixture();
    const calls = mockOpenAI();
    const form = normalizeContent({ ...EMPTY_CONTENT, ...content, hero: { ...content.hero, imageUrl: 'https://cdn.example.com/hero.png' }, checkout: checkoutConfig({ content: {}, checkout: undefined }) });
    const { content: translated, kept } = await admin.action(api.translations.landing, { storeId, language: 'en', content: form });
    expect(kept).toBe(0);
    expect(translated.hero.title).toBe('EN Aprendé a invertir');
    expect(translated.faq.items[0]).toEqual({ question: 'EN ¿Es digital?', answer: 'EN Sí.' });
    expect(translated.hero.imageUrl).toBe('https://cdn.example.com/hero.png');
    expect(translated.style.accentColor).toBe('#c15f3c');
    expect(calls[0].messages[0].content).toContain('English');
    expect(await admin.query(api.landings.getForStore, { storeId })).toBeNull();
    // The translated landing saves through the usual draft path.
    await admin.mutation(api.landings.saveDraft, { storeId, subdomain: 'tienda', template: 'classic', draft: translated });
  });

  it('fails without changing anything when the provider fails, and refuses non-admins', async () => {
    const { t, admin, storeId } = await fixture();
    const form = normalizeContent({ ...EMPTY_CONTENT, ...content, checkout: checkoutConfig({ content: {}, checkout: undefined }) });
    mockOpenAI({ broken: true });
    await expect(admin.action(api.translations.landing, { storeId, language: 'pt', content: form })).rejects.toThrow(/No se pudo traducir/);
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(admin.action(api.translations.landing, { storeId, language: 'pt', content: form })).rejects.toThrow(/OPENAI_API_KEY/);
    const stranger = await signedIn(t, 'stranger@example.com');
    await expect(stranger.action(api.translations.landing, { storeId, language: 'en', content: form })).rejects.toThrow();
  });
});

describe('translating a quiz', () => {
  it('returns a valid quiz with the same steps, options and rules', async () => {
    const { admin, storeId } = await fixture();
    mockOpenAI({ translate: text => `PT ${text}` });
    const quiz = createAdvancedQuizTemplate('Guía');
    const { quiz: translated, kept } = await admin.action(api.translations.quiz, { storeId, language: 'pt', quiz });
    expect(kept).toBe(0);
    expect(validateQuiz(translated)).toEqual([]);
    expect(translated.steps.map(s => [s.id, s.type, s.options?.map(o => o.id)])).toEqual(quiz.steps.map(s => [s.id, s.type, s.options?.map(o => o.id)]));
    expect(translated.steps[0].title).toBe(`PT ${quiz.steps[0].title}`);
    expect(translated.identity.color).toBe(quiz.identity.color);
    expect(translated.calculations.map(c => [c.id, c.expression])).toEqual(quiz.calculations.map(c => [c.id, c.expression]));
  });
});
