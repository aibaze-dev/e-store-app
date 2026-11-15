// Exit-intent popup of the public landing and its checkout: copy and trigger rule.
// Every sentence comes from the offer the visitor is looking at;
// nothing here states a price, discount, guarantee or deadline the store did not set.

const TEXT = {
  emoji: '👋',
  title: 'Pará un segundo',
  intro: {
    landing: name => `Antes de irte, mirá lo que te llevás hoy con «${name}».`,
    checkout: name => `Estás a un paso de tener «${name}». Antes de irte, mirá lo que incluye tu compra.`,
  },
  bullets: {
    access: 'Accedés al ebook apenas se confirma el pago',
    oneBonus: name => `Sumás gratis el bono «${name}»`,
    bonuses: count => `Sumás ${count} bonos gratis`,
    savings: (amount, percent) => `Ahorrás ${amount} (${percent}% OFF) sobre el valor de referencia`,
    singlePayment: 'Es un único pago',
    securePayment: 'Pagás de forma segura',
  },
  // On the landing the button repeats the landing's own purchase button.
  button: { landingFallback: 'Comprar ahora', checkout: 'Volver a mi compra' },
  closing: {
    guaranteeDays: days => `Comprás con garantía de ${days} días.`,
    guarantee: 'Tu compra tiene garantía: las condiciones están en la página.',
    plain: 'El pago es seguro y el acceso es inmediato.',
  },
};

// `step` is 'landing' or 'checkout'. `money` formats an amount in the store currency.
export function exitIntentCopy(view, step, money) {
  const { offer, content } = view;
  const bonusValue = offer.bonuses.reduce((total, bonus) => total + (bonus.referenceValue || 0), 0);
  const reference = Math.max(offer.main.price, offer.main.compareAtPrice || 0) + bonusValue;
  const savings = reference - offer.main.price;
  const guarantee = content.guarantee?.enabled !== false && Boolean(content.guarantee?.text);
  const bullets = [
    TEXT.bullets.access,
    offer.bonuses.length === 1 && TEXT.bullets.oneBonus(offer.bonuses[0].name),
    offer.bonuses.length > 1 && TEXT.bullets.bonuses(offer.bonuses.length),
    savings > 0 && TEXT.bullets.savings(money(savings), Math.round(savings / reference * 100)),
    TEXT.bullets.singlePayment,
    TEXT.bullets.securePayment,
  ].filter(Boolean).slice(0, 4);
  return {
    emoji: TEXT.emoji,
    title: TEXT.title,
    intro: TEXT.intro[step](offer.main.name),
    bullets,
    button: step === 'checkout' ? TEXT.button.checkout : content.hero?.ctaText || TEXT.button.landingFallback,
    closing: !guarantee ? TEXT.closing.plain : content.guarantee.days ? TEXT.closing.guaranteeDays(content.guarantee.days) : TEXT.closing.guarantee,
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

// Shared session memory, still used by the downsell's back trigger. The mouse-exit
// popup does not use this limit. Memory covers browsers where sessionStorage is blocked.
const shownInMemory = new Set();
const storageKey = scope => `exit-intent:${scope}`;
export const exitIntentSession = {
  seen(scope) {
    if (shownInMemory.has(scope)) return true;
    try { return sessionStorage.getItem(storageKey(scope)) === '1'; } catch { return false; }
  },
  mark(scope) {
    shownInMemory.add(scope);
    try { sessionStorage.setItem(storageKey(scope), '1'); } catch { /* memory already holds it */ }
  },
};
