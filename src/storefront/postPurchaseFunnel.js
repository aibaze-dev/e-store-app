// Steps of the post-purchase modal on the thank-you page. Pure, so the rules can be tested.
//
// First opening: offer → (declined) downsell, when the store set one → (declined) closed.
// Each later opening, after the buyer comes back to the tab or the mouse leaves the page,
// continues from the next step not seen yet, up to the last discount. After declining the
// last discount the modal never opens again.

export const REOPEN_LIMITS = { visibility: 1, mouse: 2 };

export const initialFunnel = () => ({ declined: [], reopens: { visibility: 0, mouse: 0 } });

export function stagesFor(offer) {
  return ['offer', ...(offer.downsellPrice ? ['downsell'] : []), 'final'];
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
  if (!nextStage(offer, funnel) || funnel.reopens[trigger] >= REOPEN_LIMITS[trigger]) return null;
  return { ...funnel, reopens: { ...funnel.reopens, [trigger]: funnel.reopens[trigger] + 1 } };
}

// Per purchase, so a reload continues where the buyer was. Memory covers blocked storage.
const memory = new Map();
const key = sessionId => `post-offer:${sessionId}`;
export const funnelStore = {
  read(sessionId) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key(sessionId)) || 'null');
      if (saved && Array.isArray(saved.declined) && saved.reopens) return { ...initialFunnel(), ...saved, reopens: { ...initialFunnel().reopens, ...saved.reopens } };
    } catch { /* falls back to memory */ }
    return memory.get(sessionId) ?? null;
  },
  write(sessionId, funnel) {
    memory.set(sessionId, funnel);
    try { sessionStorage.setItem(key(sessionId), JSON.stringify(funnel)); } catch { /* memory already holds it */ }
  },
};
