export const PRACTICE_MS = 60_000;
export const newTimer = () => ({ status: 'idle', remainingMs: PRACTICE_MS, deadline: null });
export function remainingAt(timer, now) {
  return timer.status === 'running' ? Math.max(0, Math.min(PRACTICE_MS, timer.deadline - now)) : timer.remainingMs;
}
export function startTimer(timer, now) {
  if (timer.status === 'running' || timer.status === 'finished') return timer;
  return { status: 'running', remainingMs: timer.remainingMs, deadline: now + timer.remainingMs };
}
export function pauseTimer(timer, now) {
  if (timer.status !== 'running') return timer;
  const remainingMs = remainingAt(timer, now);
  return { status: remainingMs > 0 ? 'paused' : 'finished', remainingMs, deadline: null };
}
export function tickTimer(timer, now) {
  return timer.status === 'running' && remainingAt(timer, now) === 0 ? pauseTimer(timer, now) : timer;
}
export function timerLabel(timer, now) {
  const seconds = Math.ceil(remainingAt(timer, now) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
