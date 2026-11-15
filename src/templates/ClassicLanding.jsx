import './classic-landing.css';
import { CLASSIC_ACCENT, classicAccent } from '../../shared/classic-design.js';
import { formatLandingText } from '../../shared/landing-copy.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronDown, CircleCheck, Gift, ShoppingBag, ShieldCheck, LockKeyhole, Zap, ShoppingCart, Mail, Sparkles, Target, TrendingUp, Dumbbell, Brain, Settings, X, Flame } from 'lucide-react';
import { storefrontMoney as formatMoney } from '@/lib/storefront-money.js';
import { useSimulatedCheckoutSignals } from '@/storefront/CheckoutSignals.jsx';
import DemoPurchaseToasts from '@/storefront/DemoPurchaseToasts.jsx';
import Testimonials, { Rating } from './Testimonials.jsx';
import { Button } from '@/components/ui/button';
import { normalizeContent, offerTotals, timeAgo } from './content.js';

export const FEATURE_ICONS = { check: Check, book: BookOpen, target: Target, growth: TrendingUp, strength: Dumbbell, brain: Brain, settings: Settings, cart: ShoppingCart, mail: Mail, sparkles: Sparkles };

export function readableOn(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#111827' : '#ffffff';
}

function Cover({ src, name }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (src && !failed) return <img src={src} alt={`Portada de ${name}`} className="sales-cover" onError={() => setFailed(true)} />;
  return <div className="sales-cover sales-cover-fallback"><span className="sales-cover-emoji" aria-hidden="true">📖</span><strong>{name}</strong><span /></div>;
}

function SectionImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src) return null;
  if (failed) return <div className="classic-image-fallback" role="img" aria-label={alt}><BookOpen aria-hidden="true" /><span>Imagen no disponible</span></div>;
  return <img className={`classic-section-image ${className}`} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

function Heading({ section, eyebrow = section.eyebrow }) {
  return <div className="sales-heading">{eyebrow && <span className="sales-eyebrow">{eyebrow}</span>}{section.title && <h2>{section.title}</h2>}{section.subtitle && <p>{section.subtitle}</p>}</div>;
}

// Announces real recent purchases one at a time, once each per visit.
export function PurchaseToasts({ recent, style }) {
  const [index, setIndex] = useState(-1);
  const [visible, setVisible] = useState(false);
  const purchases = recent.map(item => ({ ...item, ago: timeAgo(item.at, Date.now()) })).filter(item => item.ago);
  const count = purchases.length;
  useEffect(() => {
    if (index + 1 > count) return;
    const timer = visible
      ? setTimeout(() => setVisible(false), 6000)
      : index + 1 < count ? setTimeout(() => { setIndex(index + 1); setVisible(true); }, index < 0 ? 4000 : 12000) : null;
    return () => clearTimeout(timer);
  }, [index, visible, count]);
  const purchase = purchases[index];
  return <div className="sales-toast-region" style={style} role="status" aria-live="polite">{visible && purchase && <div className="sales-toast">
    <span className="sales-toast-icon"><ShoppingBag aria-hidden="true" /></span>
    <p><strong>{purchase.name || 'Alguien'}</strong><span>compró el ebook</span><small>{purchase.ago}</small></p>
    <CircleCheck aria-hidden="true" />
  </div>}</div>;
}

export default function ClassicLanding({ view, onCta }) {
  const content = normalizeContent(view.content);
  const { offer, store } = view;
  const activity = view.activity || { sales: 0, recent: [] };
  const clock = countdown => countdown.split(':').flatMap((part, index) => [index > 0 && <i key={`colon-${index}`} aria-hidden="true">:</i>, <span key={index}>{part}</span>]);
  const { shoppers, timeLeft } = useSimulatedCheckoutSignals(view.subdomain, { preview: !onCta, promotion: content.promotion });
  const countdown = content.promotion.enabled && !(content.promotion.timerMode === 'date' && timeLeft === '00:00') ? timeLeft : null;
  const landingRef = useRef(null);
  const stickyRef = useRef(null);
  const promoRef = useRef(null);
  const hasPromo = countdown !== null && Boolean(content.promotion.message);
  useEffect(() => {
    const measure = () => {
      landingRef.current?.style.setProperty('--classic-sticky-height', `${stickyRef.current?.getBoundingClientRect().height || 0}px`);
      landingRef.current?.style.setProperty('--classic-promo-height', `${promoRef.current?.getBoundingClientRect().height || 0}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (stickyRef.current) observer.observe(stickyRef.current);
    if (promoRef.current) observer.observe(promoRef.current);
    return () => observer.disconnect();
  }, [content.closing.stickyEnabled, hasPromo]);
  const accent = /^#[0-9a-fA-F]{6}$/.test(content.style.accentColor) ? classicAccent(content.style.accentColor) : CLASSIC_ACCENT;
  const actionColor = '#' + [1, 3, 5].map(i => Math.round(parseInt(accent.slice(i, i + 2), 16) * .78).toString(16).padStart(2, '0')).join('');
  const theme = { '--sales-accent': accent, '--sales-on-accent': readableOn(accent), '--classic-action': actionColor, '--classic-on-action': readableOn(actionColor) };
  const money = value => formatMoney(value, store.currency);
  const totals = offerTotals(offer);
  const guarantee = content.guarantee.enabled && Boolean(content.guarantee.text);
  const guaranteeLabel = content.guarantee.days ? `Garantía de ${content.guarantee.days} días` : content.guarantee.title;
  const cta = (text, extra = '') => <Button type="button" className={`sales-cta ${extra}`} onClick={onCta} disabled={!onCta}>{text || content.hero.ctaText || 'Comprar ahora'}</Button>;
  const trust = <div className="sales-trust"><span><Zap aria-hidden="true" />Acceso inmediato</span><span><LockKeyhole aria-hidden="true" />Pago seguro</span>{guarantee && <span><ShieldCheck aria-hidden="true" />{guaranteeLabel}</span>}</div>;
  const savings = totals.savings > 0 && <span className="sales-savings">Ahorrás {money(totals.savings)} ({totals.percent}% OFF)</span>;
  const price = <div className="sales-price">{offer.main.compareAtPrice > offer.main.price && <del>{money(offer.main.compareAtPrice)}</del>}<strong>{money(offer.main.price)}</strong></div>;
  const bonusRows = <ul className="sales-bonus-lines">{offer.bonuses.map(bonus => <li key={bonus.productId}><Gift aria-hidden="true" /><span>{bonus.name}</span><div>{bonus.referenceValue > 0 && <del>{money(bonus.referenceValue)}</del>}<strong>GRATIS</strong></div></li>)}</ul>;

  return <div ref={landingRef} className={`sales-landing classic-landing ${content.closing.stickyEnabled ? 'sales-with-sticky' : ''}`} style={theme}>
    {hasPromo && <div ref={promoRef} className="sales-promo"><Flame aria-hidden="true" /><span>{content.promotion.message}</span>{countdown && <time aria-label={`Termina en ${countdown}`}>{clock(countdown)}</time>}<Flame aria-hidden="true" /></div>}
    {content.activity.notifications && <DemoPurchaseToasts key={view.subdomain} copy={content.activity} />}
    <main>
      <header className="classic-masthead">
        <div className="sales-container classic-masthead-inner">
          <div className="sales-hero-heading">
            {content.hero.eyebrow && <span className="sales-eyebrow">{content.hero.eyebrow}</span>}
            <h1>{content.hero.title || offer.main.name}</h1>
            {content.hero.subtitle && <p>{content.hero.subtitle}</p>}
          </div>
          <div className="classic-header-offer">{price}{cta()}<span>{offer.main.name}</span></div>
        </div>
      </header>
      <section className="sales-hero sales-section" aria-label={offer.main.name}>
        <div className="sales-container sales-slim">
          <div className={`classic-hero-media ${content.hero.secondaryImageUrl ? 'has-pair' : ''}`}>
            <div className="classic-hero-image"><Cover src={content.hero.imageUrl || offer.main.coverUrl} name={offer.main.name} /></div>
            {content.hero.secondaryImageUrl && <div className="classic-hero-image"><SectionImage src={content.hero.secondaryImageUrl} alt={`Contenido de ${offer.main.name}`} /></div>}
          </div>
          <div className="sales-offer">
            <Rating value={content.socialProof.rating} customers={content.socialProof.customers} />
            <h2>{offer.main.name}</h2>
            {content.activity.salesCount && activity.sales > 0 && <p className="sales-count"><ShoppingBag aria-hidden="true" />{formatLandingText(content.activity.salesText, { cantidad: activity.sales })}</p>}
            <div className="sales-offer-card">
              {countdown !== null && content.promotion.message && <span className="sales-offer-tag">{content.promotion.message}</span>}
              {price}{savings}
              {cta()}{trust}
              {content.hero.note && <p className="classic-hero-note">{content.hero.note}</p>}
              {offer.bonuses.length > 0 && <div className="classic-included-bonuses">{bonusRows}</div>}
              {countdown !== null && content.promotion.remainingSpots > 0 && <p className="sales-scarcity"><span aria-hidden="true" />{formatLandingText(content.promotion.spotsText, { cantidad: content.promotion.remainingSpots })}</p>}
              {countdown && <div className="sales-timer"><Flame aria-hidden="true" />{content.promotion.timerLabel} <time>{countdown}</time></div>}
            </div>
            {content.activity.viewers && <p className="sales-viewers"><span aria-hidden="true" />{formatLandingText(content.activity.viewersText, { cantidad: shoppers })}</p>}
          </div>
        </div>
      </section>
      {content.introduction.enabled && content.introduction.text && <section className="sales-section classic-introduction"><div className="sales-container sales-slim"><Heading section={content.introduction} /><p>{content.introduction.text}</p></div></section>}
      {content.transformation.enabled && (content.transformation.title || content.transformation.imageUrl) && <section className="sales-section classic-transformation"><div className="sales-container sales-slim"><Heading section={content.transformation} /><SectionImage src={content.transformation.imageUrl} alt={content.transformation.imageAlt || content.transformation.title} /></div></section>}

      {content.painPoints.enabled && content.painPoints.items.length > 0 && <section className="sales-section"><div className="sales-container sales-slim"><Heading section={content.painPoints} eyebrow="Si te pasa esto, es para vos" /><ul className="sales-pains">{content.painPoints.items.map((item, index) => <li key={index}><span><X aria-hidden="true" /></span><div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</div></li>)}</ul>{content.painPoints.closingText && <p className="sales-pain-closing">{content.painPoints.closingText}</p>}<div className="classic-section-action">{cta()}</div></div></section>}

      {content.bonuses.enabled && offer.bonuses.length > 0 && <section className="sales-section sales-bonuses sales-dark"><div className="sales-container sales-narrow">
        <Heading section={content.bonuses} eyebrow="Incluido con tu compra" />
        <div className="sales-bonus-cards">{offer.bonuses.map((bonus, index) => <article key={bonus.productId} className="sales-bonus-card"><div className="classic-bonus-cover"><Cover src={bonus.coverUrl} name={bonus.name} /><span className="sales-bonus-number">{String(index + 1).padStart(2, '0')}</span></div><div><h3>{bonus.name}</h3>{bonus.description && <p>{bonus.description}</p>}</div><div className="sales-bonus-value">{bonus.referenceValue > 0 && <del>Valor: {money(bonus.referenceValue)}</del>}<strong>GRATIS</strong></div></article>)}</div>
        {totals.bonusValue > 0 && <p className="sales-bonus-total">Valor total de los bonos <strong>{money(totals.bonusValue)}</strong></p>}
      <div className="classic-section-action">{cta()}{trust}</div></div></section>}

      {content.steps.enabled && content.steps.items.length > 0 && <section className="sales-section sales-soft"><div className="sales-container sales-narrow"><Heading section={content.steps} eyebrow="El método, paso a paso" /><ol className="sales-steps">{content.steps.items.map((item, index) => {
        const Icon = FEATURE_ICONS[item.icon] || Sparkles;
        return <li key={index}><div className="sales-step-icon"><Icon aria-hidden="true" /><span>{index + 1}</span></div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</li>;
      })}</ol></div></section>}

      {content.about.enabled && content.about.text && <section className="sales-section sales-soft"><div className={`sales-container sales-narrow classic-about ${content.about.imageUrl ? 'has-image' : ''}`}><SectionImage src={content.about.imageUrl} alt={content.about.imageAlt || 'El equipo'} /><div><Heading section={content.about} /><p>{content.about.text}</p>{content.about.signature && <p className="classic-signature">{content.about.signature}</p>}</div></div></section>}
      {content.showcase.enabled && (content.showcase.title || content.showcase.imageUrl) && <section className="sales-section"><div className="sales-container sales-slim"><Heading section={content.showcase} /><SectionImage src={content.showcase.imageUrl} alt={content.showcase.imageAlt || content.showcase.title} /></div></section>}
      {content.benefits.enabled && content.benefits.items.length > 0 && <section className="sales-section sales-soft"><div className="sales-container sales-narrow"><Heading section={content.benefits} eyebrow="Tu kit completo" /><div className="sales-features">{content.benefits.items.map((item, index) => {
        const Icon = FEATURE_ICONS[item.icon] || Check;
        return <article key={index} className="sales-feature"><span className="sales-feature-icon" aria-hidden="true"><Icon aria-hidden="true" /></span><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</article>;
      })}</div></div></section>}

      {content.summary.enabled && <section className="sales-section classic-summary"><div className="sales-container sales-slim"><Heading section={content.summary} /><div className="sales-summary-card">
        <ul className="sales-includes"><li><Check aria-hidden="true" /><span>{offer.main.name}</span><strong>{money(offer.main.price)}</strong></li>{offer.bonuses.map(bonus => <li key={bonus.productId}><Check aria-hidden="true" /><span>{bonus.name}</span><strong className="sales-free">GRATIS</strong></li>)}{guarantee && <li><Check aria-hidden="true" /><span>{guaranteeLabel}</span><strong className="sales-free">INCLUIDA</strong></li>}</ul>
        <div className="sales-summary-price">{totals.savings > 0 && <><p>Valor total de referencia</p><del>{money(totals.reference)}</del></>}<span className="sales-eyebrow">Oferta de hoy</span><strong>{money(offer.main.price)}</strong><p>Un único pago</p></div>
        {cta(content.closing.ctaText)}{savings}
      </div>{trust}</div></section>}

      {content.socialProof.enabled && (content.socialProof.items.length > 0 || content.socialProof.customers > 0 || content.socialProof.rating > 0 || content.socialProof.satisfaction > 0) && <section className="sales-section sales-soft"><div className="sales-container sales-narrow"><Heading section={content.socialProof} eyebrow={content.socialProof.eyebrow} /><Testimonials section={content.socialProof} layout="grid" /></div></section>}

      {content.comparison.enabled && content.comparison.items.length > 0 && <section className="sales-section"><div className="sales-container sales-narrow"><Heading section={content.comparison} /><div className="classic-comparison">{content.comparison.items.map((item, index) => <article key={index} className={item.highlighted ? 'is-highlighted' : ''}><h3>{item.title}</h3>{item.highlighted && <span className="sales-eyebrow">{offer.main.name}</span>}<p>{item.description}</p>{item.highlighted && cta()}</article>)}</div></div></section>}
      {guarantee && <section className="sales-section sales-soft"><div className="sales-container sales-slim"><div className="sales-guarantee"><span className="sales-shield"><ShieldCheck aria-hidden="true" /></span><h2>{content.guarantee.title || guaranteeLabel}</h2><p>{content.guarantee.text}</p>{content.guarantee.days && <strong><ShieldCheck aria-hidden="true" />{content.guarantee.days} días de protección al comprador</strong>}{cta(content.hero.ctaText)}</div></div></section>}

      {content.faq.enabled && content.faq.items.length > 0 && <section className="sales-section sales-soft"><div className="sales-container sales-slim"><Heading section={content.faq} /><div className="sales-faq">{content.faq.items.map((item, index) => <details key={index}><summary>{item.question}<ChevronDown aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div></div></section>}

      {content.closing.enabled && <section className="sales-section sales-dark sales-closing"><div className="sales-container sales-slim"><h2>{content.closing.title || content.hero.title || offer.main.name}</h2>{price}{offer.bonuses.length > 0 && <><p className="sales-eyebrow">Incluye {offer.bonuses.length} {offer.bonuses.length === 1 ? 'bono gratis' : 'bonos gratis'}</p>{bonusRows}</>}{savings}{cta(content.closing.ctaText)}{trust}</div></section>}
    </main>
    <footer className="sales-footer"><div className="sales-container sales-slim"><p>© {new Date().getFullYear()} {content.footer.brandName || store.name}. Todos los derechos reservados.</p><nav aria-label="Información legal">{content.footer.termsUrl && <a href={content.footer.termsUrl} target="_blank" rel="noreferrer">Términos y condiciones</a>}{content.footer.privacyUrl && <a href={content.footer.privacyUrl} target="_blank" rel="noreferrer">Política de privacidad</a>}</nav></div></footer>
    {content.closing.stickyEnabled && <aside ref={stickyRef} className="sales-sticky" aria-label="Comprar ebook"><div><div className="sales-sticky-meta">{countdown && <p>{content.promotion.timerLabel} <time>{countdown}</time></p>}{totals.savings > 0 && <p><del>{money(totals.reference)}</del><strong>Ahorrás {money(totals.savings)}</strong></p>}</div><Button type="button" className="sales-cta" onClick={onCta} disabled={!onCta}><ShoppingCart aria-hidden="true" /><span><small>{offer.main.name}</small>{content.closing.ctaText || 'Comprar ahora'}</span><strong>{money(offer.main.price)}</strong><ArrowRight aria-hidden="true" /></Button></div></aside>}
  </div>;
}
