import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Check, LifeBuoy, LoaderCircle, Mail, Send } from 'lucide-react';
import { api } from '@/lib/api.js';
import { PageSkeleton } from '@/components/Field.jsx';
import { PurchaseLanding } from '@/templates/PostPurchaseContent.jsx';
import { postLabels, purchaseText } from '../../shared/purchase-copy.js';

const MESSAGE_MIN = 10;
const MESSAGE_MAX = 2000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public support form of a store, linked from the purchase email and the thank-you page.
// Each message is saved in Convex (contactRequests); nothing is sent to the browser's storage.
export default function SupportPage({ subdomain }) {
  const data = useQuery(api.contactRequests.page, { subdomain });
  const create = useMutation(api.contactRequests.create);
  return <SupportView data={data} onSend={fields => create({ subdomain, ...fields })} />;
}

// The page itself: `data` undefined while loading, null when the store is not available.
export function SupportView({ data, onSend }) {
  const labels = postLabels(data?.presentation);
  const ids = useId();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  useEffect(() => { if (data) document.title = `${labels.supportPageTitle} · ${data.presentation.brandName || data.storeName}`; }, [data, labels.supportPageTitle]);

  if (data === undefined) return <main className="mx-auto max-w-2xl px-5 py-10 sm:px-6"><PageSkeleton label="Loading" /></main>;
  if (data === null) return <main className="mx-auto max-w-2xl space-y-6 px-5 py-10 sm:px-6">
    <h1 className="text-3xl font-semibold tracking-tight">This page is unavailable</h1>
    <p className="leading-7 text-muted-foreground">This store could not be found. It may no longer be available.</p>
  </main>;

  const trimmed = message.trim();
  const valid = EMAIL.test(email.trim()) && trimmed.length >= MESSAGE_MIN && trimmed.length <= MESSAGE_MAX;

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;
    if (!valid) { setError(labels.supportError); return; }
    setBusy(true); setError('');
    try {
      await onSend({ email: email.trim(), message: trimmed, ...(website ? { website } : {}) });
      setSentTo(email.trim());
    } catch {
      setError(labels.supportError);
    } finally { setBusy(false); }
  }

  const hero = <header className="thanks-hero support-hero">
    <div className="sales-container support-hero-inner">
      <span className="support-hero-icon" aria-hidden="true"><LifeBuoy /></span>
      <h1>{labels.supportPageTitle}</h1>
      {labels.supportPageText && <p>{labels.supportPageText}</p>}
    </div>
  </header>;

  return <PurchaseLanding presentation={data.presentation} storeName={data.storeName} hero={hero} className="is-paid is-support">
    <div className="thanks-body"><div className="sales-container">
      <section className="thanks-card support-card" aria-live="polite">
        {sentTo ? <div className="support-sent" role="status">
          <span className="support-sent-check" aria-hidden="true"><Check /></span>
          <h2>{labels.supportSentTitle}</h2>
          <p>{purchaseText(labels, 'supportSentText', { email: sentTo })}</p>
          <Link className="purchase-open is-secondary" to=".."><ArrowLeft aria-hidden="true" />{labels.supportBack}</Link>
        </div> : <form className="support-form" onSubmit={onSubmit} noValidate>
          <label className="support-field" htmlFor={`${ids}-email`}>
            <span>{labels.supportEmail}</span>
            <span className="support-input"><Mail aria-hidden="true" />
              <input id={`${ids}-email`} type="email" inputMode="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" />
            </span>
          </label>
          <label className="support-field" htmlFor={`${ids}-message`}>
            <span>{labels.supportMessage}</span>
            <textarea id={`${ids}-message`} required rows={6} minLength={MESSAGE_MIN} maxLength={MESSAGE_MAX} value={message} onChange={event => setMessage(event.target.value)} placeholder={labels.supportPlaceholder} aria-describedby={`${ids}-count`} />
            <small id={`${ids}-count`} className="support-count">{trimmed.length} / {MESSAGE_MAX}</small>
          </label>
          {/* Hidden from people; bots that fill it are ignored by the server. */}
          <input className="support-trap" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={event => setWebsite(event.target.value)} />
          {error && <p className="support-error" role="alert">{error}</p>}
          <button type="submit" className="purchase-open support-submit" disabled={busy} aria-busy={busy}>
            {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
            {busy ? labels.supportSending : labels.supportSend}
          </button>
        </form>}
      </section>
    </div></div>
  </PurchaseLanding>;
}
