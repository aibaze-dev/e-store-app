import { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, Clipboard, HandHelping, Lightbulb, ListChecks, MessageCircle, MessagesSquare, Pause, PenLine, Play, Printer, RotateCcw, Scale, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import brand from '@/config/brandData.json';
import { SCENARIOS, scenarioFor, emptyForm, validateForm, buildCard, cardBlocks, cardText, rehearsalPrompt } from './templates.js';
import { newTimer, startTimer, pauseTimer, tickTimer, timerLabel } from './timer.js';
import './styles.css';

const icons = { idea: Lightbulb, update: ListChecks, disagree: Scale, support: HandHelping, brainstorm: MessagesSquare, conversation: MessageCircle };
const STEP_KEYS = [null, 'audience', 'outcome', 'point', 'facts', 'ask'];
const EDIT_FIELDS = [['audience', 'Who I’m speaking with'], ['outcome', 'My goal'], ['opening', 'My opening'], ['point', 'My main point'], ['ask', 'My ask'], ['closing', 'My closing']];

function CopyButton({ text, label }) {
  const [status, setStatus] = useState('idle');
  const fallbackRef = useRef(null);
  useEffect(() => { setStatus('idle'); }, [text]);
  useEffect(() => { if (status === 'failed') { fallbackRef.current?.focus(); fallbackRef.current?.select(); } }, [status]);
  async function copy() {
    setStatus('copying');
    try { await navigator.clipboard.writeText(text); setStatus('copied'); }
    catch { setStatus('failed'); }
  }
  return <div className="mp-copy-control"><Button type="button" disabled={status === 'copying'} onClick={copy}>{status === 'copied' ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}{status === 'copied' ? 'Copied!' : status === 'copying' ? 'Copying…' : label}</Button>
    <span role="status" className="mp-copy-status">{status === 'copied' ? 'Copied to your clipboard.' : status === 'failed' ? 'Copy manually: select the text below and use Ctrl+C, ⌘C, or your device’s Copy menu.' : ''}</span>
    {status === 'failed' && <textarea ref={fallbackRef} readOnly value={text} aria-label={`${label} manually`} className="mp-copy-fallback" />}
  </div>;
}

function CardContent({ card }) {
  return <article className="mp-card-content">
    <header className="mp-card-heading"><p className="mp-eyebrow">{scenarioFor(card.scenario).label}</p><h2>Your meeting card</h2></header>
    <div className="mp-card-context">{card.audience.trim() && <p><strong>Who I’m speaking with</strong><span>{card.audience}</span></p>}<p><strong>My goal</strong><span>{card.outcome}</span></p></div>
    <div className="mp-card-blocks">{cardBlocks(card).map(([title, value]) => <section className="mp-card-block" key={title}><h3>{title}</h3><p>{value}</p></section>)}</div>
  </article>;
}

function Practice({ card, onBack }) {
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
  return <main className="mp-practice"><div className="mp-practice-tools"><Button variant="ghost" onClick={onBack}><ChevronLeft aria-hidden="true" />Back to my card</Button><span className="mp-eyebrow">A LITTLE PRACTICE GOES A LONG WAY</span></div>
    <div className="mp-practice-layout"><section className="mp-timer-panel"><h1 ref={headingRef} tabIndex={-1}>Make it sound like you.</h1><p>Say your opening, main point, and ask out loud. Keep your card nearby.</p>
      <div className="mp-clock" role="timer" aria-label="Time remaining" aria-live="off">{timerLabel(timer, now)}</div>
      <p className="mp-timer-status" role="status">{timer.status === 'finished' ? 'Time’s up. Try again or return to your card.' : timer.status === 'paused' ? 'Paused. Continue when you’re ready.' : timer.status === 'running' ? 'You have the floor.' : 'Your 60 seconds start when you’re ready.'}</p>
      <div className="mp-timer-actions">{timer.status !== 'finished' && <Button onClick={toggle}>{timer.status === 'running' ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}{timer.status === 'running' ? 'Pause' : timer.status === 'paused' ? 'Continue practice' : 'Start practice'}</Button>}<Button variant="outline" onClick={() => { setTimer(newTimer()); setNow(Date.now()); }}><RotateCcw aria-hidden="true" />Reset timer</Button></div><p className="mp-footnote">No microphone, recording, or scoring. Just time to rehearse.</p>
    </section><div className="mp-card"><CardContent card={card} /></div></div>
  </main>;
}

export default function MeetingPrep() {
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(0);
  const [view, setView] = useState('wizard');
  const [card, setCard] = useState(null);
  const [builtFrom, setBuiltFrom] = useState('');
  const [edited, setEdited] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const cancelRef = useRef(null);
  const headingRef = useRef(null);
  const inputRef = useRef(null);
  const scenario = scenarioFor(form.scenario);
  const key = STEP_KEYS[step];
  const optional = [1, 4, 5].includes(step);
  const titles = ['What’s your situation?', 'Who will you be speaking with?', 'What do you want to achieve?', scenario.pointQuestion, scenario.factsQuestion, scenario.askQuestion];
  const hints = ['Choose the conversation you want to feel ready for.', 'A name isn’t necessary. Their role and your relationship are enough.', 'Think about the decision, agreement, or change you want to leave with.', 'If they remember just one thing, what should it be?', 'Use observations, examples, or numbers you know. Up to three is plenty.', 'Make it easy for the other person to understand what you need.'];
  const labels = { audience: 'Who I’m speaking with', outcome: 'Desired outcome', point: 'My main point', ask: 'My request' };
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
    confirmIf(step > 0 || !!card, { title: 'Start fresh?', description: 'Your answers and meeting card will be cleared. Copy or print anything you want to keep first.', label: 'Start over' }, () => { setForm(emptyForm()); clearCard(); setStep(0); setView('wizard'); });
  }
  function example() {
    const hasAnswers = ['audience', 'outcome', 'point', 'ask'].some(field => form[field].trim()) || form.facts.some(fact => fact.trim()) || !!card;
    confirmIf(hasAnswers, { title: 'Use this example?', description: 'This replaces your current answers and card with a complete example for this situation.', label: 'Use example' }, () => {
      setForm({ scenario: scenario.id, ...scenario.example, facts: [...scenario.example.facts] }); clearCard(); setStep(1); requestAnimationFrame(() => inputRef.current?.focus());
    });
  }
  function advance(event) {
    event.preventDefault();
    if (!step) return;
    const errors = validateForm(form);
    if (errors[key]) { setError(errors[key]); inputRef.current?.focus(); return; }
    if (step < 5) { setStep(step + 1); setError(''); return; }
    const missing = Object.keys(errors)[0];
    if (missing) { setStep(STEP_KEYS.indexOf(missing)); setError(errors[missing]); return; }
    confirmIf(edited, { title: 'Replace your edited card?', description: 'Rebuilding uses your answers and replaces changes made directly to the card.', label: 'Rebuild card' }, () => {
      setCard(buildCard(form)); setBuiltFrom(JSON.stringify(form)); setEdited(false); setEditing(false); setError(''); setView('card');
    });
  }
  function editCard(patch) { setCard(previous => ({ ...previous, ...patch })); setEdited(true); }

  return <div className="mp-app" lang="en"><div className="mp-screen">
    <header className="mp-topbar"><div className="mp-brand"><span className="mp-brand-icon"><MessagesSquare aria-hidden="true" /></span><span>{brand.artifactBrandName}<span className="mp-brand-divider">/</span><span className="mp-brand-subtitle">MEETING PREP</span></span></div><span className="mp-topbar-note">A clearer point. A calmer start.</span></header>
    {view === 'wizard' && <form className="mp-wizard" onSubmit={advance} noValidate onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.requestSubmit(); } }}>
      <main className={`mp-question${step === 0 ? ' mp-category-question' : ''}`}>
        <div className="mp-step-meta"><span className="mp-eyebrow">{step === 0 ? 'BE READY FOR THE CONVERSATION' : <><CategoryIcon aria-hidden="true" />{scenario.label}</>}</span><span className="mp-step-label">{step + 1} of 6{optional && ' · Optional'}</span></div>
        <h1 id="mp-question-title" ref={headingRef} tabIndex={-1}>{titles[step]}</h1><p className="mp-description">{hints[step]}</p>
        {step === 0 ? <><div className="mp-categories" role="group" aria-label="Choose your situation">{SCENARIOS.map(item => { const Icon = icons[item.id]; return <button key={item.id} type="button" className="mp-category" onClick={() => { setAnswer({ scenario: item.id }); setStep(1); }}><span className="mp-category-icon"><Icon aria-hidden="true" /></span><strong>{item.label}</strong><span>{item.description}</span></button>; })}</div><p className="mp-category-note">A few questions. Your own talking points. Room to practice.</p></> : <div className="mp-answer">
          {key === 'facts' ? <div className="mp-facts-inputs">{form.facts.map((fact, index) => <div key={index} className="mp-field"><Label htmlFor={`mp-fact-${index}`}>Supporting fact {index + 1}</Label><Textarea id={`mp-fact-${index}`} ref={index === 0 ? inputRef : undefined} value={fact} className="mp-input" maxLength={1500} placeholder={scenario.example.facts[index]} onChange={event => setAnswer({ facts: form.facts.map((value, i) => i === index ? event.target.value : value) })} /></div>)}</div> : <><Label className="mp-sr-only" htmlFor={`mp-${key}`}>{labels[key]}</Label><Textarea ref={inputRef} key={key} id={`mp-${key}`} className="mp-answer-input" value={form[key]} maxLength={3000} required={!optional} aria-invalid={!!error} aria-describedby={error ? 'mp-error' : 'mp-answer-hint'} placeholder={scenario.example[key]} onChange={event => setAnswer({ [key]: event.target.value })} /><div className="mp-answer-meta"><span id="mp-answer-hint">{optional ? 'Include what’s helpful. You can leave this blank.' : 'Your words are enough. We’ll give them a clear place on your card.'}</span><span>{form[key].length.toLocaleString('en-US')} / 3,000</span></div></>}
          {error && <p id="mp-error" role="alert" className="mp-error">{error}</p>}
          {step === 1 && <Button type="button" variant="ghost" className="mp-example" onClick={example}>Need a starting point? Try a complete example.</Button>}
        </div>}
        {step > 0 && <div className="mp-next-row"><Button type="submit">{step === 5 ? <><ListChecks aria-hidden="true" />{card ? 'Rebuild my card' : 'Build my meeting card'}</> : <>Continue<Check aria-hidden="true" /></>}</Button>{optional && step < 5 && (key === 'facts' ? form.facts.every(fact => !fact.trim()) : !form[key].trim()) && <Button type="button" variant="ghost" onClick={() => { setError(''); setStep(step + 1); }}>Skip this question</Button>}</div>}
        {card && <Button variant="ghost" type="button" className="mp-return-card" onClick={() => setView('card')}>View existing card</Button>}
      </main>
      <footer className="mp-wizard-footer"><div className="mp-footer-inner"><div className="mp-footer-actions"><Button variant="ghost" type="button" disabled={step === 0} onClick={() => { setStep(step - 1); setError(''); }}><ChevronLeft aria-hidden="true" />Back</Button>{step > 0 && <Button variant="ghost" type="button" onClick={reset}>Start over</Button>}</div><div className="mp-progress-group"><span>Step {step + 1} of 6</span><progress value={step + 1} max={6} aria-label="Meeting preparation progress" /></div></div><p>Nothing is saved. Copy or print your card before leaving.</p></footer>
    </form>}

    {view === 'card' && card && <main className="mp-result-page"><div className="mp-result-intro"><p className="mp-eyebrow">YOUR WORDS. A CLEAR WAY FORWARD.</p><h1 ref={headingRef} tabIndex={-1}>Walk in with a plan.</h1><p>Keep this card nearby. You don’t need to memorize every word.</p></div>
      {changed && <p className="mp-notice" role="status">Your answers changed. This is your existing card; edit your answers and rebuild when you’re ready.</p>}
      <div className="mp-result-layout"><div className="mp-card"><div className="mp-card-toolbar"><span>{edited ? 'Edited by you' : 'Built from your answers'}</span><Button variant="ghost" onClick={() => setEditing(!editing)}><PenLine aria-hidden="true" />{editing ? 'Done editing' : 'Edit card'}</Button></div>
        {editing ? <div className="mp-card-editor"><h2>Edit your meeting card</h2><p>Changes apply immediately to copying, printing, and rehearsal.</p>{EDIT_FIELDS.map(([field, label]) => <div className="mp-field" key={field}><Label htmlFor={`mp-edit-${field}`}>{label}</Label><Textarea className="mp-input" id={`mp-edit-${field}`} value={card[field]} maxLength={4000} onChange={event => editCard({ [field]: event.target.value })} /></div>)}<fieldset><legend>My supporting facts</legend>{Array.from({ length: 3 }, (_, index) => <div className="mp-field" key={index}><Label htmlFor={`mp-edit-fact-${index}`}>Supporting fact {index + 1}</Label><Textarea className="mp-input" id={`mp-edit-fact-${index}`} value={card.facts[index] || ''} maxLength={1500} onChange={event => { const facts = Array.from({ length: 3 }, (_, i) => card.facts[i] || ''); facts[index] = event.target.value; editCard({ facts }); }} /></div>)}</fieldset></div> : <CardContent card={card} />}
      </div><aside className="mp-card-actions" aria-label="Use your meeting card"><h2>Make it yours.</h2><p>Take it into the meeting, or give yourself a minute to rehearse.</p><CopyButton text={cardText(card)} label="Copy meeting card" /><Button variant="outline" onClick={() => window.print()}><Printer aria-hidden="true" />Print / Save PDF</Button><div className="mp-action-divider" /><Button onClick={() => setView('practice')}><Timer aria-hidden="true" />Practice for 60 seconds</Button><Button variant="outline" onClick={() => setView('rehearse')}><MessagesSquare aria-hidden="true" />Rehearse with Claude</Button><p className="mp-footnote">Rehearsal with Claude gives you a prompt to paste yourself. No AI runs here.</p></aside></div>
      <div className="mp-result-bottom"><Button variant="outline" onClick={() => { setView('wizard'); setStep(1); setError(''); }}><PenLine aria-hidden="true" />Edit answers</Button><Button variant="ghost" onClick={reset}><RotateCcw aria-hidden="true" />Start over</Button></div><p className="mp-footnote">Built with templates, using your words. No facts are invented. Your card stays only in this page.</p>
    </main>}
    {view === 'practice' && card && <Practice card={card} onBack={() => setView('card')} />}
    {view === 'rehearse' && card && <main className="mp-rehearsal"><Button variant="ghost" onClick={() => setView('card')}><ChevronLeft aria-hidden="true" />Back to my card</Button><p className="mp-eyebrow">ONE MORE WAY TO PRACTICE</p><h1 ref={headingRef} tabIndex={-1}>Try the conversation with Claude.</h1><p>Copy this prompt and paste it into Claude yourself. It includes your current card and asks for one question at a time, followed by feedback.</p><Label htmlFor="mp-rehearsal-prompt">Your rehearsal prompt</Label><textarea id="mp-rehearsal-prompt" className="mp-rehearsal-prompt" readOnly value={rehearsalPrompt(card)} /><CopyButton text={rehearsalPrompt(card)} label="Copy rehearsal prompt" /><p className="mp-footnote">This tool doesn’t connect to Claude or send your information anywhere.</p></main>}
    <Dialog open={!!confirmation} onOpenChange={open => { if (!open) setConfirmation(null); }}><DialogContent className="artifact-theme artifact-meeting-prep mp-confirm-dialog" lang="en" closeLabel="Close" onOpenAutoFocus={event => { event.preventDefault(); cancelRef.current?.focus(); }}><DialogTitle>{confirmation?.title}</DialogTitle><DialogDescription>{confirmation?.description}</DialogDescription><div className="mp-confirm-actions"><Button variant="outline" ref={cancelRef} onClick={() => setConfirmation(null)}>Cancel</Button><Button onClick={() => { const action = confirmation.action; setConfirmation(null); action(); }}>{confirmation?.label}</Button></div></DialogContent></Dialog>
  </div>{card && <div className="mp-print-sheet"><CardContent card={card} /></div>}</div>;
}
