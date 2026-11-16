// Temporary simulated checkout signals. Replace this source with real activity later.
// These values never affect orders, prices or Stripe's session expiry.
export function randomShoppers(previous, random = Math.random) {
  if (!Number.isInteger(previous) || previous < 2 || previous > 15) return 2 + Math.floor(random() * 14);
  const next = 2 + Math.floor(random() * 13);
  return next >= previous ? next + 1 : next;
}

// Each cycle starts at a random value around 15 minutes (14:00–15:59), never from a fixed date.
export const COUNTDOWN_MIN_SECONDS = 840;
export const COUNTDOWN_MAX_SECONDS = 959;

export function checkoutDeadline(subdomain, storage, now = Date.now(), random = Math.random) {
  const key = `checkout-simulation:v2:${subdomain}`;
  try {
    const saved = Number(storage?.getItem(key));
    // Reloading keeps the running countdown; an expired one starts a new cycle instead of staying at 00:00.
    if (Number.isFinite(saved) && saved > now && saved <= now + COUNTDOWN_MAX_SECONDS * 1000) return saved;
  } catch { /* Storage may be unavailable in private browsing. */ }
  const seconds = COUNTDOWN_MIN_SECONDS + Math.floor(random() * (COUNTDOWN_MAX_SECONDS - COUNTDOWN_MIN_SECONDS + 1));
  const deadline = now + seconds * 1000;
  try { storage?.setItem(key, String(deadline)); } catch { /* Continue in memory. */ }
  return deadline;
}

export function checkoutTimeLeft(deadline, now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
