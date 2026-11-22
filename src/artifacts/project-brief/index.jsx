import { useEffect, useRef, useState } from 'react';
import { useAction } from 'convex/react';
import { Check, ClipboardList, Clock3, Mail, Wrench } from 'lucide-react';
import BriefForm from './BriefForm.jsx';
import { api } from '@/lib/api.js';
import { DELIVERY_WINDOW_MS } from '../../../shared/project-brief.js';
import { loadSession, readSession, remainingSeconds, reportOpening, saveSession, STORAGE_KEY } from './session.js';
import './styles.css';

function DeliveryClock({ firstLoad }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  const remaining = remainingSeconds(firstLoad, now);
  const values = [Math.floor(remaining / 3600), Math.floor(remaining / 60) % 60, remaining % 60];
  const due = new Date(firstLoad + DELIVERY_WINDOW_MS);
  return <section className="delivery-clock" aria-labelledby="delivery-title">
    <h2 id="delivery-title"><Clock3 size={18} aria-hidden="true" /> Time until delivery</h2>
    <div className="digits" role="timer" aria-label="Time remaining">
      {['Hours', 'Minutes', 'Seconds'].map((unit, index) => <div key={unit}>
        <strong>{String(values[index]).padStart(2, '0')}</strong><span>{unit}</span>
      </div>)}
    </div>
    <p>{remaining ? 'Ready by ' : 'Delivery window ended ' }
      <time dateTime={due.toISOString()}>{due.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</time>
    </p>
  </section>;
}

function ProjectRoadmap({ submitted }) {
  return <section className="brief-roadmap" aria-labelledby="roadmap-title">
    <h2 id="roadmap-title">How you’ll get your project</h2>
    <ol role="list">
      <li>
        <span className={`step-icon${submitted ? ' is-complete' : ''}`} aria-hidden="true">
          {submitted ? <Check /> : <ClipboardList />}
        </span>
        <div>
          <h3>{submitted ? 'Project brief received' : <a href="#brief-title">Send us your project brief</a>}</h3>
          <p>{submitted ? 'Your answers are with our team.' : 'Tell us who it’s for, everything it needs to do, and any design details or examples you have in mind.'}</p>
        </div>
      </li>
      <li>
        <span className="step-icon" aria-hidden="true"><Wrench /></span>
        <div><h3>We build your project</h3><p>Our team uses your brief to build your landing page or custom system.</p></div>
      </li>
      <li>
        <span className="step-icon" aria-hidden="true"><Mail /></span>
        <div><h3>Get your link by email</h3><p>By the deadline shown above, we’ll email you the link to your finished project and instructions for accessing it.</p></div>
      </li>
    </ol>
  </section>;
}

export default function ProjectBrief({ name }) {
  const [session, setSession] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [readyId, setReadyId] = useState(null);
  const [openingFailed, setOpeningFailed] = useState(false);
  const [openingAttempt, setOpeningAttempt] = useState(0);
  const sending = useRef(false);
  const open = useAction(api.projectBrief.open);
  const submit = useAction(api.projectBrief.submit);

  useEffect(() => {
    let active = true;
    loadSession().then(value => { if (active) setSession(value); });
    const sync = event => {
      if (event.key === STORAGE_KEY && event.newValue) setSession(readSession());
    };
    window.addEventListener('storage', sync);
    return () => {
      active = false;
      window.removeEventListener('storage', sync);
    };
  }, []);

  const firstLoad = session?.firstLoad;
  const requestId = session?.requestId;
  const submitted = session?.submitted;
  const storageUnavailable = session?.storageUnavailable;
  useEffect(() => {
    if (!requestId || submitted || storageUnavailable) return;
    let active = true;
    const notify = async () => {
      setOpeningFailed(false);
      try {
        await reportOpening({ firstLoad, requestId }, open);
        if (active) setReadyId(requestId);
      } catch {
        if (active) setOpeningFailed(true);
      }
    };
    notify();
    window.addEventListener('online', notify);
    return () => {
      active = false;
      window.removeEventListener('online', notify);
    };
  }, [firstLoad, requestId, submitted, storageUnavailable, open, openingAttempt]);

  async function handleSubmit(fields) {
    if (sending.current || session.submitted || readyId !== session.requestId) return;
    sending.current = true;
    setPending(true);
    setError('');
    try {
      await submit({ ...fields, requestId: session.requestId, firstLoad: session.firstLoad });
      setSession(saveSession({ ...session, submitted: true }));
    } catch {
      setError('We couldn’t confirm that your brief arrived. Your details are still here. Please try sending it again.');
    } finally {
      sending.current = false;
      setPending(false);
    }
  }

  if (!session) return <main className="brief-layout" role="status">Loading your project…</main>;
  return <main className="brief-layout">
    <header className="brief-intro">
      <h1>{name}</h1>
      <p>Your landing page or custom system will be ready within 48 hours of purchase. Tell us what you need and we’ll contact you by email.</p>
      <DeliveryClock firstLoad={session.firstLoad} />
      <ProjectRoadmap submitted={session.submitted} />
      {storageUnavailable && <p role="alert">Enable site storage for this page and reload to register your project and send your brief.</p>}
    </header>
    <section className="brief-panel" aria-labelledby="brief-title">
      {session.submitted ? <div role="status">
        <Check className="received-icon" size={32} aria-hidden="true" />
        <h2 id="brief-title">We’ve received your brief.</h2>
        <p>Our team will review your project and contact you at the email address you provided.</p>
      </div> : <>
        <h2 id="brief-title">Your project brief</h2>
        <BriefForm onSend={handleSubmit} pending={pending} ready={readyId === requestId} error={error}
          openingFailed={openingFailed} onRetry={() => setOpeningAttempt(attempt => attempt + 1)} />
      </>}
    </section>
  </main>;
}
