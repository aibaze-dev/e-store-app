import { EMPTY_FORM, FORMATS, LENGTHS, TASKS, TONES } from './builder.js';

export const HISTORY_KEY = 'ateneo-prompt-builder-history-v1';

function validEntry(entry) {
  const validDate = value => Number.isFinite(value) && value >= 0 && value <= 8640000000000000;
  return entry && typeof entry.id === 'string' && entry.id.length > 0 &&
    typeof entry.output === 'string' && validDate(entry.createdAt) && validDate(entry.updatedAt) &&
    entry.form && Object.keys(EMPTY_FORM).every(key => typeof entry.form[key] === 'string') &&
    entry.form.task.trim().length > 0 &&
    TASKS.some(task => task.id === entry.form.category) && TONES.includes(entry.form.tone) &&
    FORMATS.includes(entry.form.format) && LENGTHS.includes(entry.form.length);
}

// Read before each mutation so another tab's saved prompts are not overwritten
// by a stale in-memory list. Never replace malformed or unsupported data silently.
export function readHistory(storage = window.localStorage) {
  const raw = storage.getItem(HISTORY_KEY);
  if (raw === null) return [];
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.entries) || !data.entries.every(validEntry) ||
      new Set(data.entries.map(entry => entry.id)).size !== data.entries.length) {
    throw new Error('Invalid prompt history');
  }
  return data.entries.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function savePrompt(entry, storage = window.localStorage) {
  if (!validEntry(entry)) throw new Error('Invalid prompt');
  const entries = [entry, ...readHistory(storage).filter(item => item.id !== entry.id)]
    .sort((a, b) => b.updatedAt - a.updatedAt);
  storage.setItem(HISTORY_KEY, JSON.stringify({ version: 1, entries }));
  return entries;
}

export function deletePrompt(id, storage = window.localStorage) {
  const entries = readHistory(storage).filter(entry => entry.id !== id);
  storage.setItem(HISTORY_KEY, JSON.stringify({ version: 1, entries }));
  return entries;
}
