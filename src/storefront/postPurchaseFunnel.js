import { popupOptions } from '../../shared/purchase-copy.js';
// Steps of the post-purchase modal on the thank-you page. Pure, so the rules can be tested.
//
// First opening: offer → (declined) downsell, when the store set one → (declined) closed.
// Each later opening, after the buyer comes back to the tab or the mouse leaves the page,
// continues from the next step not seen yet, up to the last discount. After declining the
// last discount the modal stays closed until the page is loaded again.

export const REOPEN_LIMITS = { visibility: 1, mouse: 2 };

export function postOfferDeadline(sessionId) {
  const deadline = Date.now() + 5 * 60_000;
  if (!sessionId) return deadline;
  const key = `post-offer-deadline:${sessionId}`;
  try {
    const saved = Number(sessionStorage.getItem(key));
    if (Number.isSafeInteger(saved) && saved > 0 && saved <= deadline) return saved;
    sessionStorage.setItem(key, String(deadline));
  } catch { /* The modal holds the deadline in memory while this page is open. */ }
  return deadline;
}

export const initialFunnel = () => ({ declined: [], reopens: { visibility: 0, mouse: 0 } });

export function stagesFor(offer) {
  const options = popupOptions(offer.content);
  return ['offer', ...(options.postDownsell && offer.downsellPrice ? ['downsell'] : []), ...(options.postFinal ? ['final'] : [])];
}

// The next step that was not declined yet, or null when every step was declined.
export function nextStage(offer, funnel) {
  return stagesFor(offer).find(stage => !funnel.declined.includes(stage)) ?? null;
}

// What happens after "No" on `stage`: the stage the modal moves to, or null to close.
// On the first opening the last discount is kept for a later opening.
export function afterDecline(offer, funnel, stage, reopened) {
  const declined = funnel.declined.includes(stage) ? funnel.declined : [...funnel.declined, stage];
  const next = nextStage(offer, { ...funnel, declined });
  return { funnel: { ...funnel, declined }, stage: next && (reopened || next !== 'final') ? next : null };
}

// Whether a trigger may open the modal again, and the funnel with the use counted.
export function claimReopen(offer, funnel, trigger) {
  const options = popupOptions(offer.content);
  if ((trigger === 'visibility' && !options.postOnReturn) || (trigger === 'mouse' && !options.postOnExit)) return null;
  if (!nextStage(offer, funnel) || funnel.reopens[trigger] >= REOPEN_LIMITS[trigger]) return null;
  return { ...funnel, reopens: { ...funnel.reopens, [trigger]: funnel.reopens[trigger] + 1 } };
}

// Each page load starts at the initial offer. Only the tab-return and mouse
// reopen counts carry across loads for this purchase, including from older records.
const memory = new Map();
const key = sessionId => `post-offer:${sessionId}`;
export const funnelStore = {
  read(sessionId) {
    const fresh = initialFunnel();
    try {
      const counts = JSON.parse(sessionStorage.getItem(key(sessionId)) || 'null')?.reopens;
      if (counts) return { ...fresh, reopens: { ...fresh.reopens, ...counts } };
    } catch { /* falls back to memory */ }
    return { ...fresh, reopens: { ...fresh.reopens, ...memory.get(sessionId) } };
  },
  write(sessionId, { reopens }) {
    memory.set(sessionId, reopens);
    try { sessionStorage.setItem(key(sessionId), JSON.stringify({ reopens })); } catch { /* memory already holds it */ }
  },
};
