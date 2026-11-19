import { useQuery } from 'convex/react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { useState } from 'react';
import { ArrowUpRight, Check, Copy, Pencil, Settings2, Sparkles } from 'lucide-react';
import { artifacts } from '@/artifacts/registry.js';
import { artifactUrl } from '@/lib/site.js';
import { Button } from '@/components/ui/button';
import { EmptyState, Field, PageSkeleton } from '@/components/Field.jsx';
import { Input } from '@/components/ui/input';
import { CatalogHeader, CoverArt, StatusPill } from './CatalogParts.jsx';

function ArtifactCard({ artifact, product }) {
  const [copyState, setCopyState] = useState('idle');
  const url = artifactUrl(artifact.slug);
  const editPath = `/panel/artefactos/${artifact.slug}`;

  async function copyLink() {
    setCopyState('copying');
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return <article className="catalog-card">
    <CoverArt src={artifact.coverUrl} title={artifact.name} variant="tool" />
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
      <StatusPill status={product?.status} configured={Boolean(product)} />
      <h2 className="text-base leading-snug font-semibold break-words"><Link to={editPath} className="hover:underline hover:underline-offset-4">{artifact.name}</Link></h2>
      <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{artifact.description}</p>
      <p className="catalog-url" title={url}>{url.replace(/^https?:\/\//, '')}</p>
      <div className="mt-auto flex flex-wrap gap-2 border-t pt-4">
        <Button asChild variant={product ? 'outline' : 'default'} className="flex-1"><Link to={editPath}>{product ? <Pencil aria-hidden="true" /> : <Settings2 aria-hidden="true" />}{product ? 'Editar ficha' : 'Configurar ficha'}<span className="sr-only"> de {artifact.name}</span></Link></Button>
        <Button variant="ghost" size="icon" className="size-11" onClick={copyLink} disabled={copyState === 'copying'} aria-label={copyState === 'copied' ? `Enlace de ${artifact.name} copiado` : `Copiar enlace de ${artifact.name}`}>
          {copyState === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
        <Button asChild variant="ghost" size="icon" className="size-11"><a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${artifact.name} en otra pestaña`}><ArrowUpRight aria-hidden="true" /></a></Button>
      </div>
      <p role="status" className="sr-only">{copyState === 'copied' ? `Enlace de ${artifact.name} copiado.` : ''}</p>
      {copyState === 'failed' && <div className="space-y-2">
        <p role="alert" className="text-sm text-muted-foreground">No pudimos copiar el enlace. Seleccionalo y copialo manualmente.</p>
        <Field label={`Enlace de ${artifact.name}`}>{props => <Input {...props} type="url" value={url} readOnly onFocus={event => event.target.select()} />}</Field>
      </div>}
    </div>
  </article>;
}

export default function ArtifactsPage() {
  const products = useQuery(api.products.list, {});
  const configured = products?.filter(item => item.type === 'artifact' && artifacts.some(artifact => artifact.slug === item.artifactSlug)) ?? [];
  return <div className="space-y-6">
    <CatalogHeader
      eyebrow="Herramientas interactivas"
      icon={Sparkles}
      title="Artefactos"
      description="Configurá la ficha comercial de cada herramienta para ofrecerla como producto, bono gratis o upsell en cualquiera de tus tiendas."
      stats={products && artifacts.length ? [
        { label: 'Herramientas', value: artifacts.length },
        { label: 'Con ficha', value: configured.length },
        { label: 'Activas', value: configured.filter(item => item.status === 'active').length },
      ] : []}
    />
    {products === undefined ? <PageSkeleton label="Cargando artefactos" /> : artifacts.length === 0
      ? <EmptyState title="Todavía no hay artefactos"><p>Las herramientas aparecerán acá cuando estén disponibles. Podrás abrirlas y copiar su enlace público.</p></EmptyState>
      : <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{artifacts.map(artifact => {
        const product = products.find(item => item.type === 'artifact' && item.artifactSlug === artifact.slug);
        return <li key={artifact.slug} className="flex"><ArtifactCard artifact={{ ...artifact, ...(product ? { name: product.name, description: product.shortDescription || product.description, coverUrl: product.coverUrl } : {}) }} product={product} /></li>;
      })}</ul>}
  </div>;
}
