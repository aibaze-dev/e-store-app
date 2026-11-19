import { describe, expect, it } from 'vitest';
import { EMPTY_FORM } from '../src/artifacts/prompt-builder/builder.js';
import { deletePrompt, HISTORY_KEY, readHistory, savePrompt } from '../src/artifacts/prompt-builder/history.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
const entry = (id = 'first', time = 100) => ({ id, createdAt: time, updatedAt: time, form: { ...EMPTY_FORM, task: 'Write a useful email', resources: 'Original reference material' }, output: 'Generated prompt\nwith details.' });

describe('local prompt history', () => {
  it('starts empty without writing any browser state', () => {
    const storage = memoryStorage();
    expect(readHistory(storage)).toEqual([]);
    expect(storage.getItem(HISTORY_KEY)).toBeNull();
  });
  it('persists the complete prompt and answers across fresh reads', () => {
    const storage = memoryStorage();
    savePrompt(entry(), storage);
    expect(readHistory(storage)).toEqual([entry()]);
    expect(JSON.parse(storage.getItem(HISTORY_KEY)).version).toBe(1);
  });
  it('updates an edited prompt without creating a duplicate or losing other prompts', () => {
    const storage = memoryStorage();
    savePrompt(entry(), storage);
    savePrompt(entry('second', 200), storage);
    const edited = { ...entry(), updatedAt: 300, output: 'My exact manual edit' };
    savePrompt(edited, storage);
    expect(readHistory(storage)).toEqual([edited, entry('second', 200)]);
  });
  it('reads the latest persisted list before saving or deleting from another tab', () => {
    const storage = memoryStorage();
    savePrompt(entry(), storage);
    const oldSnapshot = readHistory(storage);
    savePrompt(entry('second', 200), storage);
    savePrompt({ ...oldSnapshot[0], output: 'Edit from the first tab', updatedAt: 300 }, storage);
    expect(readHistory(storage).map(item => item.id)).toEqual(['first', 'second']);
    deletePrompt('first', storage);
    expect(readHistory(storage)).toEqual([entry('second', 200)]);
  });
  it('deletes only the chosen prompt and leaves other storage keys intact', () => {
    const storage = memoryStorage({ 'unrelated-preference': 'keep me' });
    savePrompt(entry(), storage);
    savePrompt(entry('second', 200), storage);
    expect(deletePrompt('first', storage)).toEqual([entry('second', 200)]);
    expect(deletePrompt('second', storage)).toEqual([]);
    expect(readHistory(storage)).toEqual([]);
    expect(storage.getItem('unrelated-preference')).toBe('keep me');
  });
  it.each(['bad json', '{"version":2,"entries":[]}', '{"version":1,"entries":[{}]}'])('does not overwrite unreadable history: %s', raw => {
    const storage = memoryStorage({ [HISTORY_KEY]: raw });
    expect(() => readHistory(storage)).toThrow();
    expect(() => savePrompt(entry(), storage)).toThrow();
    expect(() => deletePrompt('first', storage)).toThrow();
    expect(storage.getItem(HISTORY_KEY)).toBe(raw);
  });
  it('rejects duplicate IDs and dates the history UI cannot render', () => {
    const duplicate = memoryStorage({ [HISTORY_KEY]: JSON.stringify({ version: 1, entries: [entry(), entry()] }) });
    expect(() => readHistory(duplicate)).toThrow();
    expect(() => savePrompt({ ...entry(), updatedAt: 1e100 }, memoryStorage())).toThrow();
  });
  it('surfaces quota failures instead of pretending data was saved or deleted', () => {
    const initial = JSON.stringify({ version: 1, entries: [entry()] });
    const storage = { getItem: () => initial, setItem: () => { throw new Error('Quota exceeded'); } };
    expect(() => savePrompt(entry('second'), storage)).toThrow('Quota exceeded');
    expect(() => deletePrompt('first', storage)).toThrow('Quota exceeded');
    expect(readHistory(storage)).toEqual([entry()]);
  });
  it('surfaces blocked reads', () => {
    expect(() => readHistory({ getItem: () => { throw new Error('Storage blocked'); } })).toThrow('Storage blocked');
  });
});
