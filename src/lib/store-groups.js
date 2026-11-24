// A spaced dash introduces a variant label. Market codes also occur without a spaced dash.
const variantSuffix = /(?:\s+[-–—]\s+[^–—-]+|\s*[-–—]\s*[a-z]{2}|\s+(?:us|uk|br|mx|ar|es|pt|en))$/iu;

export function groupStoresByName(stores) {
  const groups = new Map();
  for (const store of stores) {
    const name = store.name.trim();
    const label = name.replace(variantSuffix, '').trim() || name;
    const key = label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ').trim() || label;
    if (!groups.has(key)) groups.set(key, { label, stores: [] });
    groups.get(key).stores.push(store);
  }
  return [...groups.values()];
}
