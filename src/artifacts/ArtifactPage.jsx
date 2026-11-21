import './theme.css';
import { Suspense, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import brand from '@/config/brandData.json';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';
import { artifacts } from './registry.js';
import { artifactComponents } from './components.js';

export default function ArtifactPage() {
  const { slug } = useParams();
  const artifact = artifacts.find(item => item.slug === slug);
  const Component = artifact && Object.hasOwn(artifactComponents, slug) ? artifactComponents[slug] : null;
  const title = `${artifact?.name || 'Artefacto no encontrado'} · ${brand.artifactBrandName}`;

  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => { document.title = previous; };
  }, [title]);

  if (!artifact || !Component) return <main className="artifact-theme flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
    <h1 className="text-3xl font-semibold tracking-tight">Artefacto no encontrado</h1>
    <p className="text-sm leading-6 text-muted-foreground">Revisá el enlace: esta herramienta no está disponible.</p>
  </main>;

  return <div className={`artifact-theme artifact-${slug} min-h-svh`}>
    <ErrorBoundary key={slug}>
      <Suspense fallback={<p role="status" className="px-6 py-16 text-center">Cargando herramienta…</p>}>
        <Component name={artifact.name} />
      </Suspense>
    </ErrorBoundary>
  </div>;
}
