import ClassicLanding from './ClassicLanding.jsx';
export { EMPTY_CONTENT, normalizeContent } from './content.js';

// Template ids must match the list accepted by convex/landings.ts.
export const TEMPLATES = { classic: { label: 'Venta de ebooks', Component: ClassicLanding } };
export function templateFor(id) {
  return (TEMPLATES[id] || TEMPLATES.classic).Component;
}
