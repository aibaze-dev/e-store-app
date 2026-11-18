import { postLabels } from '../../shared/purchase-copy.js';
import { checkoutConfig } from '../../shared/checkout-copy.js';
import { CheckoutPaymentPreview } from '@/storefront/CheckoutPayment.jsx';
import { Link } from 'react-router-dom';
import { usePreviewSection } from './PreviewEditing.jsx';
import './classic-landing.css';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, ExternalLink, LoaderCircle, X } from 'lucide-react';
import PostPurchaseOfferCard from './PostPurchaseOfferCard.jsx';
import { classicTheme } from '../../shared/classic-design.js';
import { Heading } from './ClassicLanding.jsx';
import { normalizeContent } from './content.js';
import { storefrontMoney as money } from '@/lib/storefront-money.js';
import { videoSource } from '../../shared/post-purchase.js';

// Thank-you page shell: same palette, masthead and footer as the classic landing.
export function PurchaseLanding({ presentation = {}, storeName = '', eyebrow, title, subtitle, busy = false, preview = false, children }) {
  const edit = usePreviewSection();
  const labels = postLabels(presentation);
  return <div className="sales-landing classic-landing purchase-landing" style={classicTheme(presentation.accentColor)}>
    <main>
      <header className="classic-masthead purchase-masthead">
        <div className="sales-container sales-slim">
          <div className="sales-hero-heading">
            {eyebrow && <span className="sales-eyebrow">{eyebrow}</span>}
            <h1>{busy && <LoaderCircle className="purchase-spinner animate-spin" aria-hidden="true" />}{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
      </header>
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

// The links the buyer paid for. In the preview they are examples and cannot be opened.
export function DeliveryLinks({ deliveries, preview = false, labels = postLabels() }) {
  return <PurchaseSection soft label={labels.linksTitle}>
    <Heading section={{ title: labels.linksTitle, subtitle: labels.linksSubtitle }} eyebrow={labels.linksEyebrow} />
    {deliveries.length === 0
      ? <p className="purchase-notice">{labels.emptyLinks}</p>
      : <ul className="purchase-links">{deliveries.map((link, index) => <li key={index}>
        <span className="purchase-link-icon" aria-hidden="true"><BookOpen /></span>
        <div><strong>{link.productName}</strong>{link.title && <p>{link.title}</p>}</div>
        {preview
          ? <span className="purchase-open is-disabled" aria-disabled="true">{labels.open}<ExternalLink aria-hidden="true" /></span>
          : <a className="purchase-open" href={link.url} target="_blank" rel="noreferrer">{labels.open}<span className="sr-only"> {link.productName}: {link.title}</span><ExternalLink aria-hidden="true" /></a>}
      </li>)}</ul>}
  </PurchaseSection>;
}

// Optional VSL. `editKey` marks the section for the panel preview; outside it, it is inert.
export function Video({ video, editKey = 'postPurchaseVideo', labels = postLabels(), preview = false, forceError = false }) {
  const edit = usePreviewSection();
  const [failed, setFailed] = useState(false);
  const source = videoSource(video.url);
  if (!video.enabled || !source) return null;
  return <div {...edit(editKey)} className="purchase-video">
    {video.title && <h3>{video.title}</h3>}
    {source.kind === 'embed'
      ? <iframe src={source.src} title={video.title || labels.videoTitle} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      : failed || forceError ? <p role="status" className="purchase-notice">{labels.videoError}</p>
        : <video src={source.src} controls playsInline preload="metadata" onError={() => setFailed(true)}>{labels.videoUnsupported}</video>}
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


export function PurchaseResult({ status = 'paid', presentation = {}, storeName, deliveries = [], emailed = true, preview = false, children }) {
  const copy = postLabels(presentation);
  if (status !== 'paid') {
    const titles = { loading: 'loadingTitle', missing: 'missingTitle', pending: 'pendingTitle', needs_review: 'reviewTitle', refunded: 'refundedTitle', failed: 'failedTitle', expired: 'failedTitle' };
    const messages = { loading: 'loadingTitle', missing: 'missingText', pending: 'pendingText', needs_review: 'reviewText', refunded: 'refundedText', failed: 'failedText', expired: 'expiredText' };
    return <PurchaseLanding preview={preview} presentation={presentation} storeName={storeName} title={copy[titles[status] ?? 'failedTitle']} busy={status === 'loading' || status === 'pending'}>
      <PurchaseSection><div className="purchase-notice"><p role="status">{copy[messages[status] ?? 'expiredText']}</p>
        {['failed', 'expired'].includes(status) && <Link onClick={event => { if (preview) event.preventDefault(); }} className="purchase-open purchase-notice-action" to="..">{copy.back}<ArrowRight aria-hidden="true" /></Link>}
      </div></PurchaseSection>
    </PurchaseLanding>;
  }
  return <PurchaseLanding preview={preview} presentation={presentation} storeName={storeName} eyebrow={copy.paidEyebrow} title={copy.paidTitle} subtitle={emailed ? copy.emailedText : copy.savedText}>
    {children}
    <DeliveryLinks deliveries={deliveries} preview={preview} labels={copy} />
  </PurchaseLanding>;
}

// No payment session or tracking is started by these preview actions.
export function PostPurchasePreview({ view, stage = 'offer', modal = true, state = 'offer' }) {
  const content = normalizeContent(view.content);
  const labels = postLabels(content);
  const offer = view.postPurchaseOffer;
  const [dismissed, setDismissed] = useState(false);
  const [accepted, setAccepted] = useState(false);
  useEffect(() => { setDismissed(false); setAccepted(false); }, [stage, state, modal]);
  const examples = view.offer ? [view.offer.main, ...(view.offer.bonuses || [])].map(product => ({ productName: product.name, title: '' })) : [];
  const unavailableStage = stage === 'downsell' && !offer?.downsellPrice;
  const shown = stage;
  const resultStates = ['paid', 'saved', 'empty', 'loading', 'missing', 'pending', 'needs_review', 'failed', 'expired', 'refunded'];
  const showOffer = !resultStates.includes(state);
  const paymentCopy = checkoutConfig(view);
  const card = offer && !unavailableStage && <PostPurchaseOfferCard offer={{ ...offer, content: view.content }} currency={view.store.currency} stage={shown}
    preview previewState={state} busy={state === 'preparing'} error={state === 'error' ? labels.startError : ''} canPurchase
    onAccept={() => setAccepted(true)} onDecline={() => setDismissed(true)}
    payment={accepted || ['payment', 'processing', 'payment-error', 'payment-loading'].includes(state) ? <CheckoutPaymentPreview askContact={false} copy={paymentCopy} state={state === 'processing' ? state : state === 'payment-error' ? 'error' : state === 'payment-loading' ? 'loading' : 'ready'} totalLabel={money(postPurchaseStage(offer, shown).price, view.store.currency)} /> : null} />;
  return <div className="post-offer-preview">
    <PurchaseResult presentation={{ accentColor: content.style.accentColor, ...content.footer, postLabels: content.postLabels }} storeName={view.store?.name}
      status={resultStates.includes(state) && !['saved', 'empty'].includes(state) ? state : 'paid'} emailed={state !== 'saved'} deliveries={state === 'empty' ? [] : examples} preview>
      {unavailableStage && offer && showOffer && <PurchaseSection><p className="purchase-notice">No hay un descuento de post-compra configurado para esta tienda. Configuralo en Downsell para previsualizar esta variante con su precio real.</p></PurchaseSection>}
      {!offer && showOffer && <PurchaseSection><p className="purchase-notice">Activá la oferta post-compra y elegí un producto en «Oferta post-compra» para previsualizar este modal.</p></PurchaseSection>}
      {offer && !modal && showOffer && <PurchaseSection label={labels.offerDescription}><div className="classic-offer-dialog post-offer-preview-dialog is-inline" style={classicTheme(content.style.accentColor)}>{card}</div></PurchaseSection>}
      {dismissed && showOffer && <PurchaseSection><button type="button" className="purchase-open" onClick={() => { setDismissed(false); setAccepted(false); }}>Volver a abrir la vista previa</button></PurchaseSection>}
    </PurchaseResult>
    {offer && !unavailableStage && modal && showOffer && !dismissed && <div className="post-offer-preview-overlay">
      <div role="dialog" aria-modal="false" aria-label={labels.offerDescription} className="classic-offer-dialog post-offer-preview-dialog" style={classicTheme(content.style.accentColor)}>
        <button type="button" className="post-offer-preview-close" aria-label={labels.close} onClick={() => setDismissed(true)}><X /></button>
        {card}
      </div>
    </div>}
  </div>;
}
