// Register each component here with React.lazy(() => import('./<slug>/index.jsx')).
// Keys must match the slugs in registry.js; the catalog never imports this module.
import { lazy } from 'react';

export const artifactComponents = {
  'prompt-builder': lazy(() => import('./prompt-builder/index.jsx')),
  'meeting-prep': lazy(() => import('./meeting-prep/index.jsx')),
};
