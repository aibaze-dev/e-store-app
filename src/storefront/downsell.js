// Downsell of the public landing: default texts, shown prices and the "back" trigger.
// The charged amount always comes from the server; nothing here decides a price.

export const DOWNSELL_DEFAULTS = {
  modalTitle: '¡Esperá! Tenemos un regalo para vos 🎁',
  modalSubtitle: 'Antes de irte, mirá esta oferta exclusiva con un descuento que solo está disponible ahora.',
  acceptText: 'Ver oferta',
  declineText: 'No, gracias',
  pageTitle: 'Acabás de desbloquear una oferta secreta 🔓',
  pageSubtitle: 'Sabemos que el precio puede ser una traba. Por eso queremos hacerte llegar esto al alcance, con un descuento especial que solo aparece una vez.',
};

// Texts the store left empty fall back to the defaults.
export function downsellCopy(downsell) {
  return Object.fromEntries(Object.entries(DOWNSELL_DEFAULTS).map(([key, fallback]) => [key, downsell?.[key]?.trim() || fallback]));
}

// Same rule as the server (convex/lib/pricing.ts); used only to preview a price in the panel.
export function discountedPrice(price, percent) {
  return Math.max(1, Math.round(price * (100 - percent) / 100));
}

// Calls `onBack` the first time the visitor goes back, keeping them on the page. It adds a
// second history entry for the same address, so the first "back" lands on it. Browsers skip
// entries added before any interaction, so the entry waits for the first tap, click or key.
// Returns the cleanup.
const ACTIVATION_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown'];
export function watchBackIntent(win, onBack) {
  let guarded = false;
  const stopWaiting = () => ACTIVATION_EVENTS.forEach(name => win.removeEventListener(name, guard, true));
  function guard() {
    if (guarded || win.navigator.userActivation?.hasBeenActive === false) return;
    guarded = true;
    stopWaiting();
    win.history.pushState(win.history.state, '');
  }
  const onPop = () => {
    if (!guarded) return;
    win.removeEventListener('popstate', onPop);
    onBack();
  };
  ACTIVATION_EVENTS.forEach(name => win.addEventListener(name, guard, true));
  win.addEventListener('popstate', onPop);
  guard();
  return () => { stopWaiting(); win.removeEventListener('popstate', onPop); };
}
