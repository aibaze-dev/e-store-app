import { describe, expect, it } from 'vitest';
import { QUESTIONS } from '../src/artifacts/ai-knowledge/questions.js';
import { BOOK_URL, DAYS, createExam, gradeExam, pageUrl, shuffle } from '../src/artifacts/ai-knowledge/quiz.js';

function seeded(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
const answersFor = questions => Object.fromEntries(questions.map(q => [q.id, q.answerId]));

describe('ebook question bank', () => {
  it('covers all 11 chapters with unambiguous choices and valid lesson references', () => {
    const ranges = [[7, 15], [16, 27], [28, 38], [39, 48], [49, 56], [57, 66], [67, 76], [77, 85], [86, 94], [95, 102], [103, 110]];
    expect(QUESTIONS).toHaveLength(44);
    expect(new Set(QUESTIONS.map(q => q.id)).size).toBe(44);
    ranges.forEach(([from, to], i) => {
      const chapter = QUESTIONS.filter(q => q.chapter === i + 1);
      expect(chapter).toHaveLength(4);
      for (const q of chapter) {
        expect(q.page).toBeGreaterThanOrEqual(from);
        expect(q.page).toBeLessThanOrEqual(to);
        expect(q.options).toHaveLength(4);
        expect(new Set(q.options.map(o => o.id)).size).toBe(4);
        expect(new Set(q.options.map(o => o.text)).size).toBe(4);
        expect(q.options.filter(o => o.id === q.answerId)).toHaveLength(1);
        expect(q.explanation.length).toBeGreaterThan(30);
      }
    });
  });

  it('links to the supplied ebook using physical PDF page numbers', () => {
    expect(pageUrl(54)).toBe(`${BOOK_URL}#page=54`);
  });
});

describe('test selection', () => {
  it.each(DAYS)('keeps Day $id within its two chapters, with three questions each', day => {
    const exam = createExam(day.id, [], seeded(11));
    expect(exam).toHaveLength(6);
    expect(new Set(exam.map(q => q.id)).size).toBe(6);
    for (const chapter of day.chapters) expect(exam.filter(q => q.chapter === chapter)).toHaveLength(3);
  });

  it('balances the global test across every chapter, including the foundations', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const exam = createExam('global', [], seeded(seed));
      expect(exam).toHaveLength(22);
      expect(new Set(exam.map(q => q.id)).size).toBe(22);
      for (let chapter = 1; chapter <= 11; chapter++) expect(exam.filter(q => q.chapter === chapter)).toHaveLength(2);
    }
  });

  it.each(['global', ...DAYS.map(day => day.id)])('changes the %s question set even when randomness repeats', mode => {
    const first = createExam(mode, [], () => 0.5);
    const second = createExam(mode, first.map(q => q.id), () => 0.5);
    expect(second.map(q => q.id).sort()).not.toEqual(first.map(q => q.id).sort());
    expect(second).toHaveLength(first.length);
    for (const chapter of new Set(first.map(q => q.chapter))) {
      expect(second.filter(q => q.chapter === chapter)).toHaveLength(first.filter(q => q.chapter === chapter).length);
    }
  });

  it('varies answer positions without mutating the bank or losing answer identity', () => {
    const original = JSON.stringify(QUESTIONS);
    const positions = new Set();
    for (let seed = 1; seed <= 10; seed++) {
      for (const q of createExam('global', [], seeded(seed))) positions.add(q.options.findIndex(o => o.id === q.answerId));
    }
    expect(positions.size).toBe(4);
    expect(JSON.stringify(QUESTIONS)).toBe(original);
    const source = [1, 2, 3, 4];
    expect(shuffle(source, () => 0)).not.toEqual(source);
    expect(source).toEqual([1, 2, 3, 4]);
  });

  it('rejects invalid modes', () => { expect(() => createExam('6')).toThrow('Unknown test'); });
});

describe('grading and review', () => {
  it('scores all correct and all wrong, independently of shuffled order', () => {
    const exam = createExam('global', [], seeded(42));
    expect(gradeExam(exam, answersFor(exam))).toMatchObject({ correct: 22, total: 22, percent: 100 });
    const wrong = Object.fromEntries(exam.map(q => [q.id, q.options.find(o => o.id !== q.answerId).id]));
    const result = gradeExam(exam, wrong);
    expect(result).toMatchObject({ correct: 0, total: 22, percent: 0 });
    expect(result.review.every(q => !q.correct && q.page && q.explanation)).toBe(true);
  });

  it('uses the current answers, rounds the percentage, and retains exact review pages', () => {
    const exam = createExam('2', [], seeded(3));
    const answers = answersFor(exam);
    answers[exam[0].id] = 'other-0';
    answers[exam[1].id] = 'other-1';
    const result = gradeExam(exam, answers);
    expect(result).toMatchObject({ correct: 4, total: 6, percent: 67 });
    expect(result.groups).toEqual([{ id: '2', label: 'Day 2 · Ask', correct: 4, total: 6 }]);
    expect(result.review.filter(q => !q.correct).map(q => q.page)).toEqual([exam[0].page, exam[1].page]);
    answers[exam[0].id] = exam[0].answerId;
    expect(gradeExam(exam, answers).correct).toBe(5);
  });

  it('does not grade incomplete, empty, or invalid answer sets', () => {
    const exam = createExam('1', [], seeded(7));
    expect(() => gradeExam(exam, {})).toThrow('Answer every question');
    const answers = answersFor(exam);
    answers[exam[0].id] = 'not-an-option';
    expect(() => gradeExam(exam, answers)).toThrow('Answer every question');
    expect(() => gradeExam([], {})).toThrow('Answer every question');
  });
});
