import { useRef, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { CircleCheck, ShieldCheck, Star } from 'lucide-react';
import { formatMoney } from '@/lib/format.js';
import { displayRef, evaluate, matches, personalize, resolveRef } from '../../shared/quiz.js';

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
  return <ul className="quiz-goals">{items.map(item => <li key={item}><CircleCheck aria-hidden="true" />{item}</li>)}</ul>;
}

function Features({ block, t }) {
  return <div className={`quiz-features ${block.imageUrl ? 'has-image' : ''}`}>
    <ul>{(block.items || []).map((item, i) => <li key={i}>
      <span className="quiz-feature-icon" aria-hidden="true">{item.imageUrl ? <Img src={item.imageUrl} /> : item.icon || '✓'}</span>
      <span><strong>{t(item.title)}</strong>{item.text && <small>{t(item.text)}</small>}</span>
    </li>)}</ul>
    <Img src={block.imageUrl} alt={t(block.imageAlt)} className="quiz-features-image" />
  </div>;
}

function Rating({ block, t }) {
  const rating = Number(block.rating) || 0;
  return <div className="quiz-rating">
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
    const plain = ['planSummary', 'goals', 'rating'].includes(b.type);
    return <section className={`quiz-block is-${b.type} ${plain ? 'is-plain' : ''}`} key={b.id}>
      {b.type === 'guarantee' ? <div className="quiz-guarantee"><ShieldCheck aria-hidden="true" /><div><h2>{t(b.title) || guarantee.title}</h2><p>{guarantee.text}</p></div></div> : <>
        {b.title && <h2>{t(b.title)}</h2>}
        {b.text && b.type !== 'beforeAfter' && <p>{t(b.text)}</p>}
      </>}
      {b.type === 'planSummary' && <PlanSummary block={b} context={context} t={t} />}
      {b.type === 'goals' && <Goals block={b} context={context} t={t} />}
      {b.type === 'features' && <Features block={b} t={t} />}
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
    <h1 className="quiz-title">{t(result.title)}</h1>
    {result.description && <p className="quiz-description">{t(result.description)}</p>}
    <QuizBlocks blocks={result.blocks} context={context} view={view} onCheckout={onCheckout} />
    <div className={result.stickyCta === false ? 'quiz-result-cta' : 'quiz-cta-bar'}>
      <button className="quiz-primary" type="button" disabled={busy} onClick={onCheckout}>{t(result.buttonText) || 'Quiero mi plan'}<span aria-hidden="true"> ›</span></button>
    </div>
  </div>;
}
