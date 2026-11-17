import { usePreviewSection } from './PreviewEditing.jsx';
import './classic-landing.css';
import { useState } from 'react';
import { BookOpen, ExternalLink, LoaderCircle, X } from 'lucide-react';
import PostPurchaseOfferCard from './PostPurchaseOfferCard.jsx';
import { classicTheme } from '../../shared/classic-design.js';
import { Heading } from './ClassicLanding.jsx';
import { normalizeContent } from './content.js';
import { videoSource } from '../../shared/post-purchase.js';

// Thank-you page shell: same palette, masthead and footer as the classic landing.
export function PurchaseLanding({ presentation = {}, storeName = '', eyebrow, title, subtitle, busy = false, children }) {
  const edit = usePreviewSection();
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
      <p>© {new Date().getFullYear()} {presentation.brandName || storeName}. Todos los derechos reservados.</p>
      {(presentation.termsUrl || presentation.privacyUrl) && <nav aria-label="Información legal">{presentation.termsUrl && <a href={presentation.termsUrl} target="_blank" rel="noreferrer">Términos y condiciones</a>}{presentation.privacyUrl && <a href={presentation.privacyUrl} target="_blank" rel="noreferrer">Política de privacidad</a>}</nav>}
    </div></footer>
  </div>;
}

export function PurchaseSection({ soft = false, label, children }) {
  return <section className={`sales-section ${soft ? 'sales-soft' : ''}`} aria-label={label}><div className="sales-container sales-slim">{children}</div></section>;
}

// The links the buyer paid for. In the preview they are examples and cannot be opened.
export function DeliveryLinks({ deliveries, preview = false }) {
  return <PurchaseSection soft label="Tus links de acceso">
    <Heading section={{ title: 'Tus links de acceso', subtitle: preview ? 'Ejemplo: acá el comprador ve los links de los productos que pagó.' : '' }} eyebrow="Tu compra" />
    {deliveries.length === 0
      ? <p className="purchase-notice">Esta compra no tiene links cargados. Escribile a quien te vendió el producto.</p>
      : <ul className="purchase-links">{deliveries.map((link, index) => <li key={index}>
        <span className="purchase-link-icon" aria-hidden="true"><BookOpen /></span>
        <div><strong>{link.productName}</strong>{link.title && <p>{link.title}</p>}</div>
        {preview
          ? <span className="purchase-open is-disabled" aria-disabled="true">Abrir<ExternalLink aria-hidden="true" /></span>
          : <a className="purchase-open" href={link.url} target="_blank" rel="noreferrer">Abrir<span className="sr-only"> {link.productName}: {link.title}</span><ExternalLink aria-hidden="true" /></a>}
      </li>)}</ul>}
  </PurchaseSection>;
}

// Optional VSL. `editKey` marks the section for the panel preview; outside it, it is inert.
export function Video({ video, editKey = 'postPurchaseVideo' }) {
  const edit = usePreviewSection();
  const [failed, setFailed] = useState(false);
  const source = videoSource(video.url);
  if (!video.enabled || !source) return null;
  return <div {...edit(editKey)} className="purchase-video">
    {video.title && <h3>{video.title}</h3>}
    {source.kind === 'embed'
      ? <iframe src={source.src} title={video.title || 'Video de la oferta'} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      : failed ? <p role="status" className="purchase-notice">No se pudo cargar el video. Podés abrirlo en otra pestaña o continuar con la oferta.</p>
        : <video src={source.src} controls playsInline preload="metadata" onError={() => setFailed(true)}>Tu navegador no puede reproducir este video.</video>}
    <a href={video.url} target="_blank" rel="noreferrer">Abrir video en otra pestaña<ExternalLink aria-hidden="true" /></a>
  </div>;
}

// The preview and the real paid flow use the same presentation; checkout stays in Storefront.
// Price, discount and title of each step of the post-purchase offer.
export function postPurchaseStage(offer, stage) {
  if (stage === 'final') return { price: offer.finalPrice, percent: offer.finalPercent };
  if (stage === 'downsell') return { price: offer.downsellPrice, percent: offer.downsellPercent };
  return { price: offer.price, percent: 0 };
}

// The thank-you page with the post-purchase modal open on `stage` ('offer', 'downsell' or
// 'final'), as the buyer sees it. The modal is a static mock: nothing can be paid here.
export function PostPurchasePreview({ view, stage = 'offer', modal = true }) {
  const content = normalizeContent(view.content);
  const offer = view.postPurchaseOffer;
  const examples = view.offer ? [view.offer.main, ...(view.offer.bonuses || [])].map(product => ({ productName: product.name, title: 'Link de descarga' })) : [];
  const shown = stage === 'downsell' && !offer?.downsellPrice ? 'offer' : stage;
  return <div className="post-offer-preview">
    <PurchaseLanding presentation={{ accentColor: content.style.accentColor, ...content.footer }} storeName={view.store?.name} eyebrow="Compra confirmada" title="¡Gracias por tu compra!" subtitle="Estos son tus links. También te los enviamos por email.">
      {!offer && <PurchaseSection><p className="purchase-notice">Activá la oferta post-compra y elegí un producto en «Oferta post-compra» para ver esta página.</p></PurchaseSection>}
      {offer && !modal && <PurchaseSection label="Oferta post-compra"><div className="classic-offer-dialog post-offer-preview-dialog is-inline" style={classicTheme(content.style.accentColor)}>
        <PostPurchaseOfferCard offer={{ ...offer, content: view.content }} currency={view.store.currency} stage={shown} />
      </div></PurchaseSection>}
      <DeliveryLinks deliveries={examples} preview />
    </PurchaseLanding>
    {offer && modal && <div className="post-offer-preview-overlay">
      <div role="dialog" aria-modal="false" aria-label="Vista previa de la oferta post-compra" className="classic-offer-dialog post-offer-preview-dialog" style={classicTheme(content.style.accentColor)}>
        <span className="post-offer-preview-close" aria-hidden="true"><X /></span>
        <PostPurchaseOfferCard offer={{ ...offer, content: view.content }} currency={view.store.currency} stage={shown} />
      </div>
    </div>}
  </div>;
}
