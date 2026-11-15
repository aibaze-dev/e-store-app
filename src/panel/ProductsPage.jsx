import { useStoreWorkspace } from './StoreWorkspace.jsx';
import { Link } from 'react-router-dom';
import { useQuery } from 'convex/react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api.js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState, PageSkeleton } from '@/components/Field.jsx';

export default function ProductsPage() {
  const { productsPath } = useStoreWorkspace();
  const products = useQuery(api.products.list, {});
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Productos</h1>
        <p className="text-sm leading-6 text-muted-foreground">El catálogo común: cada recurso puede usarse como principal, bono o extra en cualquier tienda.</p>
      </div>
      <Button asChild><Link to={`${productsPath}/nuevo`}><Plus aria-hidden="true" />Nuevo producto</Link></Button>
    </div>

    {products === undefined && <PageSkeleton label="Cargando productos" />}
    {products?.length === 0 && <EmptyState title="Todavía no hay productos">
      <p>Cargá tu primer ebook con los links que va a recibir quien lo compre.</p>
      <Button asChild><Link to={`${productsPath}/nuevo`}><Plus aria-hidden="true" />Nuevo producto</Link></Button>
    </EmptyState>}
    {products?.length > 0 && <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Entregables</TableHead><TableHead>Estado</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader>
        <TableBody>{products.map(product => <TableRow key={product._id}>
          <TableCell className="min-w-56 font-medium">{product.name}</TableCell>
          <TableCell className="whitespace-nowrap">{product.deliverables.length === 1 ? '1 link' : `${product.deliverables.length} links`}</TableCell>
          <TableCell><Badge variant={product.status === 'active' ? 'secondary' : 'outline'}>{product.status === 'active' ? 'Activo' : 'Archivado'}</Badge></TableCell>
          <TableCell className="text-right"><Button asChild variant="outline"><Link to={`${productsPath}/${product._id}`}>Editar<span className="sr-only"> {product.name}</span></Link></Button></TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </div>}
  </div>;
}
