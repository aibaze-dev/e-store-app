import { useRef, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Info, ShieldCheck, Star, Target } from 'lucide-react';
import { formatMoney } from '@/lib/format.js';
import { displayRef, evaluate, gaugeFor, matches, personalize, resolveRef, statPercent } from '../../shared/quiz.js';

// "*word*" in a title is highlighted with the accent color.
export function Rich({ text }) {
  return String(text || '').split(/\*([^*]+)\*/).map((part, i) => i % 2 ? <em className="quiz-accent-text" key={i}>{part}</em> : part);
}

const Img = ({ src, alt = '', className }) => src ? <img className={className} src={src} alt={alt} loading="lazy" onError={e => { e.currentTarget.hidden = true; }} /> : null;

// Answer labels for a step, without "Sin resultado" when it was skipped.
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
  return <span className="quiz-level" role="img" aria-label={`${value} de ${max}`}>{Array.from({ length: max }, (_, i) => <span key={i} className={i < value ? 'is-on' : ''} />)}</span>;
}
function NowAfter({ block, t }) {
  const sides = [block.now || {}, block.after || {}];
  return <div className="quiz-compare">
    <div className="quiz-compare-tabs">{sides.map((side, i) => <span key={i}>{t(side.label) || (i ? 'Después' : 'Ahora')}</span>)}</div>
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
      {item.display === 'icons' && <div className="quiz-stat-icons" role="img" aria-label={`${filled} de ${total}`}>{Array.from({ length: total }, (_, j) => <span key={j} className={j < filled ? 'is-on' : ''} aria-hidden="true">{item.unitIcon || '●'}</span>)}</div>}
    </article>;
  })}</div>;
}

const Laurel = ({ flip }) => <svg className={`quiz-laurel ${flip ? 'is-flipped' : ''}`} viewBox="0 0 40 80" aria-hidden="true"><path d="M30 76C14 66 8 50 10 30 11 20 15 11 22 4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />{[[19, 66, -30], [13, 54, -15], [10, 41, 0], [11, 28, 15], [15, 16, 30]].map(([x, y, r], i) => <g key={i}><ellipse cx={x + 6} cy={y} rx="7" ry="3.2" transform={`rotate(${r - 35} ${x + 6} ${y})`} fill="currentColor" /><ellipse cx={x - 5} cy={y - 3} rx="7" ry="3.2" transform={`rotate(${r + 40} ${x - 5} ${y - 3})`} fill="currentColor" opacity=".75" /></g>)}</svg>;
function Rating({ block, t }) {
  const rating = Number(block.rating) || 0;
  return <div className="quiz-rating">
    {block.laurels !== false && (block.title || block.text) && <div className="quiz-laurels"><Laurel /><div>{block.title && <h2>{t(block.title)}</h2>}{block.text && <p>{t(block.text)}</p>}</div><Laurel flip /></div>}
    {rating > 0 && <p className="quiz-stars" aria-label={`${rating} de 5`}>{[1, 2, 3, 4, 5].map(n => <Star key={n} aria-hidden="true" className={n <= Math.round(rating) ? 'is-on' : ''} />)}<span>{rating.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span></p>}
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
      {items.map((item, i) => <article className="quiz-story" key={i} aria-label={`Historia ${i + 1} de ${items.length}`}>
        {(item.beforeImageUrl || item.afterImageUrl) && <div className="quiz-story-images">
          {item.beforeImageUrl && <figure><Img src={item.beforeImageUrl} alt={`${t(block.beforeLabel) || 'Antes'} · ${t(item.name)}`} /><figcaption>{t(block.beforeLabel) || 'Antes'}</figcaption></figure>}
          {item.afterImageUrl && <figure><Img src={item.afterImageUrl} alt={`${t(block.afterLabel) || 'Después'} · ${t(item.name)}`} /><figcaption>{t(block.afterLabel) || 'Después'}</figcaption></figure>}
        </div>}
        <blockquote>{item.title && <strong>{t(item.title)}</strong>}{item.text && <p>{t(item.text)}</p>}{item.name && <footer>{t(item.name)}</footer>}</blockquote>
      </article>)}
    </div>
    {items.length > 1 && <div className="quiz-dots">{items.map((_, i) => <button key={i} type="button" aria-label={`Ver historia ${i + 1}`} aria-current={i === active} onClick={() => go(i)} />)}</div>}
  </div>;
}

export function QuizBlocks({ blocks = [], context, view, onCheckout }) {
  const t = text => personalize(text, context);
  const money = value => formatMoney(value, view?.store.currency || 'USD');
  return blocks.filter(b => b.enabled !== false && matches(b.when, context)).map(b => {
    const data = (b.points || []).map(p => ({ label: t(p.label), value: evaluate(p.expression, context) }));
    const value = b.ref ? resolveRef(b.ref, context) : null;
    const guarantee = view?.content?.guarantee;
    if (b.type === 'guarantee' && (!guarantee || guarantee.enabled === false)) return null;
    const plain = ['planSummary', 'goals', 'rating', 'nowAfter', 'gauge', 'stats', 'features'].includes(b.type);
    const ownHeading = b.type === 'rating' && b.laurels !== false && (b.title || b.text);
    return <section className={`quiz-block is-${b.type} ${plain ? 'is-plain' : ''}`} key={b.id}>
      {b.type === 'guarantee' ? <div className="quiz-guarantee"><ShieldCheck aria-hidden="true" /><div><h2>{t(b.title) || guarantee.title}</h2><p>{guarantee.text}</p></div></div> : <>
        {b.title && !ownHeading && b.type !== 'gauge' && <h2><Rich text={t(b.title)} /></h2>}
        {b.text && !ownHeading && !['beforeAfter', 'gauge'].includes(b.type) && <p>{t(b.text)}</p>}
      </>}
      {b.type === 'planSummary' && <PlanSummary block={b} context={context} t={t} />}
      {b.type === 'goals' && <Goals block={b} context={context} t={t} />}
      {b.type === 'features' && <Features block={b} t={t} />}
      {b.type === 'nowAfter' && <NowAfter block={b} t={t} />}
      {b.type === 'gauge' && <Gauge block={b} context={context} t={t} />}
      {b.type === 'stats' && <Stats block={b} context={context} t={t} />}
      {b.type === 'rating' && <Rating block={b} t={t} />}
      {b.type === 'beforeAfter' && <><BeforeAfter block={b} t={t} />{b.text && <p className="quiz-disclaimer">{t(b.text)}</p>}</>}
      {b.type === 'image' && <Img src={b.imageUrl} alt={t(b.alt)} className="quiz-image" />}
      {b.type === 'video' && b.videoUrl && <video controls preload="metadata" src={b.videoUrl} aria-label={t(b.title)} />}
      {b.type === 'answers' && <dl>{context.quiz.steps.filter(s => context.answers[s.id] != null && s.type !== 'contact').map(s => <div key={s.id}><dt>{t(s.title)}</dt><dd>{displayRef(`answer:${s.id}`, context)}</dd></div>)}</dl>}
      {['metric', 'scale'].includes(b.type) && <><strong className="quiz-metric">{displayRef(b.ref, context)} {t(b.suffix)}</strong>{b.type === 'scale' && typeof value === 'number' && <meter min={b.min} max={b.max} value={value} aria-label={t(b.title)} />}</>}
      {b.type === 'comparison' && <dl className="quiz-comparison">{data.map((p, i) => <div key={i}><dt>{p.label}</dt><dd>{p.value ?? 'Sin resultado'}</dd></div>)}</dl>}
      {['line', 'bar'].includes(b.type) && <><div className="quiz-chart" role="img" aria-label={t(b.title)}><ResponsiveContainer width="100%" height={220}>{b.type === 'line' ? <LineChart data={data}><XAxis dataKey="label" /><YAxis width={42} /><Tooltip /><Line dataKey="value" name={t(b.legend) || 'Valor'} stroke="var(--quiz-accent)" connectNulls={false} /></LineChart> : <BarChart data={data}><XAxis dataKey="label" /><YAxis width={42} /><Tooltip /><Bar dataKey="value" name={t(b.legend) || 'Valor'} fill="var(--quiz-accent)" /></BarChart>}</ResponsiveContainer></div><table className="quiz-data"><caption>{t(b.legend) || 'Valores del gráfico'}</caption><tbody>{data.map((p, i) => <tr key={i}><th>{p.label}</th><td>{p.value ?? 'Sin resultado'}</td></tr>)}</tbody></table></>}
      {['benefits', 'testimonials'].includes(b.type) && (b.items || []).map((item, i) => <article key={i}><Img src={item.imageUrl} className="quiz-image" /><h3>{t(item.title)}</h3><p>{t(item.text)}</p></article>)}
      {b.type === 'faq' && (b.items || []).map((item, i) => <details key={i}><summary>{t(item.title)}</summary><p>{t(item.text)}</p></details>)}
      {b.type === 'offer' && view && <><Img src={view.offer.main.coverUrl} alt={view.offer.main.name} className="quiz-image" /><h3>{view.offer.main.name}</h3><p>{view.offer.main.description}</p><strong className="quiz-price">{money(view.offer.main.price)}</strong><p>Pago único</p>{view.offer.bonuses.length > 0 && <><h3>Bonos incluidos</h3><ul>{view.offer.bonuses.map(p => <li key={p.productId}>{p.name}</li>)}</ul></>}<button className="quiz-primary" type="button" onClick={onCheckout}>{t(b.buttonText) || 'Ir al checkout'}</button></>}
      {b.type === 'promotion' && view?.content.promotion?.enabled && <p>{view.content.promotion.message}</p>}
    </section>;
  });
}

// Final page: personalised summary and a call to the store's own checkout. No prices here.
export default function QuizResult({ result, context, view, onCheckout, busy }) {
  const t = text => personalize(text, context);
  return <div className="quiz-result">
    {result.title ? <h1 className="quiz-title"><Rich text={t(result.title)} /></h1> : <h1 className="sr-only">Tu resultado</h1>}
    {result.description && <p className="quiz-description">{t(result.description)}</p>}
    <QuizBlocks blocks={result.blocks} context={context} view={view} onCheckout={onCheckout} />
    <div className={result.stickyCta === false ? 'quiz-result-cta' : 'quiz-cta-bar'}>
      <button className="quiz-primary" type="button" disabled={busy} onClick={onCheckout}>{t(result.buttonText) || 'Quiero mi plan'}<span aria-hidden="true"> ›</span></button>
    </div>
  </div>;
}
