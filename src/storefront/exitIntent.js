import { landingExitConfig } from '../../shared/purchase-copy.js';
import { checkoutConfig, checkoutText } from '../../shared/checkout-copy.js';
// Exit-intent popup of the public landing and its checkout: copy and trigger rule.
// Every sentence comes from the offer the visitor is looking at;
// nothing here states a price, discount, guarantee or deadline the store did not set.

export function exitIntentCopy(view, step, money) {
  const { offer, content } = view;
  const bonusValue = offer.bonuses.reduce((total, bonus) => total + (bonus.referenceValue || 0), 0);
  const reference = Math.max(offer.main.price, offer.main.compareAtPrice || 0) + bonusValue;
  const savings = reference - offer.main.price;
  const guarantee = content.guarantee?.enabled !== false && Boolean(content.guarantee?.text);
  const copy = step === 'checkout' ? checkoutConfig(view) : landingExitConfig(view);
  const t = (key, values) => checkoutText(copy, key, values);
  return {
    emoji: copy.exitEmoji, title: copy.exitTitle, intro: t('exitIntro', { producto: offer.main.name }),
    bullets: [copy.exitAccess,
      offer.bonuses.length === 1 && t('exitOneBonus', { bono: offer.bonuses[0].name }),
      offer.bonuses.length > 1 && t('exitBonuses', { cantidad: offer.bonuses.length }),
      savings > 0 && t('exitSavings', { importe: money(savings), porcentaje: Math.round(savings / reference * 100) }),
      copy.exitSinglePayment, copy.exitSecure,
    ].filter(Boolean).slice(0, 4),
    button: copy.exitButton,
    closing: !guarantee ? copy.exitClosing : content.guarantee.days ? t('exitGuaranteeDays', { dias: content.guarantee.days }) : copy.exitGuarantee,
  };
}

// True only when a mouse pointer really left the document through one of its edges.
// Moving between elements or into an embedded frame has a related target or stays inside
// the viewport; touch and pen never count.
export function leftDocument(event, viewport) {
  if (event.pointerType !== 'mouse' || event.relatedTarget) return false;
  return event.clientX <= 0 || event.clientY <= 0 || event.clientX >= viewport.innerWidth || event.clientY >= viewport.innerHeight;
}

// Shared by landing and checkout so navigating between them keeps the cooldown.
// Ignored events neither postpone the next opportunity nor schedule an opening.
const lastShownAt = new Map();
export function claimExitIntent(scope, now = performance.now()) {
  const previous = lastShownAt.get(scope);
  if (previous !== undefined && now - previous < 10_000) return false;
  lastShownAt.set(scope, now);
  return true;
}

const sessionCounts = new Map();
const sessionKey = (store, step) => `exit-intent:v2:${store}:${step}`;
function sessionCount(key) {
  const fallback = sessionCounts.get(key) ?? 0;
  try { return Math.max(fallback, Number(sessionStorage.getItem(key)) || 0); }
  catch { return fallback; }
}
export function canShowExit(store, step) {
  return sessionCount(sessionKey(store, step)) < (step === 'landing' ? 1 : 2);
}
export function claimSessionExit(store, step) {
  if (!canShowExit(store, step)) return false;
  const key = sessionKey(store, step);
  const count = sessionCount(key) + 1;
  sessionCounts.set(key, count);
  try { sessionStorage.setItem(key, String(count)); } catch { /* Use memory in this tab. */ }
  return true;
}
