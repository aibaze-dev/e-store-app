// Translating a landing or a quiz changes only the texts a visitor reads. IDs, URLs, colors,
// rule references, enums and numbers stay as they are, so the document keeps its structure
// and the same server validation applies after translating.

export const LANGUAGES = { es: 'Español', en: 'English', pt: 'Português' };

// Keys whose string values are structure, not copy.
const SKIP_KEYS = new Set([
  'id', 'type', 'template', 'layout', 'imageLayout', 'mode', 'ref', 'operator', 'op', 'tone', 'display',
  'format', 'timerMode', 'paymentLocale', 'color', 'background', 'textColor', 'accentColor',
  'icon', 'unitIcon', 'exitEmoji', 'supportEmail', 'stepId', 'optionId', 'resultId',
]);
const STRUCTURAL = /(url|Id|Ids)$/i;
const NOT_COPY = /^(https?:\/\/|mailto:|#[0-9a-f]{3,8}$|[^@\s]+@[^@\s]+\.[^@\s]+$)/i;

// {nombre}, {{answer:minutes}}: filled in when the page renders, so they must survive as written.
const PLACEHOLDER = /\{\{[^{}]+\}\}|\{[^{}]+\}/g;
export const placeholders = text => (text.match(PLACEHOLDER) ?? []).sort();

function translatable(key, value, parent) {
  if (typeof value !== 'string' || !/\p{L}/u.test(value) || NOT_COPY.test(value.trim())) return false;
  if (key === undefined) return true;
  if (SKIP_KEYS.has(key) || STRUCTURAL.test(key)) return false;
  // A rule's value compares against an option ID; it is not shown to the visitor.
  if (key === 'value' && parent && 'operator' in parent) return false;
  return true;
}

// Every translatable text with the path that leads to it.
export function collectTexts(document) {
  const found = [];
  const walk = (value, path, key, parent) => {
    if (Array.isArray(value)) value.forEach((item, index) => walk(item, [...path, index], key, value));
    else if (value && typeof value === 'object') for (const [name, child] of Object.entries(value)) walk(child, [...path, name], name, value);
    else if (translatable(key, value, parent)) found.push({ path, text: value });
  };
  walk(document, [], undefined, undefined);
  return found;
}

// Puts the translations back. A translation that drops or changes a placeholder keeps the
// original text, so the page never renders a broken variable; `kept` counts those.
export function applyTexts(document, found, translated) {
  const next = structuredClone(document);
  let kept = 0;
  found.forEach(({ path, text }, index) => {
    const candidate = translated[index];
    const valid = typeof candidate === 'string' && candidate.trim() && JSON.stringify(placeholders(candidate)) === JSON.stringify(placeholders(text));
    if (!valid) { kept += 1; return; }
    let target = next;
    for (const step of path.slice(0, -1)) target = target[step];
    target[path.at(-1)] = candidate;
  });
  return { document: next, kept };
}
