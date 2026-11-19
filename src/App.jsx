import { lazy, Suspense, useLayoutEffect } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation, useParams } from 'react-router-dom';
import Storefront from './storefront/Storefront.jsx';
import { resolveSubdomain } from './lib/site.js';
import { Button } from './components/ui/button';
import { InternalThemeProvider } from './components/InternalTheme.jsx';
import { PageSkeleton } from './components/Field.jsx';

// Public landings ship in the first download; the panel, the access page and the artifacts
// are fetched only when their route is opened.
const AccessPage = lazy(() => import('./pages/AccessPage.jsx'));
const Panel = lazy(() => import('./panel/Panel.jsx'));
const ArtifactPage = lazy(() => import('./artifacts/ArtifactPage.jsx'));
const routeFallback = <main className="mx-auto max-w-2xl px-5 py-10 sm:px-6"><PageSkeleton /></main>;

function PathStorefront() {
  const { subdomain } = useParams();
  return <Storefront subdomain={subdomain.toLowerCase()} via="path" />;
}

function NotFound() {
  return <main className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
    <h1 className="text-3xl font-semibold tracking-tight">No encontramos esta página</h1>
    <p className="text-sm leading-6 text-muted-foreground">Revisá la dirección o volvé al inicio.</p>
    <Button asChild variant="outline"><Link to="/">Ir al inicio</Link></Button>
  </main>;
}

function DocumentLanguage({ subdomain }) {
  const { pathname } = useLocation();
  const storePath = subdomain ? pathname : pathname.replace(/^\/l\/[^/]+(?=\/|$)/, '');
  const storefront = subdomain || storePath !== pathname;
  const englishStorePage = storefront && !/^\/quiz(?:\/|$)/.test(storePath);
  const language = englishStorePage || pathname.startsWith('/a/') ? 'en-US' : 'es';
  useLayoutEffect(() => { document.documentElement.lang = language; }, [language]);
  return null;
}

export default function App() {
  // On a landing subdomain the whole site is that landing; the panel lives on the base domain.
  const subdomain = resolveSubdomain();
  return <InternalThemeProvider><BrowserRouter>
    <DocumentLanguage subdomain={subdomain} />
    {subdomain
      ? <Routes><Route path="/*" element={<Storefront subdomain={subdomain} via="subdomain" />} /></Routes>
      : <Suspense fallback={routeFallback}><Routes>
        <Route path="/" element={<AccessPage />} />
        <Route path="/panel/*" element={<Panel />} />
        <Route path="/a/:slug" element={<ArtifactPage />} />
        <Route path="/l/:subdomain/*" element={<PathStorefront />} />
        <Route path="*" element={<NotFound />} />
      </Routes></Suspense>}
  </BrowserRouter></InternalThemeProvider>;
}
