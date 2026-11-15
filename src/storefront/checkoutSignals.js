// Temporary simulated checkout signals. Replace this source with real activity later.
// These values never affect orders, prices or Stripe's session expiry.
export function randomShoppers(previous, random = Math.random) {
  if (!Number.isInteger(previous) || previous < 2 || previous > 15) return 2 + Math.floor(random() * 14);
  const next = 2 + Math.floor(random() * 13);
  return next >= previous ? next + 1 : next;
}

export function checkoutDeadline(subdomain, storage, now = Date.now(), random = Math.random) {
  const key = `checkout-simulation:v1:${subdomain}`;
  try {
    const saved = Number(storage?.getItem(key));
    // Keep expired deadlines too: refreshing must not restart the countdown.
    if (Number.isFinite(saved) && saved > 0 && saved <= now + 899_000) return saved;
  } catch { /* Storage may be unavailable in private browsing. */ }
  const deadline = now + (481 + Math.floor(random() * 419)) * 1000;
  try { storage?.setItem(key, String(deadline)); } catch { /* Continue in memory. */ }
  return deadline;
}

export function checkoutTimeLeft(deadline, now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
