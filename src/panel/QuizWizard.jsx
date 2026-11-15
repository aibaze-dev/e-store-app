import { useState } from 'react';
import { ArrowLeft, ArrowRight, LoaderCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { ErrorAlert, Field } from '@/components/Field.jsx';
import { errorText } from '@/lib/format.js';
import { QuizPreview } from '@/storefront/Quiz.jsx';
import { generateQuizImages, quizImages } from './quiz-images.js';

const QUESTIONS = [
  { key: 'audience', label: '¿Para quién es este quiz?', placeholder: 'Personas que quieren aprender a usar IA y no saben por dónde empezar.' },
  { key: 'goal', label: '¿Qué querés descubrir de esa persona?', placeholder: 'Su experiencia, qué le cuesta y para qué quiere usar IA, para presentarle mi guía.' },
];

export default function QuizWizard({ quiz, view, disabled, onGenerate, onGenerateImage, onApply, onBusy, open, onOpenChange: setOpen }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({ audience: '', goal: '', tone: 'Cercano', length: 7 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState(null);
  const [preview, setPreview] = useState(false);
  const [progress, setProgress] = useState('');
  const question = QUESTIONS[step];
  const set = (key, value) => setAnswers(current => ({ ...current, [key]: value }));
  const run = async operation => {
    setBusy(true); onBusy(true); setError('');
    try { await operation(); }
    catch (failure) { setError(errorText(failure, 'No se pudo generar el quiz. Podés seguir editándolo a mano.')); }
    finally { setBusy(false); onBusy(false); setProgress(''); }
  };
  const createImages = async next => {
    const result = await generateQuizImages(next, onGenerateImage, ({ quiz: current, completed, total }) => {
      setProposal(current);
      setProgress(`Creando imágenes: ${completed} de ${total} procesadas…`);
    });
    setProposal(result.quiz);
    if (result.failed) setError(`Quedaron ${result.failed} imágenes pendientes. Podés reintentarlas sin volver a generar los textos ni las imágenes terminadas.`);
  };
  const submit = event => {
    event.preventDefault();
    if (busy) return;
    if (step < QUESTIONS.length) { setStep(step + 1); return; }
    run(async () => {
      setProgress('Escribiendo las preguntas y preparando las imágenes…');
      const next = await onGenerate({ ...answers, quiz, mode: 'replace' });
      setProposal(next);
      await createImages(next);
    });
  };
  const images = quizImages(proposal);
  const missing = images.filter(image => !image.node.imageUrl).length;

  if (!open) return <div className="landing-wizard is-closed qe-ai-card">
    <Sparkles aria-hidden="true" />
    <div><strong>Generá tu quiz con IA</strong><p>Contanos para quién es. Creamos las preguntas, los textos y las imágenes usando tu producto.</p></div>
    <Button type="button" disabled={disabled || !onGenerate} onClick={() => setOpen(true)}><Sparkles aria-hidden="true" />Generar con IA</Button>
  </div>;

  return <section className="landing-wizard qe-ai-card" aria-busy={busy}>
    <div className="landing-wizard-header">
      <div><h2>Generá tu quiz con IA</h2><span>{proposal ? 'Revisá tu nuevo quiz' : `Paso ${step + 1} de 3`}</span></div>
      <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Editar a mano</Button>
    </div>
    {progress && <p role="status" className="qe-hint">{progress}</p>}
    {proposal ? <div className="qe-stack">
      <p>La propuesta reemplaza el recorrido del borrador. La versión publicada sigue igual hasta que publiques los cambios.</p>
      <ol className="qe-proposal-list">{proposal.steps.map(s => <li key={s.id}>{s.title}</li>)}</ol>
      {images.length > 0 && <div className="qe-generated-images" aria-label="Imágenes del quiz">{images.map(image => <figure key={image.key}>
        {image.node.imageUrl ? <img src={image.node.imageUrl} alt={image.node.imageAlt || image.title} /> : <div className="qe-image-pending">{busy ? 'Creando imagen…' : 'Imagen pendiente'}</div>}
        <figcaption>{image.title}</figcaption>
      </figure>)}</div>}
      {!busy && missing > 0 && <Button type="button" variant="outline" onClick={() => run(() => createImages(proposal))}>Reintentar imágenes pendientes ({missing})</Button>}
      <Button type="button" variant="outline" onClick={() => setPreview(!preview)}>{preview ? 'Cerrar vista previa' : 'Probar propuesta'}</Button>
      {preview && <QuizPreview quiz={proposal} view={view} />}
      <div className="qe-actions">
        <Button disabled={busy} onClick={() => run(async () => { await onApply(proposal); setProposal(null); setPreview(false); setOpen(false); setStep(0); })}>{busy ? progress ? 'Generando imágenes…' : 'Guardando…' : 'Usar y guardar borrador'}</Button>
        <Button variant="outline" disabled={busy} onClick={() => { setProposal(null); setPreview(false); }}>Volver a generar</Button>
        <Button variant="ghost" disabled={busy} onClick={() => { setProposal(null); setPreview(false); setOpen(false); }}>Descartar</Button>
      </div>
    </div> : <form onSubmit={submit}>
      <div className="landing-wizard-progress" role="progressbar" aria-label="Avance del asistente" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1}><span style={{ width: `${(step + 1) / 3 * 100}%` }} /></div>
      {question ? <Field key={question.key} label={question.label}>{ids => <Textarea {...ids} autoFocus={step > 0} required maxLength={1500} placeholder={question.placeholder} value={answers[question.key]} disabled={busy} onChange={e => set(question.key, e.target.value)} />}</Field> : <>
        <Field label="¿Cuántas preguntas?">{ids => <NativeSelect {...ids} value={answers.length} onChange={e => set('length', Number(e.target.value))} disabled={busy}><option value={5}>Corto · 5 preguntas</option><option value={7}>Recomendado · 7 preguntas</option><option value={12}>Completo · 12 preguntas</option></NativeSelect>}</Field>
        <Field label="Tono">{ids => <NativeSelect {...ids} value={answers.tone} onChange={e => set('tone', e.target.value)} disabled={busy}><option>Cercano</option><option>Profesional</option><option>Enérgico</option></NativeSelect>}</Field>
        <p className="qe-hint">También creamos imágenes para la portada, las preguntas y el resultado, con un estilo visual común. Conservamos las imágenes que ya cargaste en la portada y los bloques del resultado. La generación puede tardar unos minutos.</p>
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
