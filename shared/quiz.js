// Shared, deterministic quiz language. Never evaluates user JavaScript.
export const STEP_TYPES = ['intro', 'single', 'multiple', 'text', 'number', 'measure', 'date', 'info', 'contact', 'summary', 'transition'];
export const BLOCK_TYPES = ['text', 'image', 'video', 'answers', 'metric', 'scale', 'comparison', 'line', 'bar', 'benefits', 'offer', 'testimonials', 'faq', 'guarantee', 'promotion'];
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
export function interpolate(text, context) { return String(text || '').replace(/\{\{((?:answer|score|calc|contact):[a-zA-Z0-9_-]+)\}\}/g, (_, ref) => displayRef(ref, context)); }
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
export function validDate(value) { return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function validateAnswer(step, value) {
  const fail = message => { throw new Error(message); };
  const empty = value == null || value === '' || (Array.isArray(value) && !value.length);
  if (empty) { if ((step.required && [...QUESTION_TYPES, 'contact', 'intro'].includes(step.type)) || (step.type === 'contact' && (step.nameRequired || step.emailRequired))) fail('Completá esta respuesta para continuar.'); return null; }
  if ((step.type === 'single' || (step.type === 'intro' && step.options?.length)) && !step.options.some(o => o.id === value)) fail('Elegí una opción válida.');
  if (step.type === 'multiple') {
    if (!Array.isArray(value) || new Set(value).size !== value.length || value.some(id => !step.options.some(o => o.id === id))) fail('Revisá las opciones seleccionadas.');
    if (value.length < (step.minSelections ?? (step.required ? 1 : 0)) || value.length > (step.maxSelections ?? step.options.length)) fail('Revisá la cantidad de opciones seleccionadas.');
    if (value.length > 1 && value.some(id => step.options.find(o => o.id === id)?.exclusive)) fail('La opción exclusiva no se puede combinar.');
  }
  if (['number', 'measure'].includes(step.type)) {
    if (step.type === 'measure' && (!value || !step.units.some(u => u.id === value.unit))) fail('Elegí una unidad válida.');
    const number = step.type === 'measure' ? answerValue(step, value) : value;
    if (finite(number) == null || (step.min != null && number < step.min) || (step.max != null && number > step.max)) fail('Ingresá un número dentro del rango permitido.');
  }
  if (step.type === 'text' && (typeof value !== 'string' || value.length > 2000)) fail('Ingresá hasta 2.000 caracteres.');
  if (step.type === 'date' && (!validDate(value) || (step.minDate && value < step.minDate) || (step.maxDate && value > step.maxDate))) fail('Ingresá una fecha válida dentro del rango permitido.');
  if (step.type === 'contact') {
    if (typeof value !== 'object' || Array.isArray(value)) fail('Revisá los datos de contacto.');
    const name = String(value.name || '').trim(), email = String(value.email || '').trim().toLowerCase();
    if (name.length > 120 || email.length > 254 || (step.nameRequired && !name) || (step.emailRequired && !email) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) fail('Revisá tu nombre y email.');
    if (value.consent != null && typeof value.consent !== 'boolean') fail('Consentimiento inválido.');
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
    check(STEP_TYPES.includes(s.type), `${s.id}: tipo de pantalla inválido.`);
    if (publishing && s.enabled !== false) check(typeof s.title === 'string' && s.title.trim(), `${s.id}: falta el título.`);
    group(s.when, s.id);
    if (['single', 'multiple'].includes(s.type) || (s.type === 'intro' && s.options?.length)) {
      const opts = s.options || []; ids(opts, s.id); check(opts.length >= 1 && opts.length <= 30, `${s.id}: configurá entre 1 y 30 opciones.`);
      opts.forEach(o => { check(typeof o.label === 'string' && o.label.trim(), `${s.id}: opción sin texto.`); if (o.score != null) check(finite(o.score) != null, `${s.id}: puntuación inválida.`); });
      check((s.minSelections ?? 0) >= 0 && (s.maxSelections ?? opts.length) <= opts.length && (s.minSelections ?? 0) <= (s.maxSelections ?? opts.length), `${s.id}: límites de selección inválidos.`);
    }
    if (s.type === 'measure') { ids(s.units || [], s.id); check(s.units?.length > 0 && s.units.length <= 8 && s.units.every(u => finite(u.factor) != null && u.factor > 0 && u.label), `${s.id}: unidades inválidas.`); }
    if (s.min != null || s.max != null) check((s.min == null || finite(s.min) != null) && (s.max == null || finite(s.max) != null) && (s.min == null || s.max == null || s.min <= s.max), `${s.id}: límites numéricos inválidos.`);
    if (s.minDate) check(validDate(s.minDate), `${s.id}: fecha mínima inválida.`);
    if (s.maxDate) check(validDate(s.maxDate), `${s.id}: fecha máxima inválida.`);
    if (s.minDate && s.maxDate) check(s.minDate <= s.maxDate, `${s.id}: rango de fechas inválido.`);
    for (const rule of s.jumps || []) { group(rule.when, s.id); check(rule.target === '$result' || q.steps.findIndex(x => x.id === rule.target) > index, `${s.id}: los saltos deben ir hacia adelante.`); }
    for (const variant of s.variants || []) { group(variant.when, s.id); check(variant.content && Object.keys(variant.content).every(k => ['title', 'description', 'imageUrl', 'sideImageUrl', 'buttonText'].includes(k)), `${s.id}: variante inválida.`); }
    const dependencies = [...refsIn(s.when), ...refsIn(s.jumps), ...refsIn(s.variants)];
    const earlier = (ref, seen = new Set()) => {
      if (seen.has(ref)) return false; seen.add(ref);
      if (ref.startsWith('calc:')) { const c = q.calculations.find(c => `calc:${c.id}` === ref); return c ? refsIn(c.expression).every(r => earlier(r, new Set(seen))) : false; }
      if (ref.startsWith('contact:')) return q.steps.slice(0, index).some(x => x.type === 'contact');
      const pos = q.steps.findIndex(x => x.id === ref.split(':')[1]);
      return pos >= 0 && pos <= index;
    };
    dependencies.forEach(ref => check(earlier(ref), `${s.id}: una regla depende de una respuesta futura o circular.`));
    const self = (ref, seen = new Set()) => { if (seen.has(ref)) return true; seen.add(ref); return ref === `answer:${s.id}` || ref === `score:${s.id}` || (ref.startsWith('calc:') && refsIn(q.calculations.find(c => `calc:${c.id}` === ref)?.expression).some(r=>self(r,new Set(seen)))); };
    refsIn(s.when).forEach(ref => check(!self(ref), `${s.id}: la visibilidad no puede depender de su propia respuesta.`));
  });
  q.calculations.forEach(c => expression(c.expression, c.id));
  const visited = new Set(), active = new Set();
  const visit = id => {
    if (active.has(id)) { errors.push(`Cálculo circular: ${id}.`); return; }
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
    list.forEach(b => { check(BLOCK_TYPES.includes(b.type), `${label}: bloque inválido.`); group(b.when, label); if (b.ref) check(refs.has(b.ref), `${label}: referencia desconocida.`); if (b.type === 'scale') check(finite(b.min) != null && finite(b.max) != null && b.min < b.max, `${label}: escala inválida.`); (b.points || []).forEach(p => expression(p.expression, label)); });
  };
  q.steps.forEach(s => { if (s.blocks) blocks(s.blocks, s.id); });
  q.results.forEach(r => { group(r.when, r.id); blocks(r.blocks, r.id); });
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (['title','description','text','label','name','buttonText','consentText','icon','legend','suffix','placeholder','imageAlt','backText','skipText'].includes(key) || /Url$/.test(key)) check(typeof child === 'string', `Texto inválido en ${key}.`);
      if (['required','enabled','default','autoAdvance','exclusive','stickyCta','nameRequired','emailRequired'].includes(key)) check(typeof child === 'boolean', `Opción inválida en ${key}.`);
      if (typeof child === 'string') {
        check(child.length <= 6000, `Texto demasiado largo en ${key}.`);
        if (/Url$/.test(key) && child) { try { check(new URL(child).protocol === 'https:', `Usá una URL HTTPS en ${key}.`); } catch { errors.push(`URL inválida en ${key}.`); } }
        if (['color', 'background', 'textColor'].includes(key)) check(/^#[a-f\d]{6}$/i.test(child), `Color inválido en ${key}.`);
        for (const match of child.matchAll(/\{\{([^}]+)\}\}/g)) check(refs.has(match[1]), `Variable desconocida: ${match[1]}.`);
      } else walk(child);
    }
  };
  walk(q);
  if (publishing && !errors.length) check(Boolean(firstStep(q)), 'El quiz necesita una primera pantalla visible.');
  return [...new Set(errors)];
}
export function assertQuiz(value, publishing = false) { const errors = validateQuiz(value, publishing); if (errors.length) throw new Error(errors.slice(0, 8).join('\n')); return clone(value); }
const constant = value => ({ op: 'const', value });
export function newStep(type, id) {
  return { id, type, title: 'Nueva pantalla', description: '', enabled: true, required: QUESTION_TYPES.includes(type), buttonText: 'Continuar', layout: 'list', autoAdvance: type === 'single', options: ['single', 'multiple'].includes(type) ? [{ id: 'option1', label: 'Primera opción', score: 1 }, { id: 'option2', label: 'Segunda opción', score: 2 }] : [], ...(type === 'measure' ? { units: [{ id: 'unit', label: 'Unidades', factor: 1 }] } : {}), ...(type === 'contact' ? { nameRequired: true, emailRequired: true, consentText: 'Quiero recibir novedades por email.' } : {}) };
}
export function createQuizTemplate(productName = 'tu próximo objetivo') {
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
      { id: 'guarantee', type: 'guarantee', title: 'Condiciones de la oferta' },
    ] }] };
}

export function initialSession(quiz) {
  return {revision:0,lastCommand:'',currentStep:firstStep(quiz),history:[],answers:{},calculations:contextFor(quiz).calculations};
}
// Same transition for preview and server. Going back discards all downstream answers,
// so hidden data never influences a newly chosen branch.
export function advanceSession(quiz, session, command, now = Date.now()) {
  if (command.commandId === session.lastCommand) return session;
  if (command.revision !== session.revision) throw new Error('La sesión cambió. Recuperá el avance antes de reintentar.');
  let answers = clone(session.answers), history = [...session.history], currentStep = session.currentStep;
  if (command.direction === 'back') {
    const previous = history.pop();
    if (!previous) throw new Error('No hay una pantalla anterior.');
    const index = quiz.steps.findIndex(s=>s.id===previous);
    answers = Object.fromEntries(Object.entries(answers).filter(([id])=>quiz.steps.findIndex(s=>s.id===id)<=index));
    currentStep = previous;
  } else {
    const step = quiz.steps.find(s=>s.id===currentStep);
    if (!step) throw new Error('Este recorrido ya terminó.');
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
