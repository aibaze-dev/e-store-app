import { PROMOTION_COPY, ACTIVITY_COPY, ACTIVITY_DEFAULTS } from '../../shared/landing-copy.js';
import { POST_PURCHASE_CONTENT } from '../../shared/post-purchase.js';
import { CLASSIC_ACCENT, CLASSIC_STORY, splitHeroTitle } from '../../shared/classic-design.js';

// Defaults are shared by the form and public renderer. Existing string lists remain readable.
export const EMPTY_CONTENT = {
  ...POST_PURCHASE_CONTENT,
  ...CLASSIC_STORY,
  hero: { eyebrow: '', title: '', titleAccent: '', subtitle: '', imageUrl: '', secondaryImageUrl: '', headerCtaText: '', ratingText: '', trustText: '', noteTitle: '', note: '', footnote: '', ctaText: 'Quiero mi copia' },
  promotion: { ...PROMOTION_COPY, title: '', enabled: true, message: 'Oferta limitada', timerMode: 'session' },
  benefits: { enabled: true, eyebrow: 'Tu kit completo', title: '¿Qué vas a encontrar adentro?', subtitle: 'Todo lo que necesitás en un solo lugar', imageUrl: '', imageAlt: '', videoUrl: '', items: [] },
  painPoints: { closingText: '', enabled: true, eyebrow: 'Si te pasa esto, es para vos', title: '¿Te sentís identificado?', subtitle: '', ctaText: '', items: [] },
  socialProof: { eyebrow: 'Testimonios de lectores', enabled: true, title: 'Lo que dicen quienes lo aplicaron', subtitle: '', ctaText: '', items: [] },
  bonuses: { enabled: true, eyebrow: 'Bono gratis', title: 'Bonos GRATIS incluidos', subtitle: 'Además del ebook, te llevás estos regalos', chips: [], ctaText: '', note: '' },
  summary: { enabled: true, title: 'Todo lo que incluye tu compra', subtitle: '', ctaText: '', note: '' },
  steps: { enabled: true, eyebrow: 'El método, paso a paso', title: 'Así lo aplicás', subtitle: '', items: [] },
  faq: { enabled: true, title: 'Preguntas frecuentes', subtitle: '', items: [] },
  guarantee: { enabled: true, title: 'Tu compra, con garantía', subtitle: '', text: '', ctaText: '' },
  closing: { enabled: true, title: '', text: '', ctaText: 'Comprar ahora y empezar', note: '', stickyEnabled: true },
  footer: { brandName: '', termsUrl: '', privacyUrl: '' },
  style: { accentColor: CLASSIC_ACCENT },
  activity: { ...ACTIVITY_COPY, ...ACTIVITY_DEFAULTS },
};

export function normalizeContent(content = {}) {
  const normalized = Object.fromEntries(Object.entries(EMPTY_CONTENT).map(([key, defaults]) => [key, { ...defaults, ...content[key] }]));
  Object.assign(normalized.hero, splitHeroTitle(content.hero));
  for (const key of ['benefits', 'painPoints', 'steps', 'postPurchaseBenefits']) {
    normalized[key].items = normalized[key].items.map(item => typeof item === 'string' ? { title: item, description: '', icon: 'check' } : { ...item });
  }
  normalized.socialProof.items = normalized.socialProof.items.map(item => ({ imageUrl: '', photoUrl: '', verified: false, format: 'quote', openingMessage: '', closingMessage: '', ...item }));
  normalized.bonuses.chips = [...normalized.bonuses.chips];
  normalized.comparison.items = normalized.comparison.items.map(item => ({ ...item }));
  return normalized;
}

// Regeneration replaces AI examples while retaining manually supplied testimonials.
export function mergeGeneratedContent(content, generated) {
  const merged = { ...content, ...Object.fromEntries(Object.entries(generated).map(([key, patch]) => [key, { ...content[key], ...patch }])) };
  if (generated.hero?.title !== undefined) Object.assign(merged.hero, splitHeroTitle(generated.hero));
  // Sections that start switched off turn on the first time the assistant writes them;
  // one the seller already filled keeps the visibility they chose.
  for (const key of ['introduction', 'transformation', 'about', 'showcase', 'comparison']) {
    const before = content[key] ?? {};
    if (generated[key] && !before.enabled && !before.title && !before.text && !before.items?.length) merged[key].enabled = true;
  }
  if (generated.socialProof?.items) {
    const existing = (content.socialProof?.items ?? []).filter(item => !item.isExample);
    merged.socialProof.items = [...existing, ...generated.socialProof.items].slice(0, 12);
  }
  return normalizeContent(merged);
}

export function offerTotals(offer) {
  const bonusValue = offer.bonuses.reduce((total, bonus) => total + (bonus.referenceValue || 0), 0);
  const reference = Math.max(offer.main.price, offer.main.compareAtPrice || 0) + bonusValue;
  const savings = Math.max(0, reference - offer.main.price);
  return { bonusValue, reference, savings, percent: reference ? Math.round(savings / reference * 100) : 0 };
}

// Age of a real purchase, in words. Older than a week returns null so it is not announced.
export function timeAgo(at, now) {
  const minutes = Math.max(1, Math.floor((now - at) / 60000));
  if (minutes < 60) return `hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  const days = Math.floor(hours / 24);
  return days <= 7 ? `hace ${days} ${days === 1 ? 'día' : 'días'}` : null;
}

// Checkout totals: what is charged, the reference value behind it and the difference.
// `upsells` are the extras the buyer selected.
export function checkoutTotals(offer, upsells) {
  const total = offer.main.price + upsells.reduce((sum, upsell) => sum + upsell.price, 0);
  const reference = offerTotals(offer).reference + upsells.reduce((sum, upsell) => sum + Math.max(upsell.price, upsell.compareAtPrice || 0), 0);
  return { total, reference, savings: Math.max(0, reference - total) };
}

export function promotionRemaining(promotion, now) {
  if (!promotion.enabled) return null;
  if (!promotion.endsAt) return '';
  const seconds = Math.ceil((promotion.endsAt - now) / 1000);
  if (seconds <= 0) return null;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  return `${days ? `${days}d ` : ''}${[hours, minutes, seconds % 60].map(n => String(n).padStart(2, '0')).join(':')}`;
}
