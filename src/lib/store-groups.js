// A spaced dash introduces a variant label. Market codes also occur without a spaced dash.
const variantSuffix = /(?:\s+[-–—]\s+[^–—-]+|\s*[-–—]\s*[a-z]{2}|\s+(?:us|uk|br|mx|ar|es|pt|en))$/iu;

function assignGroupHues(groups) {
  const keys = [...groups.keys()].filter(key => groups.get(key).stores.length > 1).sort();
  const used = [];
  const spacing = Math.min(35, Math.floor(180 / keys.length));
  for (const key of keys) {
    let hash = 0;
    for (const char of key) hash = (Math.imul(hash, 31) + char.codePointAt(0)) >>> 0;
    let hue = hash % 360;
    // Step around the color wheel when two names would get similar colors.
    while (used.some(other => Math.min(Math.abs(hue - other), 360 - Math.abs(hue - other)) < spacing)) {
      hue = (hue + 137) % 360;
    }
    groups.get(key).hue = hue;
    used.push(hue);
  }
}

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
  assignGroupHues(groups);
  return [...groups.values()];
}
