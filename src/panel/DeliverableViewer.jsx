import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Copy, Download, Eye, FileArchive, FileText, FileWarning, Link2, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInternalThemeClass } from '@/components/InternalTheme.jsx';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { deliverableSummary } from './CatalogParts.jsx';
import { previewMode, safeUrl } from './deliverable-preview.js';

// Storage URLs carry no extension, so the type comes from the file's headers.
const types = new Map();
function useContentType(url, enabled) {
  const [type, setType] = useState(() => types.get(url));
  useEffect(() => {
    if (!enabled || !url || types.has(url)) { setType(types.get(url)); return; }
    let active = true;
    setType(undefined);
    fetch(url, { method: 'HEAD' })
      .then(response => (response.ok ? response.headers.get('content-type') : null))
      .catch(() => null)
      .then(value => { types.set(url, value); if (active) setType(value); });
    return () => { active = false; };
  }, [url, enabled]);
  return type;
}

function CopyButton({ value, label }) {
  const [state, setState] = useState('idle');
  async function copy() {
    try { await navigator.clipboard.writeText(value); setState('copied'); }
    catch { setState('failed'); }
  }
  return <>
    <Button type="button" variant="outline" onClick={copy}>{state === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{state === 'copied' ? 'Copiado' : 'Copiar enlace'}<span className="sr-only"> de {label}</span></Button>
    <span role="status" className="sr-only">{state === 'copied' ? 'Enlace copiado.' : ''}</span>
    {state === 'failed' && <p role="alert" className="basis-full text-xs text-muted-foreground">No se pudo copiar. Seleccioná el enlace y copialo manualmente.</p>}
  </>;
}

function Preview({ item, index }) {
  const url = safeUrl(item.url);
  const contentType = useContentType(url, item.kind !== 'link' && Boolean(url));
  const { mode, format } = previewMode(item, contentType);
  const title = item.title || `Entregable ${index + 1}`;
  const open = <Button asChild><a href={url} target="_blank" rel="noopener noreferrer">{mode === 'link' ? 'Abrir enlace' : 'Abrir en otra pestaña'}<ArrowUpRight aria-hidden="true" /><span className="sr-only"> {title}</span></a></Button>;

  if (mode === 'missing') return <div className="catalog-viewer-empty">
    <FileWarning className="size-9 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
    <p className="font-medium">Este entregable no tiene {item.kind === 'link' ? 'un enlace válido' : 'un documento cargado'}</p>
    <p className="max-w-sm text-sm text-muted-foreground">Editá el ebook para completarlo antes de ofrecerlo en una tienda.</p>
  </div>;

  if (mode === 'link') return <div className="catalog-viewer-empty">
    <span className="catalog-step" aria-hidden="true"><Link2 /></span>
    <p className="font-medium">{title}</p>
    <p className="max-w-lg rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all select-all">{url}</p>
    <div className="flex flex-wrap justify-center gap-2 pt-2">{open}<CopyButton value={url} label={title} /></div>
  </div>;

  if (mode === 'checking') return <div className="catalog-viewer-empty" role="status">
    <LoaderCircle className="size-7 animate-spin text-muted-foreground" aria-hidden="true" />
    <p className="text-sm text-muted-foreground">Preparando el documento…</p>
  </div>;

  if (mode === 'pdf') return <div className="flex min-h-0 flex-1 flex-col gap-3">
    <iframe src={url} title={`Vista previa de ${title}`} className="catalog-viewer-frame" />
    <div className="flex flex-wrap gap-2">{open}</div>
  </div>;

  return <div className="catalog-viewer-empty">
    <span className="catalog-step" aria-hidden="true"><FileArchive /></span>
    <p className="font-medium">{title}</p>
    <p className="max-w-sm text-sm text-muted-foreground">{format ? `Los archivos ${format} no se pueden ver dentro del panel.` : 'No pudimos mostrar la vista previa de este archivo.'} Descargalo para revisarlo.</p>
    <Button asChild><a href={url} target="_blank" rel="noopener noreferrer" download><Download aria-hidden="true" />Descargar{format ? ` ${format}` : ' archivo'}<span className="sr-only"> {title}</span></a></Button>
  </div>;
}

export function DeliverableViewer({ product, open, onOpenChange }) {
  const [selected, setSelected] = useState(0);
  const themeClass = useInternalThemeClass();
  const items = product.deliverables || [];
  const current = items[Math.min(selected, items.length - 1)];
  return <Dialog open={open} onOpenChange={value => { onOpenChange(value); if (!value) setSelected(0); }}>
    <DialogContent className={cn(themeClass, 'catalog-viewer max-w-6xl gap-0 p-0 sm:p-0')}>
      <div className="border-b px-6 py-5 pr-16">
        <DialogTitle className="text-xl break-words">{product.name}</DialogTitle>
        <DialogDescription className="text-sm leading-6">{deliverableSummary(items)} · lo que recibe el comprador después del pago</DialogDescription>
      </div>
      {items.length === 0 ? <div className="catalog-viewer-empty m-6">
        <FileText className="size-9 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <p className="font-medium">Este ebook todavía no tiene entregables</p>
        <p className="max-w-sm text-sm text-muted-foreground">Editalo para subir documentos o agregar enlaces.</p>
      </div> : <div className="catalog-viewer-body">
        {items.length > 1 && <nav aria-label="Entregables" className="catalog-viewer-list">
          <ul className="grid gap-1">{items.map((item, index) => {
            const Icon = item.kind === 'link' ? Link2 : FileText;
            const active = current === item;
            return <li key={index}><button type="button" aria-current={active ? 'true' : undefined} className={cn('catalog-viewer-item', active && 'is-active')} onClick={() => setSelected(index)}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title || `Entregable ${index + 1}`}</span><span className="block text-xs text-muted-foreground">{item.kind === 'link' ? 'Enlace' : 'Documento'}</span></span>
            </button></li>;
          })}</ul>
        </nav>}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4 sm:p-6">
          <Preview key={`${selected}-${current.url}`} item={current} index={items.indexOf(current)} />
        </div>
      </div>}
    </DialogContent>
  </Dialog>;
}

export function ViewContentButton({ product, className, variant = 'outline', size }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)}><Eye aria-hidden="true" />Ver contenido<span className="sr-only"> de {product.name}</span></Button>
    {open && <DeliverableViewer product={product} open={open} onOpenChange={setOpen} />}
  </>;
}
