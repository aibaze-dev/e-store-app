import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, Cpu, GraduationCap, Lightbulb } from 'lucide-react';
import { postLabels, purchaseText } from '../../shared/purchase-copy.js';
import { classicTheme } from '../../shared/classic-design.js';
import { createConfetti, tint } from './confetti.js';
import './purchase-celebration.css';

// Timeline, in ms from the start. The CSS delays follow the same beats:
// 0 seal draws · 900 burst, seal lands on the book · 1000 book rises · 1450 title · 5200 exit.
const BURST_AT = 900;
const CANNONS_AT = 1250;
const DURATION = 5200;
const REDUCED_DURATION = 2200;
const EXIT = 900;
// Education, training and technology around the book.
const ORBIT = [
  { Icon: GraduationCap, className: 'is-education' },
  { Icon: Lightbulb, className: 'is-training' },
  { Icon: Cpu, className: 'is-technology' },
];

// Word by word, so a line never breaks inside a word; letters keep one running index.
function Letters({ text }) {
  let index = 0;
  return text.split(' ').map((word, wordIndex, words) => <span key={wordIndex} className="celebration-word">
    {[...word].map(letter => <span key={index} className="celebration-letter" style={{ '--i': index++ }}>{letter}</span>)}
    {wordIndex < words.length - 1 && ' '}
  </span>);
}

// The product as a 3D book: its real cover when there is one, a designed cover otherwise.
function Book({ productName, coverUrl }) {
  const [failed, setFailed] = useState(false);
  return <div className="celebration-book">
    {coverUrl && !failed
      ? <img src={coverUrl} alt="" onError={() => setFailed(true)} />
      : <span className="celebration-cover"><BookOpen /><strong>{productName}</strong><i /></span>}
    <span className="celebration-book-shine" />
  </div>;
}

// Full-screen congratulations shown once when the purchase is confirmed. It ends by itself
// or earlier with a click or a key. On exit the book flies to the element marked with
// `data-celebration-target` (the main product's card): `onExitStart` lets the page start its
// entrance underneath, and `onDone` comes once the book has landed.
export default function PurchaseCelebration({ productName = '', coverUrl = '', presentation = {}, onExitStart, onDone }) {
  const labels = postLabels(presentation);
  const theme = classicTheme(presentation.accentColor);
  const reduced = useMemo(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches), []);
  const [leaving, setLeaving] = useState(false);
  const canvas = useRef(null);
  const book = useRef(null);
  const callbacks = useRef({});
  callbacks.current = { onExitStart, onDone };
  const left = useRef(false);

  // Moves the book onto the main card. Without a visible target it just fades with the rest.
  function flyToTarget() {
    const wrap = book.current;
    const target = document.querySelector('[data-celebration-target]');
    if (!wrap || !target || !wrap.animate) return;
    const from = wrap.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    if (!to.width || to.bottom < 0 || to.top > window.innerHeight) return;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    // The hero book is measured with its own tilt; its width is the reliable size.
    const scale = to.width && from.width ? to.width / from.width : 1;
    wrap.classList.add('is-flying');
    // While it flies, the cover takes the target's pose: the hero's tilted book, or flat.
    const cover = wrap.querySelector('.celebration-book');
    const pose = target.dataset.celebrationTarget === 'book' ? 'rotateX(3deg) rotateY(-14deg)' : 'none';
    if (cover) cover.animate([{ transform: getComputedStyle(cover).transform }, { transform: pose }], { duration: 620, easing: 'ease-out', fill: 'forwards' });
    wrap.animate([{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})` }], { duration: 760, easing: 'cubic-bezier(.7, 0, .2, 1)', fill: 'forwards' });
  }

  function leave() {
    if (left.current) return;
    left.current = true;
    callbacks.current.onExitStart?.();
    if (reduced) { callbacks.current.onDone?.(); return; }
    setLeaving(true);
    flyToTarget();
    setTimeout(() => callbacks.current.onDone?.(), EXIT);
  }

  useEffect(() => {
    const colors = [theme['--sales-accent'], theme['--classic-action'], theme['--classic-cta-start'], theme['--classic-cta-end'], theme['--classic-banner-start'], tint(theme['--sales-accent'], .45), tint(theme['--sales-accent'], .75)];
    const confetti = !reduced && canvas.current ? createConfetti(canvas.current, colors) : null;
    const timers = [
      setTimeout(() => {
        confetti?.burst();
        try { navigator.vibrate?.([14, 50, 26]); } catch { /* not supported */ }
      }, BURST_AT),
      setTimeout(() => confetti?.cannons(), CANNONS_AT),
      setTimeout(leave, reduced ? REDUCED_DURATION : DURATION),
    ];
    const onKey = event => { if (['Escape', 'Enter', ' '].includes(event.key)) leave(); };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      timers.forEach(clearTimeout);
      confetti?.destroy();
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const title = labels.celebrationTitle;
  const text = productName ? purchaseText(labels, 'celebrationText', { producto: productName }) : '';
  return <div className={`purchase-celebration${leaving ? ' is-leaving' : ''}${reduced ? ' is-reduced' : ''}`}
    style={{ ...theme, '--celebration-duration': `${reduced ? REDUCED_DURATION : DURATION}ms` }} role="status" aria-live="polite" onClick={leave}>
    <div className="celebration-backdrop" aria-hidden="true"><span className="celebration-rays" /><span className="celebration-glow" /></div>
    <canvas ref={canvas} className="celebration-canvas" aria-hidden="true" />
    <div className="celebration-stage">
      <div className="celebration-emblem" aria-hidden="true">
        <div className="celebration-orbits">{ORBIT.map(({ Icon, className }) => <span key={className} className={`celebration-orbit ${className}`}><Icon /></span>)}</div>
        <div ref={book} className="celebration-book-wrap">
          <span className="celebration-book-shadow" />
          <Book productName={productName} coverUrl={coverUrl} />
          <span className="celebration-seal">
            <svg viewBox="0 0 56 56"><circle className="celebration-seal-ring" cx="28" cy="28" r="25" /><path className="celebration-seal-check" d="M17 29.5l7.5 7.5L40 21" /></svg>
          </span>
        </div>
      </div>
      <div className="celebration-copy">
        {labels.paidEyebrow && <span className="celebration-chip"><Check aria-hidden="true" />{labels.paidEyebrow}</span>}
        <h2 className="celebration-title" aria-label={title}><span aria-hidden="true"><Letters text={title} /></span></h2>
        <svg className="celebration-swoosh" viewBox="0 0 320 18" preserveAspectRatio="none" aria-hidden="true"><path d="M6 12C70 4 150 2 314 9" /></svg>
        {text && <p className="celebration-text">{text}</p>}
      </div>
    </div>
    <div className="celebration-progress" aria-hidden="true"><span /></div>
  </div>;
}
