import { describe, it, expect } from 'vitest';
import { getFunctionName } from 'convex/server';
import { api } from '../src/lib/api.js';

// The frontend names Convex functions by hand. Tests call them through anyApi, so a missing
// or misspelled name here would only show up as a crash in the browser.
const modules = import.meta.glob('../convex/*.ts');

function references(node, path = []) {
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    try { return [{ path: path.join('.'), name: getFunctionName(node) }]; } catch { /* a group, not a reference */ }
    return Object.entries(node).flatMap(([key, value]) => references(value, [...path, key]));
  }
  return [];
}

describe('frontend function references', () => {
  it('point to functions that the backend exports', async () => {
    const missing = [];
    for (const { path, name } of references(api)) {
      const [file, exported] = name.split(':');
      const load = modules[`../convex/${file}.ts`];
      const module = load ? await load() : null;
      if (!module?.[exported]) missing.push(`${path} → ${name}`);
    }
    expect(missing).toEqual([]);
  });
});
