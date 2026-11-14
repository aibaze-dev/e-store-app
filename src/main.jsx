import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexReactClient } from 'convex/react';
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react';
import { authClient } from './lib/auth-client.js';
import App from './App.jsx';
import './theme.css';
import './styles.css';

const url = import.meta.env.VITE_CONVEX_URL;
const client = url ? new ConvexReactClient(url) : null;
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {client ? <ConvexBetterAuthProvider client={client} authClient={authClient}><App /></ConvexBetterAuthProvider> :
      <main className="setup"><h1>Conectá tu proyecto a Convex</h1><p>Configurá VITE_CONVEX_URL en .env.local y ejecutá pnpm backend.</p></main>}
  </React.StrictMode>,
);
