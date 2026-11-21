// Lifetime of a Stripe payment session. Stripe accepts 30 minutes to 24 hours; the shortest
// keeps the checkout countdown real and lets abandoned orders expire within the hour.
export const SESSION_MINUTES = 30;
// Asked for on top of the 30 minutes: Stripe counts from when it receives the request, so a
// value of exactly 30 minutes from the server's clock would arrive a few milliseconds short.
export const SESSION_MARGIN_MS = 60_000;

export function sessionExpiresAt(now = Date.now()) {
  return Math.floor((now + SESSION_MINUTES * 60_000 + SESSION_MARGIN_MS) / 1000);
}

// The buyer's countdown ends one margin before Stripe's real expiry, so a payment started at
// 00:01 still reaches a live session.
export function sessionDeadline(expiresAt) {
  return typeof expiresAt === 'number' ? expiresAt - SESSION_MARGIN_MS : null;
}

export function sessionTimeLeft(deadline, now = Date.now()) {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

// Whether a session returned by the server can no longer be offered to the buyer.
export function sessionEnded(expiresAt, now = Date.now()) {
  const deadline = sessionDeadline(expiresAt);
  return deadline !== null && now >= deadline;
}
