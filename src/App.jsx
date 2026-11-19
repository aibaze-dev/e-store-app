import { BrowserRouter, Link, Route, Routes, useParams } from 'react-router-dom';
import AccessPage from './pages/AccessPage.jsx';
import Panel from './panel/Panel.jsx';
import Storefront from './storefront/Storefront.jsx';
import ArtifactPage from './artifacts/ArtifactPage.jsx';
import { resolveSubdomain } from './lib/site.js';
import { Button } from './components/ui/button';
import { InternalThemeProvider } from './components/InternalTheme.jsx';

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

export default function App() {
  // On a landing subdomain the whole site is that landing; the panel lives on the base domain.
  const subdomain = resolveSubdomain();
  return <InternalThemeProvider><BrowserRouter>
    {subdomain
      ? <Routes><Route path="/*" element={<Storefront subdomain={subdomain} via="subdomain" />} /></Routes>
      : <Routes>
        <Route path="/" element={<AccessPage />} />
        <Route path="/panel/*" element={<Panel />} />
        <Route path="/a/:slug" element={<ArtifactPage />} />
        <Route path="/l/:subdomain/*" element={<PathStorefront />} />
        <Route path="*" element={<NotFound />} />
      </Routes>}
  </BrowserRouter></InternalThemeProvider>;
}
