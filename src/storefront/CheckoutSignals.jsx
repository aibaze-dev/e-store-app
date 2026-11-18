import { CHECKOUT_DEFAULTS, checkoutText } from '../../shared/checkout-copy.js';
import { PROMOTION_COPY } from '../../shared/landing-copy.js';
import { useEffect, useState } from 'react';
import { Clock, Users } from 'lucide-react';
import { checkoutDeadline, checkoutTimeLeft, randomShoppers } from './checkoutSignals.js';

const fallbackDeadlines = new Map();
const memoryStorage = { getItem: key => fallbackDeadlines.get(key), setItem: (key, value) => fallbackDeadlines.set(key, value) };

// The countdown is always a random ~15 minute cycle per visitor; `promotion` is kept for callers.
export function useSimulatedCheckoutSignals(subdomain, { preview = false } = {}) {
  const [shoppers, setShoppers] = useState(() => randomShoppers());
  const [deadline, setDeadline] = useState(null);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (preview) { setDeadline(null); return; }
    let storage;
    try { storage = window.sessionStorage; storage.getItem('checkout-simulation:probe'); } catch { storage = memoryStorage; }
    let current = checkoutDeadline(subdomain, storage);
    setDeadline(current);
    setNow(Date.now());
    const clock = setInterval(() => {
      const time = Date.now();
      if (time >= current) { current = checkoutDeadline(subdomain, storage, time); setDeadline(current); }
      setNow(time);
    }, 1000);
    const activity = setInterval(() => setShoppers(previous => randomShoppers(previous)), 15_000);
    return () => { clearInterval(clock); clearInterval(activity); };
  }, [subdomain, preview]);

  return { shoppers: preview ? 5 : shoppers, timeLeft: preview ? '14:37' : deadline === null ? null : checkoutTimeLeft(deadline, now) };
}

export function CheckoutActivityBar({ shoppers, copy = CHECKOUT_DEFAULTS }) {
  return <p className="checkout-activity-bar flex items-center justify-center gap-2.5 bg-foreground px-5 py-3 text-center text-sm text-background" role="status">
    <Users className="size-4 shrink-0" aria-hidden="true" />
    <span>{checkoutText(copy, 'activityText', { cantidad: shoppers })}</span>
    <span className="size-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
  </p>;
}

export function CheckoutOfferTimer({ timeLeft, label = PROMOTION_COPY.timerLabel }) {
  if (timeLeft === null) return null;
  return <p className="flex items-center justify-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-3 text-center text-sm font-semibold text-destructive" role="timer" aria-live="off">
    <Clock className="size-4 shrink-0" aria-hidden="true" />
    <span>{label} <strong className="inline-block min-w-12 font-mono tabular-nums">{timeLeft}</strong></span>
  </p>;
}
