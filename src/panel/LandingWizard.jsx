import { useState } from 'react';
import { useAction } from 'convex/react';
import { ArrowLeft, ArrowRight, LoaderCircle, Sparkles, X } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText } from '@/lib/format.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { ErrorAlert, Field } from '@/components/Field.jsx';

const QUESTIONS = [
  { key: 'audience', label: '¿Para quién es tu ebook?', hint: 'Contá quién lo compra: edad, situación, nivel de experiencia.', placeholder: 'Personas de 25 a 40 años que cobran un sueldo y nunca invirtieron', required: true },
  { key: 'problem', label: '¿Qué problema le resuelve?', hint: 'Lo que hoy le molesta, le preocupa o no le sale.', placeholder: 'No llegan a fin de mes, no saben por dónde empezar y les da miedo perder plata', required: true },
  { key: 'result', label: '¿Qué logra después de leerlo?', hint: 'El cambio concreto y lo que encuentra adentro.', placeholder: 'Arman un presupuesto, un fondo de emergencia y hacen su primera inversión con un paso a paso', required: true },
  { key: 'differentiator', label: '¿Qué lo hace distinto? (opcional)', hint: 'Tu método, tu experiencia o lo que no ofrecen otros. Solo datos reales: se usan tal cual.', placeholder: 'Sin tecnicismos, con plantillas listas y ejemplos reales' },
];
const TONES = { cercano: 'Cercano', profesional: 'Profesional', energico: 'Enérgico' };
const EMPTY = { audience: '', problem: '', result: '', differentiator: '', tone: 'cercano', guaranteeDays: '' };
const LAST = QUESTIONS.length;

// A few questions that write the landing copy; the page then saves it as a draft.
export default function LandingWizard({ storeId, hasContent, disabled, onApply }) {
  const generate = useAction(api.landingWizard.generate);
  const [open, setOpen] = useState(!hasContent);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Focus follows the steps, but the page does not steal focus when it first loads.
  const [moved, setMoved] = useState(false);

  const set = (key, value) => setAnswers(current => ({ ...current, [key]: value }));
  const go = next => { setMoved(true); setError(''); setStep(next); };

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (step < LAST) return go(step + 1);
    setBusy(true); setError('');
    try {
      const { guaranteeDays, ...rest } = answers;
      await onApply(await generate({ storeId, answers: { ...rest, ...(guaranteeDays === '' ? {} : { guaranteeDays: Number(guaranteeDays) }) } }));
      setOpen(false); setStep(0);
    } catch (failure) { setError(errorText(failure, 'No se pudo generar la landing. Volvé a intentar.')); }
    finally { setBusy(false); }
  }

  if (!open) return <div className="landing-wizard is-closed">
    <Sparkles aria-hidden="true" />
    <div><strong>Generá tu landing con IA</strong><p>Respondé {LAST + 1} preguntas y armamos la landing completa, lista para revisar y publicar.</p></div>
    <Button type="button" variant="outline" disabled={disabled} onClick={() => { setMoved(true); setOpen(true); }}>{hasContent ? 'Volver a generar' : 'Empezar'}</Button>
  </div>;

  const question = QUESTIONS[step];
  return <form className="landing-wizard" onSubmit={submit} aria-busy={busy}>
    <div className="landing-wizard-header">
      <div><h2>Generá tu landing con IA</h2><span aria-live="polite">Paso {step + 1} de {LAST + 1}</span></div>
      <Button type="button" variant="ghost" size="icon" aria-label="Cerrar asistente" disabled={busy} onClick={() => setOpen(false)}><X aria-hidden="true" /></Button>
    </div>
    <div className="landing-wizard-progress" role="progressbar" aria-valuemin={1} aria-valuemax={LAST + 1} aria-valuenow={step + 1} aria-label="Avance del asistente"><span style={{ width: `${(step + 1) / (LAST + 1) * 100}%` }} /></div>
    {question
      ? <Field key={question.key} label={question.label} hint={question.hint}>{ids => <Textarea {...ids} value={answers[question.key]} onChange={event => set(question.key, event.target.value)} placeholder={question.placeholder} maxLength={600} required={question.required} disabled={busy} autoFocus={moved} />}</Field>
      : <>
        <Field label="Tono de los textos">{ids => <NativeSelect {...ids} autoFocus value={answers.tone} onChange={event => set('tone', event.target.value)} disabled={busy}>{Object.entries(TONES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect>}</Field>
        <Field label="Días de garantía (opcional)" hint="Si lo dejás vacío, no escribimos ninguna garantía.">{ids => <Input {...ids} type="number" min="1" max="365" step="1" value={answers.guaranteeDays} onChange={event => set('guaranteeDays', event.target.value)} disabled={busy} />}</Field>
        <p className="text-xs leading-6 text-muted-foreground">Usamos también el nombre, la descripción, los bonos y el producto post-compra activo de esta tienda. {hasContent ? 'Se reemplazan los textos de presentación, beneficios, problemas, pasos, preguntas, cierre, promoción y actividad, los encabezados de testimonios y las secciones de post-compra. ' : 'La IA redacta también los textos de promoción y actividad, los encabezados de testimonios y las secciones de post-compra. '} Las conversaciones reales, métricas, cupos, fechas, URL del video VSL y opciones activadas se conservan, al igual que imágenes, precios, color y enlaces. Al terminar la guardamos como borrador{hasContent ? ', junto con los cambios sin guardar del formulario' : ''}; no se publica hasta que vos lo decidas.</p>
      </>}
    <ErrorAlert>{error}</ErrorAlert>
    <div className="flex flex-wrap justify-between gap-3">
      <Button type="button" variant="ghost" disabled={busy || step === 0} onClick={() => go(step - 1)}><ArrowLeft aria-hidden="true" />Anterior</Button>
      <Button type="submit" disabled={busy}>{step < LAST ? <>Siguiente<ArrowRight aria-hidden="true" /></> : <>{busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}{busy ? 'Generando la landing…' : 'Generar landing'}</>}</Button>
    </div>
  </form>;
}
