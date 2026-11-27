import { NOTICE_REGIONS, PURCHASE_NOTICE_COPY, formatLandingText, localizedDefault, noticeRegion } from '../../shared/landing-copy.js';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import '@fontsource-variable/inter';
import './purchase-notice.css';

// Presentation only: these examples never create orders, payments or analytics events.
const randomBetween = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pickAnother = (values, previous) => {
  const choices = values.filter(value => value !== previous);
  return choices[randomBetween(0, choices.length - 1)];
};

// One purchase notice for the landing and the checkout. `placement` only moves it:
// 'top' sits under the offer bar, 'bottom' in the lower corner. The name is the only bold part.
// `region` picks the names and cities (NOTICE_REGIONS); `language` is the store's, for the
// texts that are still the English default.
export default function DemoPurchaseToasts({ copy = PURCHASE_NOTICE_COPY, placement = 'top', checkoutCopy, preview = false, region, language }) {
  const { names: NAMES, places: PLACES } = NOTICE_REGIONS[noticeRegion(region)];
  const [purchase, setPurchase] = useState(null);
  useEffect(() => {
    if (preview) { setPurchase({ name: NAMES[0], place: PLACES[0], minutes: 5 }); return; }
    setPurchase(null);
    let timer;
    let previous;
    const schedule = (first = false) => {
      if (document.hidden) return;
      timer = setTimeout(() => {
        if (document.hidden) return;
        previous = { name: pickAnother(NAMES, previous?.name), place: pickAnother(PLACES, previous?.place), minutes: randomBetween(2, 14) };
        setPurchase(previous);
        timer = setTimeout(() => { setPurchase(null); schedule(); }, 6000);
      }, first ? randomBetween(5000, 12000) : randomBetween(12000, 30000));
    };
    const onVisibility = () => {
      clearTimeout(timer);
      setPurchase(null);
      if (!document.hidden) schedule(true);
    };
    schedule(true);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [preview, NAMES, PLACES]);

  const text = key => localizedDefault(checkoutCopy?.[key] ?? copy[key] ?? PURCHASE_NOTICE_COPY[key], language);
  const [before, after = ''] = text('purchaseText').split('{nombre}');
  return <div className={`purchase-toast-region ${placement === 'bottom' ? 'is-bottom' : ''}`} role="status" aria-live="polite" aria-atomic="true">
    {purchase && <div className="purchase-toast">
      <p>{before}<strong>{purchase.name}</strong>{after} {formatLandingText(text('purchaseLocationText'), { ciudad: purchase.place })}</p>
      <small>{formatLandingText(text('noticeAge'), { minutos: purchase.minutes })} · <span aria-hidden="true">★★★★★</span> · {text('noticeExample')}</small>
      <button type="button" aria-label={text('noticeClose')} onClick={() => setPurchase(null)}><X aria-hidden="true" /></button>
    </div>}
  </div>;
}
