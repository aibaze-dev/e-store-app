import { QUESTIONS } from './questions.js';
import { QUESTIONS_ES } from './questions.es.js';
import { QUESTIONS_PT } from './questions.pt.js';

export const BOOK_URL = 'https://capable-gnu-944.convex.cloud/api/storage/9ca0b6b6-b885-4843-b0fd-40308765ea53';
export const DAYS = [
  { id: '1', name: 'Set up', description: 'Get comfortable. Start a conversation. Find your first win.', chapters: [2, 3], pages: '16–38' },
  { id: '2', name: 'Ask', description: 'Write a better brief, refine an answer, and find your voice.', chapters: [4, 5], pages: '39–56' },
  { id: '3', name: 'Work', description: 'Put emails, documents, meetings, and spreadsheets to work.', chapters: [6, 7], pages: '57–76' },
  { id: '4', name: 'Train', description: 'Know your Projects, Skills, connectors, and permissions.', chapters: [8, 9], pages: '77–94' },
  { id: '5', name: 'Build', description: 'Check your sources, build useful tools, and work safely.', chapters: [10, 11], pages: '95–110' },
];

export function pageUrl(page) { return `${BOOK_URL}#page=${page}`; }
export function dayFor(chapter) { return DAYS.find(day => day.chapters.includes(chapter)); }
export function modeLabel(mode) { const day = DAYS.find(item => item.id === mode); return day ? `Day ${day.id} · ${day.name}` : 'Global test'; }

export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Balanced sampling: every chapter in the selected scope gets equal weight.
// A retry changes the question set, even if random sampling repeats the last one.
export function createExam(mode, previousIds = [], random = Math.random) {
  const day = DAYS.find(item => item.id === mode);
  if (mode !== 'global' && !day) throw new Error('Unknown test');
  const chapters = day ? day.chapters : Array.from({ length: 11 }, (_, i) => i + 1);
  const perChapter = day ? 3 : 2;
  const selected = chapters.flatMap(chapter => shuffle(QUESTIONS.filter(q => q.chapter === chapter), random).slice(0, perChapter));
  const previous = new Set(previousIds);
  if (selected.length === previous.size && selected.every(q => previous.has(q.id))) {
    const replacement = QUESTIONS.find(q => q.chapter === selected[0].chapter && !previous.has(q.id));
    if (replacement) selected[0] = replacement;
  }
  return shuffle(selected, random).map(q => ({ ...q, options: shuffle(q.options, random) }));
}

export function gradeExam(questions, answers) {
  if (!questions.length || questions.some(q => !q.options.some(option => option.id === answers[q.id]))) {
    throw new Error('Answer every question before finishing.');
  }
  const review = questions.map(q => ({ ...q, selectedId: answers[q.id], correct: answers[q.id] === q.answerId }));
  const correct = review.filter(q => q.correct).length;
  const groups = [...new Set(questions.map(q => dayFor(q.chapter)?.id || 'intro'))].sort((a, b) => (a === 'intro' ? 0 : Number(a)) - (b === 'intro' ? 0 : Number(b))).map(id => {
    const items = review.filter(q => (dayFor(q.chapter)?.id || 'intro') === id);
    return { id, label: id === 'intro' ? 'Before Day 1' : modeLabel(id), total: items.length, correct: items.filter(q => q.correct).length };
  });
  return { correct, total: questions.length, percent: Math.round(correct / questions.length * 100), review, groups };
}

const TRANSLATIONS = { es: QUESTIONS_ES, pt: QUESTIONS_PT };

// Swap in translated text by stable question and option IDs; order and answers are unchanged.
export function localizeQuestion(question, lang) {
  const text = TRANSLATIONS[lang]?.[question.id];
  if (!text) return question;
  const optionText = id => text.options[id === 'correct' ? 0 : Number(id.slice('other-'.length)) + 1];
  return { ...question, topic: text.topic, prompt: text.prompt, explanation: text.explanation,
    options: question.options.map(option => ({ ...option, text: optionText(option.id) })) };
}
