import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, Clipboard, HandHelping, Lightbulb, ListChecks, MessageCircle, MessagesSquare, Pause, PenLine, Play, Printer, RotateCcw, Scale, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useLanguage, useStrings } from '../i18n.js';
import { LanguageSwitcher } from '../LanguageControls.jsx';
import { STRINGS } from './strings.js';
import { SCENARIOS, scenarioFor, emptyForm, validateForm, buildCard, cardBlocks, cardText, rehearsalPrompt } from './templates.js';
import { newTimer, startTimer, pauseTimer, tickTimer, timerLabel } from './timer.js';
import './styles.css';

const icons = { idea: Lightbulb, update: ListChecks, disagree: Scale, support: HandHelping, brainstorm: MessagesSquare, conversation: MessageCircle };
const STEP_KEYS = [null, 'audience', 'outcome', 'point', 'facts', 'ask'];
const EDIT_FIELDS = ['audience', 'outcome', 'opening', 'point', 'ask', 'closing'];

function CopyButton({ text, label }) {
  const t = useStrings(STRINGS);
  const [status, setStatus] = useState('idle');
  const fallbackRef = useRef(null);
  useEffect(() => { setStatus('idle'); }, [text]);
  useEffect(() => { if (status === 'failed') { fallbackRef.current?.focus(); fallbackRef.current?.select(); } }, [status]);
  async function copy() {
    setStatus('copying');
    try { await navigator.clipboard.writeText(text); setStatus('copied'); }
    catch { setStatus('failed'); }
  }
  return <div className="mp-copy-control"><Button type="button" disabled={status === 'copying'} onClick={copy}>{status === 'copied' ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}{status === 'copied' ? t.copied : status === 'copying' ? t.copying : label}</Button>
    <span role="status" className="mp-copy-status">{status === 'copied' ? t.copiedStatus : status === 'failed' ? t.copyManual : ''}</span>
    {status === 'failed' && <textarea ref={fallbackRef} readOnly value={text} aria-label={t.manually(label)} className="mp-copy-fallback" />}
  </div>;
}

function CardContent({ card }) {
  const t = useStrings(STRINGS);
  const { lang } = useLanguage();
  return <article className="mp-card-content">
    <header className="mp-card-heading"><p className="mp-eyebrow">{scenarioFor(card.scenario, lang).label}</p><h2>{t.yourCard}</h2></header>
    <div className="mp-card-context">{card.audience.trim() && <p><strong>{t.who}</strong><span>{card.audience}</span></p>}<p><strong>{t.goal}</strong><span>{card.outcome}</span></p></div>
    <div className="mp-card-blocks">{cardBlocks(card, lang).map(([title, value]) => <section className="mp-card-block" key={title}><h3>{title}</h3><p>{value}</p></section>)}</div>
  </article>;
}

function Practice({ card, onBack }) {
  const t = useStrings(STRINGS);
  const [timer, setTimer] = useState(newTimer);
  const [now, setNow] = useState(Date.now);
  const headingRef = useRef(null);
  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => {
    if (timer.status !== 'running') return;
    const tick = () => { const time = Date.now(); setNow(time); setTimer(previous => tickTimer(previous, time)); };
    const interval = setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); };
  }, [timer.status]);
  function toggle() {
    const time = Date.now(); setNow(time);
    setTimer(previous => previous.status === 'running' ? pauseTimer(previous, time) : startTimer(previous, time));
  }
  return <main className="mp-practice"><div className="mp-practice-tools"><Button variant="ghost" onClick={onBack}><ChevronLeft aria-hidden="true" />{t.backToCard}</Button><span className="mp-eyebrow">{t.practiceEyebrow}</span></div>
    <div className="mp-practice-layout"><section className="mp-timer-panel"><h1 ref={headingRef} tabIndex={-1}>{t.practiceTitle}</h1><p>{t.practiceText}</p>
      <div className="mp-clock" role="timer" aria-label={t.timeRemaining} aria-live="off">{timerLabel(timer, now)}</div>
      <p className="mp-timer-status" role="status">{timer.status === 'finished' ? t.timeUp : timer.status === 'paused' ? t.paused : timer.status === 'running' ? t.running : t.idle}</p>
      <div className="mp-timer-actions">{timer.status !== 'finished' && <Button onClick={toggle}>{timer.status === 'running' ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{timer.status === 'running' ? t.pause : timer.status === 'paused' ? t.continuePractice : t.startPractice}</Button>}<Button variant="outline" onClick={() => { setTimer(newTimer()); setNow(Date.now()); }}><RotateCcw aria-hidden="true" />{t.resetTimer}</Button></div><p className="mp-footnote">{t.noRecording}</p>
    </section><div className="mp-card"><CardContent card={card} /></div></div>
  </main>;
}

export default function MeetingPrep() {
  const t = useStrings(STRINGS);
  const { lang, locale, brandName } = useLanguage();
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(0);
  const [view, setView] = useState('wizard');
  const [card, setCard] = useState(null);
  const [builtFrom, setBuiltFrom] = useState('');
  const [builtLang, setBuiltLang] = useState(lang);
  const [edited, setEdited] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const cancelRef = useRef(null);
  const headingRef = useRef(null);
  const inputRef = useRef(null);
  const scenario = scenarioFor(form.scenario, lang);
  const key = STEP_KEYS[step];
  const optional = [1, 4, 5].includes(step);
  const titles = [...t.titles, scenario.pointQuestion, scenario.factsQuestion, scenario.askQuestion];
  const hints = t.hints;
  const labels = t.labels;
  const CategoryIcon = icons[scenario.id];
  const changed = card && builtFrom !== JSON.stringify(form);
  const setAnswer = patch => { setForm(previous => ({ ...previous, ...patch })); setError(''); };

  useEffect(() => {
    if (step || view !== 'wizard') (inputRef.current || headingRef.current)?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [step, view]);

  function confirmIf(condition, details, action) { if (condition) setConfirmation({ ...details, action }); else action(); }
  function clearCard() { setCard(null); setBuiltFrom(''); setEdited(false); setEditing(false); setError(''); }
  function reset() {
    confirmIf(step > 0 || !!card, { title: t.resetTitle, description: t.resetText, label: t.resetLabel }, () => { setForm(emptyForm()); clearCard(); setStep(0); setView('wizard'); });
  }
  function example() {
    const hasAnswers = ['audience', 'outcome', 'point', 'ask'].some(field => form[field].trim()) || form.facts.some(fact => fact.trim()) || !!card;
    confirmIf(hasAnswers, { title: t.exampleTitle, description: t.exampleText, label: t.exampleLabel }, () => {
      setForm({ scenario: scenario.id, ...scenario.example, facts: [...scenario.example.facts] }); clearCard(); setStep(1); requestAnimationFrame(() => inputRef.current?.focus());
    });
  }
  function advance(event) {
    event.preventDefault();
    if (!step) return;
    const errors = validateForm(form, lang);
    if (errors[key]) { setError(errors[key]); inputRef.current?.focus(); return; }
    if (step < 5) { setStep(step + 1); setError(''); return; }
    const missing = Object.keys(errors)[0];
    if (missing) { setStep(STEP_KEYS.indexOf(missing)); setError(errors[missing]); return; }
    confirmIf(edited, { title: t.rebuildTitle, description: t.rebuildText, label: t.rebuildLabel }, () => {
      setCard(buildCard(form, lang)); setBuiltLang(lang); setBuiltFrom(JSON.stringify(form)); setEdited(false); setEditing(false); setError(''); setView('card');
    });
  }
  function editCard(patch) { setCard(previous => ({ ...previous, ...patch })); setEdited(true); }

  return <div className="mp-app" lang={lang}><div className="mp-screen">
    <header className="mp-topbar"><div className="mp-brand"><span className="mp-brand-icon"><MessagesSquare aria-hidden="true" /></span><span>{brandName}<span className="mp-brand-divider">/</span><span className="mp-brand-subtitle">{t.subtitle}</span></span></div><div className="mp-topbar-actions"><span className="mp-topbar-note">{t.tagline}</span><LanguageSwitcher /></div></header>
    {view === 'wizard' && <form className="mp-wizard" onSubmit={advance} noValidate onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.requestSubmit(); } }}>
      <main className={`mp-question${step === 0 ? ' mp-category-question' : ''}`}>
        <div className="mp-step-meta"><span className="mp-eyebrow">{step === 0 ? t.startEyebrow : <><CategoryIcon aria-hidden="true" />{scenario.label}</>}</span><span className="mp-step-label">{t.stepOf(step + 1)}{optional && t.optional}</span></div>
        <h1 id="mp-question-title" ref={headingRef} tabIndex={-1}>{titles[step]}</h1><p className="mp-description">{hints[step]}</p>
        {step === 0 ? <><div className="mp-categories" role="group" aria-label={t.chooseSituation}>{SCENARIOS.map(base => { const item = scenarioFor(base.id, lang); const Icon = icons[item.id]; return <button key={item.id} type="button" className="mp-category" onClick={() => { setAnswer({ scenario: item.id }); setStep(1); }}><span className="mp-category-icon"><Icon aria-hidden="true" /></span><strong>{item.label}</strong><span>{item.description}</span></button>; })}</div><p className="mp-category-note">{t.categoryNote}</p></> : <div className="mp-answer">
          {key === 'facts' ? <div className="mp-facts-inputs">{form.facts.map((fact, index) => <div key={index} className="mp-field"><Label htmlFor={`mp-fact-${index}`}>{t.fact(index + 1)}</Label><Textarea id={`mp-fact-${index}`} ref={index === 0 ? inputRef : undefined} value={fact} className="mp-input" maxLength={1500} placeholder={scenario.example.facts[index]} onChange={event => setAnswer({ facts: form.facts.map((value, i) => i === index ? event.target.value : value) })} /></div>)}</div> : <><Label className="mp-sr-only" htmlFor={`mp-${key}`}>{labels[key]}</Label><Textarea ref={inputRef} key={key} id={`mp-${key}`} className="mp-answer-input" value={form[key]} maxLength={3000} required={!optional} aria-invalid={!!error} aria-describedby={error ? 'mp-error' : 'mp-answer-hint'} placeholder={scenario.example[key]} onChange={event => setAnswer({ [key]: event.target.value })} /><div className="mp-answer-meta"><span id="mp-answer-hint">{optional ? t.optionalHint : t.requiredHint}</span><span>{form[key].length.toLocaleString(locale)} / {(3000).toLocaleString(locale)}</span></div></>}
          {error && <p id="mp-error" role="alert" className="mp-error">{error}</p>}
          {step === 1 && <Button type="button" variant="ghost" className="mp-example" onClick={example}>{t.tryExample}</Button>}
        </div>}
        {step > 0 && <div className="mp-next-row"><Button type="submit">{step === 5 ? <><ListChecks aria-hidden="true" />{card ? t.rebuildCard : t.buildCard}</> : <>{t.continue}<Check aria-hidden="true" /></>}</Button>{optional && step < 5 && (key === 'facts' ? form.facts.every(fact => !fact.trim()) : !form[key].trim()) && <Button type="button" variant="ghost" onClick={() => { setError(''); setStep(step + 1); }}>{t.skip}</Button>}</div>}
        {card && <Button variant="ghost" type="button" className="mp-return-card" onClick={() => setView('card')}>{t.viewCard}</Button>}
      </main>
      <footer className="mp-wizard-footer"><div className="mp-footer-inner"><div className="mp-footer-actions"><Button variant="ghost" type="button" disabled={step === 0} onClick={() => { setStep(step - 1); setError(''); }}><ChevronLeft aria-hidden="true" />{t.back}</Button>{step > 0 && <Button variant="ghost" type="button" onClick={reset}>{t.startOver}</Button>}</div><div className="mp-progress-group"><span>{t.stepLong(step + 1)}</span><progress value={step + 1} max={6} aria-label={t.progress} /></div></div><p>{t.nothingSaved}</p></footer>
    </form>}

    {view === 'card' && card && <main className="mp-result-page"><div className="mp-result-intro"><p className="mp-eyebrow">{t.resultEyebrow}</p><h1 ref={headingRef} tabIndex={-1}>{t.resultTitle}</h1><p>{t.resultText}</p></div>
      {changed ? <p className="mp-notice" role="status">{t.changed}</p> : builtLang !== lang && <p className="mp-notice" role="status">{t.otherLanguage}</p>}
      <div className="mp-result-layout"><div className="mp-card"><div className="mp-card-toolbar"><span>{edited ? t.editedByYou : t.builtFromAnswers}</span><Button variant="ghost" onClick={() => setEditing(!editing)}><PenLine aria-hidden="true" />{editing ? t.doneEditing : t.editCard}</Button></div>
        {editing ? <div className="mp-card-editor"><h2>{t.editTitle}</h2><p>{t.editText}</p>{EDIT_FIELDS.map(field => <div className="mp-field" key={field}><Label htmlFor={`mp-edit-${field}`}>{t.edit[field]}</Label><Textarea className="mp-input" id={`mp-edit-${field}`} value={card[field]} maxLength={4000} onChange={event => editCard({ [field]: event.target.value })} /></div>)}<fieldset><legend>{t.myFacts}</legend>{Array.from({ length: 3 }, (_, index) => <div className="mp-field" key={index}><Label htmlFor={`mp-edit-fact-${index}`}>{t.fact(index + 1)}</Label><Textarea className="mp-input" id={`mp-edit-fact-${index}`} value={card.facts[index] || ''} maxLength={1500} onChange={event => { const facts = Array.from({ length: 3 }, (_, i) => card.facts[i] || ''); facts[index] = event.target.value; editCard({ facts }); }} /></div>)}</fieldset></div> : <CardContent card={card} />}
      </div><aside className="mp-card-actions" aria-label={t.useCard}><h2>{t.makeItYours}</h2><p>{t.makeItYoursText}</p><CopyButton text={cardText(card, lang)} label={t.copyCard} /><Button variant="outline" onClick={() => window.print()}><Printer aria-hidden="true" />{t.print}</Button><div className="mp-action-divider" /><Button onClick={() => setView('practice')}><Timer aria-hidden="true" />{t.practice60}</Button><Button variant="outline" onClick={() => setView('rehearse')}><MessagesSquare aria-hidden="true" />{t.rehearse}</Button><p className="mp-footnote">{t.rehearseNote}</p></aside></div>
      <div className="mp-result-bottom"><Button variant="outline" onClick={() => { setView('wizard'); setStep(1); setError(''); }}><PenLine aria-hidden="true" />{t.editAnswers}</Button><Button variant="ghost" onClick={reset}><RotateCcw aria-hidden="true" />{t.startOver}</Button></div><p className="mp-footnote">{t.templatesNote}</p>
    </main>}
    {view === 'practice' && card && <Practice card={card} onBack={() => setView('card')} />}
    {view === 'rehearse' && card && <main className="mp-rehearsal"><Button variant="ghost" onClick={() => setView('card')}><ChevronLeft aria-hidden="true" />{t.backToCard}</Button><p className="mp-eyebrow">{t.rehearseEyebrow}</p><h1 ref={headingRef} tabIndex={-1}>{t.rehearseTitle}</h1><p>{t.rehearseText}</p><Label htmlFor="mp-rehearsal-prompt">{t.rehearsalPrompt}</Label><textarea id="mp-rehearsal-prompt" className="mp-rehearsal-prompt" readOnly value={rehearsalPrompt(card, lang)} /><CopyButton text={rehearsalPrompt(card, lang)} label={t.copyRehearsal} /><p className="mp-footnote">{t.noConnection}</p></main>}
    <Dialog open={!!confirmation} onOpenChange={open => { if (!open) setConfirmation(null); }}><DialogContent className="artifact-theme artifact-meeting-prep mp-confirm-dialog" lang={lang} closeLabel={t.close} onOpenAutoFocus={event => { event.preventDefault(); cancelRef.current?.focus(); }}><DialogTitle>{confirmation?.title}</DialogTitle><DialogDescription>{confirmation?.description}</DialogDescription><div className="mp-confirm-actions"><Button variant="outline" ref={cancelRef} onClick={() => setConfirmation(null)}>{t.cancel}</Button><Button onClick={() => { const action = confirmation.action; setConfirmation(null); action(); }}>{confirmation?.label}</Button></div></DialogContent></Dialog>
  </div>{card && <div className="mp-print-sheet"><CardContent card={card} /></div>}</div>;
}
