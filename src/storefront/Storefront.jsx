import { readQuizToken } from './quiz-session.js';
const Quiz = lazy(() => import('./Quiz.jsx'));
import PostPurchaseContent, { DeliveryLinks, PurchaseLanding, PurchaseSection } from '@/templates/PostPurchaseContent.jsx';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAction, useQuery } from 'convex/react';
import { ArrowRight, BookOpen, Check, CreditCard, Gift, LoaderCircle, LockKeyhole, Plus, ShieldCheck, Zap } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText } from '@/lib/format.js';
import { storefrontMoney as formatMoney } from '@/lib/storefront-money.js';
import { trackPixel, trackPixelOnce } from '@/lib/pixel.js';
import { templateFor } from '@/templates/index.js';
import { checkoutTotals, normalizeContent } from '@/templates/content.js';
import { plainText } from '../../shared/classic-design.js';
import DemoPurchaseToasts from './DemoPurchaseToasts.jsx';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ErrorAlert, PageSkeleton } from '@/components/Field.jsx';
import ExitIntentModal from './ExitIntentModal.jsx';
import CheckoutPayment, { SessionPayment, stripeKey } from './CheckoutPayment.jsx';
import DownsellModal from './DownsellModal.jsx';
import { downsellCopy } from './downsell.js';
import { CheckoutActivityBar, CheckoutOfferTimer, useSimulatedCheckoutSignals } from './CheckoutSignals.jsx';
import { useViewTracking } from './useViewTracking.js';

const Page = ({ children }) => <main className="mx-auto max-w-2xl space-y-6 px-5 py-10 sm:px-6">{children}</main>;
const Unavailable = () => <Page>
  <h1 className="text-3xl font-semibold tracking-tight">Esta página no está disponible</h1>
  <p className="leading-7 text-muted-foreground">La oferta que buscás no existe o ya no está publicada.</p>
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
    <ExitIntentModal view={view} step="landing" onCta={() => navigate('checkout', { state: { focusHeading: true, origin:'classic' } })} />
    {view.downsell && <DownsellModal view={view} step="landing" onAccept={() => navigate('oferta', {state:{origin:'classic'}})} />}
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
  const { shoppers, timeLeft } = useSimulatedCheckoutSignals(view.subdomain, { promotion: view.content?.promotion });
  const { offer, store } = view;
  // Extras ticked in the landing's order builder arrive already selected.
  const [selected, setSelected] = useState(() => offer.upsells.filter(upsell => location.state?.selected?.includes(upsell.productId)).map(upsell => upsell.productId));
  const [busy, setBusy] = useState(false);
  const content = normalizeContent(view.content);
  const money = amount => formatMoney(amount, store.currency);
  const navigate = useNavigate();
  const focusHeading = useLocation().state?.focusHeading;
  const headingRef = useRef(null);
  const payRef = useRef(null);
  useEffect(() => { if (focusHeading) headingRef.current?.focus(); }, [focusHeading]);
  // Sends the visitor back to the step they were on; it never starts the payment.
  const exitIntent = <ExitIntentModal view={view} step="checkout" onCta={() => {
    const target = payRef.current && !payRef.current.disabled ? payRef.current : headingRef.current;
    target?.scrollIntoView({ block: 'center' });
    target?.focus();
  }} />;
  const chosen = offer.upsells.filter(upsell => selected.includes(upsell.productId));
  // Shown amounts only; the server recalculates the charge from the store.
  const { total, reference, savings } = checkoutTotals(offer, chosen);
  const locked = busy;
  const guarantee = content.guarantee.enabled && content.guarantee.text ? (content.guarantee.days ? `Garantía de ${content.guarantee.days} días` : content.guarantee.title) : '';
  const trust = <p className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
    <span className="inline-flex items-center gap-1.5"><LockKeyhole className="size-3.5" aria-hidden="true" />Pago seguro</span>
    {guarantee && <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-3.5" aria-hidden="true" />{guarantee}</span>}
  </p>;

  return <div className="checkout-page min-h-screen bg-muted/40">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-6xl items-center gap-2 px-5 py-4 text-sm font-semibold sm:px-6">
      <LockKeyhole className="size-4 text-primary" aria-hidden="true" />Pago seguro
      <Link to={origin==='quiz'?'../quiz/resultado':'..'} className="ml-auto font-normal text-muted-foreground underline underline-offset-4 hover:text-foreground">Volver a la oferta</Link>
    </div></header>
    <CheckoutActivityBar shoppers={shoppers} />
    <div className="px-5 pt-5 lg:hidden"><CheckoutOfferTimer timeLeft={timeLeft} label={view.content?.promotion?.timerLabel} /></div>
    <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-5 py-8 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
      <section className="min-w-0 space-y-8">
        <h1 ref={headingRef} tabIndex={-1} className="sr-only">Finalizá tu compra</h1>
        <CheckoutPayment origin={origin} quizToken={origin==='quiz'?readQuizToken(view.subdomain):undefined} initialBuyer={origin==='quiz'?location.state?.buyer:undefined} view={view} via={via} selected={selected} total={total} totalLabel={money(total)} onPayingChange={setBusy} payRef={payRef} />
        {trust}
      </section>

      <aside className="checkout-sidebar min-w-0 space-y-6">
        {offer.upsells.length === 0 && <div className="hidden lg:block"><CheckoutOfferTimer timeLeft={timeLeft} label={view.content?.promotion?.timerLabel} /></div>}
        {offer.upsells.length > 0 && <section className="space-y-4 rounded-xl border bg-card p-5" aria-labelledby="checkout-extras">
          <h2 id="checkout-extras" className="flex items-center justify-center gap-2 text-center text-xs font-bold tracking-widest text-primary uppercase"><Zap className="size-4" aria-hidden="true" />{view.checkout?.upsellTitle || 'Sumá a tu compra'}</h2>
          <div className="hidden lg:block"><CheckoutOfferTimer timeLeft={timeLeft} label={view.content?.promotion?.timerLabel} /></div>
          {offer.upsells.map(upsell => {
            const on = selected.includes(upsell.productId);
            const percent = upsell.compareAtPrice ? Math.round((1 - upsell.price / upsell.compareAtPrice) * 100) : 0;
            return <article key={upsell.productId} className={`relative overflow-hidden rounded-xl border-2 p-4 transition-colors ${on ? 'checkout-extra-selected' : 'border-border'}`}>
              {percent > 0 && <span className="absolute top-0 right-0 rounded-bl-lg bg-destructive px-2 py-1 text-xs font-bold text-white">-{percent}%</span>}
              <div className="flex gap-4">
                <Thumb src={upsell.coverUrl} name={upsell.name} className="size-14" />
                <div className="min-w-0 flex-1 space-y-2">
                  <h3 className="pr-10 leading-snug font-semibold">{upsell.name}</h3>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">{upsell.compareAtPrice && <del className="text-muted-foreground">{money(upsell.compareAtPrice)}</del>}<strong className="text-base checkout-positive">+ {money(upsell.price)}</strong></p>
                  {upsell.description && <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{upsell.description}</p>}
                </div>
              </div>
              <Button type="button" variant={on ? 'outline' : 'default'} className={`checkout-extra-button mt-4 w-full ${on ? 'is-selected' : ''}`} aria-pressed={on} disabled={locked}
                onClick={() => setSelected(on ? selected.filter(id => id !== upsell.productId) : [...selected, upsell.productId])}>
                {on ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{on ? 'Agregado a tu compra' : 'Agregar a mi compra'}
              </Button>
            </article>;
          })}
        </section>}

        <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="checkout-summary">
          <h2 id="checkout-summary" className="border-b p-5 font-semibold">Resumen de tu compra</h2>
          <div className="space-y-4 p-5">
            <div className="flex gap-4">
              <Thumb src={offer.main.coverUrl} name={offer.main.name} className="h-20 w-16" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="flex justify-between gap-3 font-medium"><span className="min-w-0">{offer.main.name}</span><span className="whitespace-nowrap">{money(offer.main.price)}</span></p>
                {offer.bonuses.length > 0 && <Badge variant="secondary"><Gift aria-hidden="true" />+{offer.bonuses.length} {offer.bonuses.length === 1 ? 'bono gratis' : 'bonos gratis'}</Badge>}
              </div>
            </div>
            {offer.bonuses.length > 0 && <ul className="space-y-2">{offer.bonuses.map(bonus => <li key={bonus.productId} className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">{bonus.name}</span>{bonus.referenceValue > 0 && <del className="whitespace-nowrap">{money(bonus.referenceValue)}</del>}<Badge>GRATIS</Badge>
            </li>)}</ul>}
            {chosen.length > 0 && <ul className="space-y-3">{chosen.map(upsell => <li key={upsell.productId} className="flex items-center gap-3 text-sm">
              <Thumb src={upsell.coverUrl} name={upsell.name} className="size-10" /><span className="min-w-0 flex-1">{upsell.name}</span><span className="whitespace-nowrap">{money(upsell.price)}</span>
            </li>)}</ul>}
            <div className="space-y-1 border-t pt-4" aria-live="polite">
              <p className="flex items-end justify-between gap-4"><span className="text-muted-foreground">Total</span>
                <span className="text-right">{savings > 0 && <del className="block text-sm text-muted-foreground">{money(reference)}</del>}<strong className="text-2xl font-semibold">{money(total)}</strong></span></p>
              {savings > 0 && <p className="text-right text-sm font-semibold checkout-positive">Ahorrás {money(savings)}</p>}
            </div>
          </div>
          <div className="border-t bg-muted/40 p-4">{trust}</div>
        </section>
      </aside>
    </main>
    {view.checkout?.notifications && <DemoPurchaseToasts key={view.subdomain} copy={content.activity} style={{ '--sales-accent': 'var(--primary)', '--sales-ink': 'var(--foreground)', top: 'auto', right: 'auto', bottom: 16, left: 16 }} />}
    {(content.footer.termsUrl || content.footer.privacyUrl) && <nav className="checkout-legal" aria-label="Información legal">
      {content.footer.privacyUrl && <a href={content.footer.privacyUrl} target="_blank" rel="noreferrer">Política de privacidad</a>}
      {content.footer.termsUrl && <a href={content.footer.termsUrl} target="_blank" rel="noreferrer">Términos y condiciones</a>}
    </nav>}
    {exitIntent}
    {view.downsell && <DownsellModal view={view} step="checkout" onAccept={() => navigate('../oferta', {state:{origin}})} />}
  </div>;
}

// The downsell: the main product with its bonuses and without extras, at the store's
// discount. The amounts shown come from the server, which charges the same ones.
function DownsellOffer({ view, via }) {
  const origin=useLocation().state?.origin || 'direct';
  useViewTracking(view.subdomain, 'checkout', view.store.id, origin);
  const { timeLeft } = useSimulatedCheckoutSignals(`${view.subdomain}:oferta`);
  const start = useAction(api.checkout.start);
  const attemptFor = useAttempt();
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { offer, store, downsell } = view;
  const copy = downsellCopy(downsell);
  const money = amount => formatMoney(amount, store.currency);
  useEffect(() => { document.title = offer.main.name; }, [offer.main.name]);

  async function pay() {
    if (busy) return;
    setBusy(true); setError('');
    const attempt = attemptFor('downsell');
    try {
      const result = await start({ subdomain: view.subdomain, upsellProductIds: [], ...attemptArgs(attempt), via, downsell: true, elements: true, origin, ...(origin==='quiz'?{quizToken:readQuizToken(view.subdomain)}:{}) });
      trackPixel(store.metaPixelId, 'InitiateCheckout', { value: downsell.price / 100, currency: store.currency });
      setClientSecret(result.clientSecret);
    } catch (failure) { attempt.failed = true; setError(errorText(failure, 'No se pudo iniciar el pago. Volvé a intentar.')); }
    finally { setBusy(false); }
  }

  return <div className="min-h-screen bg-muted/40">
    <header className="border-b bg-card"><div className="mx-auto flex max-w-xl items-center gap-2 px-5 py-4 text-sm font-semibold sm:px-6">
      <LockKeyhole className="size-4 text-primary" aria-hidden="true" />Pago seguro
      <Link to={origin==='quiz'?'../quiz/resultado':'..'} className="ml-auto font-normal text-muted-foreground underline underline-offset-4 hover:text-foreground">Volver a la oferta</Link>
    </div></header>
    <main className="mx-auto max-w-xl space-y-6 px-5 py-8 sm:px-6">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{copy.pageTitle}</h1>
        <p className="leading-7 text-muted-foreground">{copy.pageSubtitle}</p>
      </div>
      <CheckoutOfferTimer timeLeft={timeLeft} label={view.content?.promotion?.timerLabel} />
      <section className="overflow-hidden rounded-xl border bg-card" aria-label="Tu oferta">
        <div className="space-y-4 p-5">
          <div className="flex gap-4">
            <Thumb src={offer.main.coverUrl} name={offer.main.name} className="h-24 w-20" />
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="leading-snug font-semibold">{offer.main.name}</h2>
              <p className="flex flex-wrap items-baseline gap-x-2">
                <del className="text-sm text-muted-foreground">{money(offer.main.price)}</del>
                <strong className="text-xl text-primary">{money(downsell.price)}</strong>
                <span className="text-sm font-semibold text-primary">(Ahorrás {downsell.percent}%)</span>
              </p>
              {offer.main.description && <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{offer.main.description}</p>}
            </div>
          </div>
          {offer.bonuses.length > 0 && <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold"><Gift className="size-4 text-primary" aria-hidden="true" />+ Bonos gratis incluidos</p>
            <ul className="space-y-2">{offer.bonuses.map(bonus => <li key={bonus.productId} className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="min-w-0 flex-1 truncate">{bonus.name}</span>{bonus.referenceValue > 0 && <del className="whitespace-nowrap">{money(bonus.referenceValue)}</del>}<Badge>GRATIS</Badge>
            </li>)}</ul>
          </div>}
          <dl className="space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Subtotal</dt><dd>{money(offer.main.price)}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Descuento</dt><dd className="font-semibold text-primary">-{money(offer.main.price - downsell.price)}</dd></div>
            <div className="flex items-end justify-between gap-4"><dt className="text-muted-foreground">Total</dt><dd className="text-2xl font-semibold">{money(downsell.price)}</dd></div>
          </dl>
        </div>
      </section>
      {clientSecret ? <SessionPayment clientSecret={clientSecret} total={downsell.price} currency={store.currency} totalLabel={money(downsell.price)} askContact /> : <div className="space-y-3">
        {!stripeKey && <Alert><AlertDescription>Los pagos todavía no están habilitados en este sitio.</AlertDescription></Alert>}
        <ErrorAlert>{error}</ErrorAlert>
        <Button size="lg" className="h-14 w-full text-base" onClick={pay} disabled={busy || !stripeKey}>
          {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{busy ? 'Preparando el pago…' : 'Sí, lo quiero con descuento'}
        </Button>
        <Button asChild variant="ghost" className="w-full"><Link to="..">{copy.declineText}</Link></Button>
      </div>}
      <p className="flex justify-center gap-1.5 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" aria-hidden="true" />Pago seguro</p>
    </main>
  </div>;
}

function PostPurchaseOffer({ offer, currency, sessionId, via }) {
  const start = useAction(api.checkout.startPostPurchase);
  const attemptFor = useAttempt();
  // Declining the regular price shows the downsell once, when the store set one.
  const [state, setState] = useState({ clientSecret: '', busy: false, error: '', stage: 'offer' });
  if (state.stage === 'declined') return null;
  const downsell = state.stage === 'downsell';

  async function accept() {
    if (state.busy) return;
    setState({ ...state, busy: true, error: '' });
    const attempt = attemptFor(`${sessionId}:${state.stage}`);
    try {
      const result = await start({ parentSessionId: sessionId, ...attemptArgs(attempt), via, elements: true, ...(downsell ? { downsell: true } : {}) });
      setState({ ...state, busy: false, clientSecret: result.clientSecret });
    } catch (failure) { attempt.failed = true; setState({ ...state, busy: false, error: errorText(failure, 'No se pudo iniciar el pago. Volvé a intentar.') }); }
  }

  if (state.clientSecret) {
    const total = downsell ? offer.downsellPrice : offer.price;
    return <PurchaseSection label="Pago de la oferta">
      <div className="sales-heading"><span className="sales-eyebrow">Último paso</span><h2>Sumá {offer.name} por {formatMoney(total, currency)}</h2></div>
      <SessionPayment clientSecret={state.clientSecret} total={total} currency={currency} totalLabel={formatMoney(total, currency)} />
    </PurchaseSection>;
  }
  return <PostPurchaseContent offer={offer} currency={currency} downsell={downsell}
    busy={state.busy} error={state.error} canPurchase={Boolean(stripeKey)} onAccept={accept}
    onDecline={() => setState({ ...state, error: '', stage: !downsell && offer.downsellPrice ? 'downsell' : 'declined' })} />;
}

function ThankYou({ via }) {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id') || '';
  const delivery = useQuery(api.storefront.getDelivery, sessionId ? { sessionId } : 'skip');

  useEffect(() => {
    if (delivery?.status === 'paid') trackPixelOnce(`purchase-${sessionId}`, delivery.metaPixelId, 'Purchase', { value: delivery.total / 100, currency: delivery.currency });
  }, [delivery, sessionId]);

  const shell = (title, message, extra = {}) => <PurchaseLanding presentation={delivery?.presentation} storeName={delivery?.storeName} title={title} {...extra}>
    <PurchaseSection><div className="purchase-notice">{message}</div></PurchaseSection>
  </PurchaseLanding>;
  if (sessionId && delivery === undefined) return shell('Buscando tu compra', <PageSkeleton label="Buscando tu compra" />, { busy: true });
  if (!delivery) return shell('No encontramos esta compra', <p>Abrí el link completo de la página a la que te llevó el pago. Si el problema sigue, escribile a quien te vendió el producto.</p>);
  if (delivery.status === 'pending') return shell('Estamos confirmando tu pago', <p role="status">Suele tardar unos segundos. No cierres esta página: tus links aparecen acá apenas se confirme.</p>, { busy: true });
  if (delivery.status === 'needs_review') return shell('Estamos revisando tu pago', <p>Recibimos el pago, pero necesitamos verificarlo antes de entregar tus links. Te vamos a contactar al email que usaste en la compra.</p>);
  if (delivery.status !== 'paid') return shell(delivery.status === 'refunded' ? 'Esta compra fue reembolsada' : 'El pago no se completó', <>
    <p>{delivery.status === 'refunded' ? 'Los links de esta compra ya no están disponibles.' : delivery.status === 'failed' ? 'Tu banco rechazó el pago y no se realizó ningún cobro. Podés volver a intentarlo con otro medio.' : 'No se realizó ningún cobro. Podés volver a intentarlo.'}</p>
    {(delivery.status === 'expired' || delivery.status === 'failed') && <Link className="purchase-open purchase-notice-action" to="..">Volver a la oferta<ArrowRight aria-hidden="true" /></Link>}
  </>);

  return <PurchaseLanding presentation={delivery.presentation} storeName={delivery.storeName} eyebrow="Compra confirmada" title="¡Gracias por tu compra!"
    subtitle={`Estos son tus links. ${delivery.emailed ? 'También te los enviamos por email.' : 'Guardá la dirección de esta página: es la forma de volver a verlos.'}`}>
    {delivery.postPurchaseOffer && <PostPurchaseOffer offer={delivery.postPurchaseOffer} currency={delivery.currency} sessionId={sessionId} via={via} />}
    <DeliveryLinks deliveries={delivery.deliveries} />
  </PurchaseLanding>;
}

function LandingRoutes({ subdomain, via }) {
  const classic = useQuery(api.storefront.getLanding, { subdomain });
  const view = useQuery(api.storefront.getCheckout, { subdomain });
  if (view === undefined || classic === undefined) return <Page><PageSkeleton label="Cargando" /></Page>;
  return <Routes>
    <Route index element={classic ? <Landing view={classic} /> : <Unavailable />} />
    <Route path="quiz/*" element={<Suspense fallback={<p className="p-8">Cargando quiz…</p>}><Quiz subdomain={subdomain} view={view}/></Suspense>} />
    <Route path="checkout" element={view ? <Checkout view={view} via={via} /> : <Unavailable />} />
    <Route path="oferta" element={view?.downsell ? <DownsellOffer view={view} via={via} /> : <Unavailable />} />
    <Route path="*" element={<Unavailable />} />
  </Routes>;
}

// `via` records whether the visit came through the subdomain or the /l/<subdomain> path,
// so the server sends the buyer back to the same address after paying.
export default function Storefront({ subdomain, via }) {
  return <ErrorBoundary><Routes>
    <Route path="gracias" element={<ThankYou via={via} />} />
    <Route path="*" element={<LandingRoutes subdomain={subdomain} via={via} />} />
  </Routes></ErrorBoundary>;
}
