import { describe, it, expect } from 'vitest';
import { createQuizTemplate, createAdvancedQuizTemplate, validateQuiz, validateAnswer, removeStep, removeOption, removeCalculation, orderErrors, migrateGaugeRanges, choiceRanges, gaugeFor, contextFor, isRequired, clone } from '../shared/quiz.js';

const move = (quiz, from, to) => { const steps = [...quiz.steps]; const [step] = steps.splice(from, 1); steps.splice(to, 0, step); return { ...quiz, steps }; };

describe('quiz editor operations', () => {
  it('keeps every template savable after removing any screen', () => {
    for (const quiz of [createQuizTemplate('Guía'), createAdvancedQuizTemplate('Guía')])
      for (const step of quiz.steps) expect(validateQuiz(removeStep(quiz, step.id)), step.id).toEqual([]);
  });
  it('drops rules, variables and sections that read a removed screen', () => {
    const quiz = removeStep(createQuizTemplate('Guía'), 'minutes');
    const blocks = quiz.results[0].blocks;
    expect(JSON.stringify(quiz)).not.toContain('answer:minutes');
    expect(blocks.find(b => b.type === 'planSummary').items.some(i => i.stepId === 'minutes')).toBe(false);
    expect(blocks.find(b => b.type === 'stats').items[0].stepId).toBeUndefined();
    expect(removeStep(createQuizTemplate('Guía'), 'goal').steps.find(s => s.id === 'goal_info').variants).toEqual([]);
    expect(removeStep(createQuizTemplate('Guía'), 'welcome').results[0].blocks.some(b => b.type === 'gauge')).toBe(false);
  });
  it('resolves conditions on a removed option and a removed calculation', () => {
    const quiz = createQuizTemplate('Guía');
    quiz.steps.find(s => s.id === 'social').when = { mode: 'all', conditions: [{ ref: 'answer:goal', operator: 'neq', value: 'habit' }] };
    const next = removeOption(quiz, 'goal', 'habit');
    expect(next.steps.find(s => s.id === 'goal_info').variants).toEqual([]);
    expect(next.steps.find(s => s.id === 'social').when.conditions).toEqual([]);
    expect(validateQuiz(next)).toEqual([]);
    const advanced = removeCalculation(createAdvancedQuizTemplate('Guía'), 'month');
    expect(validateQuiz(advanced)).toEqual([]);
    expect(JSON.stringify(advanced)).not.toContain('calc:month');
  });
  it('reports moves that make a rule read a later answer, by screen title', () => {
    const quiz = createQuizTemplate('Guía');
    const index = quiz.steps.findIndex(s => s.id === 'goal_info');
    expect(orderErrors(quiz, move(quiz, index, 0))[0]).toMatch(/Pantalla «¡Tenemos justo lo que necesitás!».*respuesta futura/);
    expect(orderErrors(quiz, move(quiz, index, index + 1))).toEqual([]);
  });
  it('ties gauge feedback to the option, not its position', () => {
    const quiz = migrateGaugeRanges(createQuizTemplate('Guía'));
    const gauge = quiz.results[0].blocks.find(b => b.type === 'gauge');
    expect(gauge.ranges.map(r => r.optionId)).toEqual(['new', 'some', 'experienced']);
    const welcome = quiz.steps[0]; welcome.options = [welcome.options[2], welcome.options[0], welcome.options[1]];
    expect(gaugeFor(gauge, contextFor(quiz, { welcome: 'new' })).feedback.title).toBe('Ideal para empezar');
    expect(choiceRanges(gauge, welcome)[0]).toMatchObject({ optionId: 'experienced', title: 'Listo para profundizar' });
    expect(validateQuiz(quiz)).toEqual([]);
  });
  it('treats an unset "required" the same in editor, player and server', () => {
    const quiz = clone(createAdvancedQuizTemplate('Guía'));
    const text = { ...quiz.steps.find(s => s.type === 'text') }; delete text.required;
    expect(isRequired(text)).toBe(true);
    expect(() => validateAnswer(text, '')).toThrow();
    const cover = { ...quiz.steps[0] }; delete cover.required;
    expect(isRequired(cover)).toBe(false);
    expect(validateAnswer(cover, null)).toBeNull();
  });
});
