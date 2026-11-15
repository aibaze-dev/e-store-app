import { useId, useState } from 'react';
import { Check, ExternalLink, LoaderCircle, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorAlert } from '@/components/Field.jsx';
import { storefrontMoney as money } from '@/lib/storefront-money.js';
import { FEATURE_ICONS } from './ClassicLanding.jsx';
import { POST_PURCHASE_CONTENT, postPurchaseContent, videoSource } from '../../shared/post-purchase.js';

function Video({ video }) {
  const [failed, setFailed] = useState(false);
  const source = videoSource(video.url);
  if (!video.enabled || !source) return null;
  return <section className="space-y-3" aria-label={video.title || 'Video de la oferta'}>
    {video.title && <h3 className="text-lg font-semibold">{video.title}</h3>}
    {source.kind === 'embed'
      ? <iframe className="aspect-video w-full rounded-xl border-0 bg-black" src={source.src} title={video.title || 'Video de la oferta'} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      : failed ? <p role="status" className="text-sm text-muted-foreground">No se pudo cargar el video. Podés abrirlo en otra pestaña o continuar con la oferta.</p>
        : <video className="aspect-video w-full rounded-xl bg-black" src={source.src} controls playsInline preload="metadata" onError={() => setFailed(true)}>Tu navegador no puede reproducir este video.</video>}
    <a className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4" href={video.url} target="_blank" rel="noreferrer">Abrir video en otra pestaña<ExternalLink className="size-4" aria-hidden="true" /></a>
  </section>;
}

// The preview and the real paid flow use the same presentation; checkout stays in Storefront.
export default function PostPurchaseContent({ offer, currency, downsell = false, busy = false, error = '', onAccept, onDecline, canPurchase = false }) {
  const titleId = useId();
  const { postPurchase: copy, postPurchaseBenefits: benefits, postPurchaseVideo: video } = postPurchaseContent(offer.content);
  const defaults = POST_PURCHASE_CONTENT.postPurchase;
  const title = downsell ? copy.downsellTitle || copy.title || offer.name : copy.title || offer.name;
  const description = copy.description || offer.description;
  return <article className="post-purchase-content space-y-6 rounded-2xl border bg-card p-5 text-card-foreground sm:p-8" aria-labelledby={titleId}>
    <header className="space-y-3">
      {copy.eyebrow && <p className="text-xs font-semibold tracking-widest text-primary uppercase">{copy.eyebrow}</p>}
      <h2 id={titleId} className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {copy.subtitle && <p className="leading-7 text-muted-foreground">{copy.subtitle}</p>}
    </header>
    {video.enabled && videoSource(video.url) ? <Video key={video.url} video={video} /> : offer.coverUrl && <img className="mx-auto max-h-72 max-w-full rounded-xl object-contain" src={offer.coverUrl} alt={`Portada de ${offer.name}`} />}
    {description && <p className="leading-7 whitespace-pre-line text-muted-foreground">{description}</p>}
    {benefits.enabled && benefits.items.length > 0 && <section className="space-y-4" aria-label={benefits.title || 'Beneficios de la oferta'}>
      {benefits.title && <h3 className="text-xl font-semibold">{benefits.title}</h3>}
      {benefits.subtitle && <p className="text-sm leading-6 text-muted-foreground">{benefits.subtitle}</p>}
      <ul className="grid gap-4 sm:grid-cols-2">{benefits.items.map((item, index) => { const Icon = FEATURE_ICONS[item.icon] || Check; return <li className="flex gap-3 rounded-xl border p-4" key={index}>
        <Icon className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0"><h4 className="font-semibold">{item.title}</h4>{item.description && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>}</div>
      </li>; })}</ul>
    </section>}
    <section className="space-y-4 border-t pt-6" aria-label="Aceptar o rechazar la oferta">
      <p className="font-medium">{offer.name}</p>
      <p className="flex flex-wrap items-baseline gap-3">
        {downsell && <del className="text-muted-foreground">{money(offer.price, currency)}</del>}
        <strong className="text-3xl text-primary">{money(downsell ? offer.downsellPrice : offer.price, currency)}</strong>
        {downsell && <span className="text-sm font-semibold text-primary">Ahorrás {offer.downsellPercent}%</span>}
      </p>
      {downsell && copy.downsellText && <p className="leading-7 whitespace-pre-line">{copy.downsellText}</p>}
      <p className="text-sm leading-6 text-muted-foreground">Se paga aparte, con un segundo checkout. Tu compra anterior no cambia.</p>
      <ErrorAlert>{error}</ErrorAlert>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" className="h-auto min-h-12 max-w-full whitespace-normal" onClick={onAccept} disabled={busy || !canPurchase}>{busy && <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />}{busy ? 'Preparando el pago…' : downsell ? copy.downsellCtaText || defaults.downsellCtaText : copy.ctaText || defaults.ctaText}</Button>
        <Button size="lg" className="h-auto min-h-12 max-w-full whitespace-normal" variant="outline" onClick={onDecline} disabled={busy || !onDecline}>{copy.declineText || defaults.declineText}</Button>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-4" aria-hidden="true" />Pago seguro</p>
    </section>
  </article>;
}

export function PostPurchasePreview({ view, downsell = false }) {
  return <main className="min-h-screen bg-background px-5 py-8 text-foreground"><div className="mx-auto max-w-2xl space-y-6">
    <h1 className="text-2xl font-semibold">¡Gracias por tu compra!</h1>
    {view.postPurchaseOffer
      ? <PostPurchaseContent offer={{ ...view.postPurchaseOffer, content: view.content }} currency={view.store.currency} downsell={downsell && Boolean(view.postPurchaseOffer.downsellPrice)} />
      : <p className="rounded-xl border bg-card p-5 text-sm leading-6">Activá la oferta post-compra y elegí un producto en «Oferta post-compra» para ver esta página.</p>}
  </div></main>;
}
