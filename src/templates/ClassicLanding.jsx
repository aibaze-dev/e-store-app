import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/inter';
import './classic-landing.css';
import './classic.css';
import { classicTheme } from '../../shared/classic-design.js';
export { readableOn } from '../../shared/classic-design.js';
import { videoSource } from '../../shared/post-purchase.js';
import { formatLandingText } from '../../shared/landing-copy.js';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, CircleCheck, Gift, ImageOff, ImageUp, LockKeyhole, PiggyBank, Plus, ShieldCheck, ShoppingBag, Smartphone, Sparkles, Volume2, X, ShoppingCart, Mail, Target, TrendingUp, Dumbbell, Brain, Settings } from 'lucide-react';
import { storefrontMoney as formatMoney } from '@/lib/storefront-money.js';
import { useSimulatedCheckoutSignals } from '@/storefront/CheckoutSignals.jsx';
import DemoPurchaseToasts from '@/storefront/DemoPurchaseToasts.jsx';
import { checkoutTotals, normalizeContent, offerTotals } from './content.js';

// Used by the post-purchase page, which keeps its own icon list.
export const FEATURE_ICONS = { check: Check, book: BookOpen, target: Target, growth: TrendingUp, strength: Dumbbell, brain: Brain, settings: Settings, cart: ShoppingCart, mail: Mail, sparkles: Sparkles };

export function Cover({ src, name }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (src && !failed) return <img src={src} alt={`Portada de ${name}`} className="sales-cover" onError={() => setFailed(true)} />;
  return <div className="sales-cover sales-cover-fallback"><span className="sales-cover-emoji" aria-hidden="true">📖</span><strong>{name}</strong><span /></div>;
}

export function Heading({ section, eyebrow = section.eyebrow }) {
  return <div className="sales-heading">{eyebrow && <span className="sales-eyebrow">{eyebrow}</span>}{section.title && <h2>{section.title}</h2>}{section.subtitle && <p>{section.subtitle}</p>}</div>;
}

// "**texto**" is bold and "*texto*" takes the accent; anything else stays plain text.
export function rich(text) {
  return String(text || '').split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
    if (i % 2 === 0) return part;
    return part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <em key={i}>{part.slice(1, -1)}</em>;
  });
}
const paragraphs = text => String(text || '').split(/\n+/).map(line => line.trim()).filter(Boolean);

// An image the seller uploaded; a book placeholder stands in when there is none or it fails.
function Picture({ src, alt, name, className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (src && !failed) return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
  return <div className={`cl-placeholder ${className}`} role="img" aria-label={alt}>{src ? <ImageOff aria-hidden="true" /> : <BookOpen aria-hidden="true" />}{name && <strong>{name}</strong>}</div>;
}

// Stand-in for a photo the seller has not uploaded yet, with the proportions the real one
// should have. Only the editor previews show it; the published page never does.
function PhotoSlot({ title, hint, ratio, className = '' }) {
  return <div className={`cl-slot ${className}`} style={{ aspectRatio: ratio }} role="img" aria-label={`Espacio para: ${title}`}>
    <div><span aria-hidden="true"><ImageUp /></span><strong>{title}</strong><small>{hint}</small></div>
  </div>;
}

function Head({ section, tone = '', icon: Icon, align = '' }) {
  return <div className={`cl-head ${align}`}>
    {section.eyebrow && <span className={`cl-pill ${tone}`}>{Icon && <Icon aria-hidden="true" />}{section.eyebrow}</span>}
    {section.title && <h2>{rich(section.title)}</h2>}
    {section.subtitle && <p>{rich(section.subtitle)}</p>}
  </div>;
}

function Price({ offer, money, savings, tone = '' }) {
  return <div className={`cl-price ${tone}`}>
    {offer.main.compareAtPrice > offer.main.price && <del>{money(offer.main.compareAtPrice)}</del>}
    <strong>{money(offer.main.price)}</strong>
    {savings > 0 && <span className="cl-save">Ahorrás {money(savings)}</span>}
  </div>;
}

// Bonus covers as a coverflow: the centre card is the selected one.
function BonusFlow({ bonuses }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = bonuses.length;
  const current = Math.min(index, count - 1);
  useEffect(() => {
    if (paused || count < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setIndex(value => (value + 1) % count), 3600);
    return () => clearInterval(timer);
  }, [paused, count]);
  const move = delta => setIndex((current + delta + count) % count);
  // Shortest way round, so the last cover sits to the left of the first.
  const distance = i => {
    const d = i - current;
    return count > 2 && Math.abs(d) > count / 2 ? d - Math.sign(d) * count : d;
  };
  const bonus = bonuses[current];
  return <div className="cl-flow" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
    onKeyDown={event => { if (event.key === 'ArrowLeft') move(-1); if (event.key === 'ArrowRight') move(1); }}>
    <div className="cl-flow-stage">{bonuses.map((item, i) => {
      const d = distance(i);
      return <button key={item.productId} type="button" className={`cl-flow-card ${d === 0 ? 'is-active' : ''}`} style={{ '--d': d, '--abs': Math.abs(d) }}
        hidden={Math.abs(d) > 3} tabIndex={d === 0 ? 0 : -1} aria-label={`Ver bono ${i + 1}: ${item.name}`} aria-current={d === 0} onClick={() => setIndex(i)}>
        <Picture src={item.coverUrl} alt="" name={item.name} />
        <span>{item.name}</span>
      </button>;
    })}</div>
    <div className="cl-flow-info" aria-live={paused ? 'polite' : 'off'}>
      <p><span>{String(current + 1).padStart(2, '0')}</span><strong>Gratis</strong></p>
      <h3>{bonus.name}</h3>
      {bonus.description && <p>{bonus.description}</p>}
    </div>
    {count > 1 && <div className="cl-flow-nav">
      <button type="button" aria-label="Bono anterior" onClick={() => move(-1)}><ChevronLeft aria-hidden="true" /></button>
      <div>{bonuses.map((item, i) => <button key={item.productId} type="button" aria-label={`Ver bono ${i + 1}`} aria-current={i === current} onClick={() => setIndex(i)} />)}</div>
      <button type="button" aria-label="Bono siguiente" onClick={() => move(1)}><ChevronRight aria-hidden="true" /></button>
    </div>}
  </div>;
}

// The kit video starts muted; one tap turns the sound on and shows the controls.
function KitMedia({ section, preview }) {
  const [sound, setSound] = useState(false);
  const video = useRef(null);
  const source = section.videoUrl ? videoSource(section.videoUrl) : null;
  if (source?.kind === 'embed') return <div className="cl-kit-media"><iframe src={source.src} title={section.imageAlt || 'Video del kit'} loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>;
  if (source) return <div className="cl-kit-media">
    <video ref={video} src={source.src} poster={section.imageUrl || undefined} autoPlay muted loop playsInline controls={sound} aria-label={section.imageAlt || 'Video del kit'} />
    {!sound && <button type="button" onClick={() => { video.current.muted = false; video.current.currentTime = 0; video.current.play(); setSound(true); }}><Volume2 aria-hidden="true" />Tocá para escuchar</button>}
  </div>;
  if (!section.imageUrl) return preview ? <PhotoSlot className="cl-kit-slot" ratio="4 / 3" title="Foto o video del kit" hint="Opcional · horizontal, 880 × 660 px" /> : null;
  return <div className="cl-kit-media"><Picture src={section.imageUrl} alt={section.imageAlt || section.title} /></div>;
}

function Testimonial({ item }) {
  if (item.imageUrl && !item.quote) return <figure className="cl-testi"><img src={item.imageUrl} alt={`Testimonio de ${item.name}`} loading="lazy" /></figure>;
  return <figure className="cl-testi"><div className="cl-testi-card">
    {item.photoUrl ? <img className="cl-avatar" src={item.photoUrl} alt="" loading="lazy" /> : <span className="cl-avatar" aria-hidden="true">{item.name.trim().slice(0, 1).toUpperCase()}</span>}
    <figcaption>{item.name}</figcaption>
    <span className="cl-stars" role="img" aria-label="5 de 5 estrellas">★★★★★</span>
    <blockquote>{item.quote}</blockquote>
    {item.verified && <span className="cl-verified"><CircleCheck aria-hidden="true" />Compra verificada</span>}
  </div></figure>;
}

function ComboRow({ item, money, checked, locked, extra, onToggle }) {
  const percent = extra && item.compareAtPrice > item.price ? Math.round((1 - item.price / item.compareAtPrice) * 100) : 0;
  return <label className={`cl-combo-row ${checked ? 'is-on' : ''} ${extra ? '' : 'is-main'}`}>
    <input type="checkbox" checked={checked} disabled={locked} onChange={onToggle} />
    <span className="cl-combo-check" aria-hidden="true"><Check /></span>
    <Picture className="cl-combo-thumb" src={item.coverUrl} alt="" />
    <span className="cl-combo-text"><strong>{item.name}{percent > 0 && <i>-{percent}%</i>}</strong>{item.description && <small>{item.description}</small>}</span>
    <span className="cl-combo-price">{item.compareAtPrice > item.price && <del>{money(item.compareAtPrice)}</del>}<b>{extra ? '+' : ''}{money(item.price)}</b></span>
  </label>;
}

export default function ClassicLanding({ view, onCta }) {
  const content = normalizeContent(view.content);
  const { offer, store } = view;
  const upsells = offer.upsells ?? [];
  const { hero, promotion, combo, closing } = content;
  // Presentation-only count, stable while the landing is mounted.
  const [simulatedSales] = useState(() => 540 + Math.floor(Math.random() * (6490 - 540 + 1)));
  const preview = !onCta;
  const { shoppers, timeLeft } = useSimulatedCheckoutSignals(view.subdomain, { preview, promotion });
  const countdown = promotion.enabled ? timeLeft : null;
  const hasPromo = countdown !== null && Boolean(promotion.message);
  const [selected, setSelected] = useState([]);
  const [stickyOn, setStickyOn] = useState(false);
  const landingRef = useRef(null);
  const stickyRef = useRef(null);
  const promoRef = useRef(null);
  const comboRef = useRef(null);
  const hasCombo = combo.enabled && upsells.length > 0;
  const hasSticky = closing.stickyEnabled && stickyOn;

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
  }, [hasSticky, hasPromo]);
  // The fixed button waits for the order builder; without one it appears after the cover.
  useEffect(() => {
    const frame = landingRef.current?.ownerDocument.defaultView;
    if (!frame || !closing.stickyEnabled) return;
    const update = () => setStickyOn(comboRef.current ? comboRef.current.getBoundingClientRect().top < frame.innerHeight - 80 : frame.scrollY > 640);
    update();
    frame.addEventListener('scroll', update, { passive: true });
    frame.addEventListener('resize', update);
    return () => { frame.removeEventListener('scroll', update); frame.removeEventListener('resize', update); };
  }, [closing.stickyEnabled, hasCombo]);

  const theme = classicTheme(content.style.accentColor);
  const money = value => formatMoney(value, store.currency);
  const totals = offerTotals(offer);
  const chosen = upsells.filter(upsell => selected.includes(upsell.productId));
  const order = checkoutTotals(offer, chosen);
  const guarantee = content.guarantee.enabled && Boolean(content.guarantee.text);
  const guaranteeLabel = content.guarantee.days ? `Garantía ${content.guarantee.days} días` : content.guarantee.title;
  const trustText = hero.trustText || ['Acceso inmediato', 'Pago seguro', guarantee && guaranteeLabel].filter(Boolean).join(' · ');
  const pay = onCta ? () => onCta(chosen.map(upsell => upsell.productId)) : undefined;
  // With an order builder every button leads to it; the builder's own button starts the payment.
  const go = hasCombo ? () => comboRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : pay;
  const cta = (text, extra = '') => <button type="button" className={`cl-btn ${extra}`} onClick={go} disabled={!go}>{text || hero.ctaText || 'Comprar ahora'}</button>;
  const toggle = id => setSelected(selected.includes(id) ? selected.filter(item => item !== id) : [...selected, id]);
  const allSelected = upsells.length > 0 && chosen.length === upsells.length;
  const highlighted = content.comparison.items.find(item => item.highlighted);
  const proof = content.socialProof;
  const number = value => value.toLocaleString('es-AR', { maximumFractionDigits: 1 });
  // A photo section is its photo: the public page waits for it, the editor preview asks for it.
  const photoSection = section => section.enabled && (section.imageUrl || (preview && section.title));
  const photo = (section, slot) => section.imageUrl
    ? <Picture className="cl-figure" src={section.imageUrl} alt={section.imageAlt || section.title} />
    : <PhotoSlot {...slot} />;

  return <div ref={landingRef} className={`cl-landing ${hasSticky ? 'has-sticky' : ''}`} style={theme}>
    {hasPromo && <div ref={promoRef} className="cl-promo"><strong>{offer.main.name}</strong><span>{promotion.message}{countdown && <> · <time aria-label={`Termina en ${countdown}`}>{countdown}</time></>}</span></div>}
    {content.activity.notifications && <DemoPurchaseToasts key={view.subdomain} copy={content.activity} variant="classic" />}
    <main>
      <header className="cl-masthead"><div className="cl-wrap">
        <div className="cl-masthead-copy">
          {hero.eyebrow && <span className="cl-tag"><Sparkles aria-hidden="true" />{hero.eyebrow}</span>}
          <h1>{rich(hero.title || offer.main.name)}</h1>
          {hero.subtitle && <p>{rich(hero.subtitle)}</p>}
        </div>
        <div className="cl-masthead-offer">
          <Price offer={offer} money={money} savings={totals.savings} />
          <button type="button" className="cl-btn is-white" onClick={go} disabled={!go}>{hero.headerCtaText || hero.ctaText || 'Comprar ahora'}<ArrowRight aria-hidden="true" /></button>
        </div>
      </div></header>

      <section className="cl-hero" aria-label={offer.main.name}><div className="cl-wrap cl-w-900">
        <div className={`cl-hero-media ${hero.secondaryImageUrl || preview ? 'is-pair' : ''}`}>
          {preview && !hero.imageUrl && !offer.main.coverUrl
            ? <PhotoSlot ratio="1" title="Foto principal" hint="Cuadrada, 1000 × 1000 px. Sin foto se usa la portada del producto." />
            : <Picture src={hero.imageUrl || offer.main.coverUrl} alt={`Portada de ${offer.main.name}`} name={offer.main.name} />}
          {hero.secondaryImageUrl ? <Picture src={hero.secondaryImageUrl} alt={`Contenido de ${offer.main.name}`} />
            : preview && <PhotoSlot ratio="1" title="Segunda foto" hint="Opcional · cuadrada, 1000 × 1000 px. Sin ella, la principal queda sola y centrada." />}
        </div>
        {(proof.rating > 0 || hero.ratingText) && <p className="cl-rating">{proof.rating > 0 && <span className="cl-stars" aria-hidden="true">★★★★★</span>}
          <span>{[proof.rating > 0 && number(proof.rating), proof.rating > 0 && proof.customers > 0 && `${number(proof.customers)} clientes`, hero.ratingText].filter(Boolean).join(' · ')}</span></p>}
        {content.activity.salesCount && <p className="cl-sales"><ShoppingBag aria-hidden="true" />{formatLandingText(content.activity.salesText, { cantidad: simulatedSales })}</p>}
        <Price offer={offer} money={money} savings={totals.savings} tone="is-big" />
        {cta(hero.ctaText, 'is-big')}
        {trustText && <p className="cl-trust">{trustText}</p>}
        {(hero.noteTitle || hero.note) && <p className="cl-note"><Check aria-hidden="true" /><span>{hero.noteTitle && <strong>{hero.noteTitle} </strong>}{rich(hero.note)}</span></p>}
        {hero.footnote && <p className="cl-footnote"><Smartphone aria-hidden="true" />{hero.footnote}</p>}
        {countdown !== null && promotion.remainingSpots > 0 && <p className="cl-spots"><span aria-hidden="true" />{formatLandingText(promotion.spotsText, { cantidad: promotion.remainingSpots })}</p>}
        {content.activity.viewers && <p className="cl-live"><span aria-hidden="true" />{formatLandingText(content.activity.viewersText, { cantidad: shoppers })}</p>}
      </div></section>

      {content.introduction.enabled && (content.introduction.title || content.introduction.text) && <section className="cl-section cl-intro"><div className="cl-wrap cl-w-560">
        {content.introduction.title && <h2>{rich(content.introduction.title)}</h2>}
        {paragraphs(content.introduction.text).map((line, i) => <p key={i}>{rich(line)}</p>)}
        {content.introduction.badge && <span className="cl-badge">{content.introduction.badge}</span>}
      </div></section>}

      {photoSection(content.transformation) && <section className="cl-section"><div className="cl-wrap cl-w-760">
        <Head section={content.transformation} />
        {photo(content.transformation, { ratio: '6 / 5', title: 'Foto del antes y después', hint: 'Horizontal, 1200 × 1000 px. La sección se publica cuando subís la foto.' })}
      </div></section>}

      {content.painPoints.enabled && content.painPoints.items.length > 0 && <section className="cl-section is-cream-end"><div className="cl-wrap cl-w-760">
        <Head section={content.painPoints} tone="is-alert" />
        <ul className="cl-pains">{content.painPoints.items.map((item, index) => <li key={index}><span aria-hidden="true"><X /></span><p>{item.title}{item.description && <small>{item.description}</small>}</p></li>)}</ul>
        {content.painPoints.closingText && <p className="cl-pain-closing">{rich(content.painPoints.closingText)}</p>}
        <div className="cl-action">{cta(content.painPoints.ctaText)}</div>
      </div></section>}

      {content.bonuses.enabled && offer.bonuses.length > 0 && <section className="cl-section cl-dark"><div className="cl-wrap">
        <Head section={content.bonuses} tone="is-gold" icon={Gift} />
        {content.bonuses.chips.some(Boolean) && <ul className="cl-chips">{content.bonuses.chips.filter(Boolean).map((chip, i) => <li key={i}>{chip}</li>)}</ul>}
        <BonusFlow bonuses={offer.bonuses} />
        <div className="cl-action">{cta(content.bonuses.ctaText, 'is-big')}{content.bonuses.note && <p className="cl-trust">{content.bonuses.note}</p>}</div>
      </div></section>}

      {content.steps.enabled && content.steps.items.length > 0 && <section className="cl-section is-cream"><div className="cl-wrap cl-w-760">
        <Head section={content.steps} />
        <ol className="cl-steps">{content.steps.items.map((item, index) => <li key={index}><span aria-hidden="true">{index + 1}</span><p><strong>{item.title}</strong>{item.description && <> — {item.description}</>}</p></li>)}</ol>
      </div></section>}

      {content.about.enabled && content.about.text && <section className="cl-section is-cream"><div className={`cl-wrap cl-w-820 cl-about ${content.about.imageUrl || preview ? 'has-image' : ''}`}>
        {content.about.imageUrl ? <Picture className="cl-about-photo" src={content.about.imageUrl} alt={content.about.imageAlt || 'El equipo'} />
          : preview && <PhotoSlot className="cl-about-slot" ratio="8 / 9" title="Foto del equipo" hint="Opcional · vertical, 600 × 680 px" />}
        <div>
          <Head section={content.about} align="is-left" />
          {paragraphs(content.about.text).map((line, i) => <p key={i}>{rich(line)}</p>)}
          {content.about.signature && <p className="cl-signature">— {content.about.signature}</p>}
        </div>
      </div></section>}

      {photoSection(content.showcase) && <section className="cl-section"><div className="cl-wrap cl-w-760">
        <Head section={content.showcase} />
        {photo(content.showcase, { ratio: '1', title: 'Foto con todo lo que viene adentro', hint: 'Cuadrada, 1200 × 1200 px. La sección se publica cuando subís la foto.' })}
      </div></section>}

      {content.benefits.enabled && content.benefits.items.length > 0 && <section className="cl-section is-cream"><div className="cl-wrap cl-w-640">
        <Head section={content.benefits} />
        <KitMedia section={content.benefits} preview={preview} />
        <ol className="cl-kit">{content.benefits.items.map((item, index) => <li key={index}><span aria-hidden="true">{index + 1}</span><div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</div></li>)}</ol>
        {content.summary.enabled && <div className="cl-total">
          {totals.savings > 0 && <p>Valor total: <del>{money(totals.reference)}</del></p>}
          <p className="cl-total-today">Hoy solo: <strong>{money(offer.main.price)}</strong></p>
          {cta(content.summary.ctaText || closing.ctaText, 'is-big')}
          {(content.summary.note || trustText) && <small>{content.summary.note || trustText}</small>}
        </div>}
      </div></section>}

      {proof.enabled && (proof.items.length > 0 || proof.customers > 0 || proof.rating > 0 || proof.satisfaction > 0) && <section className="cl-section is-cream"><div className="cl-wrap cl-w-1450">
        <Head section={proof} />
        {proof.items.length > 0 && <div className="cl-testis" tabIndex={0} role="region" aria-label="Testimonios">{proof.items.map((item, index) => <Testimonial key={index} item={item} />)}</div>}
        {(proof.customers > 0 || proof.rating > 0 || proof.satisfaction > 0) && <div className="cl-metrics">
          {proof.customers > 0 && <p><strong>{number(proof.customers)}+</strong><span>Clientes</span></p>}
          {proof.rating > 0 && <p><strong>{number(proof.rating)}</strong><span>Calificación</span></p>}
          {proof.satisfaction > 0 && <p><strong>{proof.satisfaction}%</strong><span>Satisfacción</span></p>}
        </div>}
        <div className="cl-action">{cta(proof.ctaText)}</div>
      </div></section>}

      {content.comparison.enabled && content.comparison.items.length > 0 && <section className="cl-section"><div className="cl-wrap cl-w-1000">
        <Head section={{ ...content.comparison, eyebrow: '' }} />
        <div className="cl-paths">{content.comparison.items.map((item, index) => <article key={index} className={item === highlighted ? 'is-best' : ''}>
          {item === highlighted && content.comparison.badge && <span className="cl-paths-badge">{content.comparison.badge}</span>}
          <h3>{item.title}</h3>
          <ul>{paragraphs(item.description).map((line, i) => <li key={i}><span aria-hidden="true">{item === highlighted ? <Check /> : <X />}</span>{line}</li>)}</ul>
          {item === highlighted && cta(content.comparison.ctaText)}
        </article>)}</div>
      </div></section>}

      {guarantee && <section className="cl-section is-cream-end"><div className="cl-wrap cl-w-600"><div className="cl-guarantee">
        <span aria-hidden="true"><ShieldCheck /></span>
        <h2>{rich(content.guarantee.title || guaranteeLabel)}</h2>
        {paragraphs(content.guarantee.text).map((line, i) => <p key={i}>{rich(line)}</p>)}
        {cta(content.guarantee.ctaText)}
      </div></div></section>}

      {content.faq.enabled && content.faq.items.length > 0 && <section className="cl-section"><div className="cl-wrap cl-w-680">
        <Head section={{ ...content.faq, eyebrow: '' }} />
        <div className="cl-faq">{content.faq.items.map((item, index) => <details key={index}><summary>{item.question}<Plus aria-hidden="true" /></summary>{paragraphs(item.answer).map((line, i) => <p key={i}>{line}</p>)}</details>)}</div>
      </div></section>}

      {closing.enabled && <section className="cl-section cl-closing"><div className="cl-wrap cl-w-560">
        <h2>{rich(closing.title || hero.title || offer.main.name)}</h2>
        {closing.text && <p>{rich(closing.text)}</p>}
        {cta(closing.ctaText, 'is-big')}
        {(closing.note || trustText) && <p className="cl-trust">{closing.note || trustText}</p>}
      </div>{hero.footnote && <p className="cl-closing-footnote">{hero.footnote}</p>}</section>}

      {hasCombo && <section ref={comboRef} className="cl-section cl-combo-section" aria-labelledby="cl-combo-title"><div className="cl-wrap cl-w-520"><div className="cl-combo">
        {combo.eyebrow && <span className="cl-pill">{combo.eyebrow}</span>}
        <h2 id="cl-combo-title">{combo.title || 'Tu compra'}</h2>
        <ComboRow item={{ ...offer.main, description: offer.bonuses.length > 0 ? `Incluye ${offer.bonuses.length} ${offer.bonuses.length === 1 ? 'bono gratis' : 'bonos gratis'}` : '' }} money={money} checked locked />
        {combo.upsellText && <p className="cl-combo-lead">{combo.upsellText}</p>}
        {upsells.map(upsell => <ComboRow key={upsell.productId} item={upsell} money={money} extra checked={selected.includes(upsell.productId)} onToggle={() => toggle(upsell.productId)} />)}
        {upsells.length > 1 && combo.allText && <button type="button" className="cl-combo-all" aria-pressed={allSelected} onClick={() => setSelected(allSelected ? [] : upsells.map(upsell => upsell.productId))}>{allSelected ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}{allSelected ? 'Todo agregado' : combo.allText}</button>}
        {order.savings > 0 && <p className="cl-combo-savings"><PiggyBank aria-hidden="true" />Te ahorrás {money(order.savings)}</p>}
        <p className="cl-combo-total" aria-live="polite"><span>Total</span><strong>{money(order.total)}</strong></p>
        <button type="button" className="cl-btn is-wide" onClick={pay} disabled={!pay}>{combo.ctaText || 'Ir a pagar ahora'}<ArrowRight aria-hidden="true" /></button>
        {combo.note && <p className="cl-combo-note"><LockKeyhole aria-hidden="true" />{combo.note}</p>}
      </div></div></section>}
    </main>
    <footer className="cl-footer"><div className="cl-wrap">
      <p>© {new Date().getFullYear()} {content.footer.brandName || store.name}. Todos los derechos reservados.</p>
      {(content.footer.termsUrl || content.footer.privacyUrl) && <nav aria-label="Información legal">{content.footer.termsUrl && <a href={content.footer.termsUrl} target="_blank" rel="noreferrer">Términos y condiciones</a>}{content.footer.privacyUrl && <a href={content.footer.privacyUrl} target="_blank" rel="noreferrer">Política de privacidad</a>}</nav>}
    </div></footer>
    {hasSticky && <aside ref={stickyRef} className="cl-sticky" aria-label="Comprar"><div>
      <strong>{money(order.total)}</strong>
      <button type="button" className="cl-btn is-blue" onClick={pay} disabled={!pay}>{(hasCombo && combo.ctaText) || closing.ctaText || hero.ctaText || 'Comprar ahora'}<ArrowRight aria-hidden="true" /></button>
    </div></aside>}
  </div>;
}
