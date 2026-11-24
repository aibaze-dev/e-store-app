import { useEffect, useRef, useState } from 'react';
import { Braces, Check, ChevronDown, ChevronLeft, Clipboard, History, ListChecks, Mail, PenLine, RotateCcw, Save, Search, SlidersHorizontal, Table2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useLanguage, useStrings } from '../i18n.js';
import { LanguageSwitcher } from '../LanguageControls.jsx';
import { buildPrompt, contextChecklist, EMPTY_FORM, FORMATS, LENGTHS, optionLabel, TASKS, TONES, taskText } from './builder.js';
import { STRINGS } from './strings.js';
import { deletePrompt, HISTORY_KEY, readHistory, savePrompt } from './history.js';
import { examplesFor } from './examples.js';
import './styles.css';

const icons = { email: Mail, writing: PenLine, research: Search, planning: ListChecks, analysis: Table2, general: SlidersHorizontal };
const QUESTIONS = [
  {}, { key: 'task', limit: 4000 }, { key: 'context', limit: 6000 }, { key: 'audience', limit: 1500 },
  { key: 'outcome', limit: 2000 }, { key: 'resources', limit: 20000 }, { key: 'constraints', limit: 4000 }, {},
];
const LAST_STEP = QUESTIONS.length - 1;
const RESULT_STEP = QUESTIONS.length;

export default function PromptBuilder() {
  const t = useStrings(STRINGS);
  const { lang, locale, brandName } = useLanguage();
  const EXAMPLES = examplesFor(lang);
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
  const preset = taskText(form.category, lang);
  const question = { ...QUESTIONS[step], ...t.questions[step] };
  const isResult = step === RESULT_STEP;
  const optional = step >= 2 && step < LAST_STEP;
  const changed = !!generatedFrom && generatedFrom !== JSON.stringify(form);
  const otherLanguage = !!output && !!activeEntry?.form?.language && activeEntry.form.language !== lang;
  const CategoryIcon = icons[preset.id];
  const update = patch => { setForm(previous => ({ ...previous, ...patch })); setError(''); };

  function refreshHistory() {
    try { setHistory(readHistory()); setStorageError(''); }
    catch { setStorageError(t.readError); }
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
      setStorageError(t.saveError);
    }
  }
  function saveCurrent() {
    const now = Date.now();
    persist({ id: activeEntry?.id || crypto.randomUUID(), createdAt: activeEntry?.createdAt || now, updatedAt: now, form: { ...JSON.parse(generatedFrom), language: activeEntry?.form?.language || lang }, output });
  }
  function openSaved(entry) {
    const { language = 'en', ...saved } = entry.form;
    const apply = () => {
      setForm(saved); setOutput(entry.output); setGeneratedFrom(JSON.stringify(saved));
      setEdited(entry.output !== buildPrompt(saved, language)); setActiveEntry(entry); setSavedOutput(entry.output);
      setCopyState('idle'); setError(''); setStep(RESULT_STEP); setShowHistory(false);
    };
    const draft = !generatedFrom && ['task', 'context', 'audience', 'outcome', 'resources', 'constraints'].some(key => form[key].trim());
    if (draft || changed || (generatedFrom && !isSaved)) {
      setConfirmation({ title: t.openTitle, description: t.openText, label: t.openLabel, action: apply });
    } else apply();
  }
  function removeSaved(entry) {
    setConfirmation({ title: t.deleteTitle, description: t.deleteText, label: t.deleteLabel, action: () => {
      try {
        setHistory(deletePrompt(entry.id)); setStorageError('');
        if (activeEntry?.id === entry.id) { setActiveEntry(null); setSavedOutput(null); }
      } catch { setStorageError(t.deleteError); }
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
      setConfirmation({ title: t.exampleTitle(example.title), description: t.exampleText, label: t.exampleLabel, action: apply });
    } else apply();
  }
  function reset() {
    const apply = () => { setForm({ ...EMPTY_FORM }); clearOutput(); setStep(0); setShowHistory(false); };
    if (Object.keys(EMPTY_FORM).some(key => form[key] !== EMPTY_FORM[key]) || output || step > 0) {
      setConfirmation({ title: t.resetTitle, description: t.resetText, label: t.resetLabel, action: apply });
    } else apply();
  }
  function advance(event) {
    event.preventDefault();
    if (step === 0) return;
    if (!form.task.trim()) { setStep(1); setError(t.taskRequired); inputRef.current?.focus(); return; }
    if (step < LAST_STEP) { setStep(step + 1); return; }
    const apply = () => {
      const prompt = buildPrompt(form, lang);
      const now = Date.now();
      const entry = { id: crypto.randomUUID(), createdAt: now, updatedAt: now, form: { ...form, language: lang }, output: prompt };
      setActiveEntry(entry); setSavedOutput(null);
      setOutput(prompt); setGeneratedFrom(JSON.stringify(form)); setEdited(false); setCopyState('idle'); setError(''); setStep(RESULT_STEP);
      persist(entry);
    };
    if (edited) setConfirmation({ title: t.replaceTitle, description: t.replaceText, label: t.replaceLabel, action: apply });
    else apply();
  }
  async function copy() {
    setCopyState('copying');
    try { await navigator.clipboard.writeText(output); setCopyState('copied'); }
    catch { setCopyState('failed'); outputRef.current?.focus(); outputRef.current?.select(); }
  }

  return <div className="pb-app" lang={lang}>
    <header className="pb-topbar">
      <div className="pb-brand"><span className="pb-brand-mark"><Braces aria-hidden="true" /></span><span>{brandName}<span className="pb-brand-divider">/</span><span className="pb-brand-subtitle">{t.subtitle}</span></span></div>
      <div className="pb-header-actions"><Button type="button" variant="ghost" className="pb-history-toggle" onClick={() => { refreshHistory(); setShowHistory(value => !value); }}><History aria-hidden="true" />{showHistory ? t.backToBuilder : t.savedCount(history.length)}</Button><LanguageSwitcher /></div>
    </header>
    {storageError && <div className="pb-storage-error" role="alert"><p>{storageError}</p><Button type="button" variant="outline" onClick={refreshHistory}>{t.retryHistory}</Button></div>}

    {showHistory ? <main className="pb-history-page">
      <div className="pb-history-heading"><div><p className="pb-eyebrow">{t.libraryEyebrow}</p><h1 ref={headingRef} tabIndex={-1}>{t.savedPrompts}</h1><p>{t.storedHere}</p></div><Button type="button" onClick={reset}>{t.newPrompt}</Button></div>
      {history.length === 0 ? <div className="pb-history-empty"><History aria-hidden="true" /><h2>{storageError ? t.historyUnavailable : t.emptyHistory}</h2><p>{storageError ? t.historyRetry : t.historyEmptyText}</p></div> : <ul className="pb-history-list">{history.map(entry => <li key={entry.id} className="pb-history-item"><div className="pb-history-item-copy"><p className="pb-history-meta">{taskText(entry.form.category, lang).label} · <time dateTime={new Date(entry.updatedAt).toISOString()}>{new Date(entry.updatedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</time></p><h2>{entry.form.task}</h2><p className="pb-history-excerpt">{entry.output}</p></div><div className="pb-history-item-actions"><Button type="button" variant="outline" onClick={() => openSaved(entry)}>{t.openLabel}</Button><Button type="button" variant="ghost" aria-label={t.deleteAria(entry.form.task)} onClick={() => removeSaved(entry)}><Trash2 aria-hidden="true" />{t.delete}</Button></div></li>)}</ul>}
      <p className="pb-honesty">{t.historyHonesty}</p>
    </main> : !isResult ? <form className="pb-wizard" onSubmit={advance} noValidate onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.requestSubmit(); } }}>
      <main className={`pb-question${step === 0 ? ' pb-category-question' : ''}`}>
        <div className="pb-step-meta"><span className="pb-eyebrow">{step === 0 ? t.startEyebrow : <><CategoryIcon aria-hidden="true" />{preset.label}</>}</span><span className="pb-step-label">{t.stepOf(step + 1, QUESTIONS.length)}{optional && t.optional}</span></div>
        <h1 ref={headingRef} tabIndex={-1} id="pb-question-title">{question.title}</h1>
        <p className="pb-question-description">{question.description}</p>

        {step === 0 && <div className="pb-categories" role="group" aria-label={t.chooseTaskType}>{TASKS.map(task => {
          const Icon = icons[task.id];
          return <button className="pb-category" type="button" key={task.id} onClick={() => chooseCategory(task)}><span className="pb-category-icon"><Icon aria-hidden="true" /></span><strong>{taskText(task.id, lang).label}</strong><span>{t.categories[task.id]}</span></button>;
        })}</div>}

        {question.key && <div className="pb-answer">
          <Label htmlFor={`pb-${question.key}`} className="pb-sr-only">{question.label}</Label>
          <Textarea key={question.key} id={`pb-${question.key}`} ref={inputRef} className={`pb-answer-input${['audience', 'outcome'].includes(question.key) ? ' pb-short-answer' : ''}`} value={form[question.key]} maxLength={question.limit} required={step === 1} aria-invalid={step === 1 && !!error} aria-describedby={error ? 'pb-task-error' : 'pb-answer-hint'} placeholder={step === 1 ? preset.placeholder : preset.example[question.key] || t.pastePlaceholder} onChange={event => update({ [question.key]: event.target.value })} />
          <div className="pb-answer-meta"><span id="pb-answer-hint">{step === 1 ? t.taskHint : t.optionalHint}</span><span>{form[question.key].length.toLocaleString(locale)} / {question.limit.toLocaleString(locale)}</span></div>
          {error && <p id="pb-task-error" className="pb-error" role="alert">{error}</p>}
          {step === 1 && <Button type="button" variant="ghost" className="pb-example" onClick={() => setShowExamples(true)}>{t.exploreExamples(EXAMPLES[preset.id].length)}</Button>}
        </div>}

        {step === LAST_STEP && <div className="pb-preferences">{[['tone', t.tone, TONES, 'tones'], ['format', t.format, FORMATS, 'formats'], ['length', t.detail, LENGTHS, 'lengths']].map(([name, label, options, kind]) => <div className="pb-field" key={name}><Label htmlFor={`pb-${name}`}>{label}</Label><div className="pb-select-wrap"><select id={`pb-${name}`} value={form[name]} onChange={event => update({ [name]: event.target.value })}>{options.map(option => <option key={option} value={option}>{optionLabel(kind, option, lang)}</option>)}</select><ChevronDown aria-hidden="true" /></div></div>)}</div>}

        {step > 0 && <div className="pb-next-row"><Button type="submit">{step === LAST_STEP ? <><Braces aria-hidden="true" />{generatedFrom ? t.rebuild : t.build}</> : t.continue}{step < LAST_STEP && <Check aria-hidden="true" />}</Button>{optional && !form[question.key].trim() ? <Button type="button" variant="ghost" className="pb-skip" onClick={() => { setError(''); setStep(step + 1); }}>{t.skip}</Button> : <span className="pb-keyboard">{t.keyboard}</span>}</div>}
        {generatedFrom && <Button type="button" variant="ghost" className="pb-return-prompt" onClick={() => setStep(RESULT_STEP)}>{t.viewExisting}</Button>}
        {step === 0 && <p className="pb-category-note">{t.categoryNote}</p>}
      </main>

      <footer className="pb-wizard-footer">
        <div className="pb-footer-inner"><div className="pb-footer-actions"><Button type="button" variant="ghost" className="pb-back" disabled={step === 0} onClick={() => { setStep(step - 1); setError(''); }}><ChevronLeft aria-hidden="true" />{t.back}</Button>{step > 0 && <Button type="button" variant="ghost" className="pb-start-over" onClick={reset}>{t.startOver}</Button>}</div><div className="pb-progress-group"><span>{t.stepLong(step + 1, QUESTIONS.length)}</span><progress className="pb-progress" value={step + 1} max={QUESTIONS.length} aria-label={t.progress} /></div></div>
        <p>{t.footer}</p>
      </footer>
    </form> : <main className="pb-result-page">
      <div className="pb-result-intro"><span className="pb-eyebrow"><Check aria-hidden="true" />{t.readyEyebrow}</span><h1 ref={headingRef} tabIndex={-1}>{t.ready}</h1><p>{t.readyText}</p></div>
      <section className="pb-result" aria-label={t.generated}>
        <div className="pb-result-header"><span><CategoryIcon aria-hidden="true" />{preset.label}{preset.label !== optionLabel('formats', form.format, lang) && <><span className="pb-result-separator">/</span>{optionLabel('formats', form.format, lang)}</>}</span><span className="pb-editable-label"><PenLine aria-hidden="true" />{t.editable}</span></div>
        <Label className="pb-sr-only" htmlFor="pb-output">{t.editableLabel}</Label>
        <textarea id="pb-output" ref={outputRef} className="pb-output" value={output} spellCheck={false} aria-describedby="pb-output-help" onChange={event => { setOutput(event.target.value); setEdited(true); setCopyState('idle'); }} />
        {changed ? <p className="pb-result-notice" role="status">{t.answersChanged}</p> : otherLanguage && <p className="pb-result-notice" role="status">{t.otherLanguage}</p>}
        <div className="pb-result-footer"><span id="pb-output-help">{edited ? t.edited : t.review}</span><Button type="button" disabled={!output.trim() || copyState === 'copying'} onClick={copy}>{copyState === 'copied' ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}{copyState === 'copied' ? t.copied : copyState === 'copying' ? t.copying : t.copy}</Button></div>
        <p className={`pb-copy-message${copyState === 'failed' ? ' pb-copy-failed' : ''}`} role="status">{copyState === 'failed' ? t.copyFailed : copyState === 'copied' ? t.copiedMessage : ''}</p>
      </section>
      <div className="pb-save-row"><span role="status">{isSaved ? t.savedHere : t.unsaved}</span>{!isSaved && <Button type="button" variant="outline" onClick={saveCurrent}><Save aria-hidden="true" />{activeEntry && history.some(entry => entry.id === activeEntry.id) ? t.saveChanges : t.savePrompt}</Button>}</div>
      <div className="pb-result-actions"><Button type="button" variant="outline" onClick={() => setStep(1)}><PenLine aria-hidden="true" />{t.editAnswers}</Button><Button type="button" variant="ghost" onClick={reset}><RotateCcw aria-hidden="true" />{t.startOver}</Button></div>
      <div className="pb-checklist" aria-label={t.included}>{contextChecklist(form).map(item => <span key={item.label} className={item.complete ? 'is-complete' : ''}><Check aria-hidden="true" />{t.checklist[item.label] || item.label}{!item.complete && t.notProvided}</span>)}</div>
      <p className="pb-honesty">{t.resultHonesty}</p>
    </main>}

    <Dialog open={showExamples} onOpenChange={setShowExamples}>
      <DialogContent className="artifact-theme artifact-prompt-builder pb-examples-dialog" lang={lang} closeLabel={t.closeExamples}>
        <DialogTitle>{t.examplesTitle(preset.label)}</DialogTitle>
        <DialogDescription>{t.examplesText}</DialogDescription>
        <div className="pb-example-options">{EXAMPLES[preset.id].map(example => <button key={example.id} type="button" className="pb-example-option" aria-label={t.useExampleAria(example.title)} onClick={() => loadExample(example)}><strong>{example.title}</strong><span>{example.answers.task}</span><span className="pb-example-use">{t.useThis}</span></button>)}</div>
      </DialogContent>
    </Dialog>
    <Dialog open={!!confirmation} onOpenChange={open => { if (!open) setConfirmation(null); }}>
      <DialogContent className="artifact-theme artifact-prompt-builder pb-confirm-dialog" lang={lang} closeLabel={t.close} onOpenAutoFocus={event => { event.preventDefault(); cancelRef.current?.focus(); }}>
        <DialogTitle>{confirmation?.title}</DialogTitle><DialogDescription>{confirmation?.description}</DialogDescription>
        <div className="pb-confirm-actions"><Button ref={cancelRef} type="button" variant="outline" onClick={() => setConfirmation(null)}>{t.cancel}</Button><Button type="button" onClick={() => { const action = confirmation.action; setConfirmation(null); action(); }}>{confirmation?.label}</Button></div>
      </DialogContent>
    </Dialog>
  </div>;
}
