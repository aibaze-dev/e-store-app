import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Check, Gift, Info, ShieldCheck, Star, Target } from 'lucide-react';
import { storefrontMoney } from '@/lib/storefront-money.js';
import { createConfetti, tint } from './confetti.js';
import { displayRef, evaluate, gaugeFor, matches, personalize, resolveRef, statPercent } from '../../shared/quiz.js';

// The chart library is large and only result pages with a chart block need it.
const QuizChart = lazy(() => import('./QuizChart.jsx'));
const CHART_HEIGHT = 220;

// "*word*" in a title is highlighted with the accent color.
export function Rich({ text }) {
  return String(text || '').split(/\*([^*]+)\*/).map((part, i) => i % 2 ? <em className="quiz-accent-text" key={i}>{part}</em> : part);
}

const Img = ({ src, alt = '', className }) => src ? <img className={className} src={src} alt={alt} loading="lazy" onError={e => { e.currentTarget.hidden = true; }} /> : null;

// Answer labels for a step, empty when it was skipped.
function answerText(stepId, context, suffix = '') {
  const value = resolveRef(`answer:${stepId}`, context);
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return '';
  return `${displayRef(`answer:${stepId}`, context)}${suffix ? ` ${suffix}` : ''}`;
}

function PlanSummary({ block, context, t }) {
  const items = (block.items || []).map(item => ({ ...item, value: answerText(item.stepId, context, t(item.suffix)) })).filter(item => item.value);
  if (!items.length) return null;
  return <div className="quiz-summary-grid">{items.map((item, i) => <div className="quiz-summary-card" key={i}>
    {item.icon && <span className="quiz-summary-icon" aria-hidden="true">{item.icon}</span>}
    <span><small>{t(item.label)}</small><strong>{item.value}</strong></span>
  </div>)}</div>;
}

function Goals({ block, context, t }) {
  const step = context.quiz.steps.find(s => s.id === block.stepId);
  const value = block.stepId ? context.answers[block.stepId] : null;
  const chosen = (Array.isArray(value) ? value : value ? [value] : [])
    .map(id => step?.options?.find(o => o.id === id)).filter(o => o && !o.exclusive).map(o => t(o.label));
  const items = [...new Set([...chosen, ...(block.items || []).map(t)])].filter(Boolean).slice(0, 8);
  if (!items.length) return null;
  return <ul className="quiz-goals">{items.map(item => <li key={item}><Target aria-hidden="true" />{item}</li>)}</ul>;
}

function FeatureItems({ items, t }) {
  return <ul>{items.map((item, i) => <li key={i}>
    <span className="quiz-feature-icon" aria-hidden="true">{item.imageUrl ? <Img src={item.imageUrl} /> : item.icon || '✓'}</span>
    <span><strong>{t(item.title)}</strong>{item.text && <small>{t(item.text)}</small>}</span>
  </li>)}</ul>;
}
// Items are split next to up to two product images (the first one is the legacy imageUrl).
function Features({ block, t }) {
  const images = (block.mockups?.length ? block.mockups : block.imageUrl ? [{ imageUrl: block.imageUrl, imageAlt: block.imageAlt }] : []).filter(m => m?.imageUrl);
  const items = block.items || [];
  if (!images.length) return <div className="quiz-features"><FeatureItems items={items} t={t} /></div>;
  const size = Math.ceil(items.length / images.length);
  return <div className="quiz-features-rows">{images.map((image, i) => <div className="quiz-features has-image" key={i}>
    <FeatureItems items={items.slice(i * size, (i + 1) * size)} t={t} />
    <Img src={image.imageUrl} alt={t(image.imageAlt)} className="quiz-features-image" />
  </div>)}</div>;
}

function Level({ value, max = 5 }) {
  if (typeof value === 'string') return <strong className="quiz-compare-text">{value}</strong>;
  return <span className="quiz-level" role="img" aria-label={`${value} of ${max}`}>{Array.from({ length: max }, (_, i) => <span key={i} className={i < value ? 'is-on' : ''} />)}</span>;
}
function NowAfter({ block, t }) {
  const sides = [block.now || {}, block.after || {}];
  return <div className="quiz-compare">
    <div className="quiz-compare-tabs">{sides.map((side, i) => <span key={i}>{t(side.label) || (i ? 'After' : 'Now')}</span>)}</div>
    <div className="quiz-compare-images">{sides.map((side, i) => <figure key={i} className={i ? 'is-after' : 'is-now'}>
      {side.imageUrl ? <Img src={side.imageUrl} alt={t(side.imageAlt)} /> : <span className="quiz-compare-icon" aria-hidden="true">{side.icon || (i ? '😄' : '😕')}</span>}
    </figure>)}</div>
    {(block.metrics || []).length > 0 && <div className="quiz-compare-metrics">{sides.map((_, i) => <dl key={i}>{block.metrics.map((m, j) => <div key={j}>
      <dt>{t(m.label)}</dt><dd><Level value={i ? m.after : m.now} /></dd>
    </div>)}</dl>)}</div>}
  </div>;
}

function Gauge({ block, context, t }) {
  const gauge = gaugeFor(block, context);
  if (!gauge) return null;
  return <div className="quiz-gauge">
    <div className="quiz-gauge-head"><span><small>{t(block.title)}</small><strong>{gauge.display}{block.suffix ? ` ${t(block.suffix)}` : ''}</strong></span>{block.text && <Info aria-hidden="true" />}</div>
    <div className="quiz-gauge-bar" role="img" aria-label={`${t(block.title)}: ${gauge.display}`}><span style={{ left: `${gauge.percent}%` }} /></div>
    <div className="quiz-gauge-scale"><span>{t(block.leftLabel)}</span><span>{t(block.rightLabel)}</span></div>
    {gauge.feedback && <div className={`quiz-gauge-status is-${gauge.feedback.tone}`}>{gauge.feedback.title && <strong>{t(gauge.feedback.title)}</strong>}{gauge.feedback.text && <p>{t(gauge.feedback.text)}</p>}</div>}
    {block.text && <p className="quiz-gauge-note">{t(block.text)}</p>}
  </div>;
}

function Stats({ block, context, t }) {
  return <div className="quiz-stats">{(block.items || []).map((item, i) => {
    const percent = statPercent(item, context), total = Math.min(12, item.total || 10), filled = Math.min(total, item.filled ?? Math.round(percent / 100 * total));
    return <article className="quiz-stat" key={i}>
      {item.badge && <span className="quiz-stat-badge">{t(item.badge)}</span>}
      <div className="quiz-stat-head">{item.icon && <span className="quiz-summary-icon" aria-hidden="true">{item.icon}</span>}<span><small>{t(item.label)}</small><strong>{t(item.value)}</strong></span></div>
      {item.display === 'slider' && <><div className="quiz-stat-slider" role="img" aria-label={`${Math.round(percent)}%`}><span style={{ width: `${percent}%` }} /><i style={{ left: `${percent}%` }} /></div>
        <div className="quiz-gauge-scale"><span>{t(item.minLabel)}</span><span>{t(item.maxLabel)}</span></div></>}
      {item.display === 'icons' && <div className="quiz-stat-icons" role="img" aria-label={`${filled} of ${total}`}>{Array.from({ length: total }, (_, j) => <span key={j} className={j < filled ? 'is-on' : ''} aria-hidden="true">{item.unitIcon || '●'}</span>)}</div>}
    </article>;
  })}</div>;
}

const Laurel = ({ flip }) => <svg className={`quiz-laurel ${flip ? 'is-flipped' : ''}`} viewBox="0 0 40 80" aria-hidden="true"><path d="M30 76C14 66 8 50 10 30 11 20 15 11 22 4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />{[[19, 66, -30], [13, 54, -15], [10, 41, 0], [11, 28, 15], [15, 16, 30]].map(([x, y, r], i) => <g key={i}><ellipse cx={x + 6} cy={y} rx="7" ry="3.2" transform={`rotate(${r - 35} ${x + 6} ${y})`} fill="currentColor" /><ellipse cx={x - 5} cy={y - 3} rx="7" ry="3.2" transform={`rotate(${r + 40} ${x - 5} ${y - 3})`} fill="currentColor" opacity=".75" /></g>)}</svg>;
function Rating({ block, t }) {
  const rating = Number(block.rating) || 0;
  return <div className="quiz-rating">
    {block.laurels !== false && (block.title || block.text) && <div className="quiz-laurels"><Laurel /><div>{block.title && <h2>{t(block.title)}</h2>}{block.text && <p>{t(block.text)}</p>}</div><Laurel flip /></div>}
    {rating > 0 && <p className="quiz-stars" aria-label={`${rating} out of 5`}>{[1, 2, 3, 4, 5].map(n => <Star key={n} aria-hidden="true" className={n <= Math.round(rating) ? 'is-on' : ''} />)}<span>{rating.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span></p>}
    {block.subtitle && <p className="quiz-rating-subtitle">{t(block.subtitle)}</p>}
  </div>;
}

function BeforeAfter({ block, t }) {
  const items = block.items || [], track = useRef(null);
  const [active, setActive] = useState(0);
  if (!items.length) return null;
  const go = i => track.current?.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  return <div className="quiz-stories">
    <div className="quiz-stories-track" ref={track} onScroll={e => setActive(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
      {items.map((item, i) => <article className="quiz-story" key={i} aria-label={`Story ${i + 1} of ${items.length}`}>
        {(item.beforeImageUrl || item.afterImageUrl) && <div className="quiz-story-images">
          {item.beforeImageUrl && <figure><Img src={item.beforeImageUrl} alt={`${t(block.beforeLabel) || 'Before'} · ${t(item.name)}`} /><figcaption>{t(block.beforeLabel) || 'Before'}</figcaption></figure>}
          {item.afterImageUrl && <figure><Img src={item.afterImageUrl} alt={`${t(block.afterLabel) || 'After'} · ${t(item.name)}`} /><figcaption>{t(block.afterLabel) || 'After'}</figcaption></figure>}
        </div>}
        <blockquote>{item.title && <strong>{t(item.title)}</strong>}{item.text && <p>{t(item.text)}</p>}{item.name && <footer>{t(item.name)}</footer>}</blockquote>
      </article>)}
    </div>
    {items.length > 1 && <div className="quiz-dots">{items.map((_, i) => <button key={i} type="button" aria-label={`Show story ${i + 1}`} aria-current={i === active} onClick={() => go(i)} />)}</div>}
  </div>;
}

// The guarantee block: an optional badge image and an optional text, nothing else.
// It does not read the store and is not affected by block conditions.
const hasGuarantee = b => Boolean(String(b.text || '').trim() || b.imageUrl);
function GuaranteeCard({ block, t }) {
  return <div className="quiz-guarantee">
    {block.imageUrl && <Img src={block.imageUrl} alt="" className="quiz-guarantee-image" />}
    {String(block.text || '').trim() && <p>{t(block.text)}</p>}
  </div>;
}

// Short reassurance line under a price or button. Typed lines win; otherwise secure
// payment and instant digital access.
export function trustItems(block, t) {
  const typed = (block?.trust || []).map(t).map(x => String(x || '').trim()).filter(Boolean);
  if (typed.length) return typed.slice(0, 4);
  return ['🔒 Secure payment', '⚡ Instant access'];
}
export const TrustRow = ({ items }) => items.length ? <ul className="quiz-trust">{items.map(item => <li key={item}>{item}</li>)}</ul> : null;

// The price card, on the quiz's main color. The price charged is always the store's; the
// crossed-out price is the card's own (or the product's reference price) and only shows
// when it is higher. `config` is an offer block or the final page's own price settings.
export function OfferCard({ block: config = {}, view, t, onCheckout, busy, withButton = true }) {
  if (!view?.offer?.main) return null;
  const currency = view.store?.currency || 'USD', money = value => storefrontMoney(value, currency);
  const { main, bonuses = [] } = view.offer;
  const price = main.price, compare = Number.isFinite(config.compareAtPrice) && config.compareAtPrice > 0 ? config.compareAtPrice : main.compareAtPrice;
  const was = compare > price ? compare : null, save = was ? Math.round((was - price) / was * 100) : 0;
  const promotion = view.content?.promotion?.enabled && String(view.content.promotion.message || '').trim();
  const sales = view.activity?.sales >= 10 ? view.activity.sales : 0;
  const showBonuses = config.showBonuses !== false && bonuses.length > 0;
  const badge = t(config.badge) || (save > 0 ? `Save ${save}% today` : '');
  return <div className="quiz-offer-wrap">
    {config.title && <h2><Rich text={t(config.title)} /></h2>}
    <div className="quiz-offer">
      {badge && <span className="quiz-offer-ribbon">{badge}</span>}
      {promotion && <p className="quiz-offer-promo">{promotion}</p>}
      <p className="quiz-offer-label">{t(config.label) || main.name}</p>
      {was && <p className="quiz-offer-was"><s aria-label={`Regular price ${money(was)}`}>{money(was)}</s>{save > 0 && <span className="quiz-offer-save">−{save}%</span>}</p>}
      <p className="quiz-offer-price"><span className="quiz-sparkle is-left" aria-hidden="true">✦</span><span className="sr-only">{was ? 'Today’s price ' : 'Price '}</span><span className="quiz-offer-amount">{money(price)}</span><span className="quiz-sparkle is-right" aria-hidden="true">✦</span></p>
      <p className="quiz-offer-note">{t(config.note) || 'One-time payment · No subscription'}</p>
      {showBonuses && <ul className="quiz-offer-bonuses">
        {bonuses.map(b => <li key={b.productId}><Gift aria-hidden="true" /><span>{b.name}</span>{b.referenceValue > 0 && <s>{money(b.referenceValue)}</s>}<strong>FREE</strong></li>)}
      </ul>}
      {withButton && <button className="quiz-offer-cta" type="button" disabled={busy} onClick={onCheckout}>{t(config.buttonText) || 'Get my plan'}<span aria-hidden="true"> ›</span></button>}
      {withButton && <TrustRow items={trustItems(config, t)} />}
      {sales > 0 && <p className="quiz-offer-proof"><Star aria-hidden="true" />{sales.toLocaleString('en-US')} people already got it</p>}
    </div>
  </div>;
}

export function QuizBlocks({ blocks = [], context, view, onCheckout, busy }) {
  const t = text => personalize(text, context);
  return blocks.filter(b => b.enabled !== false && (b.type === 'guarantee' || matches(b.when, context))).map(b => {
    if (b.type === 'video' && !b.videoUrl) return null;
    if (b.type === 'guarantee' && !hasGuarantee(b)) return null;
    if (b.type === 'offer' && !view?.offer) return null;
    if (b.type === 'promotion' && !(view?.content?.promotion?.enabled && view.content.promotion.message)) return null;
    const data = (b.points || []).map(p => ({ label: t(p.label), value: evaluate(p.expression, context) }));
    const value = b.ref ? resolveRef(b.ref, context) : null;
    const plain = ['planSummary', 'goals', 'rating', 'nowAfter', 'gauge', 'stats', 'features', 'offer', 'guarantee'].includes(b.type);
    const ownHeading = (b.type === 'rating' && b.laurels !== false && (b.title || b.text)) || ['guarantee', 'offer'].includes(b.type);
    return <section className={`quiz-block is-${b.type} ${plain ? 'is-plain' : ''}`} key={b.id}>
      {b.title && !ownHeading && b.type !== 'gauge' && <h2><Rich text={t(b.title)} /></h2>}
      {b.text && !ownHeading && !['beforeAfter', 'gauge'].includes(b.type) && <p>{t(b.text)}</p>}
      {b.type === 'guarantee' && <GuaranteeCard block={b} t={t} />}
      {b.type === 'offer' && <OfferCard block={b} view={view} t={t} onCheckout={onCheckout} busy={busy} />}
      {b.type === 'planSummary' && <PlanSummary block={b} context={context} t={t} />}
      {b.type === 'goals' && <Goals block={b} context={context} t={t} />}
      {b.type === 'features' && <Features block={b} t={t} />}
      {b.type === 'nowAfter' && <NowAfter block={b} t={t} />}
      {b.type === 'gauge' && <Gauge block={b} context={context} t={t} />}
      {b.type === 'stats' && <Stats block={b} context={context} t={t} />}
      {b.type === 'rating' && <Rating block={b} t={t} />}
      {b.type === 'beforeAfter' && <><BeforeAfter block={b} t={t} />{b.text && <p className="quiz-disclaimer">{t(b.text)}</p>}</>}
      {b.type === 'image' && <Img src={b.imageUrl} alt={t(b.alt)} className="quiz-image" />}
      {b.type === 'video' && b.videoUrl && <video controls playsInline preload="metadata" src={b.videoUrl} aria-label={t(b.title) || 'Video'} />}
      {b.type === 'answers' && <dl>{context.quiz.steps.filter(s => context.answers[s.id] != null && s.type !== 'contact').map(s => <div key={s.id}><dt>{t(s.title)}</dt><dd>{displayRef(`answer:${s.id}`, context)}</dd></div>)}</dl>}
      {['metric', 'scale'].includes(b.type) && <><strong className="quiz-metric">{displayRef(b.ref, context)} {t(b.suffix)}</strong>{b.type === 'scale' && typeof value === 'number' && <meter min={b.min} max={b.max} value={value} aria-label={t(b.title)} />}</>}
      {b.type === 'comparison' && <dl className="quiz-comparison">{data.map((p, i) => <div key={i}><dt>{p.label}</dt><dd>{p.value ?? '—'}</dd></div>)}</dl>}
      {['line', 'bar'].includes(b.type) && <><div className="quiz-chart" role="img" aria-label={t(b.title)}><Suspense fallback={<div style={{ height: CHART_HEIGHT }} />}><QuizChart type={b.type} data={data} name={t(b.legend) || 'Value'} height={CHART_HEIGHT} /></Suspense></div><table className="quiz-data"><caption>{t(b.legend) || 'Chart values'}</caption><tbody>{data.map((p, i) => <tr key={i}><th>{p.label}</th><td>{p.value ?? '—'}</td></tr>)}</tbody></table></>}
      {['benefits', 'testimonials'].includes(b.type) && (b.items || []).map((item, i) => <article key={i}><Img src={item.imageUrl} className="quiz-image" /><h3>{t(item.title)}</h3><p>{t(item.text)}</p></article>)}
      {b.type === 'faq' && (b.items || []).map((item, i) => <details key={i}><summary>{t(item.title)}</summary><p>{t(item.text)}</p></details>)}
      {b.type === 'promotion' && <p className="quiz-offer-promo">{view.content.promotion.message}</p>}
    </section>;
  });
}

// A short confetti burst in the quiz colors when the result first appears.
function useRevealConfetti(canvas, color, enabled) {
  useEffect(() => {
    if (!enabled || !canvas.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const confetti = createConfetti(canvas.current, [color, tint(color, .45), '#f5c542', '#ffffff']);
    const timer = setTimeout(() => confetti.burst(.5, .18), 250);
    return () => { clearTimeout(timer); confetti.destroy(); };
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Final page: a hero that confirms the plan, the store's price right under it (unless an
// offer block places it elsewhere), the blocks, and the call to the store's own checkout.
export default function QuizResult({ result, context, view, onCheckout, busy, preview = false }) {
  const t = text => personalize(text, context);
  const canvas = useRef(null);
  const celebrate = !preview && result.confetti !== false;
  useRevealConfetti(canvas, context.quiz.identity?.color || '#2e8b62', celebrate);
  const blocks = result.blocks || [];
  const hasOffer = blocks.some(b => b.type === 'offer' && b.enabled !== false && matches(b.when, context));
  // Without an offer block of its own, the price goes right under the title.
  const priceTop = !hasOffer && result.showPrice !== false && view?.offer;
  const price = { compareAtPrice: result.compareAtPrice, label: result.priceLabel, note: result.priceNote, badge: result.priceBadge, buttonText: result.buttonText, trust: result.trust };
  const name = context.contact?.name ? String(context.contact.name).trim().split(/\s+/)[0] : '';
  return <div className="quiz-result">
    {celebrate && <canvas ref={canvas} className="quiz-confetti" aria-hidden="true" />}
    <header className="quiz-result-hero">
      <span className="quiz-result-eyebrow"><span className="quiz-result-check" aria-hidden="true"><Check strokeWidth={3.5} /></span>{t(result.eyebrow) || (name ? `${name}, your plan is ready` : 'Your personalized plan is ready')}</span>
      <Img src={result.imageUrl} alt={t(result.imageAlt)} className="quiz-result-image" />
      {result.title ? <h1 className="quiz-title quiz-result-title"><Rich text={t(result.title)} /></h1> : <h1 className="sr-only">Your result</h1>}
      {result.description && <p className="quiz-description quiz-result-description">{t(result.description)}</p>}
    </header>
    {priceTop && <section className="quiz-block is-offer is-plain is-top"><OfferCard block={price} view={view} t={t} onCheckout={onCheckout} busy={busy} /></section>}
    <QuizBlocks blocks={blocks} context={context} view={view} onCheckout={onCheckout} busy={busy} />
    <div className={result.stickyCta === false ? 'quiz-result-cta' : 'quiz-cta-bar'}>
      <div>
        <button className="quiz-primary quiz-halo" type="button" disabled={busy} onClick={onCheckout}>{t(result.buttonText) || 'Get my plan'}<span aria-hidden="true"> ›</span></button>
        {result.stickyCta === false && !priceTop && <TrustRow items={trustItems(null, t)} />}
      </div>
    </div>
  </div>;
}
