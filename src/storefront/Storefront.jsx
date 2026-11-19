import { postLabels, popupOptions, backPopupConfig, purchaseText } from '../../shared/purchase-copy.js';
import { checkoutConfig, checkoutText } from '../../shared/checkout-copy.js';
import { readQuizToken } from './quiz-session.js';
const Quiz = lazy(() => import('./Quiz.jsx'));
import { PurchaseResult, Video } from '@/templates/PostPurchaseContent.jsx';
import { videoSource } from '../../shared/post-purchase.js';
import PostPurchaseModal from './PostPurchaseModal.jsx';
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAction, useQuery } from 'convex/react';
import { Check, Gift, LoaderCircle, LockKeyhole, Plus, ShieldCheck, Zap } from 'lucide-react';
import { api } from '@/lib/api.js';
import { storefrontMoney as formatMoney } from '@/lib/storefront-money.js';
import { trackPixel, trackPixelOnce } from '@/lib/pixel.js';
import { templateFor } from '@/templates/index.js';
import { checkoutTotals, normalizeContent, productDiscount } from '@/templates/content.js';
import { plainText } from '../../shared/classic-design.js';
import DemoPurchaseToasts from './DemoPurchaseToasts.jsx';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ErrorAlert, PageSkeleton } from '@/components/Field.jsx';
import ExitIntentModal, { ExitIntentPreview } from './ExitIntentModal.jsx';
import CheckoutPayment, { CheckoutPaymentPreview, SessionPayment, stripeKey } from './CheckoutPayment.jsx';
import DownsellModal from './DownsellModal.jsx';
import { CheckoutActivityBar, CheckoutOfferTimer, useSimulatedCheckoutSignals } from './CheckoutSignals.jsx';
import { useViewTracking } from './useViewTracking.js';
import { useQuizContact } from './useQuizContact.js';

const Page = ({ children }) => <main className="mx-auto max-w-2xl space-y-6 px-5 py-10 sm:px-6">{children}</main>;
const Unavailable = () => <Page>
  <h1 className="text-3xl font-semibold tracking-tight">This page is unavailable</h1>
  <p className="leading-7 text-muted-foreground">This offer could not be found. It may no longer be available.</p>
</Page>;

// One checkout attempt per selection: retrying the same selection reuses the same order.
// `failed` asks the server for a fresh Stripe key, since Stripe replays a cached failure.
function useAttempt() {
  const attempt = useRef({ key: null, id: '', failed: false });
  return key => {
    if (attempt.current.key !== key) attempt.current = { key, id: crypto.randomUUID(), failed: false };
    return attempt.current;
  };
}
const attemptArgs = attempt => ({ attemptId: attempt.id, ...(attempt.failed ? { retry: true } : {}) });

function Landing({ view }) {
  useViewTracking(view.subdomain, 'landing', view.store.id);
  const navigate = useNavigate();
  useEffect(() => {
    document.title = plainText(view.content.hero.title) || view.offer.main.name;
    trackPixel(view.store.metaPixelId, 'PageView');
  }, [view]);
  const Template = templateFor(view.template);
  // The popup's button does what the landing's own button does, and the checkout takes the focus.
  return <>
    <Template view={view} onCta={selected => navigate('checkout', { state: { origin: 'classic', selected } })} />
    {popupOptions(view.content).landingExit && <ExitIntentModal view={view} step="landing" onCta={() => navigate('checkout', { state: { focusHeading: true, origin:'classic' } })} />}
    {view.downsell && popupOptions(view.content).backLanding && <DownsellModal view={view} step="landing" onAccept={() => navigate('oferta', {state:{origin:'classic'}})} />}
  </>;
}

function Thumb({ src, name, className = 'size-16' }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) return <img src={src} alt="" className={`${className} shrink-0 rounded-lg object-cover`} onError={() => setFailed(true)} />;
  return <span className={`${className} checkout-thumb shrink-0 rounded-lg bg-foreground text-background`} title={name}><span aria-hidden="true">📖</span>{className.includes('h-20') && <small>{name}</small>}</span>;
}

export function Checkout({ view, via }) {
  const location = useLocation();
  const origin=location.state?.origin || 'direct';
  useViewTracking(view.subdomain, 'checkout', view.store.id, origin);

  // The quiz already asked for name and email: the navigation brings them, the server keeps them on reload.
  const quizContact = useQuizContact(view.subdomain);
  return <CheckoutView view={view} via={via} initialBuyer={location.state?.buyer ?? quizContact ?? undefined} />;
}

export function CheckoutView({ view, via, initialBuyer, preview = false, previewState = 'ready' }) {
  const location = useLocation();
  const origin = preview ? 'direct' : location.state?.origin || 'direct';
  const { shoppers, timeLeft } = useSimulatedCheckoutSignals(view.subdomain, { preview });
  const copy = checkoutConfig(view);
  const t = (key, values) => checkoutText(copy, key, values);
  const { offer, store } = view;
  // Extras ticked in the landing's order builder arrive already selected.
  const [selected, setSelected] = useState(() => offer.upsells.filter(upsell => (!preview && location.state?.selected?.includes(upsell.productId))).map(upsell => upsell.productId));
  const [busy, setBusy] = useState(false);
  const content = normalizeContent(view.content);
  const money = amount => formatMoney(amount, store.currency);
  const navigate = useNavigate();
  const focusHeading = !preview && location.state?.focusHeading;
  const headingRef = useRef(null);
  const payRef = useRef(null);
  useLayoutEffect(() => {
    const viewport = headingRef.current.ownerDocument.defaultView;
    const scrollToTop = () => viewport.scrollTo({ top: 0, behavior: 'instant' });
    if (focusHeading) headingRef.current.focus({ preventScroll: true });
    scrollToTop();
    // History navigation can restore the old offset after React commits.
    let frame = viewport.requestAnimationFrame(scrollToTop);
    const onPageShow = () => {
      viewport.cancelAnimationFrame(frame);
      frame = viewport.requestAnimationFrame(scrollToTop);
    };
    viewport.addEventListener('pageshow', onPageShow);
    return () => {
      viewport.cancelAnimationFrame(frame);
      viewport.removeEventListener('pageshow', onPageShow);
    };
  }, [location.key, view.subdomain, focusHeading]);
  // Sends the visitor back to the step they were on; it never starts the payment.
  const exitIntent = <ExitIntentModal view={view} step="checkout" onCta={() => {
    const target = payRef.current && !payRef.current.disabled ? payRef.current : headingRef.current;
    target?.scrollIntoView({ block: 'center' });
    target?.focus();
  }} />;
  const chosen = offer.upsells.filter(upsell => selected.includes(upsell.productId));
  // Shown amounts only; the server recalculates the charge from the store.
  const { total, reference, savings } = checkoutTotals(offer, chosen);
  const locked = busy || (preview && previewState === 'processing');
  const guarantee = copy.showGuarantee && content.guarantee.enabled && content.guarantee.text ? (content.guarantee.days ? t('guarantee', { dias: content.guarantee.days }) : copy.guaranteeFallback) : '';
  const trust = copy.showTrust && <p className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
    <span className="inline-flex items-center gap-1.5"><LockKeyhole className="size-3.5" aria-hidden="true" />{copy.secure}</span>
    {guarantee && <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" aria-hidden="true" />{guarantee}</span>}
  </p>;

  return <div className="checkout-page min-h-screen bg-muted/40">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-4 text-sm font-semibold sm:px-6">
      <LockKeyhole className="size-4 text-primary" aria-hidden="true" />{copy.secure}
      <Link onClick={event => { if (preview) event.preventDefault(); }} to={origin==='quiz'?'../quiz/resultado':'..'} className="ml-auto font-normal text-muted-foreground underline underline-offset-4 hover:text-foreground">{copy.back}</Link>
    </div></header>
    {copy.showActivity && <CheckoutActivityBar shoppers={shoppers} copy={copy} />}
    <div className="px-5 pt-5 lg:hidden"><CheckoutOfferTimer timeLeft={copy.showTimer ? timeLeft : null} label={view.content?.promotion?.timerLabel} /></div>
    <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-5 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
      <section className="min-w-0 space-y-8">
        <h1 ref={headingRef} tabIndex={-1} className="sr-only">{copy.title}</h1>
        {preview ? <CheckoutPaymentPreview copy={copy} totalLabel={money(total)} state={previewState} /> : <CheckoutPayment origin={origin} quizToken={origin==='quiz'?readQuizToken(view.subdomain):undefined} initialBuyer={initialBuyer} view={view} via={via} selected={selected} total={total} totalLabel={money(total)} onPayingChange={setBusy} payRef={payRef} />}
        {trust}
      </section>

      <aside className="checkout-sidebar min-w-0 space-y-6">
        {offer.upsells.length === 0 && <div className="hidden lg:block"><CheckoutOfferTimer timeLeft={copy.showTimer ? timeLeft : null} label={view.content?.promotion?.timerLabel} /></div>}
        {offer.upsells.length > 0 && <section className="space-y-4 rounded-xl border bg-card p-5" aria-labelledby="checkout-extras">
          <h2 id="checkout-extras" className="flex items-center justify-center gap-2 text-center text-xs font-bold tracking-widest text-primary uppercase"><Zap className="size-4" aria-hidden="true" />{copy.upsellTitle}</h2>
          <div className="hidden lg:block"><CheckoutOfferTimer timeLeft={copy.showTimer ? timeLeft : null} label={view.content?.promotion?.timerLabel} /></div>
          {offer.upsells.map(upsell => {
            const on = selected.includes(upsell.productId);
            const percent = productDiscount(upsell.price, upsell.compareAtPrice);
            return <article key={upsell.productId} className={`relative overflow-hidden rounded-xl border-2 p-4 transition-colors ${on ? 'checkout-extra-selected' : 'border-border'}`}>
              {percent > 0 && <span className="mb-2 ml-auto block w-fit max-w-full rounded-lg bg-destructive px-2 py-1 text-xs font-bold text-white">{t('discount', { porcentaje: percent })}</span>}
              <div className="flex gap-4">
                <Thumb src={upsell.coverUrl} name={upsell.name} className="size-14" />
                <div className="min-w-0 flex-1 space-y-2">
                  <h3 className="pr-10 leading-snug font-semibold">{upsell.name}</h3>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">{upsell.compareAtPrice && <del className="text-muted-foreground">{money(upsell.compareAtPrice)}</del>}<strong className="text-base checkout-positive">+ {money(upsell.price)}</strong></p>
                  {(upsell.shortDescription || upsell.description) && <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{upsell.shortDescription || upsell.description}</p>}
                </div>
              </div>
              <Button type="button" variant={on ? 'outline' : 'default'} className={`checkout-extra-button mt-4 w-full ${on ? 'is-selected' : ''}`} aria-pressed={on} disabled={locked}
                onClick={() => setSelected(on ? selected.filter(id => id !== upsell.productId) : [...selected, upsell.productId])}>
                {on ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{on ? copy.added : copy.add}
              </Button>
            </article>;
          })}
        </section>}

        <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="checkout-summary">
          <h2 id="checkout-summary" className="border-b p-5 font-semibold">{copy.summaryTitle}</h2>
          <div className="space-y-4 p-5">
            <div className="flex gap-4">
              <Thumb src={offer.main.coverUrl} name={offer.main.name} className="h-20 w-16" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="flex justify-between gap-3 font-medium"><span className="min-w-0">{offer.main.name}</span><span className="whitespace-nowrap">{money(offer.main.price)}</span></p>
                {offer.bonuses.length > 0 && <Badge variant="secondary"><Gift aria-hidden="true" />{t(offer.bonuses.length === 1 ? 'oneBonus' : 'manyBonuses', { cantidad: offer.bonuses.length })}</Badge>}
              </div>
            </div>
            {offer.bonuses.length > 0 && <ul className="space-y-2">{offer.bonuses.map(bonus => <li key={bonus.productId} className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">{bonus.name}</span>{bonus.referenceValue > 0 && <del className="whitespace-nowrap">{money(bonus.referenceValue)}</del>}<Badge>{copy.free}</Badge>
            </li>)}</ul>}
            {chosen.length > 0 && <ul className="space-y-3">{chosen.map(upsell => <li key={upsell.productId} className="flex items-center gap-3 text-sm">
              <Thumb src={upsell.coverUrl} name={upsell.name} className="size-10" /><span className="min-w-0 flex-1">{upsell.name}</span><span className="whitespace-nowrap">{money(upsell.price)}</span>
            </li>)}</ul>}
            <div className="space-y-1 border-t pt-4" aria-live="polite">
              <p className="flex items-end justify-between gap-4"><span className="text-muted-foreground">{copy.total}</span>
                <span className="text-right">{savings > 0 && <del className="block text-sm text-muted-foreground">{money(reference)}</del>}<strong className="text-2xl font-semibold">{money(total)}</strong></span></p>
              {savings > 0 && <p className="text-right text-sm font-semibold checkout-positive">{t('savings', { importe: money(savings) })}</p>}
            </div>
          </div>
          <div className="border-t bg-muted/40 p-4">{trust}</div>
        </section>
      </aside>
    </main>
    {copy.notifications && <DemoPurchaseToasts key={view.subdomain} copy={copy} preview={preview} checkoutCopy={copy} placement="bottom" />}
    {(content.footer.termsUrl || content.footer.privacyUrl) && <nav className="checkout-legal" aria-label={copy.legalLabel}>
      {content.footer.privacyUrl && <a onClick={event => { if (preview) event.preventDefault(); }} href={content.footer.privacyUrl} target="_blank" rel="noreferrer">{copy.privacy}</a>}
      {content.footer.termsUrl && <a onClick={event => { if (preview) event.preventDefault(); }} href={content.footer.termsUrl} target="_blank" rel="noreferrer">{copy.terms}</a>}
    </nav>}
    {preview ? previewState === 'exit' && <ExitIntentPreview view={view} /> : copy.showExit && exitIntent}
    {!preview && view.downsell && popupOptions(view.content).backCheckout && <DownsellModal view={view} step="checkout" onAccept={() => navigate('../oferta', {state:{origin}})} />}
  </div>;
}

// The downsell: the main product with its bonuses and without extras, at the store's
// discount. The amounts shown come from the server, which charges the same ones.
function DownsellOffer({ view, via }) {
  const origin=useLocation().state?.origin || 'direct';
  useViewTracking(view.subdomain, 'checkout', view.store.id, origin);
  const quizContact = useQuizContact(view.subdomain);
  const start = useAction(api.checkout.start);
  const attemptFor = useAttempt();
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { offer, store, downsell } = view;
  useEffect(() => { document.title = offer.main.name; }, [offer.main.name]);

  async function pay() {
    if (busy) return;
    setBusy(true); setError('');
    const attempt = attemptFor('downsell');
    try {
      const result = await start({ subdomain: view.subdomain, upsellProductIds: [], ...attemptArgs(attempt), via, downsell: true, elements: true, origin, ...(origin==='quiz'?{quizToken:readQuizToken(view.subdomain)}:{}) });
      trackPixel(store.metaPixelId, 'InitiateCheckout', { value: downsell.price / 100, currency: store.currency });
      setClientSecret(result.clientSecret);
    } catch (failure) { attempt.failed = true; setError(postLabels(view.content).startError); }
    finally { setBusy(false); }
  }

  return <DownsellOfferView view={view} origin={origin} clientSecret={clientSecret} busy={busy} error={error} onPay={pay} initialBuyer={quizContact ?? undefined} />;
}

export function DownsellOfferView({ view, origin = 'direct', clientSecret, busy = false, error = '', onPay, initialBuyer, preview = false }) {
  const { offer, store, downsell } = view;
  const copy = backPopupConfig(view);
  const checkout = checkoutConfig(view);
  const labels = postLabels(view.content);
  const money = amount => formatMoney(amount, store.currency);
  const { timeLeft } = useSimulatedCheckoutSignals(`${view.subdomain}:oferta`, { preview });
  const [accepted, setAccepted] = useState(false);
  if (!downsell) return <p className="p-6">Activá el descuento del producto principal para ver esta oferta. No se inventa un precio en la vista previa.</p>;
  return <div className="min-h-screen bg-muted/40 break-words">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-xl items-center gap-2 px-5 py-4 text-sm font-semibold sm:px-6">
      <LockKeyhole className="size-4 text-primary" aria-hidden="true" />{checkout.secure}
      <Link onClick={event => { if (preview) event.preventDefault(); }} to={origin==='quiz'?'../quiz/resultado':'..'} className="ml-auto font-normal text-muted-foreground underline underline-offset-4 hover:text-foreground">{checkout.back}</Link>
    </div></header>
    <main className="mx-auto max-w-xl space-y-6 px-5 py-8 sm:px-6">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{copy.pageTitle}</h1>
        <p className="leading-7 text-muted-foreground">{copy.pageSubtitle}</p>
      </div>
      {downsell.videoUrl && videoSource(downsell.videoUrl) && <Video key={downsell.videoUrl} video={{ enabled: true, url: downsell.videoUrl, title: '' }} editKey="popupBack" labels={labels} preview={preview} />}
      <CheckoutOfferTimer timeLeft={checkout.showTimer ? timeLeft : null} label={view.content?.promotion?.timerLabel} />
      <section className="overflow-hidden rounded-xl border bg-card" aria-label={copy.offerLabel}>
        <div className="space-y-4 p-5">
          <div className="flex gap-4">
            <Thumb src={offer.main.coverUrl} name={offer.main.name} className="h-24 w-20" />
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="leading-snug font-semibold">{offer.main.name}</h2>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <del className="text-sm text-muted-foreground">{money(offer.main.price)}</del>
                <strong className="text-xl text-primary">{money(downsell.price)}</strong>
                <span className="text-sm font-semibold text-primary">{purchaseText(copy, 'savings', { porcentaje: downsell.percent })}</span>
              </p>
              {(offer.main.shortDescription || offer.main.description) && <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{offer.main.shortDescription || offer.main.description}</p>}
            </div>
          </div>
          {offer.bonuses.length > 0 && <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold"><Gift className="size-4 text-primary" aria-hidden="true" />{copy.bonuses}</p>
            <ul className="space-y-2">{offer.bonuses.map(bonus => <li key={bonus.productId} className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">{bonus.name}</span>{bonus.referenceValue > 0 && <del className="whitespace-nowrap">{money(bonus.referenceValue)}</del>}<Badge>{checkout.free}</Badge>
            </li>)}</ul>
          </div>}
          <dl className="space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{copy.subtotal}</dt><dd>{money(offer.main.price)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{copy.discount}</dt><dd className="font-semibold text-primary">-{money(offer.main.price - downsell.price)}</dd></div>
            <div className="flex items-end justify-between gap-4"><dt className="text-muted-foreground">{checkout.total}</dt><dd className="text-2xl font-semibold">{money(downsell.price)}</dd></div>
          </dl>
        </div>
      </section>
      {preview && accepted ? <CheckoutPaymentPreview copy={checkout} totalLabel={money(downsell.price)} /> : clientSecret ? <SessionPayment copy={checkout} clientSecret={clientSecret} total={downsell.price} currency={store.currency} totalLabel={money(downsell.price)} askContact initialBuyer={initialBuyer} /> : <div className="space-y-3">
        {!preview && !stripeKey && <Alert><AlertDescription>{checkout.unavailable}</AlertDescription></Alert>}
        <ErrorAlert>{error}</ErrorAlert>
        <Button size="lg" className="h-auto min-h-14 w-full whitespace-normal py-3 text-base" onClick={preview ? () => setAccepted(true) : onPay} disabled={busy || (!preview && !stripeKey)}>
          {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? labels.preparing : copy.cta}
        </Button>
        <Button asChild variant="ghost" className="w-full"><Link onClick={event => { if (preview) event.preventDefault(); }} to={origin==='quiz'?'../quiz/resultado':'..'}>{copy.declineText}</Link></Button>
      </div>}
      <p className="flex justify-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" aria-hidden="true" />{checkout.secure}</p>
    </main>
  </div>;
}

function ThankYou({ via, subdomain }) {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id') || '';
  const delivery = useQuery(api.storefront.getDelivery, sessionId ? { sessionId } : 'skip');
  // The store's look is only needed while the purchase loads or cannot be found.
  const context = useQuery(api.storefront.getCheckout, delivery?.presentation ? 'skip' : { subdomain });
  useEffect(() => {
    if (delivery?.status === 'paid') trackPixelOnce(`purchase-${sessionId}`, delivery.metaPixelId, 'Purchase', { value: delivery.total / 100, currency: delivery.currency });
  }, [delivery, sessionId]);
  const presentation = delivery?.presentation ?? { accentColor: context?.content?.style?.accentColor, ...context?.content?.footer, postLabels: context?.content?.postLabels };
  return <PurchaseResult status={sessionId && delivery === undefined ? 'loading' : delivery?.status ?? 'missing'} presentation={presentation} storeName={delivery?.storeName ?? context?.store?.name} emailed={delivery?.emailed} deliveries={delivery?.deliveries ?? []}>
    {delivery?.status === 'paid' && delivery.postPurchaseOffer && <PostPurchaseModal offer={delivery.postPurchaseOffer} currency={delivery.currency} sessionId={sessionId} via={via} accentColor={presentation.accentColor} />}
  </PurchaseResult>;
}

function LandingRoutes({ subdomain, via }) {
  const classic = useQuery(api.storefront.getLanding, { subdomain });
  const view = useQuery(api.storefront.getCheckout, { subdomain });
  if (view === undefined || classic === undefined) return <Page><PageSkeleton label="Loading" /></Page>;
  return <Routes>
    <Route index element={classic ? <Landing view={classic} /> : <Unavailable />} />
    <Route path="quiz/*" element={<Suspense fallback={<p className="p-8">Loading quiz…</p>}><Quiz subdomain={subdomain} view={view}/></Suspense>} />
    <Route path="checkout" element={view ? <Checkout view={view} via={via} /> : <Unavailable />} />
    <Route path="oferta" element={view?.downsell ? <DownsellOffer view={view} via={via} /> : <Unavailable />} />
    <Route path="*" element={<Unavailable />} />
  </Routes>;
}

// `via` records whether the visit came through the subdomain or the /l/<subdomain> path,
// so the server sends the buyer back to the same address after paying.
export default function Storefront({ subdomain, via }) {
  return <ErrorBoundary language="en-US"><Routes>
    <Route path="gracias" element={<ThankYou via={via} subdomain={subdomain} />} />
    <Route path="*" element={<LandingRoutes subdomain={subdomain} via={via} />} />
  </Routes></ErrorBoundary>;
}
