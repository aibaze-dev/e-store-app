import { PROMOTION_COPY, ACTIVITY_COPY, ACTIVITY_DEFAULTS } from '../../shared/landing-copy.js';
import { POST_PURCHASE_CONTENT } from '../../shared/post-purchase.js';

// Defaults are shared by the form and public renderer. Existing string lists remain readable.
export const EMPTY_CONTENT = {
  ...POST_PURCHASE_CONTENT,
  hero: { title: '', subtitle: '', imageUrl: '', ctaText: 'Quiero mi copia' },
  promotion: { ...PROMOTION_COPY, enabled: true, message: 'Oferta limitada', timerMode: 'session' },
  benefits: { enabled: true, title: '¿Qué vas a encontrar adentro?', subtitle: 'Todo lo que necesitás en un solo lugar', items: [] },
  painPoints: { closingText: 'Si respondiste “sí” a alguna de estas… tenemos la solución.', enabled: true, title: '¿Te sentís identificado?', subtitle: 'Si alguno de estos problemas te suena familiar, este ebook es para vos', items: [] },
  socialProof: { eyebrow: 'Testimonios de lectores', enabled: true, title: 'Lo que dicen quienes lo aplicaron', subtitle: '', items: [] },
  bonuses: { enabled: true, title: 'Bonos GRATIS incluidos', subtitle: 'Además del ebook, te llevás estos regalos' },
  summary: { enabled: true, title: 'Todo lo que incluye tu compra', subtitle: 'Acceso a todo esto por un único pago' },
  steps: { enabled: true, title: 'Así lo aplicás', subtitle: '', items: [] },
  faq: { enabled: true, title: 'Preguntas frecuentes', subtitle: 'Resolvemos tus dudas', items: [] },
  guarantee: { enabled: true, title: 'Tu compra, con garantía', subtitle: '', text: '' },
  closing: { enabled: true, title: '', ctaText: 'Comprar ahora y empezar', stickyEnabled: true },
  footer: { brandName: '', termsUrl: '', privacyUrl: '' },
  style: { accentColor: '#f59e0b' },
  activity: { ...ACTIVITY_COPY, ...ACTIVITY_DEFAULTS },
};

export function normalizeContent(content = {}) {
  const normalized = Object.fromEntries(Object.entries(EMPTY_CONTENT).map(([key, defaults]) => [key, { ...defaults, ...content[key] }]));
  for (const key of ['benefits', 'painPoints', 'steps', 'postPurchaseBenefits']) {
    normalized[key].items = normalized[key].items.map(item => typeof item === 'string' ? { title: item, description: '', icon: 'check' } : { ...item });
  }
  normalized.socialProof.items = normalized.socialProof.items.map(item => ({ imageUrl: '', format: 'quote', openingMessage: '', closingMessage: '', ...item }));
  return normalized;
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
