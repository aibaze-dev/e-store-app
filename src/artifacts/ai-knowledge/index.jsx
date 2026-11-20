import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronLeft, GraduationCap, Layers, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import brand from '@/config/brandData.json';
import { DAYS, createExam, dayFor, gradeExam, modeLabel, pageUrl, shuffle } from './quiz.js';
import './styles.css';

function BookLink({ page, children }) {
  return <a className="ak-book-link" href={pageUrl(page)} target="_blank" rel="noopener noreferrer">{children || `Review page ${page}`}<ArrowUpRight aria-hidden="true" /></a>;
}

export default function AIKnowledge() {
  const [screen, setScreen] = useState('choose');
  const [mode, setMode] = useState('global');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [position, setPosition] = useState(0);
  const [result, setResult] = useState(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [practice, setPractice] = useState(false);
  const previousExams = useRef({});
  const headingRef = useRef(null);
  const previousView = useRef(`${screen}-${position}`);

  useEffect(() => {
    const view = `${screen}-${position}`;
    if (previousView.current === view) return;
    previousView.current = view;
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screen, position]);

  useEffect(() => {
    if (screen !== 'exam') return;
    const warn = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [screen]);

  function start(nextMode) {
    const next = createExam(nextMode, previousExams.current[nextMode]);
    previousExams.current[nextMode] = next.map(q => q.id);
    setMode(nextMode);
    beginRound(next, false);
  }

  function beginRound(items, isPractice) {
    setPractice(isPractice);
    setQuestions(items);
    setAnswers({});
    setPosition(0);
    setResult(null);
    setScreen('exam');
  }

  function practiceMissed() {
    const items = shuffle(missed).map(q => ({ ...q, options: shuffle(q.options) }));
    beginRound(items, true);
  }

  function next() {
    if (!answers[questions[position].id]) return;
    if (position < questions.length - 1) setPosition(position + 1);
    else { setResult(gradeExam(questions, answers)); setScreen('results'); }
  }

  const current = questions[position];
  const missed = result?.review.filter(q => !q.correct) || [];

  const roundLabel = practice ? 'Missed-question practice' : modeLabel(mode);

  return <div className="ak-app" lang="en">
    <header className="ak-header"><span className="ak-brand"><span className="ak-brand-icon"><GraduationCap aria-hidden="true" /></span>{brand.artifactBrandName}<span className="ak-header-divider" /><span className="ak-header-label">Learning tools</span></span><BookLink page={5}>The ebook</BookLink></header>
    <main className={`ak-main ak-${screen}`}>
      {screen === 'choose' && <>
        <section className="ak-intro">
          <p className="ak-eyebrow">Master Claude in 5 Days</p>
          <h1 ref={headingRef} tabIndex={-1}>Test your AI knowledge</h1>
          <p>Choose a day from the book or test yourself on the whole course. Afterward, see which pages to revisit.</p>
        </section>
        <div className="ak-picker">
          <section className="ak-global-card" aria-labelledby="ak-global-title">
            <div className="ak-cover-art" aria-hidden="true"><Layers strokeWidth={1.35} /></div>
            <div>
              <h2 id="ak-global-title">Global test</h2>
              <p>Two questions from each chapter, from the foundations to your first working tool.</p>
            </div>
            <div><span className="ak-card-meta">22 questions · 11 chapters</span>
              <Button className="ak-primary" onClick={() => start('global')}>Start global test<ArrowRight aria-hidden="true" /></Button>
            </div>
          </section>
          <section className="ak-daily" aria-labelledby="ak-day-title">
            <div className="ak-section-heading"><h2 id="ak-day-title">Practice by day</h2><span>6 questions each</span></div>
            {DAYS.map(day => <button className="ak-day-row" key={day.id} onClick={() => start(day.id)} aria-label={`Start Day ${day.id}: ${day.name}`}>
              <span className="ak-day-number">Day {day.id}</span>
              <span><strong>{day.name}</strong><small>{day.description}</small></span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>)}
          </section>
        </div>
        <p className="ak-footnote">Take your time. You can change answers until you finish. Reloading closes your attempt.</p>
      </>}

      {screen === 'exam' && current && <>
        <div className="ak-exam-toolbar"><Button variant="ghost" className="ak-plain" onClick={() => setConfirmExit(true)}><ChevronLeft aria-hidden="true" />Choose another test</Button><span>{roundLabel}</span></div>
        <section className="ak-question-panel" aria-labelledby="ak-question-title"><div className="ak-progress-label"><span>QUESTION {position + 1} OF {questions.length}</span><span>{Object.keys(answers).length} answered</span></div><progress className="ak-progress" value={Object.keys(answers).length} max={questions.length} aria-label="Questions answered" />
          <p className="ak-question-topic">{dayFor(current.chapter) ? `Day ${dayFor(current.chapter).id}` : 'Before Day 1'}<span> / </span>Chapter {current.chapter}</p>
          <h1 id="ak-question-title" ref={headingRef} tabIndex={-1}>{current.prompt}</h1><p className="ak-question-hint" id="ak-question-hint">Choose the best answer. You can change it before finishing.</p>
          <fieldset className="ak-options" aria-labelledby="ak-question-title" aria-describedby="ak-question-hint"><legend className="ak-sr-only">Answer choices</legend>{current.options.map((option, i) => <label className={`ak-option ${answers[current.id] === option.id ? 'ak-selected' : ''}`} key={`${current.id}-${option.id}`}><input type="radio" name={`answer-${current.id}`} value={option.id} checked={answers[current.id] === option.id} onChange={() => setAnswers(old => ({ ...old, [current.id]: option.id }))} /><span className="ak-option-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span><span>{option.text}</span><Check className="ak-option-check" aria-hidden="true" /></label>)}</fieldset>
          <div className="ak-question-actions"><Button variant="ghost" className="ak-plain" disabled={position === 0} onClick={() => setPosition(position - 1)}><ChevronLeft aria-hidden="true" />Back</Button><Button className="ak-primary" disabled={!answers[current.id]} onClick={next}>{position === questions.length - 1 ? 'See my results' : 'Next question'}<ArrowRight aria-hidden="true" /></Button></div>
        </section>
      </>}

      {screen === 'results' && result && <>
        <div className="ak-results-top">
          <p className="ak-eyebrow">{roundLabel}</p>
          <h1 ref={headingRef} tabIndex={-1}>{practice ? 'Your practice score' : 'Your test results'}</h1>
          <p>{missed.length ? 'Review the lesson for each missed question, then try those questions again.' : 'Every answer was correct. Choose a new test to keep practicing.'}</p>
        </div>
        <section className="ak-score-card" aria-label="Your score"><div className="ak-score-number"><strong>{result.percent}<span>%</span></strong><p>{result.correct} of {result.total} correct</p></div><div className="ak-breakdown"><h2>Your results by day</h2>{result.groups.map(group => <div className="ak-breakdown-row" key={group.id}><div><span>{group.label}</span><strong>{group.correct}/{group.total}</strong></div><progress className="ak-progress" value={group.correct} max={group.total} aria-label={`${group.label}: ${group.correct} of ${group.total} correct`} /></div>)}</div></section>
        <div className="ak-result-actions">
          {missed.length > 0 && <Button className="ak-primary" onClick={practiceMissed}>
            <RotateCcw aria-hidden="true" />Practice missed questions ({missed.length})
          </Button>}
          <Button variant={missed.length ? "outline" : "default"} className={missed.length ? "ak-secondary" : "ak-primary"} onClick={() => start(mode)}>New {mode === 'global' ? 'global' : `Day ${mode}`} test</Button>
          <Button variant="ghost" className="ak-plain" onClick={() => setScreen('choose')}>Choose another test</Button>
        </div>
        <section className="ak-review" aria-labelledby="ak-review-heading"><div className="ak-section-heading"><h2 id="ak-review-heading">{missed.length ? 'Your personal review list' : 'Nothing to revisit this time'}</h2><span>{missed.length} {missed.length === 1 ? 'question' : 'questions'} to revisit</span></div>
          {missed.length ? <><p className="ak-review-note">Open a page, review the lesson, then give it another go. Page links open the ebook in a new tab; if your PDF viewer starts at the cover, jump to the page number shown.</p>{missed.map(q => <article className="ak-review-card" key={q.id}><p className="ak-eyebrow">CHAPTER {q.chapter} · {q.topic}</p><h3>{q.prompt}</h3><div className="ak-answer-wrong"><X aria-hidden="true" /><p><strong>Your answer</strong>{q.options.find(o => o.id === q.selectedId)?.text}</p></div><div className="ak-answer-right"><Check aria-hidden="true" /><p><strong>Correct answer</strong>{q.options.find(o => o.id === q.answerId).text}</p></div><p className="ak-explanation">{q.explanation}</p><BookLink page={q.page}><BookOpen aria-hidden="true" />Review page {q.page}</BookLink></article>)}</> : <div className="ak-perfect"><Check aria-hidden="true" /><p>All correct in this round. Keep applying these skills to real tasks.</p></div>}
        </section>
        {result.correct > 0 && <details className="ak-correct-review"><summary>Review your {result.correct} correct {result.correct === 1 ? 'answer' : 'answers'}</summary>{result.review.filter(q => q.correct).map(q => <article key={q.id}><h3>{q.prompt}</h3><p><strong>Correct: </strong>{q.options.find(o => o.id === q.answerId).text}</p><p>{q.explanation}</p><BookLink page={q.page} /></article>)}</details>}
        <p className="ak-footnote">Closing or reloading this tab clears your results.</p>
      </>}
    </main>

    <Dialog open={confirmExit} onOpenChange={setConfirmExit}><DialogContent className="artifact-theme artifact-ai-knowledge ak-dialog" lang="en" closeLabel="Keep taking the test"><DialogTitle>Leave this test?</DialogTitle><DialogDescription>Your answers in this attempt will be cleared. You can start a fresh test whenever you’re ready.</DialogDescription><div className="ak-dialog-actions"><Button variant="outline" className="ak-secondary" onClick={() => setConfirmExit(false)}>Keep going</Button><Button className="ak-primary" onClick={() => { setConfirmExit(false); setScreen('choose'); setAnswers({}); }}>Leave test</Button></div></DialogContent></Dialog>
  </div>;
}
