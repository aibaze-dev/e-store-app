import { formatLandingText } from '../shared/landing-copy.js';
import { classicTheme, plainText } from '../shared/classic-design.js';
import { describe, it, expect } from 'vitest';
import { normalizeContent, mergeGeneratedContent, offerTotals, productDiscount, promotionRemaining, timeAgo, checkoutTotals } from '../src/templates/content.js';
import { content } from './helpers';

describe('sales template content', () => {
  it('uses each product reference for OFF badges and never labels a paid product as free', () => {
    expect(productDiscount(900, 1800)).toBe(50);
    expect(productDiscount(1900, 4900)).toBe(61);
    expect(productDiscount(999, 1899)).toBe(47);
    expect(productDiscount(1, 99999999)).toBe(99);
    for (const reference of [undefined, 0, 500, 900, NaN, Infinity]) expect(productDiscount(900, reference)).toBe(0);
    expect(productDiscount(0, 1800)).toBe(0);
  });
  it('separates the trailing hero accent without reordering legacy titles', () => {
    const hero = { title: 'Aprendé en 7 días y *tené el trabajo hecho*' };
    expect(normalizeContent({ hero }).hero).toMatchObject({ title: 'Aprendé en 7 días y', titleAccent: 'tené el trabajo hecho' });
    expect(hero.title).toBe('Aprendé en 7 días y *tené el trabajo hecho*');
    for (const title of ['Tu *asistente* en 7 días', '**Aprendé** y *delegá*', '*Todo resaltado*']) {
      expect(normalizeContent({ hero: { title } }).hero).toMatchObject({ title, titleAccent: '' });
    }
    expect(normalizeContent({ hero: { ...hero, titleAccent: '' } }).hero).toMatchObject({ ...hero, titleAccent: '' });
  });
  it('replaces both hero title parts when generating new copy', () => {
    const current = normalizeContent({ hero: { title: 'Anterior', titleAccent: 'Remate anterior' } });
    expect(mergeGeneratedContent(current, { hero: { title: 'Nuevo título' } }).hero).toMatchObject({ title: 'Nuevo título', titleAccent: '' });
    expect(mergeGeneratedContent(current, { hero: { title: 'Nuevo', titleAccent: 'Remate nuevo' } }).hero).toMatchObject({ title: 'Nuevo', titleAccent: 'Remate nuevo' });
    expect(mergeGeneratedContent(current, { hero: { title: 'Nuevo *remate*' } }).hero).toMatchObject({ title: 'Nuevo', titleAccent: 'remate' });
  });
  it('upgrades the legacy palette while preserving a personalized brand color', () => {
    expect(classicTheme('#f59e0b')).toEqual(classicTheme());
    expect(classicTheme('invalid')).toEqual(classicTheme());
    expect(classicTheme('#2040a0')).toMatchObject({ '--sales-accent': '#2040a0', '--classic-cta-end': '#2040a0', '--classic-cta-text': '#ffffff' });
    expect(classicTheme('#eeeeee')['--classic-cta-text']).toBe('#111827');
  });
  it('removes the highlight marks wherever a title is shown as plain text', () => {
    expect(plainText('Aprendé y *tené el trabajo hecho* en **7 días**')).toBe('Aprendé y tené el trabajo hecho en 7 días');
    expect(plainText('5 * 3 = 15')).toBe('5 * 3 = 15');
    expect(plainText(undefined)).toBe('');
  });
  it('gives older landings the new section copy without touching what they saved', () => {
    const normalized = normalizeContent({ ...content, bonuses: { title: 'Bonos', chips: ['Uno'] }, socialProof: { title: '', items: [{ name: 'Ana', quote: 'Hola' }] } });
    expect(normalized.combo).toMatchObject({ enabled: true, allText: 'Llevar todo' });
    expect(normalized.bonuses).toMatchObject({ title: 'Bonos', chips: ['Uno'], eyebrow: 'Bono gratis' });
    expect(normalized.socialProof.items[0]).toMatchObject({ name: 'Ana', photoUrl: '', verified: false });
    expect(normalized.hero).toMatchObject({ title: content.hero.title, headerCtaText: '', trustText: '' });
  });
  it('loads legacy lists without mutating published content and fills missing sections', () => {
    const old = { ...content, benefits: { title: 'Beneficios', items: ['Una guía clara'] } };
    const normalized = normalizeContent(old);
    expect(normalized.benefits.items).toEqual([{ title: 'Una guía clara', description: '', icon: 'check' }]);
    expect(normalized.steps.items).toEqual([]);
    expect(normalized.promotion.enabled).toBe(true);
    expect(normalized.promotion.timerMode).toBe('session');
    normalized.benefits.items[0].title = 'Otro título';
    expect(old.benefits.items[0]).toBe('Una guía clara');
  });
  it('enables promotion and all activity by default while preserving explicit choices', () => {
    const fresh = normalizeContent();
    expect(fresh.promotion).toMatchObject({ enabled: true, timerMode: 'session' });
    expect(fresh.activity).toMatchObject({ viewers: true, notifications: true, salesCount: true });
    expect(fresh.promotion.remainingSpots).toBeUndefined();
    const saved = normalizeContent({ promotion: { enabled: false }, activity: { viewers: false, notifications: false, salesCount: false } });
    expect(saved.promotion.enabled).toBe(false);
    expect(saved.activity).toMatchObject({ viewers: false, notifications: false, salesCount: false });
  });
  it('fills legacy copy and replaces repeated tokens without interpreting inserted values', () => {
    const normalized = normalizeContent(content);
    expect(normalized.promotion.timerLabel).toBe('La oferta vence en');
    expect(normalized.socialProof.eyebrow).toBe('Testimonios de lectores');
    expect(formatLandingText(normalized.promotion.spotsText, { cantidad: 7 })).toBe('Quedan 7 cupos a este precio');
    expect(formatLandingText('{nombre}: {nombre} {desconocido}', { nombre: '{cantidad}' })).toBe('{cantidad}: {cantidad} {desconocido}');
    expect(normalizeContent({ activity: { viewersText: '' } }).activity.viewersText).toBe('');
  });
  it('replaces generated examples without losing manual testimonials, metrics or visibility', () => {
    const real = { name: 'Ana', quote: 'Texto original', format: 'chat' };
    const old = normalizeContent({ socialProof: { enabled: false, rating: 4.8, items: [real, { name: 'Viejo', quote: 'Ejemplo anterior', isExample: true }] } });
    const generated = { socialProof: { title: 'Ejemplos', items: [{ name: 'Nuevo', quote: 'Ejemplo nuevo', isExample: true }] } };
    const merged = mergeGeneratedContent(old, generated);
    expect(merged.socialProof).toMatchObject({ enabled: false, rating: 4.8, items: [real, generated.socialProof.items[0]] });
    expect(mergeGeneratedContent(merged, generated)).toEqual(merged);
    expect(old.socialProof.items[1].name).toBe('Viejo');
    const full = normalizeContent({ socialProof: { items: Array.from({ length: 12 }, () => ({ ...real })) } });
    expect(mergeGeneratedContent(full, generated).socialProof.items).toEqual(full.socialProof.items);
  });
  it('calculates bundle savings from reference values without changing the charge', () => {
    const offer = { main: { price: 1699000, compareAtPrice: 8495000 }, bonuses: [{ referenceValue: 1499000 }] };
    expect(offerTotals(offer)).toEqual({ bonusValue: 1499000, reference: 9994000, savings: 8295000, percent: 83 });
    expect(offer.main.price).toBe(1699000);
    expect(offerTotals({ main: { price: 2700 }, bonuses: [{}] }).savings).toBe(0);
  });
  it('describes the real age of a purchase and stops announcing it after a week', () => {
    const now = 1_800_000_000_000;
    expect(timeAgo(now - 20_000, now)).toBe('hace 1 minuto');
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('hace 3 horas');
    expect(timeAgo(now - 7 * 86_400_000, now)).toBe('hace 7 días');
    expect(timeAgo(now - 8 * 86_400_000, now)).toBeNull();
  });
  it('totals the checkout with selected extras and their reference prices', () => {
    const offer = { main: { price: 2700, compareAtPrice: 5400 }, bonuses: [{ referenceValue: 1500 }] };
    expect(checkoutTotals(offer, [])).toEqual({ total: 2700, reference: 6900, savings: 4200 });
    expect(checkoutTotals(offer, [{ price: 900, compareAtPrice: 1800 }, { price: 500 }])).toEqual({ total: 4100, reference: 9200, savings: 5100 });
    expect(checkoutTotals({ main: { price: 2700 }, bonuses: [] }, [{ price: 500 }]).savings).toBe(0);
  });
  it('uses one absolute deadline and hides expired or disabled promotions', () => {
    const now = 1_800_000_000_000;
    const promotion = { enabled: true, endsAt: now + 90_061_000 };
    expect(promotionRemaining(promotion, now)).toBe('1d 01:01:01');
    expect(promotionRemaining(promotion, promotion.endsAt)).toBeNull();
    expect(promotionRemaining({ ...promotion, enabled: false }, now)).toBeNull();
    expect(promotionRemaining({ enabled: true }, now)).toBe('');
  });
});

describe('landing editor attention', () => {
  it('flags what a generated landing still needs and clears each flag once it is solved', async () => {
    const { landingAttention } = await import('../src/panel/landing-attention.js');
    const generated = normalizeContent({
      ...content,
      transformation: { enabled: true, title: 'De dudar a invertir' },
      showcase: { enabled: true, title: 'Todo lo que recibís' },
      about: { enabled: true, title: 'Quiénes somos', text: 'Somos Tienda.' },
      socialProof: { title: 'Opiniones', items: [{ name: 'Ana', quote: 'Hola', isExample: true }, { name: 'Luz', quote: 'Clara', photoUrl: 'https://example.com/luz.jpg' }] },
      guarantee: { title: 'Garantía', text: '' },
      comparison: { enabled: true, title: 'Caminos', items: [{ title: 'Solo', description: 'Lento', highlighted: false }] },
      introduction: { enabled: false, title: '', text: '' },
    });
    const checks = landingAttention(generated, { bonuses: 0, upsells: 0, hasCover: false });
    const needs = id => (checks[id]?.needs ?? []).map(item => item.label);
    const extras = id => (checks[id]?.extras ?? []).map(item => item.label);
    expect(needs('transformation')).toEqual(['Falta la foto']);
    expect(needs('showcase')).toEqual(['Falta la foto']);
    expect(needs('cover')).toEqual(['Falta la foto principal']);
    expect(extras('cover')).toEqual(['Segunda foto', 'Calificación', 'Texto de calificación']);
    expect(needs('offer')).toEqual(['Sin bonos en la tienda']);
    expect(needs('combo')).toEqual(['Sin extras en la tienda']);
    expect(needs('socialProof')).toEqual(['Testimonios de ejemplo']);
    expect(checks.socialProof.extras[0].text).toContain('1 testimonio sin foto');
    expect(needs('guarantee')).toEqual(['Sin condiciones']);
    expect(needs('comparison')).toEqual(['Sin columna destacada']);
    expect(needs('steps')).toEqual(['Sin pasos']);
    expect(extras('about')).toEqual(['Foto del equipo']);
    expect(extras('promotion')).toEqual(['Cupos']);
    expect(checks.introduction).toBeUndefined();
    expect(checks.hero).toBeUndefined();

    const solved = normalizeContent({
      ...generated,
      hero: { ...generated.hero, imageUrl: 'https://example.com/a.png', secondaryImageUrl: 'https://example.com/b.png', ratingText: 'Edición 2026' },
      transformation: { ...generated.transformation, imageUrl: 'https://example.com/t.png' },
      showcase: { ...generated.showcase, enabled: false },
      socialProof: { title: 'Opiniones', rating: 4.9, customers: 300, satisfaction: 98, items: [{ name: 'Luz', quote: 'Clara', photoUrl: 'https://example.com/luz.jpg' }] },
      guarantee: { title: 'Garantía', text: '7 días.' },
      promotion: { enabled: true, message: 'Oferta', remainingSpots: 5 },
    });
    const after = landingAttention(solved, { bonuses: 2, upsells: 1, hasCover: true });
    for (const id of ['transformation', 'showcase', 'cover', 'offer', 'combo', 'socialProof', 'guarantee', 'promotion']) expect(after[id]).toBeUndefined();
    expect(landingAttention(normalizeContent({ ...content, hero: { ...content.hero, title: ' ' } })).hero.needs[0].label).toBe('Falta el título');
  });
});
