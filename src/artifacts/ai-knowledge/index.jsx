import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Check, ChevronLeft, GraduationCap, Layers, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useLanguage, useStrings } from '../i18n.js';
import { LanguageSwitcher } from '../LanguageControls.jsx';
import { DAYS, createExam, dayFor, gradeExam, localizeQuestion, pageUrl, shuffle } from './quiz.js';
import { STRINGS } from './strings.js';
import './styles.css';

function BookLink({ page, children }) {
  const t = useStrings(STRINGS);
  return <a className="ak-book-link" href={pageUrl(page)} target="_blank" rel="noopener noreferrer">{children || t.reviewPage(page)}<ArrowUpRight aria-hidden="true" /></a>;
}

export default function AIKnowledge() {
  const t = useStrings(STRINGS);
  const { lang, brandName } = useLanguage();
  const dayLabel = id => id === 'intro' ? t.beforeDay1 : `${t.day(id)} · ${t.days[id][0]}`;
  const local = q => localizeQuestion(q, lang);
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

  const current = questions[position] && local(questions[position]);
  const missed = result?.review.filter(q => !q.correct) || [];

  const roundLabel = practice ? t.missedPractice : mode === 'global' ? t.globalTest : dayLabel(mode);

  return <div className="ak-app" lang={lang}>
    <header className="ak-header"><span className="ak-brand"><span className="ak-brand-icon"><GraduationCap aria-hidden="true" /></span>{brandName}<span className="ak-header-divider" /><span className="ak-header-label">{t.learningTools}</span></span><div className="ak-header-actions"><BookLink page={5}>{t.theEbook}</BookLink><LanguageSwitcher /></div></header>
    <main className={`ak-main ak-${screen}`}>
      {screen === 'choose' && <>
        <section className="ak-intro">
          <p className="ak-eyebrow">{t.bookTitle}</p>
          <h1 ref={headingRef} tabIndex={-1}>{t.title}</h1>
          <p>{t.intro}</p>
        </section>
        <div className="ak-picker">
          <section className="ak-global-card" aria-labelledby="ak-global-title">
            <div className="ak-cover-art" aria-hidden="true"><Layers strokeWidth={1.35} /></div>
            <div>
              <h2 id="ak-global-title">{t.globalTest}</h2>
              <p>{t.globalText}</p>
            </div>
            <div><span className="ak-card-meta">{t.globalMeta}</span>
              <Button className="ak-primary" onClick={() => start('global')}>{t.startGlobal}<ArrowRight aria-hidden="true" /></Button>
            </div>
          </section>
          <section className="ak-daily" aria-labelledby="ak-day-title">
            <div className="ak-section-heading"><h2 id="ak-day-title">{t.byDay}</h2><span>{t.perDay}</span></div>
            {DAYS.map(day => <button className="ak-day-row" key={day.id} onClick={() => start(day.id)} aria-label={t.startDay(day.id, t.days[day.id][0])}>
              <span className="ak-day-number">{t.day(day.id)}</span>
              <span><strong>{t.days[day.id][0]}</strong><small>{t.days[day.id][1]}</small></span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>)}
          </section>
        </div>
        <p className="ak-footnote">{t.footnote}</p>
      </>}

      {screen === 'exam' && current && <>
        <div className="ak-exam-toolbar"><Button variant="ghost" className="ak-plain" onClick={() => setConfirmExit(true)}><ChevronLeft aria-hidden="true" />{t.chooseAnother}</Button><span>{roundLabel}</span></div>
        <section className="ak-question-panel" aria-labelledby="ak-question-title"><div className="ak-progress-label"><span>{t.questionOf(position + 1, questions.length)}</span><span>{t.answered(Object.keys(answers).length)}</span></div><progress className="ak-progress" value={Object.keys(answers).length} max={questions.length} aria-label={t.questionsAnswered} />
          <p className="ak-question-topic">{dayFor(current.chapter) ? t.day(dayFor(current.chapter).id) : t.beforeDay1}<span> / </span>{t.chapter(current.chapter)}</p>
          <h1 id="ak-question-title" ref={headingRef} tabIndex={-1}>{current.prompt}</h1><p className="ak-question-hint" id="ak-question-hint">{t.chooseBest}</p>
          <fieldset className="ak-options" aria-labelledby="ak-question-title" aria-describedby="ak-question-hint"><legend className="ak-sr-only">{t.answerChoices}</legend>{current.options.map((option, i) => <label className={`ak-option ${answers[current.id] === option.id ? 'ak-selected' : ''}`} key={`${current.id}-${option.id}`}><input type="radio" name={`answer-${current.id}`} value={option.id} checked={answers[current.id] === option.id} onChange={() => setAnswers(old => ({ ...old, [current.id]: option.id }))} /><span className="ak-option-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span><span>{option.text}</span><Check className="ak-option-check" aria-hidden="true" /></label>)}</fieldset>
          <div className="ak-question-actions"><Button variant="ghost" className="ak-plain" disabled={position === 0} onClick={() => setPosition(position - 1)}><ChevronLeft aria-hidden="true" />{t.back}</Button><Button className="ak-primary" disabled={!answers[current.id]} onClick={next}>{position === questions.length - 1 ? t.seeResults : t.nextQuestion}<ArrowRight aria-hidden="true" /></Button></div>
        </section>
      </>}

      {screen === 'results' && result && <>
        <div className="ak-results-top">
          <p className="ak-eyebrow">{roundLabel}</p>
          <h1 ref={headingRef} tabIndex={-1}>{practice ? t.practiceScore : t.testResults}</h1>
          <p>{missed.length ? t.reviewMissed : t.allCorrect}</p>
        </div>
        <section className="ak-score-card" aria-label={t.yourScore}><div className="ak-score-number"><strong>{result.percent}<span>%</span></strong><p>{t.correctOf(result.correct, result.total)}</p></div><div className="ak-breakdown"><h2>{t.byDayTitle}</h2>{result.groups.map(group => <div className="ak-breakdown-row" key={group.id}><div><span>{dayLabel(group.id)}</span><strong>{group.correct}/{group.total}</strong></div><progress className="ak-progress" value={group.correct} max={group.total} aria-label={`${dayLabel(group.id)}: ${t.correctOf(group.correct, group.total)}`} /></div>)}</div></section>
        <div className="ak-result-actions">
          {missed.length > 0 && <Button className="ak-primary" onClick={practiceMissed}>
            <RotateCcw aria-hidden="true" />{t.practiceMissed(missed.length)}
          </Button>}
          <Button variant={missed.length ? "outline" : "default"} className={missed.length ? "ak-secondary" : "ak-primary"} onClick={() => start(mode)}>{t.newTest(mode)}</Button>
          <Button variant="ghost" className="ak-plain" onClick={() => setScreen('choose')}>{t.chooseAnother}</Button>
        </div>
        <section className="ak-review" aria-labelledby="ak-review-heading"><div className="ak-section-heading"><h2 id="ak-review-heading">{missed.length ? t.reviewList : t.nothingToRevisit}</h2><span>{t.toRevisit(missed.length)}</span></div>
          {missed.length ? <><p className="ak-review-note">{t.reviewNote}</p>{missed.map(local).map(q => <article className="ak-review-card" key={q.id}><p className="ak-eyebrow">{t.chapterUpper(q.chapter)} · {q.topic}</p><h3>{q.prompt}</h3><div className="ak-answer-wrong"><X aria-hidden="true" /><p><strong>{t.yourAnswer}</strong>{q.options.find(o => o.id === q.selectedId)?.text}</p></div><div className="ak-answer-right"><Check aria-hidden="true" /><p><strong>{t.correctAnswer}</strong>{q.options.find(o => o.id === q.answerId).text}</p></div><p className="ak-explanation">{q.explanation}</p><BookLink page={q.page}><BookOpen aria-hidden="true" />{t.reviewPage(q.page)}</BookLink></article>)}</> : <div className="ak-perfect"><Check aria-hidden="true" /><p>{t.perfect}</p></div>}
        </section>
        {result.correct > 0 && <details className="ak-correct-review"><summary>{t.reviewCorrect(result.correct)}</summary>{result.review.filter(q => q.correct).map(local).map(q => <article key={q.id}><h3>{q.prompt}</h3><p><strong>{t.correctPrefix}</strong>{q.options.find(o => o.id === q.answerId).text}</p><p>{q.explanation}</p><BookLink page={q.page} /></article>)}</details>}
        <p className="ak-footnote">{t.clearsResults}</p>
      </>}
    </main>

    <Dialog open={confirmExit} onOpenChange={setConfirmExit}><DialogContent className="artifact-theme artifact-ai-knowledge ak-dialog" lang={lang} closeLabel={t.keepTaking}><DialogTitle>{t.leaveTitle}</DialogTitle><DialogDescription>{t.leaveText}</DialogDescription><div className="ak-dialog-actions"><Button variant="outline" className="ak-secondary" onClick={() => setConfirmExit(false)}>{t.keepGoing}</Button><Button className="ak-primary" onClick={() => { setConfirmExit(false); setScreen('choose'); setAnswers({}); }}>{t.leave}</Button></div></DialogContent></Dialog>
  </div>;
}
