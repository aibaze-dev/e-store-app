import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { ArrowRight, CheckCircle2, CircleAlert, ExternalLink, LoaderCircle, Mail, RotateCcw, Send, ShoppingBag, UserRound } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText, formatDate, formatMoney } from '@/lib/format.js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, ErrorAlert, PageSkeleton } from '@/components/Field.jsx';
import OrderStatusBadge from '@/components/OrderStatusBadge.jsx';
import { useStoreWorkspace } from './StoreWorkspace.jsx';

const FILTERS = [
  { id: 'open', label: 'Abiertas' },
  { id: 'closed', label: 'Resueltas' },
  { id: 'all', label: 'Todas' },
];
const EMPTY = {
  open: ['No hay consultas abiertas', 'Cuando un comprador escriba desde el link de soporte del email o de la página de gracias, su mensaje aparece acá.'],
  closed: ['Todavía no resolviste consultas', 'Las consultas que marques como resueltas quedan guardadas en esta pestaña.'],
  all: ['Todavía no hay consultas', 'El link de soporte va en el email de compra y al final de la página de gracias.'],
};

export const countLabel = (value, limit) => value > limit ? `${limit}+` : String(value);

const REPLY_MAX = 5000;
const SEND_ERRORS = {
  not_configured: 'El envío de emails no está configurado.',
  validation_error: 'El proveedor rechazó el email: revisá la dirección del comprador.',
};

// Replies are written here and emailed by the server (Resend). The link to the admin's own
// email app stays as an alternative, and is the only way while emails are not configured.
// The buyer's address was typed in a public form, so it is never trusted for anything else.
function replyLink(email, storeName) {
  return `mailto:${email}?subject=${encodeURIComponent(`Re: tu consulta en ${storeName}`)}`;
}

// One answer already written for this message, with the state of its email.
function Reply({ reply, onRetry }) {
  const failed = reply.status === 'failed' || reply.status === 'skipped';
  return <li className="rounded-lg border-l-4 border-primary/40 bg-muted/60 px-4 py-3">
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>Respuesta de {reply.authorEmail} · {formatDate(reply.createdAt)}</span>
      {reply.status === 'sent' && <Badge variant="outline"><CheckCircle2 aria-hidden="true" />Enviada</Badge>}
      {reply.status === 'pending' && <Badge variant="secondary"><LoaderCircle className="animate-spin" aria-hidden="true" />{reply.error ? 'Reintentando' : 'Enviando'}</Badge>}
      {failed && <Badge variant="destructive"><CircleAlert aria-hidden="true" />No se envió</Badge>}
    </p>
    <p className="mt-2 text-sm leading-6 break-words whitespace-pre-wrap">{reply.message}</p>
    {failed && <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-destructive" role="alert">
      <span>{SEND_ERRORS[reply.error] || 'El email no salió. Probá de nuevo o respondé desde tu correo.'}</span>
      {onRetry && <button type="button" className="inline-flex min-h-11 items-center font-medium underline underline-offset-4" onClick={() => onRetry(reply.message)}>Volver a intentar</button>}
    </p>}
  </li>;
}

// The reply form of one message. `onSend` resolves once the answer is saved and queued.
function Composer({ email, open, initial, onSend, onCancel }) {
  const id = useId();
  const [message, setMessage] = useState(initial);
  const [close, setClose] = useState(open);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const text = message.trim();
  async function submit(event) {
    event.preventDefault();
    if (busy || !text) return;
    setBusy(true); setError('');
    try { await onSend({ message: text, close: open && close }); }
    catch (failure) { setError(errorText(failure, 'No se pudo enviar la respuesta.')); setBusy(false); }
  }
  return <form className="mt-4 space-y-3 rounded-lg border bg-background p-4" onSubmit={submit}>
    <div className="space-y-2">
      <Label htmlFor={id}>Tu respuesta para {email}</Label>
      <Textarea id={id} autoFocus rows={6} maxLength={REPLY_MAX} value={message} onChange={event => setMessage(event.target.value)} disabled={busy} placeholder="Escribí la respuesta. Le llega por email junto con su consulta." aria-describedby={`${id}-hint ${id}-count`} />
      <p id={`${id}-hint`} className="text-xs leading-5 text-muted-foreground">El email le pide que no responda ese correo y le da un botón al formulario de soporte: si vuelve a escribir, entra acá como una consulta nueva.</p>
      <p id={`${id}-count`} className="text-xs text-muted-foreground">{text.length} / {REPLY_MAX}</p>
    </div>
    {open && <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="size-5 accent-primary" checked={close} onChange={event => setClose(event.target.checked)} disabled={busy} />Marcar como resuelta cuando se envíe</label>}
    <ErrorAlert>{error}</ErrorAlert>
    <div className="flex flex-wrap gap-2">
      <Button type="submit" disabled={busy || !text} aria-busy={busy}>{busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}Enviar respuesta</Button>
      <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Cancelar</Button>
    </div>
  </form>;
}

function Request({ request, storeName, ordersPath, canReply }) {
  const setStatus = useMutation(api.contactRequests.setStatus);
  const sendReply = useMutation(api.contactRequests.reply);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // null while the form is closed; otherwise the text it starts with.
  const [draft, setDraft] = useState(null);
  const open = request.status === 'open';
  const replies = request.replies ?? [];
  const sending = replies.some(reply => reply.status === 'pending');
  async function toggle() {
    setBusy(true); setError('');
    try { await setStatus({ id: request._id, status: open ? 'closed' : 'open' }); }
    catch (failure) { setError(errorText(failure, 'No se pudo actualizar la consulta.')); setBusy(false); }
  }
  return <li className={cn('rounded-xl border bg-card p-5 sm:p-6', !open && 'bg-muted/40')}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-2">
          <a className="font-semibold break-all underline-offset-4 hover:underline" href={replyLink(request.email, storeName)}>{request.email}</a>
          {request.order ? <Badge variant="secondary"><UserRound aria-hidden="true" />Cliente</Badge> : <Badge variant="outline">Sin compra con este email</Badge>}
        </p>
        <p className="text-xs text-muted-foreground">{formatDate(request.createdAt)}{!open && request.closedAt && ` · Resuelta el ${formatDate(request.closedAt)}`}</p>
      </div>
      {open ? <Badge>Abierta</Badge> : <Badge variant="outline"><CheckCircle2 aria-hidden="true" />Resuelta</Badge>}
    </div>

    <p className="mt-4 text-[15px] leading-7 break-words whitespace-pre-wrap">{request.message}</p>

    {request.order && <div className="mt-4 rounded-lg bg-muted/60 px-4 py-3 text-sm">
      <p className="flex items-start gap-3"><ShoppingBag className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0">{request.order.buyerName && <strong className="font-medium">{request.order.buyerName} · </strong>}{request.order.items.join(', ')} · {formatMoney(request.order.total, request.order.currency)} · {formatDate(request.order.createdAt)}</span></p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 pl-7"><OrderStatusBadge status={request.order.status} />
        <Link className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline" to={ordersPath}>Ver en cobros<ArrowRight className="size-3.5" aria-hidden="true" /></Link></div>
    </div>}

    {replies.length > 0 && <ul className="mt-4 space-y-3" aria-label="Respuestas enviadas">
      {replies.map(reply => <Reply key={reply._id} reply={reply} onRetry={canReply && draft === null && !sending ? setDraft : null} />)}
    </ul>}

    {draft !== null && <Composer email={request.email} open={open} initial={draft} onCancel={() => setDraft(null)}
      onSend={async fields => { await sendReply({ id: request._id, ...fields }); setDraft(null); }} />}

    <ErrorAlert>{error}</ErrorAlert>
    <div className="mt-4 flex flex-wrap gap-2">
      {canReply
        ? draft === null && <Button onClick={() => setDraft('')} disabled={sending}><Mail aria-hidden="true" />{replies.length ? 'Responder de nuevo' : 'Responder por email'}</Button>
        : <Button asChild><a href={replyLink(request.email, storeName)}><Mail aria-hidden="true" />Responder por email</a></Button>}
      <Button variant="outline" onClick={toggle} disabled={busy} aria-busy={busy}>
        {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : open ? <CheckCircle2 aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
        {open ? 'Marcar como resuelta' : 'Reabrir'}
      </Button>
      {canReply && <Button asChild variant="ghost"><a href={replyLink(request.email, storeName)}><ExternalLink aria-hidden="true" />Abrir en mi correo</a></Button>}
    </div>
  </li>;
}

// "Soporte" in the panel: messages from the store's public support form.
export default function SupportInboxPage() {
  const { store, basePath } = useStoreWorkspace();
  const [filter, setFilter] = useState('open');
  const requests = useQuery(api.contactRequests.list, store ? { storeId: store._id, status: filter } : 'skip');
  const counts = useQuery(api.contactRequests.counts, store ? { storeId: store._id } : 'skip');
  const canReply = useQuery(api.contactRequests.canReply, store ? {} : 'skip');
  return <SupportInbox storeName={store?.name || ''} requests={requests} counts={counts} canReply={canReply} filter={filter} onFilter={setFilter} ordersPath={`${basePath}/cobros`} />;
}

// The inbox itself: `requests` undefined while loading. `canReply` is false when the server
// cannot send emails; answering then opens the admin's own email app.
export function SupportInbox({ storeName, requests, counts, canReply, filter, onFilter, ordersPath }) {
  const total = counts ? { open: counts.open, closed: counts.closed, all: counts.open + counts.closed } : null;
  const [emptyTitle, emptyText] = EMPTY[filter];
  return <div className="space-y-6">
    <div className="space-y-1">
      <h1 className="text-3xl font-semibold tracking-tight">Soporte</h1>
      <p className="text-sm leading-6 text-muted-foreground">Consultas que dejaron los compradores de {storeName || 'esta tienda'} desde el link de ayuda del email de compra y de la página de gracias. El email lo escribe quien consulta: confirmá desde su casilla antes de reenviar accesos.</p>
      {canReply === false && <p className="text-sm leading-6 text-muted-foreground">Para responder desde acá hay que configurar el envío de emails (<code>RESEND_API_KEY</code> y <code>EMAIL_FROM</code> en Convex). Mientras tanto, «Responder por email» abre tu programa de correo.</p>}
    </div>

    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar consultas">
      {FILTERS.map(({ id, label }) => <Button key={id} variant={filter === id ? 'default' : 'outline'} aria-pressed={filter === id} onClick={() => onFilter(id)}>
        {label}{total && <span className={cn('rounded-full px-2 text-xs', filter === id ? 'bg-primary-foreground/20' : 'bg-muted')}>{countLabel(total[id], counts.limit)}</span>}
      </Button>)}
    </div>

    {requests === undefined && <PageSkeleton label="Cargando consultas" />}
    {requests?.length === 0 && <EmptyState title={emptyTitle}><p>{emptyText}</p></EmptyState>}
    {requests?.length > 0 && <ul className="space-y-4">{requests.map(request => <Request key={request._id} request={request} storeName={storeName} ordersPath={ordersPath} canReply={Boolean(canReply)} />)}</ul>}
  </div>;
}
