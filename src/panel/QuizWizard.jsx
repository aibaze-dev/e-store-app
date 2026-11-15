import { useState } from 'react';
import { ArrowLeft, ArrowRight, LoaderCircle, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { ErrorAlert, Field } from '@/components/Field.jsx';
import { errorText } from '@/lib/format.js';
import { QuizPreview } from '@/storefront/Quiz.jsx';

const QUESTIONS = [
  { key: 'audience', label: '¿Para quién es este quiz?', placeholder: 'Personas que quieren aprender a usar IA y no saben por dónde empezar.' },
  { key: 'goal', label: '¿Qué querés descubrir de esa persona?', placeholder: 'Su experiencia, qué le cuesta y para qué quiere usar IA, para presentarle mi guía.' },
];

export default function QuizWizard({ quiz, view, disabled, onGenerate, onApply, onBusy }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ audience: '', goal: '', tone: 'Cercano', length: 7 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState(null);
  const [preview, setPreview] = useState(false);
  const question = QUESTIONS[step];
  const set = (key, value) => setAnswers(current => ({ ...current, [key]: value }));
  const run = async operation => {
    setBusy(true); onBusy(true); setError('');
    try { await operation(); }
    catch (failure) { setError(errorText(failure, 'No se pudo generar el quiz. Podés seguir editándolo a mano.')); }
    finally { setBusy(false); onBusy(false); }
  };
  const submit = event => {
    event.preventDefault();
    if (busy) return;
    if (step < QUESTIONS.length) { setStep(step + 1); return; }
    run(async () => setProposal(await onGenerate({ ...answers, quiz, mode: 'replace' })));
  };

  if (!open) return <div className="landing-wizard is-closed qe-ai-card">
    <Sparkles aria-hidden="true" />
    <div><strong>Generá tu quiz con IA</strong><p>Contanos para quién es. Armamos las preguntas, los textos y el resultado usando tu producto.</p></div>
    <Button type="button" disabled={disabled || !onGenerate} onClick={() => setOpen(true)}><Sparkles aria-hidden="true" />Generar con IA</Button>
  </div>;

  return <section className="landing-wizard qe-ai-card" aria-busy={busy}>
    <div className="landing-wizard-header">
      <div><h2>Generá tu quiz con IA</h2><span>{proposal ? 'Revisá tu nuevo quiz' : `Paso ${step + 1} de 3`}</span></div>
      <Button type="button" variant="ghost" size="icon" aria-label="Cerrar asistente" disabled={busy} onClick={() => setOpen(false)}><X aria-hidden="true" /></Button>
    </div>
    {proposal ? <div className="qe-stack">
      <p>La propuesta reemplaza el recorrido del borrador. La versión publicada sigue igual hasta que publiques los cambios.</p>
      <ol className="qe-proposal-list">{proposal.steps.map(s => <li key={s.id}>{s.title}</li>)}</ol>
      <Button type="button" variant="outline" onClick={() => setPreview(!preview)}>{preview ? 'Cerrar vista previa' : 'Probar propuesta'}</Button>
      {preview && <QuizPreview quiz={proposal} view={view} />}
      <div className="qe-actions">
        <Button disabled={busy} onClick={() => run(async () => { await onApply(proposal); setProposal(null); setPreview(false); setOpen(false); setStep(0); })}>{busy ? 'Guardando…' : 'Usar y guardar borrador'}</Button>
        <Button variant="outline" disabled={busy} onClick={() => { setProposal(null); setPreview(false); }}>Volver a generar</Button>
        <Button variant="ghost" disabled={busy} onClick={() => { setProposal(null); setOpen(false); }}>Descartar</Button>
      </div>
    </div> : <form onSubmit={submit}>
      <div className="landing-wizard-progress" role="progressbar" aria-label="Avance del asistente" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1}><span style={{ width: `${(step + 1) / 3 * 100}%` }} /></div>
      {question ? <Field key={question.key} label={question.label}>{ids => <Textarea {...ids} autoFocus required maxLength={1500} placeholder={question.placeholder} value={answers[question.key]} disabled={busy} onChange={e => set(question.key, e.target.value)} />}</Field> : <>
        <Field label="¿Cuántas preguntas?">{ids => <NativeSelect {...ids} value={answers.length} onChange={e => set('length', Number(e.target.value))} disabled={busy}><option value={5}>Corto · 5 preguntas</option><option value={7}>Recomendado · 7 preguntas</option><option value={12}>Completo · 12 preguntas</option></NativeSelect>}</Field>
        <Field label="Tono">{ids => <NativeSelect {...ids} value={answers.tone} onChange={e => set('tone', e.target.value)} disabled={busy}><option>Cercano</option><option>Profesional</option><option>Enérgico</option></NativeSelect>}</Field>
        <p className="qe-hint">Usamos {view?.offer.main.name || 'el producto de tu tienda'}. Conservamos tu marca y las secciones comerciales compatibles. La propuesta crea un recorrido nuevo, sin arrastrar reglas ni cálculos anteriores. Podés revisarla antes de guardar.</p>
      </>}
      <div className="qe-actions qe-wizard-actions">
        <Button type="button" variant="ghost" disabled={busy || step === 0} onClick={() => setStep(step - 1)}><ArrowLeft aria-hidden="true" />Anterior</Button>
        <Button type="submit" disabled={busy || !onGenerate}>{step < QUESTIONS.length ? <>Siguiente<ArrowRight aria-hidden="true" /></> : <>{busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}{busy ? 'Generando tu quiz…' : 'Generar quiz'}</>}</Button>
      </div>
    </form>}
    <ErrorAlert>{error}</ErrorAlert>
  </section>;
}
