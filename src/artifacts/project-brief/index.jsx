import { useEffect, useRef, useState } from 'react';
import { useAction } from 'convex/react';
import { ArrowRight, Check, Clock3 } from 'lucide-react';
import { Field } from '@/components/Field.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
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

  async function handleSubmit(event) {
    event.preventDefault();
    if (sending.current || session.submitted || readyId !== session.requestId) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    for (const field of ['name', 'brief']) {
      if (!fields[field].trim()) {
        form.elements[field].setCustomValidity('Please fill out this field.');
        form.elements[field].reportValidity();
        return;
      }
    }
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
      {storageUnavailable && <p role="alert">Enable site storage for this page and reload to register your project and send your brief.</p>}
    </header>
    <section className="brief-panel" aria-labelledby="brief-title">
      {session.submitted ? <div role="status">
        <Check className="received-icon" size={32} aria-hidden="true" />
        <h2 id="brief-title">We’ve received your brief.</h2>
        <p>Our team will review your project and contact you at the email address you provided.</p>
      </div> : <>
        <h2 id="brief-title">Your project brief</h2>
        <form onSubmit={handleSubmit} onInput={event => event.target.setCustomValidity('')}>
          <fieldset disabled={pending}>
            <Field label="Your name">{props => <Input {...props} name="name" autoComplete="name" maxLength={120} required />}</Field>
            <Field label="Purchase email" hint="Re-enter the email you used at checkout. We’ll write to you there.">{props =>
              <Input {...props} name="email" type="email" autoComplete="email" pattern="[^@\s]+@[^@\s]+\.[^@\s]+" maxLength={254} required />}</Field>
            <Field label="Business or brand name (optional)">{props => <Input {...props} name="business" autoComplete="organization" maxLength={160} />}</Field>
            <Field label="What did you purchase?">{props => <NativeSelect {...props} name="product" defaultValue="" required>
              <option value="" disabled>Select your project type</option><option>Landing page</option><option>Custom system</option>
            </NativeSelect>}</Field>
            <Field label="What should we build?" hint="Tell us who it’s for and the most important thing it should do.">{props =>
              <Textarea {...props} name="brief" rows={3} maxLength={2000} required />}</Field>
          </fieldset>
          {error && <p role="alert" className="brief-error">{error}</p>}
          {openingFailed && <>
            <p role="alert" className="brief-error">We couldn’t connect your project. Retry the connection to send your brief.</p>
            <Button type="button" variant="outline" onClick={() => setOpeningAttempt(attempt => attempt + 1)}>Retry connection</Button>
          </>}
          <Button type="submit" disabled={pending || readyId !== requestId}>{pending ? 'Sending…' : 'Send project brief'} <ArrowRight aria-hidden="true" /></Button>
        </form>
      </>}
    </section>
  </main>;
}
