import { useStorePresence } from './useStorePresence.js';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { api } from '@/lib/api.js';
import { formatMoney, errorText } from '@/lib/format.js';
import { contextFor, effectiveStep, initialSession, advanceSession, applicableQuestions, QUESTION_TYPES, validateAnswer } from '../../shared/quiz.js';
import QuizStep from './QuizStep.jsx';
import QuizResult from './QuizResult.jsx';
import './quiz.css';
import { quizTokenKey, readQuizToken } from './quiz-session.js';
import { attributionArgs } from './attribution.js';
import { trackPageView } from '@/lib/pixel.js';

export { QuizBlocks } from './QuizResult.jsx';

export function quizTheme(identity = {}) {
  return { '--quiz-accent': identity.color || '#2e8b62', '--quiz-bg': identity.background || '#f6f3ef', '--quiz-text': identity.textColor || '#1c2530' };
}

export function QuizPlayer({ quiz, session, view, onCommand, onCheckout, busy = false, error = '', preview = false }) {
  const [value, setValue] = useState(null), [validation, setValidation] = useState('');
  const screenRef = useRef(null), submitting = useRef(false);
  useEffect(() => {
    setValue(session.answers[session.currentStep] ?? null); setValidation(''); submitting.current = false;
    const heading = screenRef.current?.querySelector('h1');
    heading?.setAttribute('tabindex', '-1'); heading?.focus({ preventScroll: true });
    if (!preview) window.scrollTo({ top: 0 }); else screenRef.current?.scrollIntoView({ block: 'nearest' });
  }, [session.revision, session.currentStep, preview]);
  useEffect(() => { if (!busy) submitting.current = false; }, [busy]);
  // The next screen's picture is fetched while the visitor reads this one.
  useEffect(() => {
    if (preview) return;
    const index = quiz.steps.findIndex(s => s.id === session.currentStep);
    const url = index < 0 ? '' : quiz.steps[index + 1]?.imageUrl;
    if (url) new Image().src = url;
  }, [quiz, session.currentStep, preview]);
  const context = contextFor(quiz, session.answers), raw = quiz.steps.find(s => s.id === session.currentStep), step = raw && effectiveStep(raw, context);
  const result = session.currentStep === null ? (quiz.results.find(r => r.id === session.resultId) || quiz.results.find(r => r.default)) : null;
  if (!step && !result) return <p className="p-8">This quiz has no screens available.</p>;
  const questions = applicableQuestions(quiz, session), done = session.history.filter(id => questions.includes(id)).length;
  const position = Math.min(done + (QUESTION_TYPES.includes(step?.type) ? 1 : 0), questions.length);
  const progress = result ? 1 : questions.length ? Math.max(done, position - .5) / questions.length : 0;
  async function next(answer = value) {
    if (busy || submitting.current) return;
    try { validateAnswer(step, answer); setValidation(''); submitting.current = true; await onCommand('next', answer); }
    catch (e) { setValidation(e.message); }
    finally { submitting.current = false; }
  }
  const identity = quiz.identity || {};
  return <div className={`quiz-public ${preview ? 'is-preview' : ''}`} style={quizTheme(identity)}>
    <header className="quiz-header">
      <div className="quiz-header-row">
        {session.history.length > 0 && !result ? <button type="button" className="quiz-back" disabled={busy} onClick={() => onCommand('back', null)} aria-label={identity.backText || 'Back'}><ChevronLeft aria-hidden="true" /></button> : <span className="quiz-back" aria-hidden="true" />}
        <span className="quiz-brand">{identity.logoUrl ? <img src={identity.logoUrl} alt={identity.name} /> : identity.name}</span>
        <span className="quiz-counter">{!result && QUESTION_TYPES.includes(step?.type) && questions.length > 0 ? <><strong>{position}</strong>/{questions.length}</> : ''}</span>
      </div>
      <div className="quiz-progress" role="progressbar" aria-label="Quiz progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><span style={{ width: `${progress * 100}%` }} /></div>
    </header>
    {preview && <p className="quiz-preview-label">Vista previa · no guarda contactos, pagos ni eventos</p>}
    <main className="quiz-column" ref={screenRef} key={session.currentStep ?? 'result'}>
      {result ? <QuizResult result={result} context={context} view={view} onCheckout={onCheckout} busy={busy} preview={preview} />
        : <QuizStep step={step} context={context} value={value} setValue={v => { setValue(v); setValidation(''); }} next={next} busy={busy} skipText={identity.skipText} view={view} onCheckout={onCheckout} />}
      {(error || validation) && <p role="alert" className="quiz-error">{validation || error}</p>}
      {(identity.termsUrl || identity.privacyUrl) && <footer className="quiz-legal">{identity.termsUrl && <a href={identity.termsUrl}>Terms</a>}{identity.privacyUrl && <a href={identity.privacyUrl}>Privacy</a>}</footer>}
    </main>
  </div>;
}

export function QuizPreview({ quiz, view, startAt }) {
  const fresh = () => {
    const session = initialSession(quiz);
    return startAt && quiz.steps.some(s => s.id === startAt) ? { ...session, currentStep: startAt } : session;
  };
  const [session, setSession] = useState(fresh), [size, setSize] = useState('mobile'), [checkout, setCheckout] = useState(false), [error, setError] = useState('');
  const command = (direction, value) => {
    try { setError(''); setSession(advanceSession(quiz, session, { direction, value, revision: session.revision, commandId: crypto.randomUUID() })); }
    catch (e) { setError(e.message); }
  };
  return <div className="quiz-preview">
    <div className="quiz-preview-tools">
      <button type="button" onClick={() => setSize(size === 'mobile' ? 'desktop' : 'mobile')}>{size === 'mobile' ? 'Ver escritorio' : 'Ver móvil'}</button>
      <button type="button" onClick={() => { setSession(fresh()); setCheckout(false); setError(''); }}>Reiniciar prueba</button>
    </div>
    {checkout && <p role="status" className="quiz-preview-status">El recorrido seguiría al checkout de la tienda ({formatMoney(view?.offer.main.price || 0, view?.store.currency || 'USD')}). No se creó ninguna compra.</p>}
    <div className={size === 'mobile' ? 'quiz-mobile-preview' : 'quiz-desktop-preview'}>
      <QuizPlayer preview quiz={quiz} session={session} view={view} error={error} onCommand={command} onCheckout={() => setCheckout(true)} />
    </div>
    <details className="quiz-debug"><summary>Respuestas y perfil de prueba</summary><pre>{JSON.stringify({ answers: session.answers, calculations: session.calculations, profile: session.resultId }, null, 2)}</pre></details>
  </div>;
}

export default function Quiz({ subdomain, view }) {
  const config = useQuery(api.quizzes.publicConfig, { subdomain });
  useStorePresence(config ? subdomain : null, 'landing');
  // The pixel starts when the quiz opens, while the ad's click id is still in the address.
  useEffect(() => { trackPageView(view?.store.metaPixelIds); }, [view?.store.metaPixelIds]);
  const start = useMutation(api.quizzes.start), save = useMutation(api.quizzes.saveAnswer), arrival = useMutation(api.quizzes.checkoutArrival), recordView = useMutation(api.analytics.recordView);
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const pending = useRef(null);
  const navigate = useNavigate(), location = useLocation();
  const base = location.pathname.includes('/l/') ? `/l/${subdomain}` : '';
  // The session is requested at once: `start` checks by itself that the quiz is published,
  // so waiting for the configuration first would only add a round trip.
  useEffect(() => {
    let ignore = false; setBusy(true); setError('');
    let token = readQuizToken(subdomain);
    try { if (!token) { token = crypto.randomUUID() + crypto.randomUUID(); sessionStorage.setItem(quizTokenKey(subdomain), token); } }
    catch { setError('Please enable browser storage so we can save your quiz progress.'); setBusy(false); return; }
    start({ subdomain, token, ...attributionArgs(subdomain) }).then(value => { if (!ignore) setData(value); }, e => { if (!ignore) setError(errorText(e, 'We couldn’t load the quiz.')); }).finally(() => { if (!ignore) setBusy(false); });
    return () => { ignore = true; };
  }, [subdomain, retry, start]);
  // The visit is counted only for a published quiz.
  useEffect(() => {
    const token = config && readQuizToken(subdomain);
    if (!token) return;
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(`quiz-visit:${token}`))
      .then(bytes => recordView({ subdomain, page: 'landing', origin: 'quiz', ...attributionArgs(subdomain), eventId: Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('').slice(0, 32) })).catch(() => {});
  }, [subdomain, Boolean(config), retry, recordView]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!data) return;
    const expected = `${base}/quiz${data.session.currentStep === null ? '/resultado' : ''}`;
    if (location.pathname !== expected) navigate(expected, { replace: true });
  }, [data, base, location.pathname, navigate]);
  async function command(direction, value) {
    if (busy) return;
    setBusy(true); setError('');
    const payload = { token: readQuizToken(subdomain), revision: data.session.revision, direction, value }, signature = JSON.stringify(payload);
    if (pending.current?.signature !== signature) pending.current = { signature, commandId: crypto.randomUUID() };
    try { setData(await save({ ...payload, commandId: pending.current.commandId })); pending.current = null; }
    catch (e) { setError(errorText(e, 'Your answer wasn’t saved. It’s still here; please try again.')); }
    finally { setBusy(false); }
  }
  async function checkout() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await arrival({ token: readQuizToken(subdomain) });
      // The checkout starts with the contact the visitor already typed in the quiz.
      const contact = contextFor(data.quiz, data.session.answers).contact || {};
      navigate(`${base}/checkout`, { state: { origin: 'quiz', buyer: { email: contact.email || '', name: (contact.name || '').trim() } } });
    } catch (e) { setError(errorText(e, 'We couldn’t continue. Please try again.')); }
    finally { setBusy(false); }
  }
  if (config === null) return <p className="p-8">This quiz is not available.</p>;
  if (!data) return <QuizLoader identity={config?.identity} error={error} onRetry={() => setRetry(n => n + 1)} />;
  return <QuizPlayer quiz={data.quiz} session={data.session} view={view} onCommand={command} onCheckout={checkout} busy={busy} error={error} />;
}

// Shown while the session starts: an animated ring in the quiz's own colors. Until those
// colors arrive nothing colored is drawn, so the ring never starts in the default green.
function QuizLoader({ identity, error, onRetry }) {
  if (!identity && !error) return <div className="quiz-loading-blank" role="status" aria-label="Loading quiz" />;
  return <div className="quiz-public quiz-loading" style={quizTheme(identity)}>
    {error ? <div className="quiz-loading-error" role="alert">
      <p>{error}</p>
      <button type="button" className="quiz-loading-retry" onClick={onRetry}>Try again</button>
    </div> : <div className="quiz-loader" role="status" aria-label="Loading quiz">
      <span className="quiz-loader-glow" aria-hidden="true" />
      <svg className="quiz-loader-ring" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="quiz-loader-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--quiz-accent)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--quiz-accent)" />
          </linearGradient>
        </defs>
        <circle className="quiz-loader-track" cx="50" cy="50" r="42" />
        <circle className="quiz-loader-arc" cx="50" cy="50" r="42" stroke="url(#quiz-loader-gradient)" />
      </svg>
      <span className="quiz-loader-core" aria-hidden="true" />
    </div>}
  </div>;
}
