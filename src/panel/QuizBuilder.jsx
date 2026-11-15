import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CircleDot, Copy, Eye, EyeOff, Flag, GripVertical, Hash, ImageUp, LayoutList, LoaderCircle, Mail, Plus, RotateCcw, SquareCheck, Trash2, Type, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuizPlayer } from '@/storefront/Quiz.jsx';
import { advanceSession, clone, hasOptionFeedback, newStep, QUESTION_TYPES } from '../../shared/quiz.js';
import { QField } from './QuizFields.jsx';
import { Blocks, Toggle, blockNames, stepNames, uid } from './QuizAdvanced.jsx';

// The editor page provides the upload function (Convex storage); without it only URLs work.
export const UploadContext = createContext(null);
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

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
const RESULT_BLOCKS = ['planSummary', 'goals', 'features', 'rating', 'beforeAfter', 'guarantee', 'faq', 'text', 'image', 'video'];
const RESULT = '$result';

function IconButton({ label, children, ...props }) {
  return <button type="button" className="qe-icon-button" aria-label={label} title={label} {...props}>{children}</button>;
}

function Segmented({ label, value, options, onChange }) {
  return <div className="qe-field"><span>{label}</span><div className="qe-segmented" role="radiogroup" aria-label={label}>
    {options.map(o => <button type="button" role="radio" aria-checked={value === o.value} key={o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
  </div></div>;
}

export function ImageField({ label = 'Imagen', value, onChange, compact = false }) {
  const upload = useContext(UploadContext), input = useRef(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [paste, setPaste] = useState(false);
  async function pick(file) {
    if (!file) return;
    if (!ACCEPT.includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Elegí una imagen JPG, PNG, WebP, GIF o AVIF de hasta 5 MB.'); return; }
    setBusy(true); setError('');
    try { onChange(await upload(file)); } catch (e) { setError(e?.message || 'No se pudo subir la imagen.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  return <div className={`qe-image ${compact ? 'is-compact' : ''}`}
    onDragOver={e => { if (upload && e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
    onDrop={e => { const file = e.dataTransfer.files?.[0]; if (upload && file) { e.preventDefault(); pick(file); } }}>
    <span className="qe-image-label">{label}</span>
    <div className="qe-image-row">
      <div className="qe-image-thumb">{value ? <img src={value} alt="" /> : <ImageUp aria-hidden="true" />}</div>
      <div className="qe-image-actions">
        <input ref={input} type="file" accept={ACCEPT.join(',')} hidden onChange={e => pick(e.target.files?.[0])} />
        {upload && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Subiendo…' : value ? 'Cambiar' : 'Subir'}</Button>}
        <Button type="button" variant="ghost" size="sm" onClick={() => setPaste(!paste)}>URL</Button>
        {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}>Quitar</Button>}
      </div>
    </div>
    {(paste || (!upload && !value)) && <input className="qe-input" type="url" placeholder="https://…" value={value || ''} onChange={e => onChange(e.target.value)} aria-label={`URL: ${label}`} />}
    {error && <p className="qe-inline-error" role="alert">{error}</p>}
  </div>;
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

function Flow({ quiz, selected, onSelect, setSteps }) {
  const [adding, setAdding] = useState(null);
  const steps = quiz.steps;
  function insert(type, at) {
    const step = newStep(type, uid());
    if (type === 'single' || type === 'multiple') step.title = '¿Tu pregunta?';
    if (type === 'number') step.title = '¿Cuánto…?';
    setSteps([...steps.slice(0, at), step, ...steps.slice(at)]); setAdding(null); onSelect(step.id);
  }
  function remove(i) {
    if (!window.confirm(`¿Eliminar la pantalla "${steps[i].title}"? Podés deshacerlo sin guardar.`)) return;
    const next = steps.filter((_, j) => j !== i); setSteps(next);
    if (selected === steps[i].id) onSelect(next[Math.min(i, next.length - 1)]?.id ?? RESULT);
  }
  const plus = at => adding === at ? <AddMenu onPick={type => insert(type, at)} onClose={() => setAdding(null)} />
    : <button type="button" className="qe-insert" onClick={() => setAdding(at)} aria-label={`Agregar pantalla en la posición ${at + 1}`}><Plus aria-hidden="true" /></button>;
  let question = 0;
  return <div className="qe-flow">
    <div className="qe-flow-head"><h2>Recorrido</h2><span>{steps.length} pantallas</span></div>
    {plus(0)}
    <Sortable label="Pantallas del quiz" items={steps} getKey={s => s.id} onMove={(from, to) => setSteps(move(steps, from, to))} render={(step, i, handle) => {
      const { label, tone } = meta(step.type); if (QUESTION_TYPES.includes(step.type)) question++;
      return <>
        <div className={`qe-flow-card ${selected === step.id ? 'is-selected' : ''} ${step.enabled === false ? 'is-hidden' : ''}`}>
          <span className="qe-handle" {...handle} aria-hidden="true" title="Arrastrar para ordenar"><GripVertical /></span>
          <button type="button" className="qe-flow-main" onClick={() => onSelect(step.id)} aria-current={selected === step.id}>
            <Thumb step={step} />
            <span className="qe-flow-text"><small className={`qe-chip tone-${tone}`}>{label}{QUESTION_TYPES.includes(step.type) ? ` · P${question}` : ''}</small><strong>{step.title || 'Sin título'}</strong></span>
          </button>
          {selected === step.id && <span className="qe-flow-actions">
            <IconButton label="Subir" disabled={i === 0} onClick={() => setSteps(move(steps, i, i - 1))}><ArrowUp /></IconButton>
            <IconButton label="Bajar" disabled={i === steps.length - 1} onClick={() => setSteps(move(steps, i, i + 1))}><ArrowDown /></IconButton>
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

function OptionsEditor({ step, onChange }) {
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
        <IconButton label="Quitar opción" disabled={options.length <= 1} onClick={() => onChange({ options: options.filter((_, j) => j !== i) })}><Trash2 /></IconButton>
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

function StepInspector({ step, index, quiz, onChange }) {
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
      {question && <Toggle label="Respuesta obligatoria" value={step.required !== false} onChange={required => onChange({ required })} />}
    </section>
    {step.type !== 'loading' && <section className="qe-section">
      <h3>Imagen de la pantalla</h3>
      <ImageField label="Imagen" value={step.imageUrl} onChange={imageUrl => onChange({ imageUrl })} />
      {step.imageUrl && <><Segmented label="Ubicación" value={step.imageLayout || 'top'} onChange={imageLayout => onChange({ imageLayout })} options={[{ value: 'top', label: 'Arriba' }, { value: 'hero-bottom', label: 'Grande abajo' }, { value: 'side', label: 'Al costado (escritorio)' }]} />
        <QField label="Texto alternativo (accesibilidad)" value={step.imageAlt} onChange={imageAlt => onChange({ imageAlt })} /></>}
    </section>}
    {['single', 'multiple', 'intro'].includes(step.type) && (step.type !== 'intro' || step.options?.length > 0) && <OptionsEditor step={step} onChange={onChange} />}
    {step.type === 'intro' && !step.options?.length && <Button type="button" variant="outline" onClick={() => onChange({ options: [{ id: uid(), label: 'Primera opción' }, { id: uid(), label: 'Segunda opción' }], autoAdvance: true })}>+ Agregar respuestas a la portada</Button>}
    {step.type === 'number' && <section className="qe-section"><h3>Número</h3><div className="qe-grid">
      <QField label="Mínimo" type="number" value={step.min} onChange={min => onChange({ min })} /><QField label="Máximo" type="number" value={step.max} onChange={max => onChange({ max })} />
      <QField label="Unidad (ej. kg, min)" value={step.suffix} onChange={suffix => onChange({ suffix })} />
    </div></section>}
    {['number', 'measure'].includes(step.type) && <RangesEditor step={step} onChange={onChange} />}
    {step.type === 'loading' && <section className="qe-section"><h3>Animación</h3>
      <QField label="Duración (segundos)" type="number" value={Math.round((step.durationMs || 5000) / 1000)} onChange={s => onChange({ durationMs: Math.min(20, Math.max(1, Number(s) || 1)) * 1000 })} />
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
  features: () => ({ title: 'Qué vas a recibir:', imageUrl: '', items: [{ icon: '📘', title: 'Beneficio', text: '' }] }),
  rating: () => ({ title: 'Más de 1.000 lectores', text: 'ya empezaron su plan', rating: 4.8 }),
  beforeAfter: () => ({ title: 'Resultados que nos enorgullecen', text: '*Historias reales. Los resultados dependen de cada persona.', items: [] }),
  guarantee: () => ({ title: '' }),
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

function BlockEditor({ block, quiz, onChange }) {
  const questions = quiz.steps.filter(s => QUESTION_TYPES.includes(s.type) || (s.type === 'intro' && s.options?.length));
  const set = patch => onChange({ ...block, ...patch });
  const head = <><QField label="Título" value={block.title} onChange={title => set({ title })} />{!['planSummary', 'goals', 'guarantee'].includes(block.type) && <QField label={block.type === 'beforeAfter' ? 'Aclaración debajo' : 'Texto'} multiline value={block.text} onChange={text => set({ text })} />}</>;
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
  if (block.type === 'features') return <div className="qe-stack">{head}
    <ImageField label="Imagen al costado (mockup del ebook, opcional)" value={block.imageUrl} onChange={imageUrl => set({ imageUrl })} />
    <ItemsEditor items={block.items} onChange={items => set({ items })} addLabel="+ Agregar beneficio" empty={() => ({ icon: '✅', title: 'Beneficio', text: '' })} fields={[['icon', 'Emoji', 'emoji'], ['title', 'Título'], ['text', 'Detalle (opcional)']]} />
  </div>;
  if (block.type === 'rating') return <div className="qe-stack">{head}
    <div className="qe-grid"><QField label="Puntuación (0 a 5, 0 oculta las estrellas)" type="number" value={block.rating} onChange={rating => set({ rating })} /><QField label="Texto junto a las estrellas" value={block.subtitle} onChange={subtitle => set({ subtitle })} /></div>
    <p className="qe-hint">Usá solo cifras reales y comprobables.</p>
  </div>;
  if (block.type === 'beforeAfter') return <div className="qe-stack">{head}
    <div className="qe-grid"><QField label="Etiqueta «Antes»" value={block.beforeLabel} onChange={beforeLabel => set({ beforeLabel })} /><QField label="Etiqueta «Después»" value={block.afterLabel} onChange={afterLabel => set({ afterLabel })} /></div>
    <ItemsEditor items={block.items} onChange={items => set({ items })} addLabel="+ Agregar historia" empty={() => ({ title: '', text: '', name: '' })} fields={[['beforeImageUrl', 'Imagen antes', 'image'], ['afterImageUrl', 'Imagen después', 'image'], ['title', 'Frase destacada'], ['text', 'Testimonio', 'long'], ['name', 'Nombre (ej. Ana, 34)']]} />
    <p className="qe-hint">Solo testimonios reales, con permiso de la persona.</p>
  </div>;
  if (block.type === 'guarantee') return <div className="qe-stack"><QField label="Título (vacío usa el de la tienda)" value={block.title} onChange={title => set({ title })} /><p className="qe-hint">El texto sale de la garantía configurada en la landing de la tienda.</p></div>;
  if (block.type === 'faq') return <div className="qe-stack">{head}<ItemsEditor items={block.items} onChange={items => set({ items })} addLabel="+ Agregar pregunta" empty={() => ({ title: 'Pregunta', text: 'Respuesta' })} fields={[['title', 'Pregunta'], ['text', 'Respuesta', 'long']]} /></div>;
  if (block.type === 'image') return <div className="qe-stack">{head}<ImageField label="Imagen" value={block.imageUrl} onChange={imageUrl => set({ imageUrl })} /></div>;
  if (block.type === 'text') return <div className="qe-stack">{head}</div>;
  return <Blocks quiz={quiz} value={[block]} onChange={([next]) => next ? onChange(next) : onChange(null)} />;
}

function ResultInspector({ quiz, result, onChange }) {
  const [open, setOpen] = useState(null), [adding, setAdding] = useState(false);
  const blocks = result.blocks || [];
  const setBlocks = next => onChange({ blocks: next });
  return <div className="qe-stack">
    <div className="qe-inspector-head"><span className="qe-chip tone-green">Página final</span><span className="qe-hint">Después del último paso</span></div>
    <section className="qe-section">
      <QField label="Título" value={result.title} onChange={title => onChange({ title })} />
      <QField label="Texto" multiline value={result.description} onChange={description => onChange({ description })} />
      <QField label="Botón al checkout" value={result.buttonText} onChange={buttonText => onChange({ buttonText })} />
      <Toggle label="Botón fijo abajo de la pantalla" value={result.stickyCta !== false} onChange={stickyCta => onChange({ stickyCta })} />
      <p className="qe-hint">{'{{contact:name}}'} pone el nombre; si no lo dejó, se omite. El botón lleva al checkout de la tienda con nombre y email precargados.</p>
    </section>
    <section className="qe-section">
      <h3>Secciones</h3>
      <Sortable label="Secciones de la página final" items={blocks} getKey={b => b.id} onMove={(from, to) => setBlocks(move(blocks, from, to))} render={(block, i, handle) => <div className={`qe-block-card ${block.enabled === false ? 'is-hidden' : ''}`}>
        <div className="qe-block-head">
          <span className="qe-handle" {...handle} aria-hidden="true"><GripVertical /></span>
          <button type="button" className="qe-block-title" aria-expanded={open === block.id} onClick={() => setOpen(open === block.id ? null : block.id)}><strong>{blockNames[block.type] || block.type}</strong><small>{block.title}</small></button>
          <IconButton label={block.enabled === false ? 'Mostrar' : 'Ocultar'} onClick={() => setBlocks(blocks.map((b, j) => j === i ? { ...b, enabled: b.enabled === false } : b))}>{block.enabled === false ? <EyeOff /> : <Eye />}</IconButton>
          <IconButton label="Eliminar sección" onClick={() => window.confirm('¿Eliminar esta sección?') && setBlocks(blocks.filter((_, j) => j !== i))}><Trash2 /></IconButton>
        </div>
        {open === block.id && <div className="qe-block-body"><BlockEditor block={block} quiz={quiz} onChange={next => setBlocks(next ? blocks.map((b, j) => j === i ? next : b) : blocks.filter((_, j) => j !== i))} /></div>}
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
  const [selected, setSelected] = useState(() => quiz.steps[0]?.id ?? RESULT);
  const index = quiz.steps.findIndex(s => s.id === selected);
  const target = index >= 0 ? selected : RESULT;
  const result = quiz.results.find(r => r.default);
  const setSteps = steps => set({ steps });
  return <div className="qe-builder">
    <Flow quiz={quiz} selected={target} onSelect={setSelected} setSteps={setSteps} />
    <div className="qe-inspector">{target === RESULT
      ? result && <ResultInspector quiz={quiz} result={result} onChange={patch => set({ results: quiz.results.map(r => r.id === result.id ? { ...r, ...patch } : r) })} />
      : <StepInspector key={target} step={quiz.steps[index]} index={index} quiz={quiz} onChange={patch => setSteps(quiz.steps.map((s, i) => i === index ? { ...s, ...patch } : s))} />}</div>
    <LivePreview quiz={quiz} view={view} target={target} />
  </div>;
}
