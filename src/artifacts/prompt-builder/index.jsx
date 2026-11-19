import { useEffect, useRef, useState } from 'react';
import { Braces, Check, ChevronDown, ChevronLeft, Clipboard, History, ListChecks, Mail, PenLine, RotateCcw, Save, Search, SlidersHorizontal, Table2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import brand from '@/config/brandData.json';
import { buildPrompt, contextChecklist, EMPTY_FORM, FORMATS, LENGTHS, TASKS, TONES, taskFor } from './builder.js';
import { deletePrompt, HISTORY_KEY, readHistory, savePrompt } from './history.js';
import { EXAMPLES } from './examples.js';
import './styles.css';

const icons = { email: Mail, writing: PenLine, research: Search, planning: ListChecks, analysis: Table2, general: SlidersHorizontal };
const categoryDescriptions = { email: 'Follow-ups, replies & outreach', writing: 'Drafts, updates & better wording', research: 'Questions, comparisons & discovery', planning: 'Projects, priorities & next steps', analysis: 'Data, decisions & takeaways', general: 'Something a little different' };
const QUESTIONS = [
  { title: 'What are we working on?', description: 'Pick a starting point. We’ll shape the questions around your task.' },
  { key: 'task', title: 'What do you want to get done?', label: 'Your task', description: 'Write it in your own words. A rough sentence is a good start.', limit: 4000 },
  { key: 'context', title: 'Give us a little background.', label: 'Background', description: 'What’s happening? Include the facts the assistant would otherwise have to guess.', limit: 6000 },
  { key: 'audience', title: 'Who is this for?', label: 'Audience', description: 'Think about who will read or use the answer, and what they already know.', limit: 1500 },
  { key: 'outcome', title: 'What would a great result do?', label: 'Success looks like', description: 'A useful prompt tells the assistant what success actually looks like.', limit: 2000 },
  { key: 'resources', title: 'Anything to work from?', label: 'Reference material', description: 'Paste notes, facts, examples, or links. This tool includes links in your prompt; it doesn’t open them.', limit: 20000 },
  { key: 'constraints', title: 'Any must-haves or no-gos?', label: 'Boundaries & must-haves', description: 'Add specific requirements, limits, or things the answer should avoid.', limit: 4000 },
  { title: 'Make the answer feel right.', description: 'Choose the tone, format, and amount of detail you want back.' },
];
const LAST_STEP = QUESTIONS.length - 1;
const RESULT_STEP = QUESTIONS.length;

export default function PromptBuilder() {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [step, setStep] = useState(0);
  const [output, setOutput] = useState('');
  const [generatedFrom, setGeneratedFrom] = useState('');
  const [edited, setEdited] = useState(false);
  const [copyState, setCopyState] = useState('idle');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [showExamples, setShowExamples] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [activeEntry, setActiveEntry] = useState(null);
  const [savedOutput, setSavedOutput] = useState(null);
  const cancelRef = useRef(null);
  const inputRef = useRef(null);
  const headingRef = useRef(null);
  const outputRef = useRef(null);
  const preset = taskFor(form.category);
  const question = QUESTIONS[step];
  const isResult = step === RESULT_STEP;
  const optional = step >= 2 && step < LAST_STEP;
  const changed = !!generatedFrom && generatedFrom !== JSON.stringify(form);
  const CategoryIcon = icons[preset.id];
  const update = patch => { setForm(previous => ({ ...previous, ...patch })); setError(''); };

  function refreshHistory() {
    try { setHistory(readHistory()); setStorageError(''); }
    catch { setStorageError('Saved prompts could not be read. Browser storage may be unavailable or the saved data may be damaged. Your current prompt is still available to copy.'); }
  }
  useEffect(() => {
    refreshHistory();
    const onStorage = event => { if (event.key === HISTORY_KEY || event.key === null) refreshHistory(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const isSaved = !!activeEntry && savedOutput === output && history.some(entry => entry.id === activeEntry.id && entry.output === output);

  function persist(entry) {
    try {
      setHistory(savePrompt(entry)); setActiveEntry(entry); setSavedOutput(entry.output); setStorageError('');
    } catch {
      setStorageError('This prompt could not be saved. Browser storage may be full or unavailable. Copy it to keep a backup, or try saving again.');
    }
  }
  function saveCurrent() {
    const now = Date.now();
    persist({ id: activeEntry?.id || crypto.randomUUID(), createdAt: activeEntry?.createdAt || now, updatedAt: now, form: JSON.parse(generatedFrom), output });
  }
  function openSaved(entry) {
    const apply = () => {
      setForm({ ...entry.form }); setOutput(entry.output); setGeneratedFrom(JSON.stringify(entry.form));
      setEdited(entry.output !== buildPrompt(entry.form)); setActiveEntry(entry); setSavedOutput(entry.output);
      setCopyState('idle'); setError(''); setStep(RESULT_STEP); setShowHistory(false);
    };
    const draft = !generatedFrom && ['task', 'context', 'audience', 'outcome', 'resources', 'constraints'].some(key => form[key].trim());
    if (draft || changed || (generatedFrom && !isSaved)) {
      setConfirmation({ title: 'Open a saved prompt?', description: 'Your unsaved answers or prompt edits will be replaced. Saved prompts will stay in your history.', label: 'Open prompt', action: apply });
    } else apply();
  }
  function removeSaved(entry) {
    setConfirmation({ title: 'Delete this prompt?', description: 'This removes it from this browser’s saved prompts. This cannot be undone.', label: 'Delete prompt', action: () => {
      try {
        setHistory(deletePrompt(entry.id)); setStorageError('');
        if (activeEntry?.id === entry.id) { setActiveEntry(null); setSavedOutput(null); }
      } catch { setStorageError('This prompt could not be deleted. Please try again when browser storage is available.'); }
    } });
  }

  useEffect(() => {
    if (step > 0) (inputRef.current || headingRef.current)?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [step, showHistory]);

  function clearOutput() { setOutput(''); setGeneratedFrom(''); setEdited(false); setCopyState('idle'); setError(''); setActiveEntry(null); setSavedOutput(null); }
  function chooseCategory(category) {
    update({ category: category.id, ...(category.id !== form.category ? { format: category.format } : {}) });
    setStep(1);
  }
  function loadExample(example) {
    setShowExamples(false);
    const apply = () => {
      setForm({ ...EMPTY_FORM, category: preset.id, format: preset.format, ...example.answers });
      clearOutput(); setStep(1); requestAnimationFrame(() => inputRef.current?.focus());
    };
    if (['task', 'context', 'audience', 'outcome', 'resources', 'constraints'].some(key => form[key].trim()) || output) {
      setConfirmation({ title: `Use “${example.title}”?`, description: 'This replaces your current answers and prompt with a complete sample task. Your saved prompts stay in your history.', label: 'Use example', action: apply });
    } else apply();
  }
  function reset() {
    const apply = () => { setForm({ ...EMPTY_FORM }); clearOutput(); setStep(0); setShowHistory(false); };
    if (Object.keys(EMPTY_FORM).some(key => form[key] !== EMPTY_FORM[key]) || output || step > 0) {
      setConfirmation({ title: 'Start fresh?', description: 'Your current answers and unsaved edits will be cleared. Saved prompts will stay in your history.', label: 'Start over', action: apply });
    } else apply();
  }
  function advance(event) {
    event.preventDefault();
    if (step === 0) return;
    if (!form.task.trim()) { setStep(1); setError('Describe the task you want help with first.'); inputRef.current?.focus(); return; }
    if (step < LAST_STEP) { setStep(step + 1); return; }
    const apply = () => {
      const prompt = buildPrompt(form);
      const now = Date.now();
      const entry = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, form: { ...form }, output: prompt };
      setActiveEntry(entry); setSavedOutput(null);
      setOutput(prompt); setGeneratedFrom(JSON.stringify(form)); setEdited(false); setCopyState('idle'); setError(''); setStep(RESULT_STEP);
      persist(entry);
    };
    if (edited) setConfirmation({ title: 'Replace your edited prompt?', description: 'Building again uses your current answers and replaces any changes you made directly to the prompt.', label: 'Replace prompt', action: apply });
    else apply();
  }
  async function copy() {
    setCopyState('copying');
    try { await navigator.clipboard.writeText(output); setCopyState('copied'); }
    catch { setCopyState('failed'); outputRef.current?.focus(); outputRef.current?.select(); }
  }

  return <div className="pb-app" lang="en">
    <header className="pb-topbar">
      <div className="pb-brand"><span className="pb-brand-mark"><Braces aria-hidden="true" /></span><span>{brand.shortName}<span className="pb-brand-divider">/</span><span className="pb-brand-subtitle">PROMPT BUILDER</span></span></div>
      <div className="pb-header-actions"><Button type="button" variant="ghost" className="pb-history-toggle" onClick={() => { refreshHistory(); setShowHistory(value => !value); }}><History aria-hidden="true" />{showHistory ? 'Back to builder' : `Saved prompts (${history.length})`}</Button></div>
    </header>
    {storageError && <div className="pb-storage-error" role="alert"><p>{storageError}</p><Button type="button" variant="outline" onClick={refreshHistory}>Retry history</Button></div>}

    {showHistory ? <main className="pb-history-page">
      <div className="pb-history-heading"><div><p className="pb-eyebrow">YOUR PERSONAL PROMPT LIBRARY</p><h1 ref={headingRef} tabIndex={-1}>Saved prompts</h1><p>Stored in this browser, ready when you need them.</p></div><Button type="button" className="pb-primary" onClick={reset}>New prompt</Button></div>
      {history.length === 0 ? <div className="pb-history-empty"><History aria-hidden="true" /><h2>{storageError ? 'History is unavailable' : 'Your next good prompt belongs here.'}</h2><p>{storageError ? 'Try reading your history again. Existing data has not been replaced.' : 'Build a prompt and it will be saved automatically. You can reopen or delete it here.'}</p></div> : <ul className="pb-history-list">{history.map(entry => <li key={entry.id} className="pb-history-item"><div className="pb-history-item-copy"><p className="pb-history-meta">{taskFor(entry.form.category).label} · <time dateTime={new Date(entry.updatedAt).toISOString()}>{new Date(entry.updatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</time></p><h2>{entry.form.task}</h2><p className="pb-history-excerpt">{entry.output}</p></div><div className="pb-history-item-actions"><Button type="button" variant="outline" onClick={() => openSaved(entry)}>Open prompt</Button><Button type="button" variant="ghost" aria-label={`Delete prompt: ${entry.form.task}`} onClick={() => removeSaved(entry)}><Trash2 aria-hidden="true" />Delete</Button></div></li>)}</ul>}
      <p className="pb-honesty">History is local to this browser and website. It is not synced to an account or other devices. Clearing this site’s browser data also removes saved prompts.</p>
    </main> : !isResult ? <form className="pb-wizard" onSubmit={advance} noValidate onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.requestSubmit(); } }}>
      <main className={`pb-question${step === 0 ? ' pb-category-question' : ''}`}>
        <div className="pb-step-meta"><span className="pb-eyebrow">{step === 0 ? 'GOOD PROMPTS START WITH A CLEAR TASK' : <><CategoryIcon aria-hidden="true" />{preset.label}</>}</span><span className="pb-step-label">{step + 1} of {QUESTIONS.length}{optional && ' · Optional'}</span></div>
        <h1 ref={headingRef} tabIndex={-1} id="pb-question-title">{question.title}</h1>
        <p className="pb-question-description">{question.description}</p>

        {step === 0 && <div className="pb-categories" role="group" aria-label="Choose your task type">{TASKS.map(task => {
          const Icon = icons[task.id];
          return <button className="pb-category" type="button" key={task.id} onClick={() => chooseCategory(task)}><span className="pb-category-icon"><Icon aria-hidden="true" /></span><strong>{task.label}</strong><span>{categoryDescriptions[task.id]}</span></button>;
        })}</div>}

        {question.key && <div className="pb-answer">
          <Label htmlFor={`pb-${question.key}`} className="pb-sr-only">{question.label}</Label>
          <Textarea key={question.key} id={`pb-${question.key}`} ref={inputRef} className={`pb-answer-input${['audience', 'outcome'].includes(question.key) ? ' pb-short-answer' : ''}`} value={form[question.key]} maxLength={question.limit} required={step === 1} aria-invalid={step === 1 && !!error} aria-describedby={error ? 'pb-task-error' : 'pb-answer-hint'} placeholder={step === 1 ? preset.placeholder : preset.example[question.key] || 'Paste your notes, source material, or links here…'} onChange={event => update({ [question.key]: event.target.value })} />
          <div className="pb-answer-meta"><span id="pb-answer-hint">{step === 1 ? 'Be specific about the action and the result.' : 'Only include what’s useful. You can leave this blank.'}</span><span>{form[question.key].length.toLocaleString('en-US')} / {question.limit.toLocaleString('en-US')}</span></div>
          {error && <p id="pb-task-error" className="pb-error" role="alert">{error}</p>}
          {step === 1 && <Button type="button" variant="ghost" className="pb-example" onClick={() => setShowExamples(true)}>Need a starting point? Explore {EXAMPLES[preset.id].length} examples.</Button>}
        </div>}

        {step === LAST_STEP && <div className="pb-preferences">{[['tone', 'Tone', TONES], ['format', 'Format', FORMATS], ['length', 'Detail', LENGTHS]].map(([name, label, options]) => <div className="pb-field" key={name}><Label htmlFor={`pb-${name}`}>{label}</Label><div className="pb-select-wrap"><select id={`pb-${name}`} value={form[name]} onChange={event => update({ [name]: event.target.value })}>{options.map(option => <option key={option}>{option}</option>)}</select><ChevronDown aria-hidden="true" /></div></div>)}</div>}

        {step > 0 && <div className="pb-next-row"><Button type="submit" className="pb-primary">{step === LAST_STEP ? <><Braces aria-hidden="true" />{generatedFrom ? 'Rebuild my prompt' : 'Build my prompt'}</> : 'Continue'}{step < LAST_STEP && <Check aria-hidden="true" />}</Button>{optional && !form[question.key].trim() ? <Button type="button" variant="ghost" className="pb-skip" onClick={() => { setError(''); setStep(step + 1); }}>Skip this question</Button> : <span className="pb-keyboard">or press ⌘ / Ctrl + Enter</span>}</div>}
        {generatedFrom && <Button type="button" variant="ghost" className="pb-return-prompt" onClick={() => setStep(RESULT_STEP)}>View existing prompt</Button>}
        {step === 0 && <p className="pb-category-note">A few guided questions. One prompt you can actually use.</p>}
      </main>

      <footer className="pb-wizard-footer">
        <div className="pb-footer-inner"><div className="pb-footer-actions"><Button type="button" variant="ghost" className="pb-back" disabled={step === 0} onClick={() => { setStep(step - 1); setError(''); }}><ChevronLeft aria-hidden="true" />Back</Button>{step > 0 && <Button type="button" variant="ghost" className="pb-start-over" onClick={reset}>Start over</Button>}</div><div className="pb-progress-group"><span>Step {step + 1} of {QUESTIONS.length}</span><progress className="pb-progress" value={step + 1} max={QUESTIONS.length} aria-label="Prompt builder progress" /></div></div>
        <p>Completed prompts are saved in this browser. Unfinished answers are not saved.</p>
      </footer>
    </form> : <main className="pb-result-page">
      <div className="pb-result-intro"><span className="pb-eyebrow"><Check aria-hidden="true" />READY TO PUT TO WORK</span><h1 ref={headingRef} tabIndex={-1}>Your prompt is ready.</h1><p>Built from your answers. Make it yours, then take it to your favorite AI assistant.</p></div>
      <section className="pb-result" aria-label="Your generated prompt">
        <div className="pb-result-header"><span><CategoryIcon aria-hidden="true" />{preset.label}{preset.label !== form.format && <><span className="pb-result-separator">/</span>{form.format}</>}</span><span className="pb-editable-label"><PenLine aria-hidden="true" />Editable</span></div>
        <Label className="pb-sr-only" htmlFor="pb-output">Your editable prompt</Label>
        <textarea id="pb-output" ref={outputRef} className="pb-output" value={output} spellCheck={false} aria-describedby="pb-output-help" onChange={event => { setOutput(event.target.value); setEdited(true); setCopyState('idle'); }} />
        {changed && <p className="pb-result-notice" role="status">Your answers changed. Go back and rebuild to include them.</p>}
        <div className="pb-result-footer"><span id="pb-output-help">{edited ? 'Manually edited. Rebuilding replaces your edits.' : 'Review the details before you use it.'}</span><Button type="button" className="pb-primary" disabled={!output.trim() || copyState === 'copying'} onClick={copy}>{copyState === 'copied' ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}{copyState === 'copied' ? 'Copied!' : copyState === 'copying' ? 'Copying…' : 'Copy prompt'}</Button></div>
        <p className={`pb-copy-message${copyState === 'failed' ? ' pb-copy-failed' : ''}`} role="status">{copyState === 'failed' ? 'Could not copy automatically. Your prompt is selected: press Ctrl+C or ⌘C, or use your device’s Copy menu.' : copyState === 'copied' ? 'Prompt copied to your clipboard.' : ''}</p>
      </section>
      <div className="pb-save-row"><span role="status">{isSaved ? 'Saved in this browser' : 'Unsaved changes'}</span>{!isSaved && <Button type="button" variant="outline" onClick={saveCurrent}><Save aria-hidden="true" />{activeEntry && history.some(entry => entry.id === activeEntry.id) ? 'Save changes' : 'Save prompt'}</Button>}</div>
      <div className="pb-result-actions"><Button type="button" variant="outline" onClick={() => setStep(1)}><PenLine aria-hidden="true" />Edit answers</Button><Button type="button" variant="ghost" onClick={reset}><RotateCcw aria-hidden="true" />Start over</Button></div>
      <div className="pb-checklist" aria-label="Included context">{contextChecklist(form).map(item => <span key={item.label} className={item.complete ? 'is-complete' : ''}><Check aria-hidden="true" />{item.label}{!item.complete && ' not provided'}</span>)}</div>
      <p className="pb-honesty">Built with templates, not AI. Prompts are saved only in this browser. After editing the text, use Save changes to keep your edits.</p>
    </main>}

    <Dialog open={showExamples} onOpenChange={setShowExamples}>
      <DialogContent className="artifact-prompt-builder pb-examples-dialog" lang="en" closeLabel="Close examples">
        <DialogTitle>{preset.label} examples</DialogTitle>
        <DialogDescription>Pick a complete starting point, then make it yours. Each example fills in the task, context, audience, outcome, references, and constraints with sample answers.</DialogDescription>
        <div className="pb-example-options">{EXAMPLES[preset.id].map(example => <button key={example.id} type="button" className="pb-example-option" aria-label={`Use example: ${example.title}`} onClick={() => loadExample(example)}><strong>{example.title}</strong><span>{example.answers.task}</span><span className="pb-example-use">Use this example</span></button>)}</div>
      </DialogContent>
    </Dialog>
    <Dialog open={!!confirmation} onOpenChange={open => { if (!open) setConfirmation(null); }}>
      <DialogContent className="artifact-prompt-builder pb-confirm-dialog" lang="en" closeLabel="Close" onOpenAutoFocus={event => { event.preventDefault(); cancelRef.current?.focus(); }}>
        <DialogTitle>{confirmation?.title}</DialogTitle><DialogDescription>{confirmation?.description}</DialogDescription>
        <div className="pb-confirm-actions"><Button ref={cancelRef} type="button" variant="outline" onClick={() => setConfirmation(null)}>Cancel</Button><Button type="button" onClick={() => { const action = confirmation.action; setConfirmation(null); action(); }}>{confirmation?.label}</Button></div>
      </DialogContent>
    </Dialog>
  </div>;
}
