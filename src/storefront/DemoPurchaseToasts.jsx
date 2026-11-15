import { ACTIVITY_COPY, formatLandingText } from '../../shared/landing-copy.js';
import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';

// Presentation only: these examples never create orders, payments or analytics events.
const NAMES = ['Lucía', 'Mateo', 'Sofía', 'Diego', 'Valentina', 'Nicolás', 'Camila', 'Gabriel', 'Martina', 'Daniel', 'Carolina', 'Andrés'];
const PLACES = ['Córdoba, Argentina', 'Rosario, Argentina', 'Montevideo, Uruguay', 'Santiago, Chile', 'Lima, Perú', 'Bogotá, Colombia', 'Medellín, Colombia', 'Guadalajara, México', 'Ciudad de México, México', 'Madrid, España', 'Valencia, España', 'Quito, Ecuador'];
const randomBetween = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pickAnother = (values, previous) => {
  const choices = values.filter(value => value !== previous);
  return choices[randomBetween(0, choices.length - 1)];
};

export default function DemoPurchaseToasts({ style, copy = ACTIVITY_COPY }) {
  const [purchase, setPurchase] = useState(null);
  useEffect(() => {
    let timer;
    let previous;
    const schedule = (first = false) => {
      if (document.hidden) return;
      timer = setTimeout(() => {
        if (document.hidden) return;
        previous = { name: pickAnother(NAMES, previous?.name), place: pickAnother(PLACES, previous?.place) };
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

  return <div className="sales-toast-region" style={style} role="status" aria-live="polite" aria-atomic="true">
    {purchase && <div className="sales-toast">
      <span className="sales-toast-icon"><ShoppingBag aria-hidden="true" /></span>
      <p><span className="sales-toast-demo">{formatLandingText(copy.purchaseText ?? ACTIVITY_COPY.purchaseText, { nombre: purchase.name })}</span><strong>{formatLandingText(copy.purchaseLocationText ?? ACTIVITY_COPY.purchaseLocationText, { ciudad: purchase.place })}</strong></p>
    </div>}
  </div>;
}
