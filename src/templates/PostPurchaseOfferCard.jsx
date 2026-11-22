import { postLabels, postOptions, purchaseText } from '../../shared/purchase-copy.js';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { checkoutTimeLeft } from '@/storefront/checkoutSignals.js';
import { ArrowRight, Check, LoaderCircle, LockKeyhole, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorAlert } from '@/components/Field.jsx';
import { storefrontMoney as money } from '@/lib/storefront-money.js';
import { POST_PURCHASE_CONTENT, postPurchaseContent, videoSource } from '../../shared/post-purchase.js';
import { usePreviewSection } from './PreviewEditing.jsx';
import { Video, postPurchaseStage } from './PostPurchaseContent.jsx';

const PlainTitle = props => <h2 data-slot="dialog-title" className="text-2xl font-semibold tracking-tight" {...props} />;
function OfferTimer({ deadline }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let tick;
    function update() {
      const time = Date.now();
      setNow(time);
      if (time >= deadline) clearInterval(tick);
    }
    tick = setInterval(update, 1000);
    update();
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', update); };
  }, [deadline]);
  return <div className="post-offer-timer" data-running={now < deadline} role="timer" aria-label="Offer countdown" aria-live="off">
    {checkoutTimeLeft(deadline, now)}
  </div>;
}
const PlainDescription = ({ className = '', ...props }) => <p data-slot="dialog-description" className={`leading-7 text-muted-foreground ${className}`} {...props} />;

// Content of the post-purchase modal: the thank-you page shows it inside a dialog and the
// panel preview inside a mock of that dialog. `payment` replaces the buttons once accepted.
export default function PostPurchaseOfferCard({ offer, currency, stage, deadline, preview = false, previewState = 'offer', busy = false, error = '', canPurchase = false, onAccept, onDecline, payment = null, Title = PlainTitle, Description = PlainDescription }) {
  const edit = usePreviewSection();
  const titleRef = useRef(null);
  const previousStage = useRef(stage);
  useLayoutEffect(() => {
    if (previousStage.current === stage) return;
    previousStage.current = stage;
    const heading = titleRef.current;
    const dialog = heading?.closest('[role="dialog"]');
    if (!dialog) return;
    heading.focus({ preventScroll: true });
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    dialog.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
  }, [stage]);
  const { postPurchase: copy, postPurchaseVideo: video, postPurchaseBenefits: benefits } = postPurchaseContent(offer.content);
  const labels = postLabels(offer.content);
  const options = postOptions(offer.content);
  const defaults = POST_PURCHASE_CONTENT.postPurchase;
  const { price, percent } = postPurchaseStage(offer, stage);
  const discounted = stage !== 'offer';
  const final = stage === 'final';
  const title = final ? copy.finalTitle || defaults.finalTitle : discounted ? copy.downsellTitle || copy.title || offer.name : copy.title || offer.name;
  const subtitle = final ? copy.finalText : discounted ? copy.downsellText : copy.subtitle || copy.description || offer.description;
  const ctaText = final ? copy.finalCtaText || defaults.finalCtaText : discounted ? copy.downsellCtaText || defaults.downsellCtaText : copy.ctaText || defaults.ctaText;
  const hasVideo = video.enabled && Boolean(videoSource(video.url));
  const showBenefits = !payment && benefits.enabled && benefits.items.length > 0;
  const timer = deadline && <OfferTimer deadline={deadline} />;

  return <>
    <div {...edit(final ? 'postPurchaseFinal' : discounted ? 'postPurchaseDownsell' : 'postPurchase')} className="space-y-2 pr-8">
      {copy.eyebrow && !discounted && <p className="text-xs font-bold tracking-widest text-primary uppercase">{copy.eyebrow}</p>}
      {discounted && options.showDiscount && <p className="text-xs font-bold tracking-widest text-primary uppercase">{purchaseText(labels, 'discount', { porcentaje: percent })}</p>}
      <Title ref={titleRef} tabIndex={-1}>{title}</Title>
      {subtitle ? <Description>{subtitle}</Description> : <Description className="sr-only">{labels.offerDescription}</Description>}
    </div>
    {preview && previewState === 'videoError' && !hasVideo && <p className="text-sm text-muted-foreground">Activá un video en Post-compra para revisar su mensaje de error.</p>}
    {!payment && (hasVideo
      ? <Video key={video.url} video={video} autoPlay labels={labels} preview={preview} forceError={previewState === 'videoError'}>{timer}</Video>
      : timer)}
    <div className="flex gap-4">
      {options.showCover && offer.coverUrl && <img src={offer.coverUrl} alt="" className="h-24 w-18 shrink-0 rounded-lg object-cover" />}
      <div className="min-w-0 space-y-1">
        <p className="leading-snug font-semibold">{offer.name}</p>
        <p className="flex flex-wrap items-baseline gap-x-2">
          {discounted && <del className="text-sm text-muted-foreground">{money(offer.price, currency)}</del>}
          <strong className="text-2xl">{money(price, currency)}</strong>
        </p>
      </div>
    </div>
    {showBenefits && <ul {...edit('postPurchaseBenefits')} className="grid gap-2 text-sm" aria-label={benefits.title || labels.benefitsTitle}>
      {benefits.items.map((item, index) => <li key={index} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /><span><strong className="font-semibold">{item.title}</strong>{item.description && <span className="text-muted-foreground"> — {item.description}</span>}</span></li>)}
    </ul>}
    {payment || <div className="grid gap-2">
      <ErrorAlert>{error}</ErrorAlert>
      <Button type="button" size="lg" className="h-auto min-h-12 w-full py-3 text-base whitespace-normal" onClick={onAccept} disabled={busy || !canPurchase}>
        {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {busy ? labels.preparing : ctaText}
        {!busy && <ArrowRight aria-hidden="true" />}
      </Button>
      <Button type="button" variant="ghost" className="h-auto min-h-11 w-full whitespace-normal" onClick={onDecline} disabled={busy || !onDecline}>{copy.declineText || defaults.declineText}</Button>
      {options.showTrust && <p className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Zap className="size-3.5" aria-hidden="true" />{labels.access}</span><span className="inline-flex items-center gap-1"><LockKeyhole className="size-3.5" aria-hidden="true" />{labels.secure}</span></p>}
      {options.showPaymentNote && <p className="text-center text-xs text-muted-foreground">{labels.paymentNote}</p>}
    </div>}
  </>;
}
