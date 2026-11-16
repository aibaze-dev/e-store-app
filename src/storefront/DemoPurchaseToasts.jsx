import { ACTIVITY_COPY, formatLandingText } from '../../shared/landing-copy.js';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import '@fontsource-variable/inter';
import './purchase-notice.css';

// Presentation only: these examples never create orders, payments or analytics events.
const NAMES = ['Lucía', 'Mateo', 'Sofía', 'Diego', 'Valentina', 'Nicolás', 'Camila', 'Gabriel', 'Martina', 'Daniel', 'Carolina', 'Andrés'];
const PLACES = ['Córdoba, Argentina', 'Rosario, Argentina', 'Montevideo, Uruguay', 'Santiago, Chile', 'Lima, Perú', 'Bogotá, Colombia', 'Medellín, Colombia', 'Guadalajara, México', 'Ciudad de México, México', 'Madrid, España', 'Valencia, España', 'Quito, Ecuador'];
const randomBetween = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pickAnother = (values, previous) => {
  const choices = values.filter(value => value !== previous);
  return choices[randomBetween(0, choices.length - 1)];
};

// One purchase notice for the landing and the checkout. `placement` only moves it:
// 'top' sits under the offer bar, 'bottom' in the lower corner. The name is the only bold part.
export default function DemoPurchaseToasts({ copy = ACTIVITY_COPY, placement = 'top' }) {
  const [purchase, setPurchase] = useState(null);
  useEffect(() => {
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
  }, []);

  const [before, after = ''] = (copy.purchaseText ?? ACTIVITY_COPY.purchaseText).split('{nombre}');
  return <div className={`purchase-notice-region ${placement === 'bottom' ? 'is-bottom' : ''}`} role="status" aria-live="polite" aria-atomic="true">
    {purchase && <div className="purchase-notice">
      <p>{before}<strong>{purchase.name}</strong>{after} {formatLandingText(copy.purchaseLocationText ?? ACTIVITY_COPY.purchaseLocationText, { ciudad: purchase.place })}</p>
      <small>hace {purchase.minutes} min · <span aria-hidden="true">★★★★★</span> · Aviso de ejemplo</small>
      <button type="button" aria-label="Cerrar aviso de compra" onClick={() => setPurchase(null)}><X aria-hidden="true" /></button>
    </div>}
  </div>;
}
