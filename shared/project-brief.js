export const DELIVERY_WINDOW_MS = 48 * 60 * 60 * 1000;

export function validProjectSession(firstLoad, requestId) {
  return Number.isSafeInteger(firstLoad) && firstLoad > 0 &&
    Number.isFinite(new Date(firstLoad + DELIVERY_WINDOW_MS).getTime()) &&
    typeof requestId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId);
}
