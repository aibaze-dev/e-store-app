import { BookOpen, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// Deliverables without `kind` are documents: the form treats them that way too.
export function deliverableCounts(deliverables = []) {
  const links = deliverables.filter(item => item.kind === 'link').length;
  return { files: deliverables.length - links, links, total: deliverables.length };
}

export function deliverableSummary(deliverables = []) {
  const { files, links, total } = deliverableCounts(deliverables);
  if (total === 0) return 'Sin entregables';
  const parts = [];
  if (files) parts.push(files === 1 ? '1 documento' : `${files} documentos`);
  if (links) parts.push(links === 1 ? '1 enlace' : `${links} enlaces`);
  return parts.join(' · ');
}

export function CatalogHeader({ eyebrow, icon: Icon, title, description, stats = [], action }) {
  return <header className="catalog-hero">
    <div className="relative z-10 flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-2xl space-y-3">
        <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-primary uppercase">{Icon && <Icon className="size-4" aria-hidden="true" />}{eyebrow}</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-sm leading-7 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
    {stats.length > 0 && <dl className="relative z-10 mt-6 flex flex-wrap gap-2">
      {stats.map(stat => <div key={stat.label} className="catalog-stat"><dt className="text-muted-foreground">{stat.label}</dt><dd className="font-semibold text-foreground">{stat.value}</dd></div>)}
    </dl>}
  </header>;
}

export function StatusPill({ status, configured = true }) {
  const state = !configured ? 'draft' : status === 'active' ? 'active' : 'archived';
  const label = state === 'draft' ? 'Sin configurar' : state === 'active' ? 'Activo' : 'Archivado';
  return <span className="catalog-status" data-state={state}><span aria-hidden="true" />{label}</span>;
}

// Cover image or a typographic placeholder that keeps the grid balanced.
export function CoverArt({ src, title, variant = 'book', className }) {
  const Icon = variant === 'book' ? BookOpen : Sparkles;
  return <div className={cn('catalog-cover', `is-${variant}`, className)}>
    {src
      ? <img src={src} alt="" loading="lazy" />
      : <div className="catalog-cover-fallback" aria-hidden="true"><Icon strokeWidth={1.4} /><span>{title || (variant === 'book' ? 'Tu ebook' : 'Herramienta')}</span></div>}
  </div>;
}

export function SectionHeading({ step, icon: Icon, title, description, id }) {
  return <div className="flex items-start gap-4">
    <span className="catalog-step" aria-hidden="true">{Icon ? <Icon /> : step}</span>
    <div className="min-w-0 space-y-1">
      <h2 id={id} className="text-lg font-semibold tracking-tight">{title}</h2>
      {description && <p className="text-sm leading-6 text-muted-foreground">{description}</p>}
    </div>
  </div>;
}
