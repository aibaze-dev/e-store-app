import { useState } from 'react';
import { ArrowUpRight, Check, Copy } from 'lucide-react';
import { artifacts } from '@/artifacts/registry.js';
import { artifactUrl } from '@/lib/site.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { EmptyState, Field } from '@/components/Field.jsx';
import { Input } from '@/components/ui/input';

function ArtifactCard({ artifact }) {
  const [copyState, setCopyState] = useState('idle');
  const url = artifactUrl(artifact.slug);

  async function copyLink() {
    setCopyState('copying');
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return <Card className="min-w-0 overflow-hidden">
    {artifact.coverUrl && <img src={artifact.coverUrl} alt="" loading="lazy" className="aspect-video w-full object-cover" />}
    <CardHeader>
      <CardTitle className="break-words">{artifact.name}</CardTitle>
      <CardDescription className="break-words">{artifact.description}</CardDescription>
    </CardHeader>
    <CardContent className="mt-auto space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button asChild><a href={url} target="_blank" rel="noopener noreferrer">Abrir<ArrowUpRight aria-hidden="true" /><span className="sr-only"> {artifact.name} en otra pestaña</span></a></Button>
        <Button variant="outline" onClick={copyLink} disabled={copyState === 'copying'}>
          {copyState === 'copied' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copyState === 'copied' ? 'Enlace copiado' : copyState === 'copying' ? 'Copiando…' : 'Copiar enlace'}
          <span className="sr-only"> de {artifact.name}</span>
        </Button>
      </div>
      <p role="status" className="sr-only">{copyState === 'copied' ? `Enlace de ${artifact.name} copiado.` : ''}</p>
      {copyState === 'failed' && <div className="space-y-2">
        <p role="alert" className="text-sm text-muted-foreground">No pudimos copiar el enlace. Seleccionalo y copialo manualmente.</p>
        <Field label={`Enlace de ${artifact.name}`}>{props => <Input {...props} type="url" value={url} readOnly onFocus={event => event.target.select()} />}</Field>
      </div>}
    </CardContent>
  </Card>;
}

export default function ArtifactsPage() {
  return <div className="space-y-6">
    <div className="space-y-1">
      <h1 className="text-3xl font-semibold tracking-tight">Artefactos</h1>
      <p className="text-sm leading-6 text-muted-foreground">Herramientas y prototipos disponibles para compartir o entregar desde cualquiera de tus tiendas.</p>
    </div>
    {artifacts.length === 0
      ? <EmptyState title="Todavía no hay artefactos"><p>Las herramientas aparecerán acá cuando estén disponibles. Podrás abrirlas y copiar su enlace público.</p></EmptyState>
      : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{artifacts.map(artifact => <ArtifactCard key={artifact.slug} artifact={artifact} />)}</div>}
  </div>;
}
