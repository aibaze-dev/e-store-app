import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';
import { feedbackFor, hasOptionFeedback, personalize, QUESTION_TYPES } from '../../shared/quiz.js';
import { QuizBlocks } from './QuizResult.jsx';

export const Media = ({ src, alt = '', className = 'quiz-image' }) => src ? <img className={className} src={src} alt={alt} loading="lazy" onError={e => { e.currentTarget.hidden = true; }} /> : null;

const toneIcons = { good: CircleCheck, warn: TriangleAlert, bad: CircleX, info: Info };
export function FeedbackCard({ feedback, t }) {
  if (!feedback) return null;
  const Icon = toneIcons[feedback.tone] || Info;
  return <div className={`quiz-feedback is-${feedback.tone}`}>
    <Icon className="quiz-feedback-icon" aria-hidden="true" />
    <div>{feedback.title && <strong>{t(feedback.title)}</strong>}{feedback.text && <p>{t(feedback.text)}</p>}</div>
  </div>;
}

function Options({ step, value, onSelect, t, instant }) {
  const multiple = step.type === 'multiple', layout = step.layout || 'list';
  return <div className={`quiz-options is-${layout}`} role="group" aria-label={t(step.title)}>
    {step.options.map(o => {
      const on = multiple ? Array.isArray(value) && value.includes(o.id) : value === o.id;
      return <button className="quiz-option" type="button" key={o.id} aria-pressed={on} onClick={() => onSelect(o)}>
        {layout === 'grid' && <Media src={o.imageUrl} className="quiz-option-media" />}
        {o.icon && <span className="quiz-option-icon" aria-hidden="true">{o.icon}</span>}
        <span className="quiz-option-text"><strong>{t(o.label)}</strong>{o.description && <small>{t(o.description)}</small>}</span>
        {layout !== 'grid' && <Media src={o.imageUrl} className="quiz-option-media" />}
        {multiple ? <span className="quiz-check" aria-hidden="true">{on && <Check strokeWidth={3} />}</span>
          : instant && layout === 'list' && !o.imageUrl && <ChevronRight className="quiz-chevron" aria-hidden="true" />}
      </button>;
    })}
  </div>;
}

// Checklist that fills up over durationMs and then advances on its own.
function Loading({ step, t, onDone }) {
  const [progress, setProgress] = useState(0), [stuck, setStuck] = useState(false);
  const done = useRef(false);
  useEffect(() => {
    done.current = false;
    const start = performance.now(), duration = Math.max(1000, step.durationMs || 5000);
    let frame;
    const tick = now => {
      const value = Math.min(1, (now - start) / duration);
      setProgress(value);
      if (value < 1) frame = requestAnimationFrame(tick);
      else if (!done.current) { done.current = true; onDone(); timer = setTimeout(() => setStuck(true), 2500); }
    };
    let timer;
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [step.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = step.items || [], active = Math.floor(progress * items.length);
  const percent = Math.round(progress * 100), radius = 54, length = 2 * Math.PI * radius;
  return <div className="quiz-loading">
    <div className="quiz-ring" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t(step.title)}>
      <svg viewBox="0 0 128 128" aria-hidden="true"><circle cx="64" cy="64" r={radius} className="quiz-ring-track" /><circle cx="64" cy="64" r={radius} className="quiz-ring-value" strokeDasharray={length} strokeDashoffset={length * (1 - progress)} /></svg>
      <span>{percent}%</span>
    </div>
    {items.length > 0 && <ul className="quiz-loading-items">
      {items.map((item, i) => <li key={i} className={i < active ? 'is-done' : i === active ? 'is-active' : ''}>
        <span className="quiz-loading-mark" aria-hidden="true">{i < active && <Check strokeWidth={3} />}</span>{t(item)}
      </li>)}
    </ul>}
    {/* Only if saving the automatic step failed: lets the visitor retry by hand. */}
    {stuck && <button className="quiz-primary" type="submit">Continuar</button>}
  </div>;
}

export function StepImage({ step, t, layout }) {
  if (!step.imageUrl || (step.imageLayout || 'top') !== layout) return null;
  return <Media src={step.imageUrl} alt={t(step.imageAlt)} className={`quiz-image is-${layout}`} />;
}

// One quiz screen. `next(answer)` validates and saves; the parent owns the answer state.
export default function QuizStep({ step, context, value, setValue, next, busy, skipText, view, onCheckout }) {
  const t = text => personalize(text, context);
  const options = step.options || [];
  const choice = step.type === 'single' || (step.type === 'intro' && options.length > 0);
  const feedback = feedbackFor(step, value);
  const instant = choice && step.autoAdvance !== false && !hasOptionFeedback(step);
  const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0);
  const blocked = (choice || step.type === 'multiple') && step.required !== false && empty;
  const question = QUESTION_TYPES.includes(step.type);

  function select(option) {
    if (step.type === 'multiple') {
      const selected = Array.isArray(value) ? value : [];
      setValue(selected.includes(option.id) ? selected.filter(id => id !== option.id)
        : option.exclusive ? [option.id] : [...selected.filter(id => !options.find(o => o.id === id)?.exclusive), option.id]);
    } else { setValue(option.id); if (instant) next(option.id); }
  }

  return <form className={`quiz-step is-${step.type}`} onSubmit={e => { e.preventDefault(); next(); }}>
    <fieldset disabled={busy}>
      <StepImage step={step} t={t} layout="top" />
      <StepImage step={step} t={t} layout="side" />
      {step.sideImageUrl && <img className="quiz-side-image" src={step.sideImageUrl} alt="" />}
      {step.type !== 'loading' && <>
        <h1 className="quiz-title">{t(step.title)}</h1>
        {step.description && <p className="quiz-description">{t(step.description)}</p>}
      </>}
      {step.videoUrl && <video controls preload="metadata" src={step.videoUrl} aria-label={t(step.title)} />}

      {options.length > 0 && ['intro', 'single', 'multiple'].includes(step.type) && <Options step={step} value={value} onSelect={select} t={t} instant={instant} />}
      {step.type === 'loading' && <><h1 className="quiz-title">{t(step.title)}</h1><Loading step={step} t={t} onDone={() => next(null)} />{step.description && <p className="quiz-description">{t(step.description)}</p>}</>}
      {step.type === 'number' && <label className="quiz-number"><span className="sr-only">{t(step.inputLabel) || t(step.title)}</span>
        <input type="number" inputMode="decimal" step="any" min={step.min} max={step.max} placeholder={t(step.placeholder) || '0'} value={value ?? ''} onChange={e => setValue(e.target.value === '' ? '' : Number(e.target.value))} />
        {step.suffix && <span className="quiz-number-suffix">{t(step.suffix)}</span>}
      </label>}
      {step.type === 'measure' && <div className="quiz-measure">
        {step.units.length > 1 && <div className="quiz-units" role="group" aria-label="Unidad">{step.units.map(u => <button type="button" key={u.id} aria-pressed={(value?.unit || step.units[0].id) === u.id} onClick={() => setValue({ value: value?.value ?? '', unit: u.id })}>{u.label}</button>)}</div>}
        <label className="quiz-number"><span className="sr-only">{t(step.title)}</span>
          <input type="number" inputMode="decimal" step="any" placeholder={t(step.placeholder) || '0'} value={value?.value ?? ''} onChange={e => setValue({ unit: value?.unit || step.units[0].id, value: e.target.value === '' ? '' : Number(e.target.value) })} />
          <span className="quiz-number-suffix">{step.units.find(u => u.id === (value?.unit || step.units[0].id))?.label}</span>
        </label>
      </div>}
      {['text', 'date'].includes(step.type) && <label className="quiz-field"><span className="sr-only">{t(step.inputLabel) || t(step.title)}</span>
        {step.type === 'text' ? <textarea rows={3} maxLength={2000} placeholder={t(step.placeholder)} value={value ?? ''} onChange={e => setValue(e.target.value)} />
          : <input type="date" min={step.minDate} max={step.maxDate} value={value ?? ''} onChange={e => setValue(e.target.value)} />}
      </label>}
      {step.type === 'contact' && <div className="quiz-contact">
        <label className="quiz-field"><span>Nombre{step.nameRequired ? '' : ' (opcional)'}</span><input autoComplete="given-name" maxLength={120} required={step.nameRequired} placeholder="Tu nombre" value={value?.name || ''} onChange={e => setValue({ ...value, name: e.target.value })} /></label>
        <label className="quiz-field"><span>Email{step.emailRequired ? '' : ' (opcional)'}</span><input type="email" autoComplete="email" maxLength={254} required={step.emailRequired} placeholder="tu@email.com" value={value?.email || ''} onChange={e => setValue({ ...value, email: e.target.value })} /></label>
        {step.consentText && <label className="quiz-consent"><input type="checkbox" checked={value?.consent === true} onChange={e => setValue({ ...value, consent: e.target.checked })} />{t(step.consentText)}</label>}
      </div>}

      <div aria-live="polite"><FeedbackCard feedback={feedback} t={t} /></div>
      <QuizBlocks blocks={step.blocks} context={context} view={view} onCheckout={onCheckout} />
      <StepImage step={step} t={t} layout="hero-bottom" />

      {!instant && step.type !== 'loading' && <div className="quiz-cta-bar"><button className="quiz-primary" type="submit" disabled={blocked}>{busy ? 'Guardando…' : t(step.buttonText) || 'Continuar'}</button></div>}
      {question && step.required === false && <button type="button" className="quiz-skip" onClick={() => next(null)}>{skipText || 'Omitir'}</button>}
    </fieldset>
  </form>;
}
