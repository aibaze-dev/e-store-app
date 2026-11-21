// Downsell of the public landing: default texts, shown prices and the "back" trigger.
// The charged amount always comes from the server; nothing here decides a price.

import { DOWNSELL_DEFAULTS } from '../../shared/purchase-copy.js';
export { DOWNSELL_DEFAULTS };

// Texts the store left empty fall back to the defaults.
export function downsellCopy(downsell) {
  return Object.fromEntries(Object.entries(DOWNSELL_DEFAULTS).map(([key, fallback]) => [key, downsell?.[key]?.trim() || fallback]));
}

export { discountedPrice } from '../../shared/post-purchase.js';

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
    // Reloads and React effect remounts reuse the guard already at this location.
    if (!win.history.state?.offerExitGuard) {
      win.history.pushState({ ...win.history.state, offerExitGuard: true }, '');
    }
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
