import './theme.css';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';
import { artifacts } from './registry.js';
import { artifactComponents } from './components.js';
import { artifactNameFor, brandNameFor, LanguageContext, languageFromSearch, readStoredLanguage, storeLanguage } from './i18n.js';
import { LanguagePicker } from './LanguageControls.jsx';

const LOADING = { en: 'Loading tool…', es: 'Cargando herramienta…', pt: 'Carregando ferramenta…' };

function initialLanguage() {
  const fromUrl = languageFromSearch(window.location.search);
  if (fromUrl) storeLanguage(fromUrl);
  return fromUrl || readStoredLanguage();
}

export default function ArtifactPage() {
  const { slug } = useParams();
  const [lang, setLangState] = useState(initialLanguage);
  const artifact = artifacts.find(item => item.slug === slug);
  const Component = artifact && Object.hasOwn(artifactComponents, slug) ? artifactComponents[slug] : null;
  const name = artifactNameFor(artifact, lang);
  const title = `${name || 'Artefacto no encontrado'} · ${brandNameFor(lang || 'en')}`;
  const context = useMemo(() => ({ lang: lang || 'en', setLang: code => { storeLanguage(code); setLangState(code); } }), [lang]);

  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => { document.title = previous; };
  }, [title]);

  useEffect(() => {
    if (!lang) return;
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => { document.documentElement.lang = previous; };
  }, [lang]);

  if (!artifact || !Component) return <main className="artifact-theme flex min-h-svh flex-col items-center justify-center gap-3 px-6 text-center">
    <h1 className="text-3xl font-semibold tracking-tight">Artefacto no encontrado</h1>
    <p className="text-sm leading-6 text-muted-foreground">Revisá el enlace: esta herramienta no está disponible.</p>
  </main>;

  // First visit: nothing renders (and nothing is reported) until a language is chosen.
  if (!lang) return <div className={`artifact-theme artifact-${slug} min-h-svh`}>
    <LanguagePicker onChoose={context.setLang} />
  </div>;

  return <LanguageContext.Provider value={context}>
    <div className={`artifact-theme artifact-${slug} min-h-svh`} lang={lang}>
      <ErrorBoundary key={slug}>
        <Suspense fallback={<p role="status" className="px-6 py-16 text-center">{LOADING[lang]}</p>}>
          <Component name={name} />
        </Suspense>
      </ErrorBoundary>
    </div>
  </LanguageContext.Provider>;
}
