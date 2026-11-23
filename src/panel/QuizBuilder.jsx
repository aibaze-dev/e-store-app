import { useEffect, useRef, useState } from 'react';
import { ImageField, VideoField, UploadContext } from './ImageField.jsx';
export { ImageField, UploadContext };
import { ArrowDown, ArrowUp, CircleDot, Copy, Eye, EyeOff, Flag, GripVertical, Hash, LayoutList, LoaderCircle, Mail, Plus, RotateCcw, SquareCheck, Trash2, Type, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { fromMinor, toMinor } from '@/lib/format.js';
import { storefrontMoney } from '@/lib/storefront-money.js';
import { QuizPlayer } from '@/storefront/Quiz.jsx';
import { advanceSession, choiceRanges, clone, hasOptionFeedback, isRequired, newStep, orderErrors, QUESTION_TYPES, removeOption, removeStep } from '../../shared/quiz.js';
import { QField } from './QuizFields.jsx';
import { Blocks, GuaranteeFields, Toggle, blockNames, stepNames, uid } from './QuizAdvanced.jsx';

const TYPE_META = {
  single: { label: 'Una respuesta', icon: CircleDot, tone: 'blue' },
  multiple: { label: 'Varias respuestas', icon: SquareCheck, tone: 'violet' },
  info: { label: 'Solo texto', icon: Type, tone: 'amber' },
  number: { label: 'Número + feedback', icon: Hash, tone: 'teal' },
  measure: { label: 'Medida + feedback', icon: Hash, tone: 'teal' },
  loading: { label: 'Analizando…', icon: LoaderCircle, tone: 'pink' },
  contact: { label: 'Nombre y email', icon: Mail, tone: 'green' },
  intro: { label: 'Portada', icon: Flag, tone: 'slate' },
};
const meta = type => TYPE_META[type] || { label: stepNames[type] || type, icon: LayoutList, tone: 'slate' };
const ADD_TYPES = ['single', 'multiple', 'info', 'number', 'loading', 'contact'];
const TONES = [{ value: 'good', label: '🟢 Bien' }, { value: 'warn', label: '🟡 Atención' }, { value: 'bad', label: '🔴 Te pasaste' }, { value: 'info', label: '🔵 Dato' }];
const RESULT_BLOCKS = ['offer', 'guarantee', 'video', 'nowAfter', 'gauge', 'stats', 'planSummary', 'goals', 'features', 'rating', 'beforeAfter', 'faq', 'text', 'image'];
const RESULT = '$result';

function IconButton({ label, children, ...props }) {
  return <button type="button" className="qe-icon-button" aria-label={label} title={label} {...props}>{children}</button>;
}

function Segmented({ label, value, options, onChange }) {
  return <div className="qe-field"><span>{label}</span><div className="qe-segmented" role="radiogroup" aria-label={label}>
    {options.map(o => <button type="button" role="radio" aria-checked={value === o.value} key={o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
  </div></div>;
}

// Reorderable list: drag by the handle (native HTML5) or use the arrow buttons.
function Sortable({ items, getKey, onMove, render, label }) {
  const [armed, setArmed] = useState(null), [drag, setDrag] = useState(null), [over, setOver] = useState(null);
  const reset = () => { setArmed(null); setDrag(null); setOver(null); };
  function drop() {
    if (drag != null && over != null && over !== drag && over !== drag + 1) onMove(drag, over > drag ? over - 1 : over);
    reset();
  }
  return <ol className="qe-sortable" aria-label={label}>{items.map((item, i) => <li key={getKey(item)} draggable={armed === i}
    className={`${drag === i ? 'is-dragging' : ''} ${over === i ? 'is-drop-before' : ''} ${over === items.length && i === items.length - 1 ? 'is-drop-after' : ''}`}
    onDragStart={e => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
    onDragOver={e => { if (drag == null) return; e.preventDefault(); const box = e.currentTarget.getBoundingClientRect(); setOver(e.clientY < box.top + box.height / 2 ? i : i + 1); }}
    onDrop={e => { e.preventDefault(); drop(); }} onDragEnd={reset}>
    {render(item, i, { onPointerDown: () => setArmed(i), onPointerUp: () => setArmed(null) })}
  </li>)}</ol>;
}
const move = (list, from, to) => { const next = [...list]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; };

function AddMenu({ onPick, onClose }) {
  return <div className="qe-add-menu" role="menu">
    {ADD_TYPES.map(type => { const { icon: Icon, label, tone } = meta(type); return <button type="button" role="menuitem" key={type} className={`tone-${tone}`} onClick={() => onPick(type)}><Icon aria-hidden="true" />{label}</button>; })}
    <IconButton label="Cerrar" onClick={onClose}><X /></IconButton>
  </div>;
}

function Thumb({ step }) {
  const { icon: Icon, tone } = meta(step.type);
  const icon = step.options?.find(o => o.icon)?.icon;
  return <span className={`qe-thumb tone-${tone}`}>{step.imageUrl ? <img src={step.imageUrl} alt="" /> : icon ? <span>{icon}</span> : <Icon aria-hidden="true" />}</span>;
}

function Flow({ quiz, selected, onSelect, setSteps, setQuiz }) {
  const [adding, setAdding] = useState(null);
  const steps = quiz.steps;
  function insert(type, at) {
    const step = newStep(type, uid());
    if (type === 'single' || type === 'multiple') step.title = '¿Tu pregunta?';
    if (type === 'number') step.title = '¿Cuánto…?';
    setSteps([...steps.slice(0, at), step, ...steps.slice(at)]); setAdding(null); onSelect(step.id);
  }
  function remove(i) {
    if (!window.confirm(`¿Eliminar la pantalla "${steps[i].title}"? También se quitan las reglas, variables y secciones que usan su respuesta.`)) return;
    const next = removeStep(quiz, steps[i].id); setQuiz(next);
    if (selected === steps[i].id) onSelect(next.steps[Math.min(i, next.steps.length - 1)]?.id ?? RESULT);
  }
  // A move that would make a rule read a later answer is refused, so the draft stays savable.
  function reorder(from, to) {
    const next = { ...quiz, steps: move(steps, from, to) };
    const errors = orderErrors(quiz, next);
    if (errors.length) { window.alert(`No se puede mover esta pantalla:\n\n${errors.join('\n')}\n\nRevisá esas reglas en Avanzado › Reglas por pantalla.`); return; }
    setSteps(next.steps);
  }
  const plus = at => adding === at ? <AddMenu onPick={type => insert(type, at)} onClose={() => setAdding(null)} />
    : <button type="button" className="qe-insert" onClick={() => setAdding(at)} aria-label={`Agregar pantalla en la posición ${at + 1}`}><Plus aria-hidden="true" /></button>;
  let question = 0;
  return <div className="qe-flow">
    <div className="qe-flow-head"><h2>Recorrido</h2><span>{steps.length} pantallas</span></div>
    {plus(0)}
    <Sortable label="Pantallas del quiz" items={steps} getKey={s => s.id} onMove={reorder} render={(step, i, handle) => {
      const { label, tone } = meta(step.type); if (QUESTION_TYPES.includes(step.type)) question++;
      return <>
        <div className={`qe-flow-card ${selected === step.id ? 'is-selected' : ''} ${step.enabled === false ? 'is-hidden' : ''}`}>
          <span className="qe-handle" {...handle} aria-hidden="true" title="Arrastrar para ordenar"><GripVertical /></span>
          <button type="button" className="qe-flow-main" onClick={() => onSelect(step.id)} aria-current={selected === step.id}>
            <Thumb step={step} />
            <span className="qe-flow-text"><small className={`qe-chip tone-${tone}`}>{label}{QUESTION_TYPES.includes(step.type) ? ` · P${question}` : ''}</small><strong>{step.title || 'Sin título'}</strong></span>
          </button>
          {selected === step.id && <span className="qe-flow-actions">
            <IconButton label="Subir" disabled={i === 0} onClick={() => reorder(i, i - 1)}><ArrowUp /></IconButton>
            <IconButton label="Bajar" disabled={i === steps.length - 1} onClick={() => reorder(i, i + 1)}><ArrowDown /></IconButton>
            <IconButton label="Duplicar" onClick={() => { const copy = { ...clone(step), id: uid() }; setSteps([...steps.slice(0, i + 1), copy, ...steps.slice(i + 1)]); onSelect(copy.id); }}><Copy /></IconButton>
            <IconButton label={step.enabled === false ? 'Mostrar' : 'Ocultar'} onClick={() => setSteps(steps.map((s, j) => j === i ? { ...s, enabled: s.enabled === false } : s))}>{step.enabled === false ? <EyeOff /> : <Eye />}</IconButton>
            <IconButton label="Eliminar" onClick={() => remove(i)}><Trash2 /></IconButton>
          </span>}
        </div>
        {plus(i + 1)}
      </>;
    }} />
    <button type="button" className={`qe-flow-card qe-flow-result ${selected === RESULT ? 'is-selected' : ''}`} onClick={() => onSelect(RESULT)} aria-current={selected === RESULT}>
      <span className="qe-thumb tone-green"><Flag aria-hidden="true" /></span>
      <span className="qe-flow-text"><small className="qe-chip tone-green">Página final</small><strong>Resumen y botón al checkout</strong></span>
    </button>
  </div>;
}

function FeedbackEditor({ value, onChange }) {
  if (!value) return <Button type="button" variant="outline" size="sm" onClick={() => onChange({ tone: 'good', title: '¡Bien!', text: '' })}>+ Agregar feedback</Button>;
  return <div className="qe-feedback-editor">
    <Segmented label="Tono" value={value.tone} options={TONES} onChange={tone => onChange({ ...value, tone })} />
    <QField label="Título del feedback" value={value.title} onChange={title => onChange({ ...value, title })} />
    <QField label="Texto del feedback" multiline value={value.text} onChange={text => onChange({ ...value, text })} />
    <Button type="button" variant="ghost" size="sm" onClick={() => onChange(undefined)}>Quitar feedback</Button>
  </div>;
}

function OptionsEditor({ step, onChange, onRemoveOption }) {
  const options = step.options || [];
  const set = (i, patch) => onChange({ options: options.map((o, j) => i === j ? { ...o, ...patch } : o) });
  const feedback = step.type !== 'multiple';
  return <section className="qe-section">
    <h3>Respuestas</h3>
    <Segmented label="Presentación" value={step.layout || 'list'} onChange={layout => onChange({ layout })} options={[{ value: 'list', label: 'Lista' }, { value: 'image-right', label: 'Imagen a la derecha' }, { value: 'grid', label: 'Grilla 2 columnas' }]} />
    {options.map((o, i) => <div className="qe-option" key={o.id}>
      <div className="qe-option-row">
        <input className="qe-input qe-emoji" aria-label={`Emoji de la opción ${i + 1}`} placeholder="🙂" maxLength={8} value={o.icon || ''} onChange={e => set(i, { icon: e.target.value })} />
        <input className="qe-input" aria-label={`Texto de la opción ${i + 1}`} value={o.label} onChange={e => set(i, { label: e.target.value })} />
        <IconButton label="Subir opción" disabled={i === 0} onClick={() => onChange({ options: move(options, i, i - 1) })}><ArrowUp /></IconButton>
        <IconButton label="Quitar opción" disabled={options.length <= 1} onClick={() => onRemoveOption(o.id)}><Trash2 /></IconButton>
      </div>
      <details className="qe-option-more" open={Boolean(o.feedback) || undefined}>
        <summary>{feedback ? 'Imagen y feedback' : 'Imagen'}{o.imageUrl ? ' · 🖼' : ''}{o.feedback ? ` · ${TONES.find(t => t.value === o.feedback.tone)?.label.split(' ')[0]}` : ''}</summary>
        <ImageField compact label="Imagen de la opción" value={o.imageUrl} onChange={imageUrl => set(i, { imageUrl })} />
        {step.type === 'multiple' && <Toggle label="Exclusiva (como «Ninguna»)" value={o.exclusive} onChange={exclusive => set(i, { exclusive })} />}
        {feedback && <div className="qe-subsection"><strong>Feedback al elegirla</strong><p className="qe-hint">Se muestra debajo de las respuestas antes de continuar.</p><FeedbackEditor value={o.feedback} onChange={value => set(i, { feedback: value })} /></div>}
      </details>
    </div>)}
    <Button type="button" variant="outline" onClick={() => onChange({ options: [...options, { id: uid(), label: 'Nueva respuesta' }] })}>+ Agregar respuesta</Button>
    {feedback && (hasOptionFeedback(step)
      ? <p className="qe-hint">Como hay feedback, la pantalla muestra «{step.buttonText || 'Continuar'}» en vez de avanzar sola.</p>
      : <Toggle label="Avanzar apenas elige una respuesta" value={step.autoAdvance !== false} onChange={autoAdvance => onChange({ autoAdvance })} />)}
  </section>;
}

function RangesEditor({ step, onChange }) {
  const ranges = step.feedbackRanges || [];
  const set = (i, patch) => onChange({ feedbackRanges: ranges.map((r, j) => i === j ? { ...r, ...patch } : r) });
  return <section className="qe-section">
    <h3>Feedback según el valor</h3>
    <p className="qe-hint">Aparece en vivo mientras la persona escribe. Dejá «Desde» o «Hasta» vacío para no poner límite.</p>
    {ranges.map((r, i) => <div className={`qe-range tone-${r.tone}`} key={i}>
      <div className="qe-grid"><QField label="Desde" type="number" value={r.min} onChange={min => set(i, { min })} /><QField label="Hasta" type="number" value={r.max} onChange={max => set(i, { max })} /></div>
      <Segmented label="Tono" value={r.tone} options={TONES} onChange={tone => set(i, { tone })} />
      <QField label="Título" value={r.title} onChange={title => set(i, { title })} />
      <QField label="Texto" multiline value={r.text} onChange={text => set(i, { text })} />
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ feedbackRanges: ranges.filter((_, j) => j !== i) })}>Quitar rango</Button>
    </div>)}
    <Button type="button" variant="outline" disabled={ranges.length >= 12} onClick={() => onChange({ feedbackRanges: [...ranges, { min: ranges.at(-1)?.max != null ? ranges.at(-1).max + 1 : step.min ?? 0, max: undefined, tone: 'good', title: '¡Bien!', text: '' }] })}>+ Agregar rango</Button>
  </section>;
}

// Typing in a number box may pass through empty; only a valid value is kept.
function DurationField({ value, onChange }) {
  const seconds = Math.round((value || 5000) / 1000);
  const [text, setText] = useState(String(seconds));
  useEffect(() => { setText(String(seconds)); }, [seconds]);
  return <label className="qe-field"><span>Duración (1 a 20 segundos)</span><input type="number" min={1} max={20} value={text}
    onChange={e => { setText(e.target.value); const n = Number(e.target.value); if (e.target.value !== '' && Number.isInteger(n) && n >= 1 && n <= 20) onChange(n * 1000); }}
    onBlur={() => setText(String(seconds))} /></label>;
}

function StepInspector({ step, index, quiz, onChange, onRemoveOption }) {
  const { label, tone } = meta(step.type);
  const question = QUESTION_TYPES.includes(step.type);
  const choice = step.type === 'single' || (step.type === 'intro' && step.options?.length);
  const instant = choice && step.autoAdvance !== false && !hasOptionFeedback(step);
  return <div className="qe-stack">
    <div className="qe-inspector-head"><span className={`qe-chip tone-${tone}`}>{label}</span><span className="qe-hint">Pantalla {index + 1}</span><Toggle label="Activa" value={step.enabled !== false} onChange={enabled => onChange({ enabled })} /></div>
    <section className="qe-section">
      <QField label={question ? 'Pregunta' : 'Título'} value={step.title} onChange={title => onChange({ title })} />
      <QField label={step.type === 'info' ? 'Texto' : 'Texto de apoyo (opcional)'} multiline value={step.description} onChange={description => onChange({ description })} />
      {!instant && step.type !== 'loading' && <QField label="Texto del botón" value={step.buttonText} onChange={buttonText => onChange({ buttonText })} />}
      {question && <Toggle label="Respuesta obligatoria" value={isRequired(step)} onChange={required => onChange({ required })} />}
    </section>
    {step.type !== 'loading' && <section className="qe-section">
      <h3>Imagen de la pantalla</h3>
      <ImageField label="Imagen" value={step.imageUrl} onChange={imageUrl => onChange({ imageUrl })} />
      {step.imageUrl && <><Segmented label="Ubicación" value={step.imageLayout || 'top'} onChange={imageLayout => onChange({ imageLayout })} options={[{ value: 'top', label: 'Arriba' }, { value: 'hero-bottom', label: 'Grande abajo' }, { value: 'side', label: 'Al costado (escritorio)' }]} />
        <QField label="Texto alternativo (accesibilidad)" value={step.imageAlt} onChange={imageAlt => onChange({ imageAlt })} /></>}
    </section>}
    {['single', 'multiple', 'intro'].includes(step.type) && (step.type !== 'intro' || step.options?.length > 0) && <OptionsEditor step={step} onChange={onChange} onRemoveOption={onRemoveOption} />}
    {step.type === 'intro' && !step.options?.length && <Button type="button" variant="outline" onClick={() => onChange({ options: [{ id: uid(), label: 'Primera opción' }, { id: uid(), label: 'Segunda opción' }], autoAdvance: true })}>+ Agregar respuestas a la portada</Button>}
    {step.type === 'number' && <section className="qe-section"><h3>Número</h3><div className="qe-grid">
      <QField label="Mínimo" type="number" value={step.min} onChange={min => onChange({ min })} /><QField label="Máximo" type="number" value={step.max} onChange={max => onChange({ max })} />
      <QField label="Unidad (ej. kg, min)" value={step.suffix} onChange={suffix => onChange({ suffix })} />
    </div></section>}
    {['number', 'measure'].includes(step.type) && <RangesEditor step={step} onChange={onChange} />}
    {step.type === 'loading' && <section className="qe-section"><h3>Animación</h3>
      <DurationField value={step.durationMs} onChange={durationMs => onChange({ durationMs })} />
      {(step.items || []).map((item, i) => <div className="qe-option-row" key={i}>
        <input className="qe-input" aria-label={`Mensaje ${i + 1}`} value={item} onChange={e => onChange({ items: step.items.map((x, j) => j === i ? e.target.value : x) })} />
        <IconButton label="Quitar mensaje" onClick={() => onChange({ items: step.items.filter((_, j) => j !== i) })}><Trash2 /></IconButton>
      </div>)}
      <Button type="button" variant="outline" disabled={(step.items || []).length >= 8} onClick={() => onChange({ items: [...(step.items || []), 'Nuevo mensaje'] })}>+ Agregar mensaje</Button>
    </section>}
    {step.type === 'contact' && <section className="qe-section"><h3>Datos</h3>
      <Toggle label="Nombre obligatorio" value={step.nameRequired} onChange={nameRequired => onChange({ nameRequired, required: nameRequired || step.emailRequired })} />
      <Toggle label="Email obligatorio" value={step.emailRequired} onChange={emailRequired => onChange({ emailRequired, required: emailRequired || step.nameRequired })} />
      <QField label="Consentimiento para novedades (vacío para ocultarlo)" multiline value={step.consentText} onChange={consentText => onChange({ consentText })} />
      <p className="qe-hint">El nombre y el email se precargan en el checkout.</p>
    </section>}
  </div>;
}

const NEW_BLOCKS = {
  planSummary: quiz => ({ title: '', items: quiz.steps.filter(s => QUESTION_TYPES.includes(s.type)).slice(0, 3).map(s => ({ stepId: s.id, label: s.title, icon: '✅' })) }),
  goals: quiz => ({ title: 'Queremos que logres:', stepId: quiz.steps.find(s => s.type === 'multiple')?.id, items: [] }),
  features: () => ({ title: 'Qué vas a recibir:', mockups: [], items: [{ icon: '📘', title: 'Beneficio', text: '' }] }),
  rating: () => ({ title: 'Más de 1.000 lectores', text: 'ya empezaron su plan', rating: 4.8, laurels: true }),
  nowAfter: () => ({ now: { label: 'Ahora', icon: '😕', imageUrl: '' }, after: { label: 'Con tu plan', icon: '😄', imageUrl: '' }, metrics: [{ label: 'Claridad', now: 2, after: 5 }] }),
  gauge: quiz => { const step = quiz.steps.find(s => ['number', 'measure'].includes(s.type) || (['single', 'intro'].includes(s.type) && s.options?.length)); return { title: 'Tu punto de partida', stepId: step?.id, leftLabel: 'Inicial', rightLabel: 'Avanzado', ranges: [] }; },
  stats: () => ({ items: [{ icon: '📖', label: 'Tiempo diario recomendado', value: '15 min', badge: 'Recomendado', display: 'slider', percent: 30, minLabel: '5 min', maxLabel: '60 min' }] }),
  beforeAfter: () => ({ title: 'Resultados que nos enorgullecen', text: '*Historias reales. Los resultados dependen de cada persona.', items: [] }),
  guarantee: () => ({ text: '', imageUrl: '' }),
  offer: () => ({ title: '', label: '', badge: '', note: '', buttonText: '', trust: [] }),
  faq: () => ({ title: 'Preguntas frecuentes', items: [{ title: 'Pregunta', text: 'Respuesta' }] }),
  text: () => ({ title: 'Título', text: '' }), image: () => ({ title: '', imageUrl: '' }), video: () => ({ title: '', videoUrl: '' }),
};

function ItemsEditor({ items = [], onChange, fields, empty, max = 10, addLabel }) {
  const set = (i, patch) => onChange(items.map((x, j) => i === j ? { ...x, ...patch } : x));
  return <div className="qe-stack">
    {items.map((item, i) => <div className="qe-option" key={i}>
      {fields.map(([key, label, kind]) => kind === 'image' ? <ImageField key={key} compact label={label} value={item[key]} onChange={value => set(i, { [key]: value })} />
        : kind === 'emoji' ? <QField key={key} label={label} value={item[key]} onChange={value => set(i, { [key]: value })} />
          : <QField key={key} label={label} multiline={kind === 'long'} value={item[key]} onChange={value => set(i, { [key]: value })} />)}
      <div className="qe-actions"><IconButton label="Subir" disabled={i === 0} onClick={() => onChange(move(items, i, i - 1))}><ArrowUp /></IconButton><Button type="button" variant="ghost" size="sm" onClick={() => onChange(items.filter((_, j) => j !== i))}>Quitar</Button></div>
    </div>)}
    <Button type="button" variant="outline" disabled={items.length >= max} onClick={() => onChange([...items, empty()])}>{addLabel}</Button>
  </div>;
}

// Typed in major units and kept in the currency's minor unit, like the store's prices.
function PriceField({ label, currency, value, onChange }) {
  const [text, setText] = useState(() => value ? fromMinor(value, currency) : '');
  return <QField label={label}><input type="text" inputMode="decimal" placeholder="49.90" value={text} onChange={e => {
    setText(e.target.value); const minor = toMinor(e.target.value, currency);
    onChange(Number.isFinite(minor) && minor > 0 ? minor : undefined);
  }} /></QField>;
}

function BlockEditor({ block, quiz, view, onChange }) {
  const questions = quiz.steps.filter(s => QUESTION_TYPES.includes(s.type) || (s.type === 'intro' && s.options?.length));
  const set = patch => onChange({ ...block, ...patch });
  const head = <><QField label="Título (*palabra* la resalta)" value={block.title} onChange={title => set({ title })} />{!['planSummary', 'goals', 'guarantee'].includes(block.type) && <QField label={block.type === 'beforeAfter' ? 'Aclaración debajo' : 'Texto'} multiline value={block.text} onChange={text => set({ text })} />}</>;
  if (block.type === 'planSummary') return <div className="qe-stack">{head}
    <p className="qe-hint">Tarjetas con lo que respondió. Las que quedaron sin respuesta no se muestran.</p>
    {(block.items || []).map((item, i) => <div className="qe-option" key={i}><div className="qe-grid">
      <label className="qe-field"><span>Respuesta de</span><select value={item.stepId} onChange={e => set({ items: block.items.map((x, j) => j === i ? { ...x, stepId: e.target.value } : x) })}>{questions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
      <QField label="Etiqueta" value={item.label} onChange={label => set({ items: block.items.map((x, j) => j === i ? { ...x, label } : x) })} />
      <QField label="Emoji" value={item.icon} onChange={icon => set({ items: block.items.map((x, j) => j === i ? { ...x, icon } : x) })} />
      <QField label="Unidad (opcional)" value={item.suffix} onChange={suffix => set({ items: block.items.map((x, j) => j === i ? { ...x, suffix } : x) })} />
    </div><Button type="button" variant="ghost" size="sm" onClick={() => set({ items: block.items.filter((_, j) => j !== i) })}>Quitar tarjeta</Button></div>)}
    <Button type="button" variant="outline" disabled={!questions.length || (block.items || []).length >= 6} onClick={() => set({ items: [...(block.items || []), { stepId: questions[0].id, label: questions[0].title, icon: '✅' }] })}>+ Agregar tarjeta</Button>
  </div>;
  if (block.type === 'goals') return <div className="qe-stack">{head}
    <label className="qe-field"><span>Mostrar las respuestas marcadas en</span><select value={block.stepId || ''} onChange={e => set({ stepId: e.target.value || undefined })}><option value="">Ninguna (solo la lista fija)</option>{quiz.steps.filter(s => ['single', 'multiple'].includes(s.type)).map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
    <QField label="Objetivos fijos (uno por línea)" multiline value={(block.items || []).join('\n')} onChange={text => set({ items: text.split('\n').map(x => x.trimStart()).filter((x, i, all) => x || i < all.length - 1).slice(0, 10) })} />
  </div>;
  if (block.type === 'features') { const mockups = block.mockups?.length ? block.mockups : block.imageUrl ? [{ imageUrl: block.imageUrl }] : [];
    const setMockup = (i, imageUrl) => { const next = [0, 1].map(j => j === i ? { ...mockups[j], imageUrl } : mockups[j] || { imageUrl: '' }).filter(m => m.imageUrl || m.imagePrompt); set({ mockups: next, imageUrl: undefined }); };
    return <div className="qe-stack">{head}
    <div className="qe-grid"><ImageField label="Imagen del producto 1" value={mockups[0]?.imageUrl} onChange={url => setMockup(0, url)} /><ImageField label="Imagen del producto 2" value={mockups[1]?.imageUrl} onChange={url => setMockup(1, url)} /></div>
    <p className="qe-hint">Los beneficios se reparten al lado de cada imagen.</p>
    <ItemsEditor items={block.items} onChange={items => set({ items })} addLabel="+ Agregar beneficio" empty={() => ({ icon: '✅', title: 'Beneficio', text: '' })} fields={[['icon', 'Emoji', 'emoji'], ['title', 'Título'], ['text', 'Detalle (opcional)']]} />
  </div>; }
  if (block.type === 'nowAfter') { const side = key => patch => set({ [key]: { ...block[key], ...patch } });
    return <div className="qe-stack">
    <div className="qe-grid">{['now', 'after'].map(key => <div className="qe-option" key={key}>
      <QField label={key === 'now' ? 'Etiqueta «ahora»' : 'Etiqueta «después»'} value={block[key]?.label} onChange={label => side(key)({ label })} />
      <ImageField compact label="Imagen" value={block[key]?.imageUrl} onChange={imageUrl => side(key)({ imageUrl })} />
      {!block[key]?.imageUrl && <QField label="Emoji si no hay imagen" value={block[key]?.icon} onChange={icon => side(key)({ icon })} />}
    </div>)}</div>
    <strong className="text-sm">Indicadores (barras del 0 al 5)</strong>
    {(block.metrics || []).map((m, i) => <div className="qe-option-row" key={i}>
      <input className="qe-input" aria-label={`Indicador ${i + 1}`} value={m.label} onChange={e => set({ metrics: block.metrics.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} />
      {['now', 'after'].map(k => <select key={k} className="qe-input qe-level-select" aria-label={k === 'now' ? 'Ahora' : 'Después'} value={m[k]} onChange={e => set({ metrics: block.metrics.map((x, j) => j === i ? { ...x, [k]: Number(e.target.value) } : x) })}>{[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{k === 'now' ? 'Ahora' : 'Después'}: {n}</option>)}</select>)}
      <IconButton label="Quitar indicador" onClick={() => set({ metrics: block.metrics.filter((_, j) => j !== i) })}><Trash2 /></IconButton>
    </div>)}
    <Button type="button" variant="outline" disabled={(block.metrics || []).length >= 4} onClick={() => set({ metrics: [...(block.metrics || []), { label: 'Nuevo indicador', now: 1, after: 4 }] })}>+ Agregar indicador</Button>
  </div>; }
  if (block.type === 'gauge') { const sources = quiz.steps.filter(s => ['number', 'measure'].includes(s.type) || (['single', 'intro'].includes(s.type) && s.options?.length)), source = quiz.steps.find(s => s.id === block.stepId);
    const choice = source?.options?.length && ['single', 'intro'].includes(source.type);
    const ranges = block.ranges || [];
    const byOption = choice ? choiceRanges(block, source) : [];
    const setRange = (i, patch) => set({ ranges: (choice ? byOption : ranges).map((r, j) => j === i ? { ...r, ...patch } : r) });
    return <div className="qe-stack">
    <QField label="Título (ej. Tu punto de partida)" value={block.title} onChange={title => set({ title })} />
    <label className="qe-field"><span>Se mueve según la respuesta de</span><select value={block.stepId || ''} onChange={e => set({ stepId: e.target.value, ranges: [] })}>{sources.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
    <div className="qe-grid"><QField label="Texto a la izquierda" value={block.leftLabel} onChange={leftLabel => set({ leftLabel })} /><QField label="Texto a la derecha" value={block.rightLabel} onChange={rightLabel => set({ rightLabel })} /></div>
    {choice ? source.options.map((o, i) => { const r = byOption[i]; return <div className={`qe-range tone-${r.tone || 'good'}`} key={o.id}>
      <strong className="text-sm">Si eligió «{o.label}»</strong>
      <div className="qe-segmented" role="radiogroup" aria-label="Tono">{TONES.map(tone => <button type="button" role="radio" key={tone.value} aria-checked={(r.tone || 'good') === tone.value} onClick={() => setRange(i, { tone: tone.value })}>{tone.label}</button>)}</div>
      <QField label="Título" value={r.title} onChange={title => setRange(i, { title })} /><QField label="Texto" value={r.text} onChange={text => setRange(i, { text })} />
    </div>; }) : <><div className="qe-grid"><QField label="Mínimo de la escala" type="number" value={block.min} onChange={min => set({ min })} /><QField label="Máximo de la escala" type="number" value={block.max} onChange={max => set({ max })} /></div>
      {ranges.map((r, i) => <div className={`qe-range tone-${r.tone}`} key={i}><div className="qe-grid"><QField label="Desde" type="number" value={r.min} onChange={min => setRange(i, { min })} /><QField label="Hasta" type="number" value={r.max} onChange={max => setRange(i, { max })} /></div>
        <div className="qe-segmented" role="radiogroup" aria-label="Tono">{TONES.map(tone => <button type="button" role="radio" key={tone.value} aria-checked={r.tone === tone.value} onClick={() => setRange(i, { tone: tone.value })}>{tone.label}</button>)}</div>
        <QField label="Título" value={r.title} onChange={title => setRange(i, { title })} /><QField label="Texto" value={r.text} onChange={text => setRange(i, { text })} /></div>)}
      <Button type="button" variant="outline" onClick={() => set({ ranges: [...ranges, { tone: 'good', title: '¡Bien!', text: '' }] })}>+ Agregar rango</Button></>}
  </div>; }
  if (block.type === 'stats') return <div className="qe-stack">
    <ItemsEditor items={block.items} max={6} onChange={items => set({ items })} addLabel="+ Agregar tarjeta" empty={() => ({ icon: '✅', label: 'Recomendación', value: '', badge: 'Recomendado', display: 'none' })} fields={[['icon', 'Emoji', 'emoji'], ['label', 'Etiqueta'], ['value', 'Valor (ej. 15 min)'], ['badge', 'Etiqueta de esquina (opcional)']]} />
    {(block.items || []).map((item, i) => <div className="qe-option" key={i}>
      <strong className="text-sm">Visual de «{item.label}»</strong>
      <div className="qe-segmented" role="radiogroup" aria-label="Visual">{[['none', 'Solo texto'], ['slider', 'Barra'], ['icons', 'Íconos']].map(([value, label]) => <button type="button" role="radio" key={value} aria-checked={(item.display || 'none') === value} onClick={() => set({ items: block.items.map((x, j) => j === i ? { ...x, display: value } : x) })}>{label}</button>)}</div>
      {item.display === 'slider' && <div className="qe-grid"><QField label="Posición (0 a 100)" type="number" value={item.percent} onChange={percent => set({ items: block.items.map((x, j) => j === i ? { ...x, percent } : x) })} /><QField label="Texto izquierda" value={item.minLabel} onChange={minLabel => set({ items: block.items.map((x, j) => j === i ? { ...x, minLabel } : x) })} /><QField label="Texto derecha" value={item.maxLabel} onChange={maxLabel => set({ items: block.items.map((x, j) => j === i ? { ...x, maxLabel } : x) })} /></div>}
      {item.display === 'icons' && <div className="qe-grid"><QField label="Emoji de cada ícono" value={item.unitIcon} onChange={unitIcon => set({ items: block.items.map((x, j) => j === i ? { ...x, unitIcon } : x) })} /><QField label="Llenos" type="number" value={item.filled} onChange={filled => set({ items: block.items.map((x, j) => j === i ? { ...x, filled } : x) })} /><QField label="Total (máx. 12)" type="number" value={item.total} onChange={total => set({ items: block.items.map((x, j) => j === i ? { ...x, total } : x) })} /></div>}
    </div>)}
  </div>;
  if (block.type === 'rating') return <div className="qe-stack">{head}
    <Toggle label="Ramas de laurel alrededor del título" value={block.laurels !== false} onChange={laurels => set({ laurels })} />
    <div className="qe-grid"><QField label="Puntuación (0 a 5, 0 oculta las estrellas)" type="number" value={block.rating} onChange={rating => set({ rating })} /><QField label="Texto junto a las estrellas" value={block.subtitle} onChange={subtitle => set({ subtitle })} /></div>
    <p className="qe-hint">Usá solo cifras reales y comprobables.</p>
  </div>;
  if (block.type === 'beforeAfter') return <div className="qe-stack">{head}
    <div className="qe-grid"><QField label="Etiqueta «Antes»" value={block.beforeLabel} onChange={beforeLabel => set({ beforeLabel })} /><QField label="Etiqueta «Después»" value={block.afterLabel} onChange={afterLabel => set({ afterLabel })} /></div>
    <ItemsEditor items={block.items} onChange={items => set({ items })} addLabel="+ Agregar historia" empty={() => ({ title: '', text: '', name: '' })} fields={[['beforeImageUrl', 'Imagen antes', 'image'], ['afterImageUrl', 'Imagen después', 'image'], ['title', 'Frase destacada'], ['text', 'Testimonio', 'long'], ['name', 'Nombre (ej. Ana, 34)']]} />
    <p className="qe-hint">Solo testimonios reales, con permiso de la persona.</p>
  </div>;
  if (block.type === 'guarantee') return <GuaranteeFields block={block} onChange={onChange} />;
  if (block.type === 'offer') { const currency = view?.store?.currency || 'USD', main = view?.offer?.main;
    const compare = Number.isFinite(block.compareAtPrice) ? block.compareAtPrice : null;
    return <div className="qe-stack">
    <div className="qe-card" role="note"><p><strong>Precio que se cobra: {main ? storefrontMoney(main.price, currency) : '—'}</strong><br />Sale de la oferta de la tienda y es el mismo del checkout. {main?.compareAtPrice ? `Precio de referencia del producto: ${storefrontMoney(main.compareAtPrice, currency)}.` : ''}</p>
      {view?.store?.id && <Link className="text-sm underline underline-offset-4" to={`/panel/tiendas/${view.store.id}`}>Editar la oferta de la tienda</Link>}</div>
    <PriceField label={`Precio tachado en ${currency} (opcional)`} currency={currency} value={compare} onChange={compareAtPrice => set({ compareAtPrice })} />
    {compare != null && main && compare <= main.price && <p className="qe-hint">El precio tachado tiene que ser mayor que {storefrontMoney(main.price, currency)} para mostrarse.</p>}
    <p className="qe-hint">Vacío usa el precio de referencia del producto. El ahorro (%) se calcula solo.</p>
    <QField label="Título arriba de la tarjeta (opcional)" value={block.title} onChange={title => set({ title })} />
    <QField label="Nombre del plan (vacío usa el del producto)" placeholder="Plan completo de 21 días" value={block.label} onChange={label => set({ label })} />
    <QField label="Cinta destacada (vacío muestra el ahorro)" placeholder="Oferta especial" value={block.badge} onChange={badge => set({ badge })} />
    <QField label="Texto debajo del precio" placeholder="One-time payment · No subscription" value={block.note} onChange={note => set({ note })} />
    <QField label="Texto del botón" placeholder="Get my plan" value={block.buttonText} onChange={buttonText => set({ buttonText })} />
    <QField label="Sellos de confianza (uno por línea, máx. 4)" multiline placeholder={'🔒 Pago seguro\n✓ Garantía 30 días\n⚡ Acceso inmediato'} value={(block.trust || []).join('\n')} onChange={text => set({ trust: text.split('\n').slice(0, 4) })} />
    <p className="qe-hint">Vacío muestra «Secure payment» y «Instant access».</p>
    <Toggle label="Mostrar bonos con su valor" value={block.showBonuses !== false} onChange={showBonuses => set({ showBonuses })} />
  </div>; }
  if (block.type === 'faq') return <div className="qe-stack">{head}<ItemsEditor items={block.items} onChange={items => set({ items })} addLabel="+ Agregar pregunta" empty={() => ({ title: 'Pregunta', text: 'Respuesta' })} fields={[['title', 'Pregunta'], ['text', 'Respuesta', 'long']]} /></div>;
  if (block.type === 'image') return <div className="qe-stack">{head}<ImageField label="Imagen" value={block.imageUrl} onChange={imageUrl => set({ imageUrl })} /></div>;
  if (block.type === 'video') return <div className="qe-stack">{head}<VideoField label="Archivo del VSL" value={block.videoUrl} onChange={videoUrl => set({ videoUrl })} /><p className="qe-hint">Se muestra al terminar el quiz, antes de ir al checkout. Subí tu video para que aparezca en la página final.</p></div>;
  if (block.type === 'text') return <div className="qe-stack">{head}</div>;
  return <Blocks quiz={quiz} value={[block]} onChange={([next]) => next ? onChange(next) : onChange(null)} />;
}

function ResultInspector({ quiz, result, view, onChange }) {
  const [open, setOpen] = useState(null), [adding, setAdding] = useState(false);
  const blocks = result.blocks || [];
  const setBlocks = next => onChange({ blocks: next });
  return <div className="qe-stack">
    <div className="qe-inspector-head"><span className="qe-chip tone-green">Página final</span><span className="qe-hint">Después del último paso</span></div>
    <section className="qe-section">
      <QField label="Etiqueta arriba del título" placeholder="Tu plan personalizado está listo" value={result.eyebrow} onChange={eyebrow => onChange({ eyebrow })} />
      <QField label="Título" value={result.title} onChange={title => onChange({ title })} />
      <QField label="Texto" multiline value={result.description} onChange={description => onChange({ description })} />
      <ImageField label="Imagen del encabezado (opcional)" value={result.imageUrl} onChange={imageUrl => onChange({ imageUrl })} />
      <Toggle label="Confeti al mostrar el resultado" value={result.confetti !== false} onChange={confetti => onChange({ confetti })} />
      <Toggle label="Tarjeta de precio antes del botón (si no agregaste «Precio y oferta»)" value={result.showPrice !== false} onChange={showPrice => onChange({ showPrice })} />
      <QField label="Botón al checkout" value={result.buttonText} onChange={buttonText => onChange({ buttonText })} />
      <Toggle label="Botón fijo abajo de la pantalla" value={result.stickyCta !== false} onChange={stickyCta => onChange({ stickyCta })} />
      <p className="qe-hint">{'{{contact:name}}'} pone el nombre; si no lo dejó, se omite. El botón lleva al checkout de la tienda con nombre y email precargados.</p>
    </section>
    <section className="qe-section">
      <h3>Secciones</h3>
      {!blocks.some(b => b.type === 'video') && <Button type="button" variant="outline" onClick={() => { const block = { id: uid(), type: 'video', ...NEW_BLOCKS.video() }; setBlocks([block, ...blocks]); setOpen(block.id); }}>+ Agregar VSL</Button>}
      <Sortable label="Secciones de la página final" items={blocks} getKey={b => b.id} onMove={(from, to) => setBlocks(move(blocks, from, to))} render={(block, i, handle) => <div className={`qe-block-card ${block.enabled === false ? 'is-hidden' : ''}`}>
        <div className="qe-block-head">
          <span className="qe-handle" {...handle} aria-hidden="true"><GripVertical /></span>
          <button type="button" className="qe-block-title" aria-expanded={open === block.id} onClick={() => setOpen(open === block.id ? null : block.id)}><strong>{blockNames[block.type] || block.type}</strong><small>{block.title}</small></button>
          <IconButton label={block.enabled === false ? 'Mostrar' : 'Ocultar'} onClick={() => setBlocks(blocks.map((b, j) => j === i ? { ...b, enabled: b.enabled === false } : b))}>{block.enabled === false ? <EyeOff /> : <Eye />}</IconButton>
          <IconButton label="Eliminar sección" onClick={() => window.confirm('¿Eliminar esta sección?') && setBlocks(blocks.filter((_, j) => j !== i))}><Trash2 /></IconButton>
        </div>
        {open === block.id && <div className="qe-block-body"><BlockEditor block={block} quiz={quiz} view={view} onChange={next => setBlocks(next ? blocks.map((b, j) => j === i ? next : b) : blocks.filter((_, j) => j !== i))} /></div>}
      </div>} />
      {adding ? <div className="qe-add-menu">{RESULT_BLOCKS.map(type => <button type="button" key={type} onClick={() => { const block = { id: uid(), type, ...NEW_BLOCKS[type](quiz) }; setBlocks([...blocks, block]); setOpen(block.id); setAdding(false); }}>{blockNames[type]}</button>)}<IconButton label="Cerrar" onClick={() => setAdding(false)}><X /></IconButton></div>
        : <Button type="button" variant="outline" onClick={() => setAdding(true)}>+ Agregar sección</Button>}
    </section>
  </div>;
}

// Plausible answers for the screens before `index`, so the preview shows variants and the summary.
function sampleAnswers(quiz, index = quiz.steps.length) {
  const answers = {};
  for (const s of quiz.steps.slice(0, index)) {
    if (s.enabled === false) continue;
    const first = s.options?.find(o => !o.exclusive);
    if ((s.type === 'single' || s.type === 'intro') && first) answers[s.id] = first.id;
    else if (s.type === 'multiple' && first) answers[s.id] = s.options.filter(o => !o.exclusive).slice(0, 2).map(o => o.id);
    else if (s.type === 'number') answers[s.id] = s.min != null && s.max != null ? Math.round((s.min + s.max) / 4) || s.min : 10;
    else if (s.type === 'measure') answers[s.id] = { value: 10, unit: s.units[0].id };
    else if (s.type === 'contact') answers[s.id] = { name: 'Ana', email: 'ana@ejemplo.com', consent: false };
  }
  return answers;
}

function LivePreview({ quiz, view, target }) {
  const build = () => {
    if (target === RESULT) return { revision: 0, lastCommand: '', currentStep: null, history: [], answers: sampleAnswers(quiz), calculations: {}, resultId: quiz.results.find(r => r.default)?.id };
    const index = quiz.steps.findIndex(s => s.id === target);
    return { revision: 0, lastCommand: '', currentStep: target, history: quiz.steps.slice(0, index).filter(s => s.enabled !== false).map(s => s.id), answers: sampleAnswers(quiz, index), calculations: {} };
  };
  const [session, setSession] = useState(build), [note, setNote] = useState('');
  useEffect(() => { setSession(build()); setNote(''); }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  const missing = session.currentStep && !quiz.steps.some(s => s.id === session.currentStep);
  const command = (direction, value) => {
    try { setNote(''); setSession(advanceSession(quiz, session, { direction, value, revision: session.revision, commandId: crypto.randomUUID() })); }
    catch (e) { setNote(e.message); }
  };
  return <div className="qe-live">
    <div className="qe-live-head"><strong>Vista previa</strong><IconButton label="Volver a esta pantalla" onClick={() => { setSession(build()); setNote(''); }}><RotateCcw /></IconButton></div>
    <div className="qe-phone">{missing ? <p className="p-6 text-sm">Elegí una pantalla.</p>
      : <QuizPlayer preview quiz={quiz} session={session} view={view} error={note} onCommand={command} onCheckout={() => setNote('Acá seguiría al checkout de la tienda.')} />}</div>
    <p className="qe-hint">Probá elegir respuestas o escribir valores: el feedback aparece como lo verá el visitante.</p>
  </div>;
}

export default function QuizBuilder({ quiz, view, set }) {
  // `set` merges a patch, so a whole quiz replaces every top-level field.
  const [selected, setSelected] = useState(() => quiz.steps[0]?.id ?? RESULT);
  const index = quiz.steps.findIndex(s => s.id === selected);
  const target = index >= 0 ? selected : RESULT;
  const result = quiz.results.find(r => r.default);
  const setSteps = steps => set({ steps });
  return <div className="qe-builder">
    <Flow quiz={quiz} selected={target} onSelect={setSelected} setSteps={setSteps} setQuiz={set} />
    <div className="qe-inspector">{target === RESULT
      ? result && <ResultInspector quiz={quiz} result={result} view={view} onChange={patch => set({ results: quiz.results.map(r => r.id === result.id ? { ...r, ...patch } : r) })} />
      : <StepInspector key={target} step={quiz.steps[index]} index={index} quiz={quiz} onChange={patch => setSteps(quiz.steps.map((s, i) => i === index ? { ...s, ...patch } : s))} onRemoveOption={optionId => set(removeOption(quiz, selected, optionId))} />}</div>
    <LivePreview quiz={quiz} view={view} target={target} />
  </div>;
}
