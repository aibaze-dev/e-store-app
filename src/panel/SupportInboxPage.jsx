import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from 'convex/react';
import { ArrowRight, CheckCircle2, LoaderCircle, Mail, RotateCcw, ShoppingBag, UserRound } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText, formatDate, formatMoney } from '@/lib/format.js';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

// Answering happens in the admin's own email app: the reply goes from a real mailbox
// and the buyer's address was typed in a public form, so it is never trusted for anything else.
function replyLink(email, storeName) {
  return `mailto:${email}?subject=${encodeURIComponent(`Re: tu consulta en ${storeName}`)}`;
}

function Request({ request, storeName, ordersPath }) {
  const setStatus = useMutation(api.contactRequests.setStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const open = request.status === 'open';
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

    <ErrorAlert>{error}</ErrorAlert>
    <div className="mt-4 flex flex-wrap gap-2">
      <Button asChild><a href={replyLink(request.email, storeName)}><Mail aria-hidden="true" />Responder por email</a></Button>
      <Button variant="outline" onClick={toggle} disabled={busy} aria-busy={busy}>
        {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : open ? <CheckCircle2 aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
        {open ? 'Marcar como resuelta' : 'Reabrir'}
      </Button>
    </div>
  </li>;
}

// "Soporte" in the panel: messages from the store's public support form.
export default function SupportInboxPage() {
  const { store, basePath } = useStoreWorkspace();
  const [filter, setFilter] = useState('open');
  const requests = useQuery(api.contactRequests.list, store ? { storeId: store._id, status: filter } : 'skip');
  const counts = useQuery(api.contactRequests.counts, store ? { storeId: store._id } : 'skip');
  return <SupportInbox storeName={store?.name || ''} requests={requests} counts={counts} filter={filter} onFilter={setFilter} ordersPath={`${basePath}/cobros`} />;
}

// The inbox itself: `requests` undefined while loading.
export function SupportInbox({ storeName, requests, counts, filter, onFilter, ordersPath }) {
  const total = counts ? { open: counts.open, closed: counts.closed, all: counts.open + counts.closed } : null;
  const [emptyTitle, emptyText] = EMPTY[filter];
  return <div className="space-y-6">
    <div className="space-y-1">
      <h1 className="text-3xl font-semibold tracking-tight">Soporte</h1>
      <p className="text-sm leading-6 text-muted-foreground">Consultas que dejaron los compradores de {storeName || 'esta tienda'} desde el link de ayuda del email de compra y de la página de gracias. El email lo escribe quien consulta: confirmá desde su casilla antes de reenviar accesos.</p>
    </div>

    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar consultas">
      {FILTERS.map(({ id, label }) => <Button key={id} variant={filter === id ? 'default' : 'outline'} aria-pressed={filter === id} onClick={() => onFilter(id)}>
        {label}{total && <span className={cn('rounded-full px-2 text-xs', filter === id ? 'bg-primary-foreground/20' : 'bg-muted')}>{countLabel(total[id], counts.limit)}</span>}
      </Button>)}
    </div>

    {requests === undefined && <PageSkeleton label="Cargando consultas" />}
    {requests?.length === 0 && <EmptyState title={emptyTitle}><p>{emptyText}</p></EmptyState>}
    {requests?.length > 0 && <ul className="space-y-4">{requests.map(request => <Request key={request._id} request={request} storeName={storeName} ordersPath={ordersPath} />)}</ul>}
  </div>;
}
