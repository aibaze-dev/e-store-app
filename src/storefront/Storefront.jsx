import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { api } from '@/lib/api.js';
import { trackPageView } from '@/lib/pixel.js';
import { clarityTags, startClarity } from '@/lib/clarity.js';
import { templateFor } from '@/templates/index.js';
import { plainText } from '../../shared/classic-design.js';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';
import { PageSkeleton } from '@/components/Field.jsx';
import ExitIntentModal from './ExitIntentModal.jsx';
import { useStorePresence } from './useStorePresence.js';
import { useViewTracking } from './useViewTracking.js';
import { useEarlyLanding } from './early-landing.js';
import { attributionArgs, captureAttribution } from './attribution.js';

const quizModule = () => import('./Quiz.jsx');
const Quiz = lazy(quizModule);
// A visit that opens on the quiz fetches its code together with the app, not after the data.
if (typeof window !== 'undefined' && /\/quiz(\/|$)/.test(window.location.pathname)) quizModule();
// Checkout, downsell offer and thank-you page share one chunk, loaded when first needed.
const checkoutPages = () => import('./CheckoutPages.jsx');
const Checkout = lazy(() => checkoutPages().then(module => ({ default: module.Checkout })));
const DownsellOffer = lazy(() => checkoutPages().then(module => ({ default: module.DownsellOffer })));
const ThankYou = lazy(() => checkoutPages().then(module => ({ default: module.ThankYou })));
const SupportPage = lazy(() => import('./SupportPage.jsx'));

const Page = ({ children }) => <main className="mx-auto max-w-2xl space-y-6 px-5 py-10 sm:px-6">{children}</main>;
const Unavailable = () => <Page>
  <h1 className="text-3xl font-semibold tracking-tight">This page is unavailable</h1>
  <p className="leading-7 text-muted-foreground">This offer could not be found. It may no longer be available.</p>
</Page>;

function Landing({ view }) {
  useStorePresence(view.subdomain, 'landing');
  useViewTracking(view.subdomain, 'landing', view.store.id);
  const navigate = useNavigate();
  useEffect(() => { document.title = plainText(view.content.hero.title) || view.offer.main.name; }, [view]);
  useEffect(() => { trackPageView(view.store.metaPixelIds); }, [view.store.metaPixelIds]);
  // The payment screens are fetched in the background, so the button opens them without a wait.
  useEffect(() => {
    const timer = setTimeout(checkoutPages, 2000);
    return () => clearTimeout(timer);
  }, []);
  const Template = templateFor(view.template);
  // The popup's button does what the landing's own button does, and the checkout takes the focus.
  return <>
    <Template view={view} onCta={selected => navigate('checkout', { state: { origin: 'classic', selected } })} />
    <ExitIntentModal view={view} step="landing" onCta={() => navigate('checkout', { state: { focusHeading: true, origin:'classic' } })} />
  </>;
}

function LandingRoutes({ subdomain, via }) {
  const live = useQuery(api.storefront.getLanding, { subdomain });
  const early = useEarlyLanding(subdomain);
  // The request index.html started usually answers first; the live query then takes over.
  const classic = live === undefined ? early : live;
  // Asked for up front so the checkout opens at once; the landing does not wait for it.
  const view = useQuery(api.storefront.getCheckout, { subdomain });
  const loading = <Page><PageSkeleton label="Loading" /></Page>;
  const ready = element => view === undefined ? loading : element;
  // Recordings of the funnel of a store that exists: landing, quiz, checkout and offer.
  const exists = Boolean(classic || view);
  useEffect(() => { if (exists) startClarity(clarityTags(subdomain, attributionArgs(subdomain).attribution)); }, [exists, subdomain]);
  return <Suspense fallback={loading}><Routes>
    <Route index element={classic === undefined ? loading : classic ? <Landing view={classic} /> : <Unavailable />} />
    {/* The quiz starts on its own data; offer blocks appear once the store's view arrives. */}
    <Route path="quiz/*" element={<Suspense fallback={<p className="p-8">Loading quiz…</p>}><Quiz subdomain={subdomain} view={view}/></Suspense>} />
    <Route path="checkout" element={ready(view ? <Checkout view={view} via={via} /> : <Unavailable />)} />
    <Route path="oferta" element={ready(view?.downsell ? <DownsellOffer view={view} via={via} /> : <Unavailable />)} />
    <Route path="*" element={ready(<Unavailable />)} />
  </Routes></Suspense>;
}

// `via` records whether the visit came through the subdomain or the /l/<subdomain> path,
// so the server sends the buyer back to the same address after paying.
export default function Storefront({ subdomain, via }) {
  // Read while rendering: the quiz and the checkout navigate to addresses without the
  // campaign parameters, and child effects run before this component's own.
  captureAttribution(subdomain);
  return <ErrorBoundary language="en-US"><Suspense fallback={<Page><PageSkeleton label="Loading" /></Page>}><Routes>
    <Route path="gracias" element={<ThankYou via={via} subdomain={subdomain} />} />
    <Route path="soporte" element={<SupportPage subdomain={subdomain} />} />
    <Route path="*" element={<LandingRoutes subdomain={subdomain} via={via} />} />
  </Routes></Suspense></ErrorBoundary>;
}
