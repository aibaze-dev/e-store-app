import { useQuery } from 'convex/react';
import { api } from '@/lib/api.js';
import { formatDate, formatMoney, STATUS_LABELS } from '@/lib/format.js';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, PageSkeleton } from '@/components/Field.jsx';
import { useStoreWorkspace } from './StoreWorkspace.jsx';

const ROLE_LABELS = { main: 'Principal', bonus: 'Bono', upsell: 'Extra', post_purchase: 'Post-compra' };

export default function OrdersPage() {
  const { store } = useStoreWorkspace();
  const orders = useQuery(api.orders.list, store ? { storeId: store._id } : 'skip');
  return <div className="space-y-6">
    <div className="space-y-1">
      <h1 className="text-3xl font-semibold tracking-tight">Cobros y entregas</h1>
      <p className="text-sm leading-6 text-muted-foreground">Las últimas 100 compras de {store?.name || 'esta tienda'}, con el estado que confirmó Stripe y los links de cada una.</p>
    </div>

    {orders === undefined && <PageSkeleton label="Cargando cobros" />}
    {orders?.length === 0 && <EmptyState title="Todavía no hay compras">
      <p>Cuando alguien inicie un pago desde una landing publicada, va a aparecer acá con su estado.</p>
    </EmptyState>}
    {orders?.length > 0 && <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tienda</TableHead><TableHead>Comprador</TableHead><TableHead>Detalle</TableHead><TableHead>Total</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
        <TableBody>{orders.map(order => <TableRow key={order._id}>
          <TableCell className="whitespace-nowrap">{formatDate(order.createdAt)}</TableCell>
          <TableCell className="min-w-40">{order.storeName || '—'}{order.isPostPurchase && <span className="block text-xs text-muted-foreground">Oferta post-compra</span>}{order.downsell && <span className="block text-xs text-muted-foreground">Con descuento de downsell</span>}</TableCell>
          <TableCell className="min-w-44">{order.buyer?.email
            ? <>{order.buyer.name && <span className="block">{order.buyer.name}</span>}<span className="block text-xs break-all text-muted-foreground">{order.buyer.email}</span></>
            : <span className="text-muted-foreground">Sin datos todavía</span>}</TableCell>
          <TableCell className="min-w-64">
            <ul className="space-y-1">{order.items.map((item, index) => <li key={index}>{item.name} <span className="text-xs text-muted-foreground">· {ROLE_LABELS[item.role]}{item.price > 0 && ` · ${formatMoney(item.price, order.currency)}`}</span></li>)}</ul>
            {order.deliveries.length > 0 && <details className="mt-2">
              <summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium text-primary">Ver {order.deliveries.length === 1 ? '1 link' : `${order.deliveries.length} links`} de entrega</summary>
              <ul className="space-y-1 pb-1 text-xs">{order.deliveries.map((link, index) => <li key={index}>{link.productName} · <a className="break-all underline underline-offset-4" href={link.url} target="_blank" rel="noreferrer">{link.title}</a></li>)}</ul>
            </details>}
          </TableCell>
          <TableCell className="font-medium whitespace-nowrap">{formatMoney(order.total, order.currency)}</TableCell>
          <TableCell><Badge variant={order.status === 'paid' ? 'secondary' : 'outline'}>{STATUS_LABELS[order.status]}</Badge></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>}
  </div>;
}
