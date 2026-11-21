import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, Cpu, GraduationCap, Lightbulb } from 'lucide-react';
import { postLabels, purchaseText } from '../../shared/purchase-copy.js';
import { classicTheme } from '../../shared/classic-design.js';
import './purchase-celebration.css';

const DURATION = 4200;
const REDUCED_DURATION = 2200;
const EXIT = 520;
const COLORS = ['var(--sales-accent)', '#ffc83d', '#ff6b9a', '#34d1bf', '#8b5cf6', '#ffffff', '#4f9dff'];
// Education, training and technology around the book.
const ORBIT = [
  { Icon: GraduationCap, className: 'is-education' },
  { Icon: Lightbulb, className: 'is-training' },
  { Icon: Cpu, className: 'is-technology' },
];

// Deterministic pseudo-random numbers, so the burst is the same on every render.
function seeded(seed) {
  let value = seed;
  return () => { value = (value * 16807) % 2147483647; return (value - 1) / 2147483646; };
}

function confettiPieces(count) {
  const random = seeded(7);
  return Array.from({ length: count }, (_, index) => {
    const angle = random() * Math.PI * 2;
    const distance = 22 + random() * 38;
    return {
      key: index,
      shape: ['square', 'strip', 'circle'][index % 3],
      style: {
        '--tx': `${Math.cos(angle) * distance}vmax`,
        '--ty': `${Math.sin(angle) * distance * 0.7 - 12}vmax`,
        '--fall': `${40 + random() * 50}vh`,
        '--spin': `${(random() > .5 ? 1 : -1) * (360 + random() * 720)}deg`,
        '--delay': `${random() * 380}ms`,
        '--size': `${7 + random() * 9}px`,
        '--color': COLORS[index % COLORS.length],
      },
    };
  });
}

// Full-screen congratulations shown once when the purchase is confirmed. It ends by
// itself, or earlier with a click or Escape, and then `onDone` reveals the thank-you page.
export default function PurchaseCelebration({ productName = '', presentation = {}, onDone }) {
  const labels = postLabels(presentation);
  const reduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, []);
  const pieces = useMemo(() => (reduced ? [] : confettiPieces(90)), [reduced]);
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  const leavingRef = useRef(false);

  function leave() {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    setTimeout(() => done.current?.(), reduced ? 0 : EXIT);
  }

  useEffect(() => {
    const timer = setTimeout(leave, reduced ? REDUCED_DURATION : DURATION);
    const onKey = event => { if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') leave(); };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(timer); window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const text = productName ? purchaseText(labels, 'celebrationText', { producto: productName }) : '';
  return <div className={`purchase-celebration${leaving ? ' is-leaving' : ''}${reduced ? ' is-reduced' : ''}`} style={{ ...classicTheme(presentation.accentColor), '--celebration-duration': `${reduced ? REDUCED_DURATION : DURATION}ms` }}
    role="status" aria-live="polite" onClick={leave}>
    <div className="celebration-glow" aria-hidden="true" />
    <div className="celebration-rays" aria-hidden="true" />
    <div className="celebration-confetti" aria-hidden="true">
      {pieces.map(piece => <i key={piece.key} className={`is-${piece.shape}`} style={piece.style} />)}
    </div>
    <div className="celebration-stage">
      <div className="celebration-emblem" aria-hidden="true">
        <span className="celebration-ring" />
        <span className="celebration-ring is-late" />
        {ORBIT.map(({ Icon, className }) => <span key={className} className={`celebration-orbit ${className}`}><Icon /></span>)}
        <span className="celebration-book"><BookOpen /><span className="celebration-check"><Check /></span></span>
      </div>
      <h2 className="celebration-title">{labels.celebrationTitle}</h2>
      {text && <p className="celebration-text">{text}</p>}
    </div>
    <div className="celebration-progress" aria-hidden="true"><span /></div>
  </div>;
}
