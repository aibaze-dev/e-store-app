import { DELIVERY_WINDOW_MS, validProjectSession } from '../../../shared/project-brief.js';

export const STORAGE_KEY = 'ateneo:project-brief:v1';
const OPENING_RECEIPT = STORAGE_KEY + ':opening-receipt';

function withLock(name, task) {
  return globalThis.navigator?.locks ? navigator.locks.request(name, task) : Promise.resolve().then(task);
}

// Two tabs opening the same fresh link must agree on firstLoad and requestId.
export function loadSession() {
  return withLock(STORAGE_KEY, readSession);
}

let acknowledgedInMemory;
let openingInFlight;

export function reportOpening({ firstLoad, requestId }, notify) {
  if (openingInFlight?.requestId === requestId) return openingInFlight.promise;
  const promise = withLock(OPENING_RECEIPT, async () => {
    if (acknowledgedInMemory === requestId) return;
    try {
      if (window.localStorage.getItem(OPENING_RECEIPT) === requestId) return;
    } catch { /* The in-memory receipt still covers this page. */ }
    await notify({ firstLoad, requestId });
    acknowledgedInMemory = requestId;
    try {
      window.localStorage.setItem(OPENING_RECEIPT, requestId);
    } catch { /* Storage is unavailable. */ }
  }).finally(() => {
    if (openingInFlight?.requestId === requestId) openingInFlight = undefined;
  });
  openingInFlight = { requestId, promise };
  return promise;
}

export function readSession() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (saved && validProjectSession(saved.firstLoad, saved.requestId) && typeof saved.submitted === 'boolean') return saved;
  } catch { /* Storage can be disabled or contain an incomplete record. */ }
  const session = { firstLoad: Date.now(), requestId: crypto.randomUUID(), submitted: false };
  return saveSession(session);
}

export function saveSession({ firstLoad, requestId, submitted }) {
  const session = { firstLoad, requestId, submitted };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  } catch {
    return { ...session, storageUnavailable: true };
  }
}

export function remainingSeconds(firstLoad, now) {
  return Math.max(0, Math.ceil((firstLoad + DELIVERY_WINDOW_MS - now) / 1000));
}
