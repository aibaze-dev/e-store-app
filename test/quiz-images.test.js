import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { backend, signedIn, product } from './helpers';
import { createQuizTemplate, newStep, validateQuiz } from '../shared/quiz.js';
import { withImagePlan } from '../convex/lib/quiz_images';
import { generateQuizImages, quizImages } from '../src/panel/quiz-images.js';

beforeEach(() => { vi.stubEnv('ADMIN_EMAILS', 'owner@example.com'); vi.stubEnv('OPENAI_API_KEY', 'test-only'); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
async function fixture() {
  const t = backend(), admin = await signedIn(t, 'owner@example.com');
  const main = await admin.mutation(api.products.create, product('Guía de huerto', 'guide'));
  const storeId = await admin.mutation(api.stores.create, { name: 'Tienda', status: 'active', currency: 'usd', offer: { mainProductId: main, price: 2700, bonuses: [], upsells: [] }, postPurchase: { enabled: false, price: 0 }, tracking: { metaPixelId: '' } });
  return { t, admin, storeId };
}
function proposal() {
  const quiz = createQuizTemplate('Guía');
  quiz.steps = [newStep('intro', 'welcome'), newStep('single', 'goal'), newStep('contact', 'contact')];
  quiz.calculations = [];
  quiz.results = [{ id: 'general', default: true, title: 'Tu guía', blocks: [{ id: 'offer', type: 'offer' }] }];
  return quiz;
}
const copy = { title: 'Tu huerto', description: 'Cultivá en casa', visualStyle: 'Ilustración cálida de trazos simples', imagePrompt: 'Un balcón con macetas', imageAlt: 'Macetas en un balcón', steps: [{ title: '¿Qué querés cultivar?', imagePrompt: 'Hierbas y verduras en macetas', imageAlt: 'Hierbas y verduras' }], results: [{ id: 'general', title: 'Tu guía', description: 'Conocé el contenido de la guía', imagePrompt: 'Herramientas para empezar un huerto', imageAlt: 'Herramientas de jardinería' }] };
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02, 0xff, 0xd9]);

describe('AI quiz images', () => {
  it('the text-generation action returns image briefs for the entire new proposal', async () => {
    const f = await fixture();
    const output = { ...copy, steps: Array.from({ length: 3 }, (_, i) => ({ ...copy.steps[0], type: 'single', title: `Pregunta ${i + 1}`, description: 'Elegí una opción', imagePrompt: `Escena ${i + 1}`, options: [{ label: 'A', description: '' }, { label: 'B', description: '' }] })) };
    const fetch = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] })));
    vi.stubGlobal('fetch', fetch);
    const quiz = await f.admin.action(api.quiz_wizard.generate, { storeId: f.storeId, quiz: proposal(), audience: 'Principiantes', goal: 'Conocer sus objetivos', tone: 'Cercano', length: 3, mode: 'replace' });
    expect(quizImages(quiz)).toHaveLength(5);
    expect(validateQuiz(quiz, true)).toEqual([]);
    expect(quiz.steps.filter(s => s.type === 'single').map(s => JSON.parse(s.imagePrompt).scene)).toEqual(['Escena 1', 'Escena 2', 'Escena 3']);
    const request = JSON.parse(fetch.mock.calls[0][1].body);
    expect(request.response_format.json_schema.schema.properties.steps.items.required).toContain('imagePrompt');
    expect(await f.admin.query(api.landings.list, { storeId: f.storeId })).toEqual([]);
  });

  it('plans distinct cover, question and result images while preserving uploads and the original quiz', () => {
    const original = proposal();
    const planned = withImagePlan(original, copy, ['goal'], 'Principiantes');
    expect(validateQuiz(planned, true)).toEqual([]);
    expect(quizImages(planned)).toHaveLength(3);
    expect(quizImages(original)).toHaveLength(0);
    expect(planned.steps[0].imageAlt).toBe('Macetas en un balcón');
    for (const { node } of quizImages(planned)) expect(JSON.parse(node.imagePrompt)).toMatchObject({ style: copy.visualStyle, audience: 'Principiantes' });
    original.steps[0].imageUrl = 'https://example.com/manual.jpg';
    original.results[0].blocks.unshift({ id: 'manual', type: 'image', imageUrl: 'https://example.com/result.jpg' });
    const preserved = withImagePlan(original, copy, ['goal'], 'Principiantes');
    expect(preserved.steps[0].imageUrl).toBe(original.steps[0].imageUrl);
    expect(preserved.results[0].blocks).toEqual(original.results[0].blocks);
    expect(quizImages(preserved)).toHaveLength(1);
  });

  it('retains completed images on failure and retries only missing images, at most two at a time', async () => {
    const planned = withImagePlan(proposal(), copy, ['goal'], 'Principiantes');
    let active = 0, peak = 0, calls = 0;
    const generation = vi.fn(async () => {
      active++; peak = Math.max(peak, active); const n = ++calls;
      await Promise.resolve(); active--;
      if (n === 2) throw new Error('Provider unavailable');
      return { imageUrl: `https://images.example/${n}.jpg` };
    });
    const progress = vi.fn();
    const partial = await generateQuizImages(planned, generation, progress);
    expect(partial.failed).toBe(1);
    expect(peak).toBe(2);
    expect(quizImages(partial.quiz).filter(i => i.node.imageUrl)).toHaveLength(2);
    expect(quizImages(planned).every(i => !i.node.imageUrl)).toBe(true);
    const retry = vi.fn(async () => ({ imageUrl: 'https://images.example/retried.jpg' }));
    const finished = await generateQuizImages(partial.quiz, retry);
    expect(retry).toHaveBeenCalledOnce();
    expect(finished.failed).toBe(0);
    expect(finished.quiz.steps[0].imageUrl).toBe(partial.quiz.steps[0].imageUrl);
    expect(quizImages(finished.quiz).every(i => i.node.imageUrl)).toBe(true);
    expect(progress.mock.calls.at(-1)[0]).toMatchObject({ completed: 3, total: 3, failed: 1 });
    expect(validateQuiz(finished.quiz, true)).toEqual([]);
  });

  it('requires an admin, valid store, key and bounded prompt before calling the provider', async () => {
    const f = await fixture();
    const regular = await signedIn(f.t, 'reader@example.com');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const args = { storeId: f.storeId, prompt: 'Un huerto' };
    await expect(f.t.action(api.quiz_images.generate, args)).rejects.toThrow();
    await expect(regular.action(api.quiz_images.generate, args)).rejects.toThrow();
    await expect(f.admin.action(api.quiz_images.generate, { ...args, prompt: 'x'.repeat(6001) })).rejects.toThrow(/6.000/);
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(f.admin.action(api.quiz_images.generate, args)).rejects.toThrow(/configurada/);
    vi.stubEnv('OPENAI_API_KEY', 'test-only');
    await f.t.run(ctx => ctx.db.delete(f.storeId));
    await expect(f.admin.action(api.quiz_images.generate, args)).rejects.toThrow(/disponible/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('generates real storage assets, keeps draft/publication unchanged until explicitly saved, then publishes the URLs', async () => {
    const f = await fixture();
    const original = proposal();
    await f.admin.mutation(api.quizzes.save, { storeId: f.storeId, subdomain: 'guide', quiz: original });
    await f.admin.mutation(api.quizzes.publish, { storeId: f.storeId });
    vi.stubEnv('OPENAI_IMAGE_MODEL', 'gpt-image-2.6-flare');
    const fetch = vi.fn(async () => new Response(JSON.stringify({ data: [{ b64_json: jpeg.toString('base64') }] })));
    vi.stubGlobal('fetch', fetch);
    const planned = withImagePlan(original, copy, ['goal'], 'Principiantes');
    const { quiz, failed } = await generateQuizImages(planned, args => f.admin.action(api.quiz_images.generate, { storeId: f.storeId, ...args }));
    expect(failed).toBe(0);
    const request = JSON.parse(fetch.mock.calls[0][1].body);
    expect(fetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/images/generations');
    expect(request).toMatchObject({ model: 'gpt-image-2.6-flare', output_format: 'jpeg', size: '1536x1024', n: 1 });
    expect(request.prompt).toContain('Guía de huerto');
    expect(request).not.toHaveProperty('response_format');
    const stored = await f.t.run(ctx => ctx.db.system.query('_storage').collect());
    expect(stored).toHaveLength(3);
    // convex-test omits contentType from metadata; inspect the stored Blob itself.
    const blobs = await f.t.run(ctx => Promise.all(stored.map(async file => {
      const blob = await ctx.storage.get(file._id);
      return { type: blob.type, size: blob.size };
    })));
    expect(blobs.every(blob => blob.type === 'image/jpeg' && blob.size === jpeg.length)).toBe(true);
    expect((await f.admin.query(api.quizzes.get, { storeId: f.storeId })).quiz).toEqual(original);
    expect(await f.t.query(api.quizzes.publicConfig, { subdomain: 'guide' })).toEqual(original);
    await f.admin.mutation(api.quizzes.save, { storeId: f.storeId, subdomain: 'guide', quiz });
    expect(await f.t.query(api.quizzes.publicConfig, { subdomain: 'guide' })).toEqual(original);
    await f.admin.mutation(api.quizzes.publish, { storeId: f.storeId });
    expect(await f.t.query(api.quizzes.publicConfig, { subdomain: 'guide' })).toEqual(quiz);
  });

  it.each(['refusal', 'missing', 'invalid', 'network'])('handles %s without storing a broken image or exposing provider secrets', async failure => {
    const f = await fixture();
    vi.stubGlobal('fetch', async () => {
      if (failure === 'network') throw new Error('private details');
      return new Response(JSON.stringify(failure === 'refusal' ? { error: { message: 'private details' } } : failure === 'invalid' ? { data: [{ b64_json: btoa('<html>invalid</html>') }] } : { data: [] }), { status: failure === 'refusal' ? 403 : 200 });
    });
    await expect(f.admin.action(api.quiz_images.generate, { storeId: f.storeId, prompt: 'Un huerto' })).rejects.toThrow(/reintentá las pendientes/);
    expect(await f.t.run(ctx => ctx.db.system.query('_storage').collect())).toHaveLength(0);
  });

  it('builds the whole final page from the AI copy and plans its now/after and product images', async () => {
    const f = await fixture();
    const steps = [
      { ...copy.steps[0], type: 'single', title: '¿Cuál es tu experiencia?', description: '', options: [{ label: 'Ninguna', description: '' }, { label: 'Algo', description: '' }, { label: 'Mucha', description: '' }] },
      { ...copy.steps[0], type: 'multiple', title: '¿Qué querés lograr?', description: '', options: [{ label: 'Comer sano', description: '' }, { label: 'Ahorrar', description: '' }] },
      { ...copy.steps[0], type: 'number', title: '¿Cuántos minutos?', description: '', options: [] },
    ];
    const finalPage = {
      planName: 'plan de huerta', now: { label: 'Ahora', imagePrompt: 'Persona dudando frente a macetas vacías', imageAlt: 'Persona dudando' }, after: { label: 'Con tu plan', imagePrompt: 'La misma persona cosechando', imageAlt: 'Persona cosechando' },
      metrics: [{ label: 'Confianza', now: 1, after: 9 }], levelQuestion: 0, levelTitle: 'Tu experiencia', leftLabel: 'Inicial', rightLabel: 'Experto',
      levels: [{ tone: 'info', title: 'Desde cero', text: 'Empezamos por lo básico.' }, { tone: 'good', title: 'Buena base', text: '' }, { tone: 'nope', title: 'Avanzado', text: '' }],
      recommendations: [{ icon: '💧', label: 'Riego diario', value: '2 vasos', display: 'icons', percent: 0, minLabel: '', maxLabel: '', unitIcon: '💧', filled: 20, total: 40 }],
      summary: [{ questionIndex: 0, label: 'Experiencia', icon: '🌱' }, { questionIndex: 7, label: 'Fuera', icon: 'x' }], goalsQuestion: 1, goals: ['Cosechar en 6 semanas'],
      features: [{ icon: '📗', title: 'Guía paso a paso' }], mockups: [{ imagePrompt: 'Ebook en una tablet sobre la mesa', imageAlt: 'Ebook en tablet' }],
    };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ...copy, finalPage, steps }) } }] }))));
    const quiz = await f.admin.action(api.quiz_wizard.generate, { storeId: f.storeId, quiz: proposal(), audience: 'Principiantes', goal: 'Conocer su experiencia', tone: 'Cercano', length: 3, mode: 'replace' });
    expect(validateQuiz(quiz, true)).toEqual([]);
    const blocks = quiz.results[0].blocks, of = type => blocks.find(b => b.type === type);
    expect(blocks.map(b => b.type)).toEqual(['nowAfter', 'gauge', 'stats', 'planSummary', 'goals', 'features', 'guarantee', 'offer']);
    expect(of('nowAfter').metrics).toEqual([{ label: 'Confianza', now: 1, after: 5 }]);
    expect(of('gauge').ranges.map(r => [r.min, r.tone])).toEqual([[1, 'info'], [2, 'good'], [3, 'good']]);
    expect(of('stats').items[0]).toMatchObject({ total: 12, filled: 12, display: 'icons' });
    expect(of('planSummary')).toMatchObject({ title: '{{contact:name}}, tu plan de huerta está *listo*', items: [{ label: 'Experiencia' }] });
    expect(of('goals').stepId).toBe(quiz.steps.find(s => s.type === 'multiple').id);
    // 3 questions + cover + now + after + 1 mockup; no generic result image when the page has its own.
    const images = quizImages(quiz);
    expect(images).toHaveLength(7);
    expect(images.filter(i => i.key.startsWith('result:')).map(i => i.key.split(':').slice(2).join(':'))).toEqual(['now_after:now', 'now_after:after', 'features:mockup0']);
    expect(JSON.parse(of('nowAfter').now.imagePrompt)).toMatchObject({ scene: 'Persona dudando frente a macetas vacías', style: copy.visualStyle });
    expect(JSON.stringify(quiz)).not.toContain('imageScene');
  });
});
