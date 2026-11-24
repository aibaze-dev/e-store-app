import { describe, expect, it } from 'vitest';
import { artifactNameFor, brandNameFor, LANGUAGE_KEY, languageFromSearch, readStoredLanguage, storeLanguage, suggestedLanguage } from '../src/artifacts/i18n.js';
import { artifacts } from '../src/artifacts/registry.js';
import { QUESTIONS } from '../src/artifacts/ai-knowledge/questions.js';
import { createExam, gradeExam, localizeQuestion } from '../src/artifacts/ai-knowledge/quiz.js';
import { STRINGS as QUIZ_STRINGS } from '../src/artifacts/ai-knowledge/strings.js';
import { buildPrompt, EMPTY_FORM, FORMATS, LENGTHS, optionLabel, TASKS, taskText, TONES } from '../src/artifacts/prompt-builder/builder.js';
import { EXAMPLES, examplesFor } from '../src/artifacts/prompt-builder/examples.js';
import { savePrompt, readHistory } from '../src/artifacts/prompt-builder/history.js';
import { STRINGS as PB_STRINGS } from '../src/artifacts/prompt-builder/strings.js';
import { buildCard, cardText, rehearsalPrompt, SCENARIOS, scenarioFor, validateForm } from '../src/artifacts/meeting-prep/templates.js';
import { STRINGS as MP_STRINGS } from '../src/artifacts/meeting-prep/strings.js';
import { formatProjectBrief, localizeSections, projectSections } from '../src/artifacts/project-brief/questions.js';
import { QUESTION_TEXT, STRINGS as PB_BRIEF_STRINGS } from '../src/artifacts/project-brief/strings.js';

const LANGS = ['es', 'pt'];
const memory = () => { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }; };
const sameKeys = (table, lang) => expect(Object.keys(table[lang]).sort()).toEqual(Object.keys(table.en).sort());

describe('artifact language selection', () => {
  it('reads a supported ?lang value, including regional codes, and ignores the rest', () => {
    expect(languageFromSearch('?lang=es')).toBe('es');
    expect(languageFromSearch('?utm=x&lang=pt-BR')).toBe('pt');
    expect(languageFromSearch('?lang=fr')).toBeNull();
    expect(languageFromSearch('')).toBeNull();
  });

  it('remembers only supported choices and survives unavailable storage', () => {
    const storage = memory();
    expect(readStoredLanguage(storage)).toBeNull();
    storeLanguage('de', storage);
    expect(storage.getItem(LANGUAGE_KEY)).toBeNull();
    storeLanguage('pt', storage);
    expect(readStoredLanguage(storage)).toBe('pt');
    const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(readStoredLanguage(broken)).toBeNull();
    expect(() => storeLanguage('es', broken)).not.toThrow();
  });

  it('suggests the first supported browser language, defaulting to English', () => {
    expect(suggestedLanguage(['fr-FR', 'pt-BR', 'es'])).toBe('pt');
    expect(suggestedLanguage(['de'])).toBe('en');
  });

  it('names every artifact and the brand in each language', () => {
    for (const lang of ['en', ...LANGS]) {
      expect(brandNameFor(lang)).toBeTruthy();
      for (const artifact of artifacts) expect(artifactNameFor(artifact, lang)).toBeTruthy();
    }
    expect(artifactNameFor(artifacts[0], 'en')).toBe(artifacts[0].name);
  });
});

describe.each(LANGS)('%s translations', lang => {
  it('cover every interface string', () => {
    for (const table of [QUIZ_STRINGS, PB_STRINGS, MP_STRINGS, PB_BRIEF_STRINGS]) sameKeys(table, lang);
    expect(PB_STRINGS[lang].questions).toHaveLength(PB_STRINGS.en.questions.length);
    expect(Object.keys(QUIZ_STRINGS[lang].days)).toEqual(Object.keys(QUIZ_STRINGS.en.days));
  });

  it('translate all 44 quiz questions without changing answers or pages', () => {
    for (const question of QUESTIONS) {
      const local = localizeQuestion(question, lang);
      expect(local.prompt).not.toBe(question.prompt);
      expect(local.explanation.length).toBeGreaterThan(30);
      expect(new Set(local.options.map(o => o.text)).size).toBe(4);
      expect(local.options.map(o => o.id)).toEqual(question.options.map(o => o.id));
      expect(local).toMatchObject({ id: question.id, page: question.page, chapter: question.chapter, answerId: question.answerId });
    }
    const exam = createExam('global', [], () => 0.3);
    const answers = Object.fromEntries(exam.map(q => [q.id, q.answerId]));
    expect(gradeExam(exam.map(q => localizeQuestion(q, lang)), answers).percent).toBe(100);
  });

  it('build the whole prompt, labels and examples in the chosen language', () => {
    const form = { ...EMPTY_FORM, task: 'Tarea', context: 'Contexto', resources: 'https://example.com' };
    const english = buildPrompt(form);
    const local = buildPrompt(form, lang);
    expect(local).not.toBe(english);
    expect(local).toContain(taskText('email', lang).role);
    expect(local).not.toMatch(/TASK\n|Write the final response in English|undefined/);
    for (const [kind, values] of [['tones', TONES], ['formats', FORMATS], ['lengths', LENGTHS]]) {
      for (const value of values) expect(optionLabel(kind, value, lang)).toBeTruthy();
    }
    for (const task of TASKS) {
      expect(examplesFor(lang)[task.id].map(e => e.id)).toEqual(EXAMPLES[task.id].map(e => e.id));
      expect(Object.keys(taskText(task.id, lang).example).sort()).toEqual(Object.keys(task.example).sort());
    }
  });

  it('keeps saved prompts valid with their language', () => {
    const storage = memory();
    const entry = { id: 'a', createdAt: 1, updatedAt: 1, form: { ...EMPTY_FORM, task: 'x', language: lang }, output: 'y' };
    savePrompt(entry, storage);
    expect(readHistory(storage)).toEqual([entry]);
    expect(() => savePrompt({ ...entry, form: { ...entry.form, language: 'fr' } }, storage)).toThrow();
  });

  it('builds meeting cards and rehearsal prompts in the chosen language', () => {
    for (const base of SCENARIOS) {
      const scenario = scenarioFor(base.id, lang);
      expect(scenario.label).not.toBe(base.label);
      expect(scenario.example.facts).toHaveLength(3);
      const card = buildCard({ ...scenario.example, scenario: base.id }, lang);
      expect(card.opening).toBe(scenario.opening);
      expect(cardText(card, lang)).toContain(scenario.label);
      expect(rehearsalPrompt(card, lang)).not.toContain('REHEARSAL FORMAT');
    }
    expect(Object.values(validateForm({ outcome: '', point: '' }, lang))[0]).not.toMatch(/Describe the result/);
  });

  it('translates the project brief questions but sends English keys to the team', () => {
    for (const product of ['Landing page', 'Custom system']) {
      const sections = projectSections(product);
      const local = localizeSections(sections, QUESTION_TEXT[lang]);
      local.flatMap(s => s.questions).forEach((q, i) => {
        const original = sections.flatMap(s => s.questions)[i];
        expect(q.key).toBe(original.key);
        expect(q.label).not.toBe(original.label);
      });
      expect(formatProjectBrief(local, { Goal: 'Más reservas' })).toBe('Goal: Más reservas');
    }
  });
});
