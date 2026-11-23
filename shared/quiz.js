// Shared, deterministic quiz language. Never evaluates user JavaScript.
export const STEP_TYPES = ['intro', 'single', 'multiple', 'text', 'number', 'measure', 'date', 'info', 'contact', 'summary', 'transition', 'loading'];
export const BLOCK_TYPES = ['text', 'image', 'video', 'answers', 'metric', 'scale', 'comparison', 'line', 'bar', 'benefits', 'offer', 'testimonials', 'faq', 'guarantee', 'promotion', 'planSummary', 'goals', 'features', 'rating', 'beforeAfter', 'nowAfter', 'gauge', 'stats'];
// Feedback tones shown inside a step: green, amber, red and neutral.
export const TONES = ['good', 'warn', 'bad', 'info'];
export const IMAGE_LAYOUTS = ['top', 'hero-bottom', 'side', 'none'];
export const OPTION_LAYOUTS = ['list', 'grid', 'image-right'];
export const QUESTION_TYPES = ['single', 'multiple', 'text', 'number', 'measure', 'date'];
export const OPS = ['add', 'subtract', 'multiply', 'divide', 'power', 'min', 'max', 'round', 'days'];
export const clone = value => JSON.parse(JSON.stringify(value));
const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function answerValue(step, value) {
  if (value == null || value === '') return null;
  if (step?.type === 'measure') return finite(value.value) == null ? null : value.value * (step.units?.find(u => u.id === value.unit)?.factor ?? 1);
  if (step?.type === 'single') return step.options?.find(o => o.id === value)?.score ?? null;
  if (step?.type === 'multiple') { const scores = Array.isArray(value) ? value.map(id => step.options?.find(o => o.id === id)?.score) : []; return scores.length && scores.every(n => finite(n) != null) ? finite(scores.reduce((a,b) => a+b,0)) : null; }
  return typeof value === 'number' ? finite(value) : value;
}
export function resolveRef(ref, context) {
  const [kind, id] = (ref || '').split(':');
  if (kind === 'calc') return context.calculations?.[id] ?? null;
  if (kind === 'contact') return context.contact?.[id] ?? null;
  const step = context.quiz.steps.find(s => s.id === id);
  if (!step) return null;
  const value = context.answers[id];
  return kind === 'score' ? answerValue(step, value) : value ?? null;
}
export function matches(group, context) {
  if (!group?.conditions?.length) return true;
  const results = group.conditions.map(c => {
    const value = resolveRef(c.ref, context);
    const has = value != null && value !== '' && (!Array.isArray(value) || value.length > 0);
    if (c.operator === 'answered') return has;
    if (!has) return false;
    if (c.operator === 'contains') return Array.isArray(value) ? value.includes(c.value) : String(value).includes(String(c.value));
    if (c.operator === 'eq') return String(value) === String(c.value);
    if (c.operator === 'neq') return String(value) !== String(c.value);
    if (c.operator === 'range') return typeof value === 'number' && value >= c.min && value <= c.max;
    return false;
  });
  return group.mode === 'any' ? results.some(Boolean) : results.every(Boolean);
}
export function evaluate(expression, context, depth = 0) {
  if (!expression || depth > 24) return null;
  if (expression.op === 'const') return finite(expression.value);
  if (expression.op === 'ref') return resolveRef(expression.ref, context);
  if (expression.op === 'if') return evaluate(matches(expression.when, context) ? expression.yes : expression.no, context, depth + 1);
  const values = (expression.args || []).map(e => evaluate(e, context, depth + 1));
  if (values.some(v => v == null)) return null;
  if (expression.op === 'days') {
    if (values.length !== 2 || values.some(v => typeof v !== 'string' || !validDate(v))) return null;
    return (Date.parse(values[1]) - Date.parse(values[0])) / 86400000;
  }
  if (values.some(v => finite(v) == null)) return null;
  const [a, b] = values;
  const result = { add: () => values.reduce((x, y) => x + y, 0), subtract: () => a - b, multiply: () => values.reduce((x, y) => x * y, 1), divide: () => b === 0 ? null : a / b, power: () => a ** b, min: () => Math.min(...values), max: () => Math.max(...values), round: () => Math.round(a * 10 ** b) / 10 ** b }[expression.op]?.();
  return finite(result);
}
export function contextFor(quiz, answers = {}) {
  const contact = Object.assign({}, ...quiz.steps.filter(s => s.type === 'contact').map(s => answers[s.id] || {}));
  const context = { quiz, answers, contact, calculations: {} };
  const done = new Set();
  const visiting = new Set();
  const run = id => {
    if (done.has(id) || visiting.has(id)) return;
    visiting.add(id);
    const formula = quiz.calculations.find(c => c.id === id);
    if (formula) {
      for (const ref of refsIn(formula.expression)) if (ref.startsWith('calc:')) run(ref.slice(5));
      context.calculations[id] = evaluate(formula.expression, context);
    }
    visiting.delete(id); done.add(id);
  };
  quiz.calculations.forEach(c => run(c.id));
  return context;
}
export function displayRef(ref, context) {
  const value = resolveRef(ref, context);
  const step = context.quiz.steps.find(s => `answer:${s.id}` === ref);
  if (value == null || value === '') return 'Sin resultado';
  if (step?.options?.length) return (Array.isArray(value) ? value : [value]).map(id => step.options.find(o => o.id === id)?.label || id).join(', ');
  if (typeof value === 'object' && !Array.isArray(value)) return 'value' in value ? `${value.value} ${step?.units?.find(u => u.id === value.unit)?.label || ''}` : '';
  return typeof value === 'number' ? String(Math.round(value * 10000) / 10000) : String(value);
}
export function interpolate(text, context, empty) { return String(text || '').replace(/\{\{((?:answer|score|calc|contact):[a-zA-Z0-9_-]+)\}\}/g, (_, ref) => { const value = resolveRef(ref, context); return empty !== undefined && (value == null || value === '') ? empty : displayRef(ref, context); }); }
// Public copy: a missing variable disappears instead of printing "Sin resultado", and the
// punctuation around it is tidied ("{{contact:name}}, tu plan" → "Tu plan").
export function personalize(text, context) {
  const value = interpolate(text, context, '').replace(/^[\s,;:.]+/, '').replace(/\s*,\s*([!?.]|$)/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
  // Only a sentence that starts with a variable needs its first letter fixed ("ana, …").
  return /^\s*\{\{/.test(String(text || '')) ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
export function effectiveStep(step, context) { const variant = step.variants?.find(v => matches(v.when, context)); return variant ? { ...step, ...variant.content } : step; }
export function visibleSteps(quiz, answers) { const context = contextFor(quiz, answers); return quiz.steps.filter(s => s.enabled !== false && matches(s.when, context)); }
export function firstStep(quiz) { return visibleSteps(quiz, {})[0]?.id ?? null; }
export function nextStep(quiz, stepId, answers) {
  const context = contextFor(quiz, answers);
  const index = quiz.steps.findIndex(s => s.id === stepId);
  const rule = quiz.steps[index]?.jumps?.find(r => matches(r.when, context));
  if (rule?.target === '$result') return null;
  const start = rule ? quiz.steps.findIndex(s => s.id === rule.target) : index + 1;
  return quiz.steps.slice(start).find(s => s.enabled !== false && matches(s.when, context))?.id ?? null;
}
export function resultFor(quiz, answers) { const context = contextFor(quiz, answers); return quiz.results.find(r => !r.default && matches(r.when, context)) || quiz.results.find(r => r.default); }
// Feedback configured on the step itself: per option (single) or per numeric range (number/measure).
// Ranges use the base unit and open bounds; the first match wins.
export function feedbackFor(step, value) {
  if (!step || value == null || value === '') return null;
  const usable = f => f && TONES.includes(f.tone) && (f.title || f.text) ? f : null;
  if (step.type === 'single' || (step.type === 'intro' && step.options?.length)) return usable(step.options?.find(o => o.id === value)?.feedback);
  if (step.type !== 'number' && step.type !== 'measure') return null;
  const number = step.type === 'measure' ? answerValue(step, value) : finite(value);
  if (number == null) return null;
  return usable((step.feedbackRanges || []).find(r => (finite(r.min) == null || number >= r.min) && (finite(r.max) == null || number <= r.max)));
}
// Indicator block: the marker comes from a number answer, or from the position of the chosen
// option (1…n). `ranges` work like a step's feedback ranges on that value.
export function gaugeFor(block, context) {
  const step = context.quiz.steps.find(s => s.id === block.stepId);
  const answer = step ? context.answers[step.id] : null;
  if (!step || answer == null || answer === '') return null;
  const choice = step.options?.length && ['single', 'intro'].includes(step.type);
  const value = choice ? step.options.findIndex(o => o.id === answer) + 1 : step.type === 'measure' ? answerValue(step, answer) : finite(answer);
  if (!value) return value === 0 ? { value, percent: 0, display: '0', feedback: null } : null;
  const min = finite(block.min) ?? (choice ? 1 : finite(step.min) ?? 0), max = finite(block.max) ?? (choice ? step.options.length : finite(step.max) ?? 100);
  const percent = max > min ? Math.min(100, Math.max(0, (value - min) / (max - min) * 100)) : 50;
  const display = choice ? step.options[value - 1].label : `${Math.round(value * 10) / 10}`;
  // Choice ranges follow the option ID, so reordering options keeps each feedback with its
  // option. Older ranges without IDs still match by position.
  const ranges = choice && block.ranges?.some(r => r?.optionId) ? block.ranges.filter(r => r?.optionId === answer).map(r => ({ ...r, min: value, max: value })) : block.ranges;
  return { value, percent, display, feedback: feedbackFor({ type: 'number', feedbackRanges: ranges }, value) };
}
// One range per option of a choice question, in option order, each tied to its option ID.
export function choiceRanges(block, step) {
  const ranges = Array.isArray(block?.ranges) ? block.ranges : [];
  const legacy = !ranges.some(r => r?.optionId);
  return (step?.options || []).map((o, j) => ({ tone: 'good', title: '', text: '', ...(ranges.find(r => legacy ? r?.min === j + 1 : r?.optionId === o.id) || {}), optionId: o.id, min: j + 1, max: j + 1 }));
}
const isChoice = step => step?.options?.length > 0 && ['single', 'intro'].includes(step.type);
// Gauge ranges saved by position are converted to option IDs before the options can move.
export function migrateGaugeRanges(quiz) {
  const fix = blocks => Array.isArray(blocks) ? blocks.map(b => {
    if (b?.type !== 'gauge' || !Array.isArray(b.ranges) || !b.ranges.length || b.ranges.some(r => r?.optionId)) return b;
    const step = quiz.steps.find(s => s.id === b.stepId);
    return isChoice(step) ? { ...b, ranges: choiceRanges(b, step) } : b;
  }) : blocks;
  return { ...quiz, steps: quiz.steps.map(s => s.blocks ? { ...s, blocks: fix(s.blocks) } : s), results: quiz.results.map(r => ({ ...r, blocks: fix(r.blocks) })) };
}
// Answers are required unless the step says otherwise; a cover only asks when it has options.
export function isRequired(step) {
  if (!step) return false;
  if (step.required != null) return Boolean(step.required);
  return QUESTION_TYPES.includes(step.type) || (step.type === 'intro' && step.options?.length > 0);
}
// A stats card can follow a number answer within [scaleMin, scaleMax]; otherwise it uses `percent`.
export function statPercent(item, context) {
  const answer = item.stepId ? context.answers[item.stepId] : null;
  const value = typeof answer === 'number' ? answer : answer && typeof answer === 'object' ? answer.value : null;
  if (finite(value) != null && finite(item.scaleMin) != null && finite(item.scaleMax) != null && item.scaleMax > item.scaleMin) return Math.min(100, Math.max(0, (value - item.scaleMin) / (item.scaleMax - item.scaleMin) * 100));
  return Math.min(100, Math.max(0, finite(item.percent) ?? 50));
}
export function hasOptionFeedback(step) { return Boolean(step?.options?.some(o => o.feedback && (o.feedback.title || o.feedback.text))); }
export function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function validateAnswer(step, value) {
  const fail = message => { throw new Error(message); };
  const empty = value == null || value === '' || (Array.isArray(value) && !value.length);
  if (empty) { if ((isRequired(step) && (QUESTION_TYPES.includes(step.type) || (step.type === 'intro' && step.options?.length))) || (step.type === 'contact' && (step.required || step.nameRequired || step.emailRequired))) fail('Please answer this question to continue.'); return null; }
  if ((step.type === 'single' || (step.type === 'intro' && step.options?.length)) && !step.options.some(o => o.id === value)) fail('Please choose a valid option.');
  if (step.type === 'multiple') {
    if (!Array.isArray(value) || new Set(value).size !== value.length || value.some(id => !step.options.some(o => o.id === id))) fail('Please check the options you selected.');
    if (value.length < (step.minSelections ?? (step.required ? 1 : 0)) || value.length > (step.maxSelections ?? step.options.length)) fail('Please check how many options you selected.');
    if (value.length > 1 && value.some(id => step.options.find(o => o.id === id)?.exclusive)) fail('This option can’t be combined with others.');
  }
  if (['number', 'measure'].includes(step.type)) {
    if (step.type === 'measure' && (!value || !step.units.some(u => u.id === value.unit))) fail('Please choose a valid unit.');
    const number = step.type === 'measure' ? answerValue(step, value) : value;
    if (finite(number) == null || (step.min != null && number < step.min) || (step.max != null && number > step.max)) fail('Please enter a number within the allowed range.');
  }
  if (step.type === 'text' && (typeof value !== 'string' || value.length > 2000)) fail('Please enter up to 2,000 characters.');
  if (step.type === 'date' && (!validDate(value) || (step.minDate && value < step.minDate) || (step.maxDate && value > step.maxDate))) fail('Please enter a valid date within the allowed range.');
  if (step.type === 'contact') {
    if (typeof value !== 'object' || Array.isArray(value)) fail('Please check your contact details.');
    const name = String(value.name || '').trim(), email = String(value.email || '').trim().toLowerCase();
    if (name.length > 120 || email.length > 254 || (step.nameRequired && !name) || (step.emailRequired && !email) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) fail('Please check your name and email.');
    if (value.consent != null && typeof value.consent !== 'boolean') fail('Invalid consent value.');
    return { name, email, consent: Boolean(value.consent && step.consentText) };
  }
  if (step.type === 'measure') return { value: value.value, unit: value.unit };
  if (!QUESTION_TYPES.includes(step.type) && step.type !== 'contact' && !(step.type === 'intro' && step.options?.length)) return null;
  return typeof value === 'string' ? value.trim() : value;
}
function refsIn(value) {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => key === 'ref' && typeof child === 'string' ? [child] : refsIn(child));
}
export function validateQuiz(input, publishing = false) {
  try { return validateQuizStructure(input, publishing); } catch { return ['Estructura de quiz inválida. Revisá los tipos y las listas de campos.']; }
}
const TEXT_KEYS = ['title','description','text','label','name','buttonText','consentText','icon','legend','suffix','placeholder','imageAlt','backText','skipText','eyebrow','badge','note','sealText','sealUnit'];
const BOOLEAN_KEYS = ['required','enabled','default','autoAdvance','exclusive','stickyCta','nameRequired','emailRequired','highlighted','laurels','showBonuses','showPrice','confetti'];
const FIELD_NAMES = { title: 'el título', description: 'la descripción', text: 'el texto', eyebrow: 'la etiqueta del encabezado', badge: 'la cinta destacada', note: 'el texto debajo del precio', sealText: 'el texto del sello', sealUnit: 'la unidad del sello', trust: 'un sello de confianza', label: 'la etiqueta', name: 'el nombre', buttonText: 'el texto del botón', consentText: 'el texto de consentimiento', icon: 'el ícono', legend: 'la leyenda', suffix: 'el sufijo', placeholder: 'la ayuda del campo', imageAlt: 'el texto alternativo de la imagen', backText: 'el botón Atrás', skipText: 'el botón Omitir', imageUrl: 'la imagen', sideImageUrl: 'la imagen lateral', videoUrl: 'el video', logoUrl: 'el logo', termsUrl: 'la URL de términos', privacyUrl: 'la URL de privacidad', beforeImageUrl: 'la imagen «antes»', afterImageUrl: 'la imagen «después»', photoUrl: 'la foto', color: 'el color de botones', background: 'el color de fondo', textColor: 'el color de texto', items: 'un mensaje' };
const fieldName = key => FIELD_NAMES[key] || `el campo «${key}»`;
// Errors name screens by their title: IDs are internal and mean nothing to the editor.
const stepName = s => typeof s?.title === 'string' && s.title.trim() ? `Pantalla «${s.title.trim().slice(0, 60)}»` : `Pantalla ${s?.id ?? ''}`.trim();
function validateQuizStructure(input, publishing) {
  const errors = [];
  const check = (test, message) => { if (!test) errors.push(message); };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['Quiz inválido.'];
  if (JSON.stringify(input).length > 350000) return ['El quiz supera el tamaño permitido (350 KB).'];
  const q = input;
  check(q.version === 1, 'Versión de quiz inválida.');
  if (!Array.isArray(q.steps) || !Array.isArray(q.calculations) || !Array.isArray(q.results) || !q.identity) return ['Faltan identidad, pantallas, cálculos o resultados.'];
  check(q.steps.length <= 80 && (!publishing || q.steps.length > 0), 'Usá entre 1 y 80 pantallas para publicar.');
  check(q.calculations.length <= 40 && q.results.length <= 20, 'Máximo: 40 cálculos y 20 resultados.');
  const ids = (list, label) => { check(list.every(x => x && typeof x.id === 'string' && !['constructor','prototype','__proto__'].includes(x.id) && /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(x.id)), `${label}: identificadores inválidos.`); check(new Set(list.map(x => x?.id)).size === list.length, `${label}: identificadores repetidos.`); };
  ids(q.steps, 'Pantallas'); ids(q.calculations, 'Cálculos'); ids(q.results, 'Resultados');
  const refs = new Set([...q.steps.flatMap(s => [`answer:${s.id}`, `score:${s.id}`]), ...q.calculations.map(c => `calc:${c.id}`), 'contact:name', 'contact:email']);
  const group = (g, label) => {
    if (!g) return;
    if (!['all', 'any'].includes(g.mode) || !Array.isArray(g.conditions) || g.conditions.length > 20) { errors.push(`${label}: condiciones inválidas.`); return; }
    for (const c of g.conditions) {
      check(c && refs.has(c.ref), `${label}: referencia desconocida.`);
      check(['eq', 'neq', 'contains', 'range', 'answered'].includes(c?.operator), `${label}: operador inválido.`);
      if (c?.operator === 'range') check(finite(c.min) != null && finite(c.max) != null && c.min <= c.max, `${label}: rango inválido.`);
      if (['eq', 'neq', 'contains'].includes(c?.operator)) check(['string', 'number', 'boolean'].includes(typeof c.value), `${label}: falta el valor de comparación.`);
    }
  };
  const expression = (e, label, depth = 0) => {
    if (!e || depth > 12) { errors.push(`${label}: fórmula inválida o demasiado profunda.`); return; }
    if (e.op === 'const') { check(finite(e.value) != null, `${label}: constante inválida.`); return; }
    if (e.op === 'ref') { check(refs.has(e.ref), `${label}: referencia desconocida.`); return; }
    if (e.op === 'if') { group(e.when, label); expression(e.yes, label, depth + 1); expression(e.no, label, depth + 1); return; }
    check(OPS.includes(e.op) && Array.isArray(e.args) && e.args.length === 2, `${label}: elegí una operación y dos operandos.`);
    if (Array.isArray(e.args)) e.args.slice(0, 3).forEach(a => expression(a, label, depth + 1));
  };
  q.steps.forEach((s, index) => {
    const name = stepName(s);
    check(STEP_TYPES.includes(s.type), `${name}: tipo de pantalla inválido.`);
    if (publishing && s.enabled !== false) check(typeof s.title === 'string' && s.title.trim(), `${name}: falta el título.`);
    group(s.when, name);
    if (['single', 'multiple'].includes(s.type) || (s.type === 'intro' && s.options?.length)) {
      const opts = s.options || []; ids(opts, name); check(opts.length >= 1 && opts.length <= 30, `${name}: configurá entre 1 y 30 opciones.`);
      opts.forEach(o => { check(typeof o.label === 'string' && o.label.trim(), `${name}: opción sin texto.`); if (o.score != null) check(finite(o.score) != null, `${name}: puntuación inválida.`); });
      check((s.minSelections ?? 0) >= 0 && (s.maxSelections ?? opts.length) <= opts.length && (s.minSelections ?? 0) <= (s.maxSelections ?? opts.length), `${name}: límites de selección inválidos.`);
    }
    if (s.imageLayout != null) check(IMAGE_LAYOUTS.includes(s.imageLayout), `${name}: posición de imagen inválida.`);
    if (s.layout != null) check(OPTION_LAYOUTS.includes(s.layout), `${name}: presentación de opciones inválida.`);
    for (const o of s.options || []) if (o?.feedback != null) check(typeof o.feedback === 'object' && TONES.includes(o.feedback.tone), `${name}: feedback de opción inválido.`);
    if (s.feedbackRanges != null) {
      check(Array.isArray(s.feedbackRanges) && s.feedbackRanges.length <= 12, `${name}: máximo 12 rangos de feedback.`);
      for (const r of Array.isArray(s.feedbackRanges) ? s.feedbackRanges : []) check(r && TONES.includes(r.tone) && (r.min == null || finite(r.min) != null) && (r.max == null || finite(r.max) != null) && (r.min == null || r.max == null || r.min <= r.max), `${name}: rango de feedback inválido.`);
    }
    if (s.type === 'loading') check(finite(s.durationMs) != null && s.durationMs >= 1000 && s.durationMs <= 20000 && Array.isArray(s.items) && s.items.length <= 8 && s.items.every(i => typeof i === 'string'), `${name}: configurá entre 1 y 20 segundos y hasta 8 mensajes.`);
    if (s.type === 'measure') { ids(s.units || [], name); check(s.units?.length > 0 && s.units.length <= 8 && s.units.every(u => finite(u.factor) != null && u.factor > 0 && u.label), `${name}: unidades inválidas.`); }
    if (s.min != null || s.max != null) check((s.min == null || finite(s.min) != null) && (s.max == null || finite(s.max) != null) && (s.min == null || s.max == null || s.min <= s.max), `${name}: límites numéricos inválidos.`);
    if (s.minDate) check(validDate(s.minDate), `${name}: fecha mínima inválida.`);
    if (s.maxDate) check(validDate(s.maxDate), `${name}: fecha máxima inválida.`);
    if (s.minDate && s.maxDate) check(s.minDate <= s.maxDate, `${name}: rango de fechas inválido.`);
    for (const rule of s.jumps || []) { group(rule.when, name); check(rule.target === '$result' || q.steps.findIndex(x => x.id === rule.target) > index, `${name}: los saltos deben ir hacia adelante.`); }
    for (const variant of s.variants || []) { group(variant.when, name); check(variant.content && Object.keys(variant.content).every(k => ['title', 'description', 'imageUrl', 'sideImageUrl', 'buttonText'].includes(k)), `${name}: variante inválida.`); }
    const dependencies = [...refsIn(s.when), ...refsIn(s.jumps), ...refsIn(s.variants)];
    const earlier = (ref, seen = new Set()) => {
      if (seen.has(ref)) return false; seen.add(ref);
      if (ref.startsWith('calc:')) { const c = q.calculations.find(c => `calc:${c.id}` === ref); return c ? refsIn(c.expression).every(r => earlier(r, new Set(seen))) : false; }
      if (ref.startsWith('contact:')) return q.steps.slice(0, index).some(x => x.type === 'contact');
      const pos = q.steps.findIndex(x => x.id === ref.split(':')[1]);
      return pos >= 0 && pos <= index;
    };
    dependencies.forEach(ref => check(earlier(ref), `${name}: una regla depende de una respuesta futura o circular.`));
    const self = (ref, seen = new Set()) => { if (seen.has(ref)) return true; seen.add(ref); return ref === `answer:${s.id}` || ref === `score:${s.id}` || (ref.startsWith('calc:') && refsIn(q.calculations.find(c => `calc:${c.id}` === ref)?.expression).some(r=>self(r,new Set(seen)))); };
    refsIn(s.when).forEach(ref => check(!self(ref), `${name}: la visibilidad no puede depender de su propia respuesta.`));
  });
  q.calculations.forEach(c => expression(c.expression, `Cálculo «${c.label || c.id}»`));
  const visited = new Set(), active = new Set();
  const visit = id => {
    if (active.has(id)) { errors.push(`Cálculo circular: «${q.calculations.find(c => c.id === id)?.label || id}».`); return; }
    if (visited.has(id)) return;
    active.add(id);
    const c = q.calculations.find(c => c.id === id);
    if (c) refsIn(c.expression).filter(r => r.startsWith('calc:')).forEach(r => visit(r.slice(5)));
    active.delete(id); visited.add(id);
  };
  q.calculations.forEach(c => visit(c.id));
  check(q.results.filter(r => r.default).length === 1, 'Debe existir exactamente un resultado predeterminado.');
  const blocks = (list, label) => {
    check(Array.isArray(list) && list.length <= 40, `${label}: máximo 40 bloques.`);
    if (!Array.isArray(list)) return;
    ids(list, label);
    list.forEach(b => { check(BLOCK_TYPES.includes(b.type), `${label}: bloque inválido.`); if (b.type !== 'guarantee') group(b.when, label); if (b.ref) check(refs.has(b.ref), `${label}: referencia desconocida.`); if (b.type === 'scale') check(finite(b.min) != null && finite(b.max) != null && b.min < b.max, `${label}: escala inválida.`); (b.points || []).forEach(p => expression(p.expression, label));
      if (b.type === 'planSummary') check(Array.isArray(b.items) && b.items.length <= 6 && b.items.every(i => q.steps.some(s => s.id === i?.stepId)), `${label}: el resumen usa pantallas inexistentes (máximo 6).`);
      if (b.type === 'goals') check((!b.stepId || q.steps.some(s => s.id === b.stepId && ['single', 'multiple'].includes(s.type))) && (b.items == null || (Array.isArray(b.items) && b.items.length <= 10)), `${label}: los objetivos deben salir de una pregunta con opciones.`);
      if (['features', 'beforeAfter'].includes(b.type)) check(Array.isArray(b.items) && b.items.length <= 10, `${label}: máximo 10 elementos.`);
      if (b.type === 'gauge') check(q.steps.some(s => s.id === b.stepId && (['number', 'measure'].includes(s.type) || (['single', 'intro'].includes(s.type) && s.options?.length))) && (b.ranges == null || (Array.isArray(b.ranges) && b.ranges.length <= 12 && b.ranges.every(r => r && TONES.includes(r.tone) && (r.min == null || finite(r.min) != null) && (r.max == null || finite(r.max) != null)))), `${label}: el indicador necesita una pregunta numérica o de opciones y rangos válidos.`);
      if (b.type === 'stats') check(Array.isArray(b.items) && b.items.length <= 6 && b.items.every(i => i && ['none', 'slider', 'icons'].includes(i.display ?? 'none') && (!i.stepId || q.steps.some(s => s.id === i.stepId)) && (i.total == null || (Number.isInteger(i.total) && i.total >= 1 && i.total <= 12)) && (i.filled == null || (Number.isInteger(i.filled) && i.filled >= 0))), `${label}: tarjetas inválidas (máximo 6, hasta 12 íconos).`);
      if (b.type === 'nowAfter') check(['now', 'after'].every(k => b[k] && typeof b[k] === 'object') && Array.isArray(b.metrics) && b.metrics.length <= 4 && b.metrics.every(m => m && [m.now, m.after].every(n => n == null || typeof n === 'string' || (Number.isInteger(n) && n >= 0 && n <= 5))), `${label}: la comparación necesita «ahora», «después» y hasta 4 indicadores.`);
      if (b.mockups != null) check(Array.isArray(b.mockups) && b.mockups.length <= 2, `${label}: máximo 2 imágenes de producto.`);
      if (b.type === 'offer') check((b.compareAtPrice == null || (Number.isInteger(b.compareAtPrice) && b.compareAtPrice > 0)) && (b.trust == null || (Array.isArray(b.trust) && b.trust.length <= 4 && b.trust.every(x => typeof x === 'string' && x.length <= 80))), `${label}: el precio tachado tiene que ser un importe positivo y los sellos de confianza, hasta 4 textos cortos.`);
      if (b.type === 'rating' && b.rating != null) check(finite(b.rating) != null && b.rating >= 0 && b.rating <= 5, `${label}: la puntuación va de 0 a 5.`); });
  };
  q.steps.forEach(s => { if (s.blocks) blocks(s.blocks, stepName(s)); });
  q.results.forEach(r => { const name = r.default ? 'Página final' : `Perfil «${r.title || r.id}»`; group(r.when, name); blocks(r.blocks, name); });
  // Field checks name the screen/block and the field as the editor shows them. Keys set to
  // undefined are skipped: Convex drops them on save, so they must not block publishing.
  const where = (base, key, child, i) => {
    if (key === 'blocks') return `${base} › bloque «${String(child?.title || '').trim().slice(0, 40) || child?.type || i + 1}»`;
    if (key === 'options') return `${base} › opción «${String(child?.label || '').trim().slice(0, 40) || i + 1}»`;
    if (key === 'mockups') return `${base} › imagen de producto ${i + 1}`;
    if (key === 'items') return `${base} › elemento ${i + 1}`;
    if (key === 'variants') return `${base} › variante ${i + 1}`;
    return base;
  };
  const walk = (value, at) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) continue;
      const field = fieldName(key);
      if (TEXT_KEYS.includes(key) || /Url$/.test(key)) check(typeof child === 'string', `${at}: ${field} tiene un valor que no es texto. Volvé a completar ese campo o dejalo vacío.`);
      if (BOOLEAN_KEYS.includes(key)) check(typeof child === 'boolean', `${at}: la opción «${key}» tiene un valor inválido.`);
      if (typeof child === 'string') {
        check(child.length <= 6000, `${at}: ${field} supera los 6.000 caracteres.`);
        if (/Url$/.test(key) && child) { try { check(new URL(child).protocol === 'https:', `${at}: ${field} tiene que empezar con https://.`); } catch { errors.push(`${at}: ${field} no es una dirección web válida («${child.slice(0, 60)}»).`); } }
        if (['color', 'background', 'textColor'].includes(key)) check(/^#[a-f\d]{6}$/i.test(child), `${at}: ${field} tiene que ser un color como #1a2b3c.`);
        for (const match of child.matchAll(/\{\{([^}]+)\}\}/g)) check(refs.has(match[1]), `${at}: variable desconocida {{${match[1]}}} en ${field}. Puede venir de una pregunta o cálculo que borraste.`);
      } else if (Array.isArray(child)) child.forEach((item, i) => item && typeof item === 'object' ? walk(item, where(at, key, item, i)) : walk({ [key]: item }, at));
      else walk(child, at);
    }
  };
  walk(q.identity, 'Diseño');
  q.steps.forEach(s => walk(s, stepName(s)));
  q.calculations.forEach(c => walk(c, `Cálculo «${c?.label || c?.id}»`));
  q.results.forEach(r => walk(r, r?.default ? 'Página final' : `Perfil «${r?.title || r?.id}»`));
  for (const [key, child] of Object.entries(q)) if (!['identity', 'steps', 'calculations', 'results'].includes(key)) walk({ [key]: child }, 'Quiz');
  if (publishing && !errors.length) check(Boolean(firstStep(q)), 'El quiz necesita una primera pantalla visible.');
  return [...new Set(errors)];
}
export function assertQuiz(value, publishing = false) { const errors = validateQuiz(value, publishing); if (errors.length) throw new Error(errors.slice(0, 8).join('\n')); return clone(value); }

// Editor operations that remove a screen, an option or a calculation and keep the draft valid.
// Each condition that used the removed item is resolved the way it would evaluate without it:
// a condition that can no longer be true makes an "all" group impossible, so that rule is
// dropped (variant, jump, profile) or its screen/section hidden; one that is always true is
// simply removed from the group.
function pruneGroup(group, classify) {
  if (!group?.conditions?.length) return { group, never: false };
  const kept = []; let falses = 0, trues = 0;
  for (const c of group.conditions) { const kind = classify(c); if (kind === 'false') falses++; else if (kind === 'true') trues++; else kept.push(c); }
  if (!falses && !trues) return { group, never: false };
  if (group.mode === 'any') {
    if (trues) return { group: { ...group, conditions: [] }, never: false };
    return { group: { ...group, conditions: kept }, never: !kept.length };
  }
  return { group: { ...group, conditions: kept }, never: falses > 0 };
}
function pruneExpression(e, classify, gone) {
  if (!e || typeof e !== 'object') return e;
  if (e.op === 'ref') return gone(e.ref) ? { op: 'const', value: 0 } : e;
  if (e.op === 'if') {
    const { group, never } = pruneGroup(e.when, classify);
    return never ? pruneExpression(e.no, classify, gone) : { ...e, when: group, yes: pruneExpression(e.yes, classify, gone), no: pruneExpression(e.no, classify, gone) };
  }
  return Array.isArray(e.args) ? { ...e, args: e.args.map(a => pruneExpression(a, classify, gone)) } : e;
}
function pruneStrings(value, gone) {
  if (typeof value === 'string') return value.replace(/\{\{((?:answer|score|calc|contact):[a-zA-Z0-9_-]+)\}\}/g, (match, ref) => gone(ref) ? '' : match);
  if (Array.isArray(value)) return value.map(v => pruneStrings(v, gone));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, pruneStrings(v, gone)]));
  return value;
}
function pruneQuiz(quiz, { classify, gone = () => false, stepGone = () => false, block: fixBlock = b => b }) {
  const rules = list => (list || []).flatMap(rule => { const { group, never } = pruneGroup(rule.when, classify); return never ? [] : [{ ...rule, when: group }]; });
  const blocks = list => Array.isArray(list) ? list.flatMap(b => {
    let next = fixBlock(b);
    if (!next) return [];
    const { group, never } = pruneGroup(next.when, classify);
    next = { ...next, ...(next.when ? { when: group } : {}), ...(never ? { enabled: false } : {}) };
    if (next.ref && gone(next.ref)) { const { ref, ...rest } = next; next = rest; }
    if (Array.isArray(next.points)) next.points = next.points.map(p => ({ ...p, expression: pruneExpression(p.expression, classify, gone) }));
    return [next];
  }) : list;
  const steps = quiz.steps.map(s => {
    const { group, never } = pruneGroup(s.when, classify);
    return { ...s, ...(s.when ? { when: group } : {}), ...(never ? { enabled: false } : {}),
      ...(s.jumps ? { jumps: rules(s.jumps).filter(r => r.target === '$result' || !stepGone(r.target)) } : {}),
      ...(s.variants ? { variants: rules(s.variants) } : {}),
      ...(s.blocks ? { blocks: blocks(s.blocks) } : {}) };
  });
  const calculations = quiz.calculations.map(c => ({ ...c, expression: pruneExpression(c.expression, classify, gone) }));
  const results = quiz.results.flatMap(r => {
    const { group, never } = pruneGroup(r.when, classify);
    if (never && !r.default) return [];
    return [{ ...r, ...(r.when ? { when: group } : {}), blocks: blocks(r.blocks) }];
  });
  return pruneStrings({ ...quiz, steps, calculations, results }, gone);
}
const refOf = id => ref => ref === `answer:${id}` || ref === `score:${id}`;
// Without the screen, its answer is missing: every condition on it evaluates to false.
export function removeStep(quiz, stepId) {
  const gone = refOf(stepId);
  const next = { ...quiz, steps: quiz.steps.filter(s => s.id !== stepId) };
  return pruneQuiz(next, {
    gone, stepGone: id => id === stepId, classify: c => gone(c?.ref) ? 'false' : 'keep',
    block: b => {
      if (b.type === 'gauge' && b.stepId === stepId) return null;
      if (b.type === 'planSummary' && Array.isArray(b.items)) return { ...b, items: b.items.filter(i => i?.stepId !== stepId) };
      if (b.type === 'goals' && b.stepId === stepId) { const { stepId: _, ...rest } = b; return rest; }
      if (b.type === 'stats' && Array.isArray(b.items)) return { ...b, items: b.items.map(i => { if (i?.stepId !== stepId) return i; const { stepId: _, ...rest } = i; return rest; }) };
      return b;
    },
  });
}
// A removed option is never chosen again: "equals/contains it" is false, "differs from it" is true.
export function removeOption(quiz, stepId, optionId) {
  const migrated = migrateGaugeRanges(quiz);
  const next = { ...migrated, steps: migrated.steps.map(s => s.id === stepId ? { ...s, options: (s.options || []).filter(o => o.id !== optionId) } : s) };
  const answer = `answer:${stepId}`;
  return pruneQuiz(next, {
    classify: c => c?.ref !== answer || String(c.value) !== optionId ? 'keep' : c.operator === 'neq' ? 'true' : ['eq', 'contains'].includes(c.operator) ? 'false' : 'keep',
    block: b => b.type === 'gauge' && b.stepId === stepId && Array.isArray(b.ranges) ? { ...b, ranges: b.ranges.filter(r => r?.optionId !== optionId) } : b,
  });
}
// A removed calculation has no value: conditions on it are false and formulas use 0.
export function removeCalculation(quiz, calcId) {
  const gone = ref => ref === `calc:${calcId}`;
  return pruneQuiz({ ...quiz, calculations: quiz.calculations.filter(c => c.id !== calcId) }, { gone, classify: c => gone(c?.ref) ? 'false' : 'keep' });
}
// Rule errors a new step order would introduce (rules that would read a later answer).
export function orderErrors(before, after) {
  const rules = q => validateQuiz(q).filter(e => /respuesta futura|hacia adelante/.test(e));
  const known = new Set(rules(before));
  return rules(after).filter(e => !known.has(e));
}
const constant = value => ({ op: 'const', value });
const STEP_DEFAULTS = {
  loading: { title: 'Analizando tus respuestas…', description: '', buttonText: 'Continuar', durationMs: 5000, items: ['Analizando tus respuestas', 'Eligiendo lo más importante para vos', 'Armando tu plan'] },
  info: { title: 'Un mensaje para vos', buttonText: 'Continuar', imageLayout: 'hero-bottom' },
  number: { feedbackRanges: [] },
  measure: { feedbackRanges: [] },
};
export function newStep(type, id) {
  return { id, type, title: 'Nueva pantalla', description: '', enabled: true, required: QUESTION_TYPES.includes(type), buttonText: 'Continuar', layout: 'list', imageLayout: 'top', autoAdvance: type === 'single', options: ['single', 'multiple'].includes(type) ? [{ id: 'option1', label: 'Primera opción', score: 1 }, { id: 'option2', label: 'Segunda opción', score: 2 }] : [], ...(type === 'measure' ? { units: [{ id: 'unit', label: 'Unidades', factor: 1 }] } : {}), ...(type === 'contact' ? { nameRequired: true, emailRequired: true, consentText: 'Quiero recibir novedades por email.' } : {}), ...(STEP_DEFAULTS[type] || {}) };
}
const option = (id, label, icon, extra = {}) => ({ id, label, icon, ...extra });
// Default funnel: questions with images/icons, text-only breaks, live feedback, a loading
// screen, contact capture and a personalised final page that leads to the store checkout.
export function createQuizTemplate(productName = 'tu próximo objetivo') {
  const steps = [
    { ...newStep('intro', 'welcome'), title: `Tu plan personalizado con ${productName}`, description: 'Respondé unas preguntas rápidas (menos de 2 minutos). Empezá eligiendo tu punto de partida:', required: true, autoAdvance: true,
      options: [option('new', 'Estoy empezando', '🌱', { score: 1 }), option('some', 'Ya probé algunas cosas', '🚶', { score: 2 }), option('experienced', 'Quiero profundizar', '🚀', { score: 3 })] },
    { ...newStep('single', 'goal'), title: '¿Cuál es tu objetivo principal?',
      options: [option('learn', 'Aprender desde cero', '📚', { score: 1 }), option('improve', 'Mejorar lo que ya hago', '📈', { score: 2 }), option('habit', 'Crear un hábito constante', '🔁', { score: 3 })] },
    { ...newStep('info', 'goal_info'), title: '¡Tenemos justo lo que necesitás!', description: 'Miles de personas empezaron exactamente donde estás vos.\n\nVamos a armar un plan simple, con pasos cortos que podés sostener.',
      variants: [{ when: { mode: 'all', conditions: [{ ref: 'answer:goal', operator: 'eq', value: 'habit' }] }, content: { title: 'La constancia se entrena', description: 'Con 10 minutos por día alcanza para crear el hábito. Tu plan va a priorizar acciones pequeñas y repetibles.' } }] },
    { ...newStep('multiple', 'wishes'), title: '¿Qué más te gustaría lograr?', description: 'Elegí todas las que apliquen', minSelections: 1,
      options: [option('confidence', 'Sentirme más seguro/a', '💪'), option('time', 'Aprovechar mejor mi tiempo', '⏱️'), option('results', 'Ver resultados concretos', '🎯'), option('enjoy', 'Disfrutar el proceso', '😊'), option('none', 'Nada de lo anterior', '✖️', { exclusive: true })] },
    { ...newStep('single', 'obstacle'), title: '¿Qué te frenó hasta ahora?', autoAdvance: false,
      options: [
        option('time', 'Falta de tiempo', '⌛', { feedback: { tone: 'good', title: '¡Lo tenemos en cuenta!', text: 'Tu plan usa sesiones cortas que entran en cualquier agenda.' } }),
        option('info', 'Demasiada información suelta', '🧩', { feedback: { tone: 'good', title: 'Orden ante todo', text: 'Vas a seguir un paso a paso claro, sin perderte en lo que no suma.' } }),
        option('motivation', 'Me cuesta mantener la motivación', '🔋', { feedback: { tone: 'info', title: 'Es lo más común', text: 'Por eso el plan marca pequeños logros que te mantienen avanzando.' } }),
      ] },
    { ...newStep('number', 'minutes'), title: '¿Cuántos minutos por día podés dedicarle?', description: 'Ingresá un número aproximado.', min: 1, max: 240, suffix: 'min', placeholder: '15',
      feedbackRanges: [
        { min: 1, max: 4, tone: 'warn', title: 'Es poquito, pero suma', text: 'Con tan poco tiempo vas a avanzar despacio. Si podés, apuntá a 10 minutos.' },
        { min: 5, max: 30, tone: 'good', title: '¡Ideal!', text: 'Es el rango donde más se avanza sin abandonar.' },
        { min: 31, max: 90, tone: 'info', title: 'Muy bien', text: 'Vas a poder avanzar rápido. Recordá hacer pausas.' },
        { min: 91, max: 240, tone: 'bad', title: 'Te pasaste un poco', text: 'Más tiempo no siempre es mejor: con menos y constante alcanza.' },
      ] },
    { ...newStep('info', 'social'), title: 'No estás solo/a', description: 'La mayoría de las personas que empiezan con este plan tienen tu mismo punto de partida.\n\nLo importante es dar el primer paso: ya lo estás haciendo.' },
    { ...newStep('loading', 'analyzing') },
    { ...newStep('contact', 'contact'), title: '¿A dónde te enviamos tu plan?', description: 'Lo vas a ver en la próxima pantalla.', required: true, consentText: 'Quiero recibir consejos y novedades por email.' },
  ];
  return { version: 1, identity: { name: 'Tu guía', logoUrl: '', color: '#2e8b62', background: '#f6f3ef', textColor: '#1c2530', backText: 'Atrás', skipText: 'Omitir', termsUrl: '', privacyUrl: '' }, steps, calculations: [],
    results: [{ id: 'general', default: true, title: '', description: '', stickyCta: true, buttonText: 'Quiero mi plan', blocks: finalPageBlocks(productName) }] };
}
// The final page, in the order of a mobile funnel: now/after, indicator, recommendations,
// "your plan is ready" summary, goals, what you get and (when real data exists) social proof.
export function finalPageBlocks(productName = 'tu guía', ids = { level: 'welcome', minutes: 'minutes', goal: 'goal', wishes: 'wishes' }) {
  return [
    { id: 'vsl', type: 'video', title: '', videoUrl: '' },
    { id: 'now_after', type: 'nowAfter', now: { label: 'Ahora', icon: '😕', imageUrl: '' }, after: { label: 'Con tu plan', icon: '😄', imageUrl: '' },
      metrics: [{ label: 'Claridad', now: 2, after: 5 }, { label: 'Constancia', now: 1, after: 4 }] },
    ...(ids.level ? [{ id: 'level', type: 'gauge', title: 'Tu punto de partida', stepId: ids.level, leftLabel: 'Inicial', rightLabel: 'Avanzado',
      ranges: [{ min: 1, max: 1, tone: 'info', title: 'Ideal para empezar', text: 'El plan arranca por las bases, sin dar nada por sabido.' }, { min: 2, max: 2, tone: 'good', title: 'Buena base', text: 'Vas a ordenar lo que ya sabés y sumar lo que falta.' }, { min: 3, max: 3, tone: 'good', title: 'Listo para profundizar', text: 'Vas directo a las técnicas que marcan la diferencia.' }] }] : []),
    { id: 'recommended', type: 'stats', items: [
      { icon: '📖', label: 'Tiempo diario recomendado', value: ids.minutes ? '{{answer:' + ids.minutes + '}} min' : '15 min', badge: 'Recomendado', display: 'slider', stepId: ids.minutes || undefined, scaleMin: 5, scaleMax: 60, percent: 30, minLabel: '5 min', maxLabel: '60 min' },
      { icon: '✅', label: 'Capítulos por semana', value: '3 capítulos', badge: 'Recomendado', display: 'icons', unitIcon: '📘', filled: 3, total: 10 },
    ] },
    { id: 'summary', type: 'planSummary', title: '{{contact:name}}, tu plan está *listo*', items: [ids.level && { stepId: ids.level, label: 'Nivel', icon: '📈' }, ids.goal && { stepId: ids.goal, label: 'Objetivo', icon: '🎯' }, ids.minutes && { stepId: ids.minutes, label: 'Tiempo por día', icon: '⏱️', suffix: 'min' }].filter(Boolean) },
    { id: 'goals', type: 'goals', title: 'Queremos que logres:', ...(ids.wishes ? { stepId: ids.wishes } : {}), items: ['Avanzar con un paso a paso claro'] },
    { id: 'features', type: 'features', title: 'Qué vas a recibir:', mockups: [], items: [{ icon: '📘', title: `${productName}, completo`, text: '' }, { icon: '🗓️', title: 'Un plan fácil de seguir', text: '' }, { icon: '📈', title: 'Avances visibles desde las primeras semanas', text: '' }, { icon: '💬', title: 'Ejercicios para aplicarlo', text: '' }] },
    { id: 'rating', type: 'rating', enabled: false, laurels: true, title: '', text: '', rating: 0 },
    { id: 'stories', type: 'beforeAfter', enabled: false, title: 'Resultados que nos enorgullecen', text: '*Historias de personas reales. Los resultados dependen de cada caso.', items: [] },
    { id: 'offer', type: 'offer', title: '', label: '', badge: '', note: '', buttonText: '', trust: [] },
    { id: 'guarantee', type: 'guarantee', text: '', imageUrl: '' },
    { id: 'faq', type: 'faq', enabled: false, title: 'Preguntas frecuentes', items: [{ title: '¿Dónde accedo al material?', text: 'Los enlaces se muestran apenas se confirma el pago.' }] },
  ];
}
export function createAdvancedQuizTemplate(productName = 'tu próximo objetivo') {
  const steps = [
    { ...newStep('intro', 'welcome'), title: `Encontrá cómo empezar con ${productName}`, description: 'Respondé a tu ritmo y descubrí qué parte de esta propuesta encaja con vos.', buttonText: 'Empezar' },
    { ...newStep('single', 'experience'), title: '¿Cuál es tu punto de partida?', options: [{ id: 'new', label: 'Estoy empezando', score: 1 }, { id: 'some', label: 'Ya probé algunas cosas', score: 2 }, { id: 'experienced', label: 'Quiero profundizar', score: 3 }] },
    { ...newStep('info', 'encouragement'), title: 'Un paso a la vez', description: 'Vamos a identificar tus prioridades para presentarte el contenido más relevante.', variants: [{ when: { mode: 'all', conditions: [{ ref: 'answer:experience', operator: 'eq', value: 'new' }] }, content: { title: 'Empezar también cuenta', description: 'Podés avanzar desde las bases, sin experiencia previa.' } }] },
    { ...newStep('multiple', 'goals'), title: '¿Qué te gustaría conseguir?', options: [{ id: 'learn', label: 'Aprender las bases', score: 1 }, { id: 'practice', label: 'Aplicarlo con constancia', score: 2 }, { id: 'organize', label: 'Organizar mis próximos pasos', score: 1 }, { id: 'none', label: 'Todavía no lo sé', score: 0, exclusive: true }] },
    { ...newStep('number', 'minutes'), title: '¿Cuántos minutos podés dedicar por día?', min: 1, max: 240 },
    { ...newStep('measure', 'weekly'), title: '¿Cuánto tiempo reservás por semana?', units: [{ id: 'minutes', label: 'Minutos', factor: 1 }, { id: 'hours', label: 'Horas', factor: 60 }], min: 0, max: 10080 },
    { ...newStep('date', 'start'), title: '¿Cuándo te gustaría empezar?', required: false },
    { ...newStep('text', 'motivation'), title: '¿Qué te motiva a dar este paso?', required: false },
    { ...newStep('summary', 'summary'), title: 'Tus prioridades', blocks: [{ id: 'answers', type: 'answers', title: 'Lo que nos contaste' }, { id: 'time', type: 'metric', title: 'Minutos en cuatro semanas', ref: 'calc:month' }] },
    { ...newStep('contact', 'contact'), title: '¿Cómo te llamás?', description: 'Tus datos se guardarán junto con tus respuestas. Podés continuar sin dejarlos.', required: false, nameRequired: false, emailRequired: false },
    { ...newStep('transition', 'ready'), title: 'Prepará tu próximo paso', description: 'Al continuar guardaremos tus respuestas y mostraremos tu resultado.', buttonText: 'Ver mi resultado' },
  ];
  return { version: 1, identity: { name: 'Tu guía', logoUrl: '', color: '#27785b', background: '#f7f5f2', textColor: '#1c2530', backText: 'Atrás', skipText: 'Omitir', termsUrl: '', privacyUrl: '' }, steps,
    calculations: [{ id: 'month', label: 'Minutos en cuatro semanas', expression: { op: 'multiply', args: [{ op: 'ref', ref: 'answer:minutes' }, constant(28)] } }],
    results: [{ id: 'general', default: true, title: 'Tu punto de partida', description: 'Estas son tus prioridades y la propuesta disponible para acompañarte.', stickyCta: true, buttonText: 'Ver checkout', blocks: [
      { id: 'recap', type: 'answers', title: 'Tu resumen' },
      { id: 'metric', type: 'metric', title: 'Tiempo que elegiste dedicar en cuatro semanas', ref: 'calc:month' },
      { id: 'scale', type: 'scale', title: 'Experiencia declarada', ref: 'score:experience', min: 0, max: 3 },
      { id: 'comparison', type: 'comparison', title: 'Tiempo disponible', points: [{ label: 'Por día', expression: { op: 'ref', ref: 'answer:minutes' } }, { label: 'Por semana', expression: { op: 'ref', ref: 'score:weekly' } }] },
      { id: 'chart', type: 'line', title: 'Ejemplo de distribución del tiempo', text: 'Distribución ilustrativa del tiempo declarado; no representa resultados garantizados.', points: [1, 2, 3, 4].map(n => ({ label: `Semana ${n}`, expression: { op: 'multiply', args: [{ op: 'ref', ref: 'answer:minutes' }, constant(7 * n)] } })) },
      { id: 'bars', type: 'bar', enabled: false, title: 'Prioridades', points: [{ label: 'Objetivos', expression: { op: 'ref', ref: 'score:goals' } }] },
      { id: 'benefits', type: 'benefits', title: 'Tu siguiente paso', items: [{ title: 'Elegí por dónde empezar', text: 'Revisá si el contenido del producto responde a tus objetivos.' }] },
      { id: 'image', type: 'image', enabled: false, title: 'Conocé el material', imageUrl: '' },
      { id: 'video', type: 'video', enabled: false, title: 'Presentación', videoUrl: '' },
      { id: 'testimonials', type: 'testimonials', enabled: false, title: 'Opiniones de lectores', items: [] },
      { id: 'promotion', type: 'promotion', enabled: false, title: 'Propuesta disponible', text: '' },
      { id: 'offer', type: 'offer', title: 'Qué incluye tu compra' },
      { id: 'faq', type: 'faq', title: 'Preguntas frecuentes', items: [{ title: '¿Dónde accedo al material?', text: 'Los enlaces se muestran cuando se confirma el pago.' }] },
      { id: 'guarantee', type: 'guarantee', text: '', imageUrl: '' },
    ] }] };
}

export function initialSession(quiz) {
  return {revision:0,lastCommand:'',currentStep:firstStep(quiz),history:[],answers:{},calculations:contextFor(quiz).calculations};
}
// Same transition for preview and server. Going back discards all downstream answers,
// so hidden data never influences a newly chosen branch.
export function advanceSession(quiz, session, command, now = Date.now()) {
  if (command.commandId === session.lastCommand) return session;
  if (command.revision !== session.revision) throw new Error('Your session changed. Reload the page to continue where you left off.');
  let answers = clone(session.answers), history = [...session.history], currentStep = session.currentStep;
  if (command.direction === 'back') {
    let previous = history.pop();
    // Loading screens advance on their own, so going back skips them.
    while (previous && history.length && quiz.steps.find(s => s.id === previous)?.type === 'loading') previous = history.pop();
    if (!previous) throw new Error('There is no previous screen.');
    const index = quiz.steps.findIndex(s=>s.id===previous);
    answers = Object.fromEntries(Object.entries(answers).filter(([id])=>quiz.steps.findIndex(s=>s.id===id)<=index));
    currentStep = previous;
  } else {
    const step = quiz.steps.find(s=>s.id===currentStep);
    if (!step) throw new Error('This quiz is already finished.');
    const value = validateAnswer(step, command.value);
    if (value !== null) answers[step.id] = value; else delete answers[step.id];
    history.push(step.id);
    currentStep = nextStep(quiz, step.id, answers);
  }
  const context = contextFor(quiz,answers);
  return {revision:session.revision+1,lastCommand:command.commandId,currentStep,history,answers,calculations:context.calculations,
    ...(currentStep === null ? {resultId:resultFor(quiz,answers).id,completedAt:now} : {}), contact:context.contact};
}
export function applicableQuestions(quiz, session) {
  const ids=[...session.history]; let id=session.currentStep;
  for(let n=0;id && n<quiz.steps.length;n++){ids.push(id);id=nextStep(quiz,id,session.answers);}
  return ids.filter(id=>QUESTION_TYPES.includes(quiz.steps.find(s=>s.id===id)?.type));
}
