import { usePreviewSection } from './PreviewEditing.jsx';
import './classic-landing.css';
import { useId, useState } from 'react';
import { ArrowRight, BookOpen, Check, ExternalLink, LoaderCircle, LockKeyhole, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorAlert } from '@/components/Field.jsx';
import { storefrontMoney as money } from '@/lib/storefront-money.js';
import { classicTheme } from '../../shared/classic-design.js';
import { Cover, FEATURE_ICONS, Heading } from './ClassicLanding.jsx';
import { normalizeContent } from './content.js';
import { POST_PURCHASE_CONTENT, postPurchaseContent, videoSource } from '../../shared/post-purchase.js';

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

function Video({ video }) {
  const edit = usePreviewSection();
  const [failed, setFailed] = useState(false);
  const source = videoSource(video.url);
  if (!video.enabled || !source) return null;
  return <div {...edit('postPurchaseVideo')} className="purchase-video">
    {video.title && <h3>{video.title}</h3>}
    {source.kind === 'embed'
      ? <iframe src={source.src} title={video.title || 'Video de la oferta'} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      : failed ? <p role="status" className="purchase-notice">No se pudo cargar el video. Podés abrirlo en otra pestaña o continuar con la oferta.</p>
        : <video src={source.src} controls playsInline preload="metadata" onError={() => setFailed(true)}>Tu navegador no puede reproducir este video.</video>}
    <a href={video.url} target="_blank" rel="noreferrer">Abrir video en otra pestaña<ExternalLink aria-hidden="true" /></a>
  </div>;
}

// The preview and the real paid flow use the same presentation; checkout stays in Storefront.
export default function PostPurchaseContent({ offer, currency, downsell = false, busy = false, error = '', onAccept, onDecline, canPurchase = false }) {
  const edit = usePreviewSection();
  const titleId = useId();
  const { postPurchase: copy, postPurchaseBenefits: benefits, postPurchaseVideo: video } = postPurchaseContent(offer.content);
  const defaults = POST_PURCHASE_CONTENT.postPurchase;
  const title = downsell ? copy.downsellTitle || copy.title || offer.name : copy.title || offer.name;
  const description = copy.description || offer.description;
  const hasVideo = video.enabled && Boolean(videoSource(video.url));
  return <>
    <section className="sales-hero sales-section post-purchase-content" aria-labelledby={titleId} {...edit(downsell ? 'postPurchaseDownsell' : 'postPurchase')}>
      <div className="sales-container sales-slim">
        <div className="sales-heading">
          {copy.eyebrow && <span className="sales-eyebrow">{copy.eyebrow}</span>}
          <h2 id={titleId}>{title}</h2>
          {copy.subtitle && <p>{copy.subtitle}</p>}
        </div>
        <div className="classic-hero-media">
          {hasVideo ? <Video key={video.url} video={video} /> : <div className="classic-hero-image"><Cover src={offer.coverUrl} name={offer.name} /></div>}
        </div>
        <div className="sales-offer">
          {description && <p className="purchase-offer-description">{description}</p>}
          <h2>{offer.name}</h2>
          <div className="sales-offer-card">
            {downsell && <span className="sales-offer-tag">Ahorrás {offer.downsellPercent}%</span>}
            <div className="sales-price">{downsell && <del>{money(offer.price, currency)}</del>}<strong>{money(downsell ? offer.downsellPrice : offer.price, currency)}</strong></div>
            {downsell && copy.downsellText && <p className="classic-hero-note">{copy.downsellText}</p>}
            <ErrorAlert>{error}</ErrorAlert>
            <Button type="button" className="sales-cta" onClick={onAccept} disabled={busy || !canPurchase}>
              {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}
              <span>{busy ? 'Preparando el pago…' : downsell ? copy.downsellCtaText || defaults.downsellCtaText : copy.ctaText || defaults.ctaText}</span>
              {!busy && <ArrowRight aria-hidden="true" />}
            </Button>
            <button type="button" className="purchase-decline" onClick={onDecline} disabled={busy || !onDecline}>{copy.declineText || defaults.declineText}</button>
            <div className="sales-trust"><span><Zap aria-hidden="true" />Acceso inmediato</span><span><LockKeyhole aria-hidden="true" />Pago seguro</span></div>
            <p className="classic-hero-note">Se paga aparte, con un segundo checkout. Tu compra anterior no cambia.</p>
          </div>
        </div>
      </div>
    </section>
    {benefits.enabled && benefits.items.length > 0 && <section className="sales-section sales-soft" aria-label={benefits.title || 'Beneficios de la oferta'} {...edit('postPurchaseBenefits')}><div className="sales-container sales-narrow">
      <Heading section={benefits} eyebrow="Lo que te llevás" />
      <div className="sales-features">{benefits.items.map((item, index) => {
        const Icon = FEATURE_ICONS[item.icon] || Check;
        return <article key={index} className="sales-feature"><span className="sales-feature-icon" aria-hidden="true"><Icon aria-hidden="true" /></span><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</article>;
      })}</div>
    </div></section>}
  </>;
}

export function PostPurchasePreview({ view, downsell = false }) {
  const content = normalizeContent(view.content);
  const offer = view.offer;
  const examples = offer ? [offer.main, ...(offer.bonuses || [])].map(product => ({ productName: product.name, title: 'Link de descarga' })) : [];
  return <PurchaseLanding presentation={{ accentColor: content.style.accentColor, ...content.footer }} storeName={view.store?.name} eyebrow="Compra confirmada" title="¡Gracias por tu compra!" subtitle="Estos son tus links. También te los enviamos por email.">
    {view.postPurchaseOffer
      ? <PostPurchaseContent offer={{ ...view.postPurchaseOffer, content: view.content }} currency={view.store.currency} downsell={downsell && Boolean(view.postPurchaseOffer.downsellPrice)} />
      : <PurchaseSection><p className="purchase-notice">Activá la oferta post-compra y elegí un producto en «Oferta post-compra» para ver esta página.</p></PurchaseSection>}
    <DeliveryLinks deliveries={examples} preview />
  </PurchaseLanding>;
}
