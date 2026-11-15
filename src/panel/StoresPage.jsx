import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api.js';
import { formatMoney } from '@/lib/format.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, PageSkeleton } from '@/components/Field.jsx';

export default function StoresPage() {
  const stores = useQuery(api.stores.list, {});
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Tiendas</h1>
        <p className="text-sm leading-6 text-muted-foreground">Cada tienda es una campaña: un ebook principal con sus bonos, extras y landing.</p>
      </div>
      <Button asChild><Link to="/panel/tiendas/nueva"><Plus aria-hidden="true" />Nueva tienda</Link></Button>
    </div>

    {stores === undefined && <PageSkeleton label="Cargando tiendas" />}
    {stores?.length === 0 && <EmptyState title="Todavía no hay tiendas">
      <p>Creá una tienda para elegir el ebook principal, su precio y armar la landing. Antes necesitás al menos un producto en el catálogo.</p>
      <Button asChild><Link to="/panel/tiendas/nueva"><Plus aria-hidden="true" />Nueva tienda</Link></Button>
    </EmptyState>}
    {stores?.length > 0 && <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader><TableRow><TableHead>Tienda</TableHead><TableHead>Principal</TableHead><TableHead>Precio</TableHead><TableHead>Estado</TableHead><TableHead>Landing</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader>
        <TableBody>{stores.map(store => <TableRow key={store._id}>
          <TableCell className="min-w-48 font-medium">{store.name}</TableCell>
          <TableCell className="min-w-40">{store.mainProductName || '—'}</TableCell>
          <TableCell className="whitespace-nowrap">{formatMoney(store.price, store.currency)}</TableCell>
          <TableCell><Badge variant={store.status === 'active' ? 'secondary' : 'outline'}>{store.status === 'active' ? 'Activa' : 'Borrador'}</Badge></TableCell>
          <TableCell className="whitespace-nowrap">{store.subdomain ? <>{store.subdomain} · {store.published ? 'publicada' : 'sin publicar'}</> : 'Sin landing'}</TableCell>
          <TableCell><div className="flex justify-end gap-2">
            <Button asChild><Link to={`/panel/tiendas/${store._id}`}>Entrar<span className="sr-only"> a {store.name}</span></Link></Button>
            <Button asChild variant="outline"><Link to={`/panel/tiendas/${store._id}/configuracion`}>Configurar<span className="sr-only"> {store.name}</span></Link></Button>
            <Button asChild variant="outline"><Link to={`/panel/tiendas/${store._id}/landing`}>Landing<span className="sr-only"> de {store.name}</span></Link></Button>
          </div></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>}
  </div>;
}
