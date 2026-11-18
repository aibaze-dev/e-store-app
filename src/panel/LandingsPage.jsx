import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { Eye, ListChecks, LoaderCircle, PanelTop, PenLine, Rocket, X } from 'lucide-react';
import { api } from '@/lib/api.js';
import { landingUrls } from '@/lib/site.js';
import { errorText, formatDate } from '@/lib/format.js';
import { Button } from '@/components/ui/button';
import { ErrorAlert, PageSkeleton } from '@/components/Field.jsx';
import { ShareLink } from './StoreDashboardPage.jsx';
import { QuizPreview } from '@/storefront/Quiz.jsx';

const TYPES = {
  classic: { title: 'Landing clásica', icon: PanelTop, description: 'Tu página de venta completa, con secciones, testimonios y oferta.', edit: 'landing' },
  quiz: { title: 'Quiz', icon: ListChecks, description: 'Preguntas y resultados personalizados antes de la compra.', edit: 'quiz' },
};

export default function LandingsPage() {
  const { storeId } = useParams();
  const rows = useQuery(api.landings.list, { storeId });
  const quiz = useQuery(api.quizzes.get, { storeId });
  const publishClassic = useMutation(api.landings.publish);
  const publishQuiz = useMutation(api.quizzes.publish);
  const unpublish = useMutation(api.landings.unpublish);
  if (rows === undefined || quiz === undefined) return <PageSkeleton label="Cargando landings" />;
  return <LandingsView storeId={storeId} rows={rows} quiz={quiz}
    onPublish={type => type === 'classic' ? publishClassic({ storeId }) : publishQuiz({ storeId })}
    onUnpublish={type => unpublish({ storeId, type })} />;
}

// Presentational: receives the landings and the publish actions, so it can be rendered without a backend.
export function LandingsView({ storeId, rows, quiz, onPublish, onUnpublish }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState(false);
  const base = `/panel/tiendas/${storeId}`;
  const run = async (key, action) => {
    setBusy(key); setError('');
    try { await action(); } catch (failure) { setError(errorText(failure, 'No se pudo cambiar la publicación.')); } finally { setBusy(''); }
  };
  const liveCount = rows.filter(row => row.published || row.publicationId).length;

  return <div className="landings-page">
    <header className="landings-heading">
      <p className="text-xs font-semibold tracking-widest text-primary uppercase">Una oferta · dos recorridos</p>
      <h1 className="text-3xl font-semibold tracking-tight">Landings</h1>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Publicá cada experiencia por separado. Las dos comparten checkout, precios, bonos y entrega.</p>
      <p className="text-sm font-medium">{liveCount === 0 ? 'Ninguna publicada todavía' : liveCount === 1 ? '1 de 2 publicada' : 'Las 2 están publicadas'}</p>
    </header>
    <ErrorAlert>{error}</ErrorAlert>
    <div className="landings-grid">
      {Object.keys(TYPES).map(type => <LandingCard key={type} type={type} row={rows.find(item => item.template === type)} base={base} busy={busy}
        previewOpen={type === 'quiz' && preview} canPreviewQuiz={Boolean(quiz)} onTogglePreview={() => setPreview(value => !value)}
        onPublish={() => run(`publish:${type}`, () => onPublish(type))} onUnpublish={() => run(`unpublish:${type}`, () => onUnpublish(type))} />)}
    </div>
    {preview && quiz && <section className="dashboard-card landings-quiz-preview" aria-labelledby="quiz-preview-title">
      <div className="flex items-center justify-between gap-3 border-b p-4"><h2 id="quiz-preview-title" className="font-semibold">Vista previa del quiz</h2>
        <Button type="button" variant="ghost" size="icon" aria-label="Cerrar vista previa" onClick={() => setPreview(false)}><X aria-hidden="true" /></Button></div>
      <QuizPreview quiz={quiz.quiz} view={quiz.view} />
    </section>}
  </div>;
}

function LandingCard({ type, row, base, busy, previewOpen, canPreviewQuiz, onTogglePreview, onPublish, onUnpublish }) {
  const [confirming, setConfirming] = useState(false);
  const config = TYPES[type];
  const Icon = config.icon;
  const live = Boolean(row?.published || row?.publicationId);
  // Only the classic landing keeps a published copy to compare with its draft.
  const pending = type === 'classic' && live && row.draft && JSON.stringify(row.published) !== JSON.stringify(row.draft);
  const status = live ? (pending ? 'Publicada · con cambios' : 'Publicada') : row ? 'Borrador' : 'Sin configurar';
  const url = row ? `${landingUrls(row.subdomain).path}${type === 'quiz' ? '/quiz' : ''}` : '';
  // The quiz keeps no published copy to compare, so a live quiz never asks to publish.
  const needsPublish = Boolean(row) && (!live || pending);
  const publishing = busy === `publish:${type}`;
  const unpublishing = busy === `unpublish:${type}`;

  return <section className="dashboard-card landing-card" aria-labelledby={`landing-${type}`}>
    <div className="landing-card-head">
      <span className="dashboard-icon"><Icon aria-hidden="true" /></span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5"><h2 id={`landing-${type}`} className="text-lg font-semibold">{config.title}</h2><span className={`landing-status ${live ? 'is-live' : row ? 'is-draft' : ''}`}>{status}</span></div>
        <p className="text-sm leading-6 text-muted-foreground">{config.description}</p>
      </div>
    </div>

    {row ? <>
      <ShareLink key={url} label="Link público" url={url} icon={Eye} enabled={live} />
      <div className="landing-card-meta">
        <p>{live
          ? `${row.publishedAt ? `Publicada el ${formatDate(row.publishedAt)}.` : 'Publicada.'}${pending ? ' Hay cambios en el borrador que todavía no se ven en el link.' : ''}`
          : 'El link se activa cuando publicás el borrador.'}</p>
        {live && !confirming && <button type="button" className="landing-card-unpublish" disabled={Boolean(busy)} onClick={() => setConfirming(true)}>Despublicar</button>}
      </div>
    </> : <div className="landing-card-empty">
      <p className="text-sm leading-6">Todavía no configuraste esta experiencia. Empezá a editarla para generar su borrador y su link.</p>
    </div>}

    <div className="landing-card-actions">
      <div className="flex flex-wrap gap-2">
        <Button asChild variant={needsPublish ? 'outline' : 'default'}><Link to={`${base}/${config.edit}`}><PenLine aria-hidden="true" />{row ? 'Editar' : 'Empezar a configurar'}</Link></Button>
        {row && (type === 'classic'
          ? <Button asChild variant="outline"><Link to={`${base}/vista-previa`}><Eye aria-hidden="true" />Vista previa</Link></Button>
          : <Button type="button" variant="outline" aria-expanded={previewOpen} disabled={!canPreviewQuiz} onClick={onTogglePreview}><Eye aria-hidden="true" />{previewOpen ? 'Ocultar vista previa' : 'Vista previa'}</Button>)}
      </div>
      {row && <Button type="button" variant={needsPublish ? 'default' : 'outline'} disabled={Boolean(busy)} onClick={onPublish}>
        {publishing ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Rocket aria-hidden="true" />}{publishing ? 'Publicando…' : live ? 'Publicar cambios' : 'Publicar'}
      </Button>}
    </div>

    {live && confirming && <div className="landing-card-confirm" role="alertdialog" aria-labelledby={`unpublish-${type}`}>
      <p id={`unpublish-${type}`} className="text-sm leading-6">¿Despublicar {config.title.toLowerCase()}? El link deja de funcionar para tus visitantes. El borrador se conserva y podés volver a publicarlo.</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="destructive" disabled={Boolean(busy)} onClick={async () => { await onUnpublish(); setConfirming(false); }}>{unpublishing && <LoaderCircle className="animate-spin" aria-hidden="true" />}{unpublishing ? 'Despublicando…' : 'Sí, despublicar'}</Button>
        <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => setConfirming(false)}>Cancelar</Button>
      </div>
    </div>}
  </section>;
}
