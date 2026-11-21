import { initialFunnel, afterDecline, claimReopen, nextStage } from '@/storefront/postPurchaseFunnel.js';
import { postLabels } from '../../shared/purchase-copy.js';
import { checkoutConfig } from '../../shared/checkout-copy.js';
import { CheckoutPaymentPreview } from '@/storefront/CheckoutPayment.jsx';
import { Link } from 'react-router-dom';
import { PageSkeleton } from '@/components/Field.jsx';
import { usePreviewSection } from './PreviewEditing.jsx';
import './classic-landing.css';
import './thank-you.css';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, BookOpen, LifeBuoy, Check, Download, ExternalLink, Gift, Globe, LoaderCircle, PlusCircle, Receipt, Star, X } from 'lucide-react';
import { groupDeliveries } from '@/storefront/delivery-groups.js';
import { downloadFile, isDownloadable } from '@/storefront/download.js';
import PostPurchaseOfferCard from './PostPurchaseOfferCard.jsx';
import { classicTheme } from '../../shared/classic-design.js';
import { Heading } from './ClassicLanding.jsx';
import { normalizeContent } from './content.js';
import { storefrontMoney as money } from '@/lib/storefront-money.js';
import { videoSource } from '../../shared/post-purchase.js';

// Thank-you page shell: same palette, masthead and footer as the classic landing.
export function PurchaseLanding({ presentation = {}, storeName = '', eyebrow, title, subtitle, busy = false, preview = false, className = '', hero = null, children }) {
  const edit = usePreviewSection();
  const labels = postLabels(presentation);
  return <div className={`sales-landing classic-landing purchase-landing ${className}`.trim()} style={classicTheme(presentation.accentColor)}>
    <main>
      {hero ?? <header className="classic-masthead purchase-masthead">
        <div className="sales-container sales-slim">
          <div className="sales-hero-heading">
            {eyebrow && <span className="sales-eyebrow">{eyebrow}</span>}
            <h1>{busy && <LoaderCircle className="purchase-spinner animate-spin" aria-hidden="true" />}{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
      </header>}
      {children}
    </main>
    <footer {...edit('identity')} className="sales-footer"><div className="sales-container sales-slim">
      <p>© {new Date().getFullYear()} {presentation.brandName || storeName}. {labels.rights}</p>
      {(presentation.termsUrl || presentation.privacyUrl) && <nav aria-label={labels.legal}>{presentation.termsUrl && <a onClick={event => { if (preview) event.preventDefault(); }} href={presentation.termsUrl} target="_blank" rel="noreferrer">{labels.terms}</a>}{presentation.privacyUrl && <a onClick={event => { if (preview) event.preventDefault(); }} href={presentation.privacyUrl} target="_blank" rel="noreferrer">{labels.privacy}</a>}</nav>}
    </div></footer>
  </div>;
}

export function PurchaseSection({ soft = false, label, children }) {
  return <section className={`sales-section ${soft ? 'sales-soft' : ''}`} aria-label={label}><div className="sales-container sales-slim">{children}</div></section>;
}

// Download of one file: busy while it is fetched, so a second click does not start another.
function DownloadButton({ link, labels, className = 'purchase-open' }) {
  const [busy, setBusy] = useState(false);
  async function onClick() {
    if (busy) return;
    setBusy(true);
    try { await downloadFile(link.url, link.title || link.productName); } finally { setBusy(false); }
  }
  return <button type="button" className={className} onClick={onClick} disabled={busy} aria-busy={busy}>
    {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
    {busy ? labels.downloading : labels.download}<span className="sr-only"> {link.productName}: {link.title}</span>
  </button>;
}

const GROUP_LOOK = {
  main: { Icon: Star, label: 'groupMain' },
  bonus: { Icon: Gift, label: 'groupBonus' },
  extras: { Icon: PlusCircle, label: 'groupExtras' },
};

// Product cover when there is one, the group icon otherwise.
function DeliveryThumb({ link, group, web }) {
  const [failed, setFailed] = useState(false);
  const Icon = web ? Globe : group === 'bonus' ? Gift : group === 'extras' ? PlusCircle : BookOpen;
  if (link.coverUrl && !failed) return <span className="thanks-thumb is-cover" aria-hidden="true"><img src={link.coverUrl} alt="" onError={() => setFailed(true)} /></span>;
  return <span className="thanks-thumb" aria-hidden="true"><Icon /></span>;
}

// «Open» always, and «Download» first when the deliverable is a file.
// Files: «Download» and «Open». Pages (artifacts, external links): one «Visit site» button.
function DeliveryActions({ link, preview, labels, downloadable }) {
  const secondary = downloadable ? ' is-secondary' : '';
  const openLabel = downloadable ? labels.open : labels.openSite;
  if (preview) return <div className="purchase-actions">
    {downloadable && <span className="purchase-open is-disabled" aria-disabled="true"><Download aria-hidden="true" />{labels.download}</span>}
    <span className={`purchase-open is-disabled${secondary}`} aria-disabled="true">{openLabel}<ExternalLink aria-hidden="true" /></span>
  </div>;
  return <div className="purchase-actions">
    {downloadable && <DownloadButton link={link} labels={labels} />}
    <a className={`purchase-open${secondary}`} href={link.url} target="_blank" rel="noreferrer">{openLabel}<span className="sr-only"> {link.productName}: {link.title}</span><ExternalLink aria-hidden="true" /></a>
  </div>;
}

function DeliveryItem({ link, group, preview, labels, order }) {
  const downloadable = preview ? link.kind !== 'link' : isDownloadable(link);
  return <li className={`thanks-row is-${group}${downloadable ? '' : ' is-web'}`} style={{ '--i': order }}>
    <DeliveryThumb link={link} group={group} web={!downloadable} />
    <div className="thanks-row-text">
      <strong>{link.productName}{group === 'bonus' && labels.free && <span className="purchase-free">{labels.free}</span>}{!downloadable && labels.webBadge && <span className="purchase-web"><Globe aria-hidden="true" />{labels.webBadge}</span>}</strong>
      {link.title && link.title !== link.productName && <p>{link.title}</p>}
    </div>
    <DeliveryActions link={link} preview={preview} labels={labels} downloadable={downloadable} />
  </li>;
}

// The buyer's library: main product, free bonuses, then added products, as rows of one card.
// In the preview they are examples and cannot be opened.
export function DeliveryLinks({ deliveries, preview = false, labels = postLabels() }) {
  const groups = groupDeliveries(deliveries);
  let order = 0;
  return <section id="accesos" className="thanks-card thanks-library" aria-labelledby="thanks-library-title">
    <header className="thanks-card-head">
      {labels.linksEyebrow && <span className="thanks-kicker">{labels.linksEyebrow}</span>}
      <h2 id="thanks-library-title">{labels.linksTitle}</h2>
      {labels.linksSubtitle && <p>{labels.linksSubtitle}</p>}
    </header>
    {groups.length === 0
      ? <p className="purchase-notice">{labels.emptyLinks}</p>
      : groups.map(({ key, links }) => {
        const look = GROUP_LOOK[key];
        const title = look && labels[look.label];
        const group = key === 'all' ? 'main' : key;
        return <section key={key} className={`thanks-group is-${key}`} aria-label={title || labels.linksTitle} style={{ '--i': order }}>
          {title && <h3 className="thanks-group-title"><span><look.Icon aria-hidden="true" /></span>{title}<small>{links.length}</small></h3>}
          <ul className="thanks-rows">{links.map((link, index) => <DeliveryItem key={index} link={link} group={group} preview={preview} labels={labels} order={order++} />)}</ul>
        </section>;
      })}
  </section>;
}

// The main product as a 3D book: its cover, or a designed cover with its name.
// `target` marks it as the place where the celebration's book lands.
export function ProductBook({ name = '', coverUrl = '', target = false, web = false }) {
  const [failed, setFailed] = useState(false);
  return <div className="thanks-book" aria-hidden="true" {...(target ? { 'data-celebration-target': 'book' } : {})}>
    <div className="thanks-book-body">
      {coverUrl && !failed
        ? <img src={coverUrl} alt="" onError={() => setFailed(true)} />
        : <span className="thanks-book-cover">{web ? <Globe /> : <BookOpen />}<strong>{name}</strong><i /></span>}
      <span className="thanks-book-shine" />
    </div>
    <span className="thanks-book-seal"><Check /></span>
    <span className="thanks-book-shadow" />
  </div>;
}

// Hero of the paid page: confirmation, the main product's first action and its book.
function ThanksHero({ eyebrow, title, subtitle, main, preview, labels }) {
  return <header className="thanks-hero">
    <div className="sales-container thanks-hero-inner">
      <div className="thanks-hero-copy">
        <span className="thanks-hero-badge"><span className="thanks-hero-check"><Check aria-hidden="true" /></span>{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        <div className="thanks-hero-actions">
          {main && !preview && isDownloadable(main) && <DownloadButton link={main} labels={labels} className="thanks-hero-primary" />}
          {main && !preview && !isDownloadable(main) && <a className="thanks-hero-primary" href={main.url} target="_blank" rel="noreferrer">{labels.openSite}<span className="sr-only"> {main.productName}</span><ExternalLink aria-hidden="true" /></a>}
          {main && preview && (main.kind === 'link'
            ? <span className="thanks-hero-primary is-disabled" aria-disabled="true">{labels.openSite}<ExternalLink aria-hidden="true" /></span>
            : <span className="thanks-hero-primary is-disabled" aria-disabled="true"><Download aria-hidden="true" />{labels.download}</span>)}
          <a className="thanks-hero-secondary" href="#accesos" onClick={event => { event.preventDefault(); document.getElementById('accesos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{labels.seeLinks}<ArrowDown aria-hidden="true" /></a>
        </div>
      </div>
      {main && <div className="thanks-hero-art"><span className="thanks-hero-halo" /><ProductBook name={main.productName} coverUrl={main.coverUrl} target={!preview} web={preview ? main.kind === 'link' : !isDownloadable(main)} /></div>}
    </div>
  </header>;
}

const ROLE_ORDER = { main: 0, bonus: 1, upsell: 2, post_purchase: 3 };

// Ticket-like receipt: every item of the order, bonuses as «Free», and the total paid.
export function OrderSummary({ order, labels }) {
  if (!order?.items?.length || !order.currency) return null;
  const items = [...order.items].sort((a, b) => (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9));
  return <aside className="thanks-card thanks-receipt" aria-labelledby="thanks-receipt-title">
    <h2 id="thanks-receipt-title"><Receipt aria-hidden="true" />{labels.summaryTitle}</h2>
    <ul>{items.map((item, index) => <li key={index}>
      <span>{item.name}</span>
      <strong className={item.price ? '' : 'is-free'}>{item.price ? money(item.price, order.currency) : labels.free}</strong>
    </li>)}</ul>
    <p className="thanks-receipt-total"><span>{labels.summaryTotal}</span><strong>{money(order.total, order.currency)}</strong></p>
  </aside>;
}

// Optional VSL. `editKey` marks the section for the panel preview; outside it, it is inert.
export function Video({ video, editKey = 'postPurchaseVideo', labels = postLabels(), preview = false, forceError = false }) {
  const edit = usePreviewSection();
  const [failed, setFailed] = useState(false);
  const [nativeRatio, setNativeRatio] = useState(null);
  const source = videoSource(video.url);
  if (!video.enabled || !source) return null;
  const format = video.format && video.format !== 'auto' ? video.format : source.format;
  const ratio = format === 'reel' ? 9 / 16 : format === 'landscape' ? 16 / 9 : nativeRatio ?? 16 / 9;
  function measureVideo(event) {
    const { videoWidth, videoHeight } = event.currentTarget;
    if (videoWidth && videoHeight) setNativeRatio(videoWidth / videoHeight);
  }
  return <div {...edit(editKey)} className="purchase-video" style={{ '--vsl-ratio': ratio }}>
    {video.title && <h3>{video.title}</h3>}
    {source.kind === 'embed'
      ? <iframe src={source.src} title={video.title || labels.videoTitle} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      : failed || forceError ? <p role="status" className="purchase-notice">{labels.videoError}</p>
        : <video src={source.src} controls playsInline preload="metadata" onLoadedMetadata={measureVideo} onError={() => setFailed(true)}>{labels.videoUnsupported}</video>}
    <a onClick={event => { if (preview) event.preventDefault(); }} href={video.url} target="_blank" rel="noreferrer">{labels.videoOpen}<ExternalLink aria-hidden="true" /></a>
  </div>;
}

// The preview and the real paid flow use the same presentation; checkout stays in Storefront.
// Price, discount and title of each step of the post-purchase offer.
export function postPurchaseStage(offer, stage) {
  if (stage === 'final') return { price: offer.finalPrice, percent: offer.finalPercent };
  if (stage === 'downsell') return { price: offer.downsellPrice, percent: offer.downsellPercent };
  return { price: offer.price, percent: 0 };
}


// Under the library: where to write if something is missing. Same page the email links to.
function SupportBand({ labels, preview }) {
  return <aside className="thanks-card support-band">
    <span className="support-band-icon" aria-hidden="true"><LifeBuoy /></span>
    <div><h2>{labels.supportTitle}</h2>{labels.supportText && <p>{labels.supportText}</p>}</div>
    <Link className="purchase-open is-secondary" to="../soporte" onClick={event => { if (preview) event.preventDefault(); }}>{labels.supportLink}<ArrowRight aria-hidden="true" /></Link>
  </aside>;
}

// `entrance` adds the page's entrance classes after the celebration (see ThankYou).
export function PurchaseResult({ status = 'paid', presentation = {}, storeName, deliveries = [], order = null, emailed = true, preview = false, entrance = '', children }) {
  const copy = postLabels(presentation);
  if (status !== 'paid') {
    const titles = { loading: 'loadingTitle', missing: 'missingTitle', pending: 'pendingTitle', needs_review: 'reviewTitle', refunded: 'refundedTitle', failed: 'failedTitle', expired: 'failedTitle' };
    const messages = { loading: 'loadingTitle', missing: 'missingText', pending: 'pendingText', needs_review: 'reviewText', refunded: 'refundedText', failed: 'failedText', expired: 'expiredText' };
    return <PurchaseLanding preview={preview} presentation={presentation} storeName={storeName} title={copy[titles[status] ?? 'failedTitle']} busy={status === 'loading' || status === 'pending'}>
      <PurchaseSection><div className="purchase-notice">{status === 'loading' ? <PageSkeleton label={copy.loadingTitle} /> : <p role="status">{copy[messages[status] ?? 'expiredText']}</p>}
        {['failed', 'expired'].includes(status) && <Link onClick={event => { if (preview) event.preventDefault(); }} className="purchase-open purchase-notice-action" to="..">{copy.back}<ArrowRight aria-hidden="true" /></Link>}
      </div></PurchaseSection>
    </PurchaseLanding>;
  }
  const main = groupDeliveries(deliveries)[0]?.links[0] ?? null;
  const hero = <ThanksHero eyebrow={copy.paidEyebrow} title={copy.paidTitle} subtitle={emailed ? copy.emailedText : copy.savedText} main={main} preview={preview} labels={copy} />;
  return <PurchaseLanding preview={preview} presentation={presentation} storeName={storeName} hero={hero} className={`is-paid ${entrance}`}>
    <div className="thanks-body"><div className="sales-container">
      <div className={`thanks-grid${order?.items?.length ? '' : ' is-single'}`}>
        <DeliveryLinks deliveries={deliveries} preview={preview} labels={copy} />
        <OrderSummary order={order} labels={copy} />
      </div>
      <SupportBand labels={copy} preview={preview} />
    </div></div>
    {children}
  </PurchaseLanding>;
}

// No payment session or tracking is started by these preview actions.
export function PostPurchasePreview({ view, stage = 'offer', modal = true, state = 'offer', onStageChange }) {
  const content = normalizeContent(view.content);
  const labels = postLabels(content);
  const offer = view.postPurchaseOffer;
  const [dismissed, setDismissed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const initialPreviewFunnel = () => ({ ...initialFunnel(), declined: stage === 'final' ? ['offer', 'downsell'] : stage === 'downsell' ? ['offer'] : [] });
  const [funnel, setFunnel] = useState(initialPreviewFunnel);
  const [shown, setShown] = useState(stage);
  const [reopened, setReopened] = useState(stage === 'final');
  const internalStage = useRef(null);
  useEffect(() => { if (internalStage.current === stage) { internalStage.current = null; return; } setDismissed(false); setAccepted(false); setShown(stage); setFunnel(initialPreviewFunnel()); setReopened(stage === 'final'); }, [stage, state, modal]);
  const configuredOffer = { ...offer, content: view.content };
  function showStage(next) { setShown(next); if (onStageChange) { internalStage.current = next; onStageChange(next); } }
  function decline() {
    const result = afterDecline(configuredOffer, funnel, shown, reopened);
    setFunnel(result.funnel); setAccepted(false);
    if (result.stage) showStage(result.stage);
    else setDismissed(true);
  }
  function dismiss() {
    setFunnel(current => ({ ...current, declined: current.declined.includes(shown) ? current.declined : [...current.declined, shown] }));
    setDismissed(true); setAccepted(false);
  }
  function reopen(trigger) {
    const next = claimReopen(configuredOffer, funnel, trigger);
    if (!next) return;
    setFunnel(next); setReopened(true); setDismissed(false); setAccepted(false); showStage(nextStage(configuredOffer, next));
  }
  const example = role => product => ({ productName: product.name, title: '', role, ...(product.coverUrl ? { coverUrl: product.coverUrl } : {}) });
  const examples = view.offer ? [example('main')(view.offer.main), ...(view.offer.bonuses || []).map(example('bonus')), ...(view.offer.upsells || []).map(example('upsell'))] : [];
  const exampleItems = view.offer ? [{ name: view.offer.main.name, role: 'main', price: view.offer.main.price ?? 0 }, ...(view.offer.bonuses || []).map(product => ({ name: product.name, role: 'bonus', price: 0 })), ...(view.offer.upsells || []).map(product => ({ name: product.name, role: 'upsell', price: product.price ?? 0 }))] : [];
  const exampleOrder = exampleItems.length ? { items: exampleItems, total: exampleItems.reduce((sum, item) => sum + item.price, 0), currency: view.store?.currency } : null;
  const unavailableStage = shown === 'downsell' && !offer?.downsellPrice;
  const resultStates = ['paid', 'saved', 'empty', 'loading', 'missing', 'pending', 'needs_review', 'failed', 'expired', 'refunded'];
  const showOffer = !resultStates.includes(state);
  const paymentCopy = checkoutConfig(view);
  const card = offer && !unavailableStage && <PostPurchaseOfferCard offer={{ ...offer, content: view.content }} currency={view.store.currency} stage={shown}
    preview previewState={state} busy={state === 'preparing'} error={state === 'error' ? labels.startError : ''} canPurchase
    onAccept={() => setAccepted(true)} onDecline={decline}
    payment={accepted || ['payment', 'processing', 'payment-error', 'payment-loading'].includes(state) ? <CheckoutPaymentPreview askContact={false} copy={paymentCopy} state={state === 'processing' ? state : state === 'payment-error' ? 'error' : state === 'payment-loading' ? 'loading' : 'ready'} totalLabel={money(postPurchaseStage(offer, shown).price, view.store.currency)} /> : null} />;
  return <div className="post-offer-preview">
    <PurchaseResult presentation={{ accentColor: content.style.accentColor, ...content.footer, postLabels: content.postLabels }} storeName={view.store?.name}
      status={resultStates.includes(state) && !['saved', 'empty'].includes(state) ? state : 'paid'} emailed={state !== 'saved'} deliveries={state === 'empty' ? [] : examples} order={state === 'empty' ? null : exampleOrder} preview>
      {unavailableStage && offer && showOffer && <PurchaseSection><p className="purchase-notice">No hay un descuento de post-compra configurado para esta tienda. Configuralo en Downsell para previsualizar esta variante con su precio real.</p></PurchaseSection>}
      {!offer && showOffer && <PurchaseSection><p className="purchase-notice">Activá la oferta post-compra y elegí un producto en «Oferta post-compra» para previsualizar este modal.</p></PurchaseSection>}
      {offer && !modal && showOffer && !dismissed && <PurchaseSection label={labels.offerDescription}><div className="classic-offer-dialog post-offer-preview-dialog is-inline" style={classicTheme(content.style.accentColor)}>{card}</div></PurchaseSection>}
      {dismissed && showOffer && <PurchaseSection><div className="space-y-4 rounded-xl border p-5 text-sm leading-6"><p>El modal se cerró. Probá los disparadores de reapertura o volvé a elegir una variante desde el mapa.</p><div className="flex flex-wrap gap-3">{['visibility', 'mouse'].map(trigger => <button key={trigger} type="button" className="rounded-lg border p-3 disabled:opacity-40" disabled={!claimReopen(configuredOffer, funnel, trigger)} onClick={() => reopen(trigger)}>{trigger === 'visibility' ? 'Simular regreso a la pestaña' : 'Simular salida con el mouse'}</button>)}</div></div></PurchaseSection>}
    </PurchaseResult>
    {offer && !unavailableStage && modal && showOffer && !dismissed && <div className="post-offer-preview-overlay">
      <div role="dialog" aria-modal="false" aria-label={labels.offerDescription} className="classic-offer-dialog post-offer-preview-dialog" style={classicTheme(content.style.accentColor)}>
        <button type="button" className="post-offer-preview-close" disabled={state === 'processing' || state === 'preparing'} aria-label={labels.close} onClick={dismiss}><X /></button>
        {card}
      </div>
    </div>}
  </div>;
}
