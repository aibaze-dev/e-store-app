import { PreviewEditing } from '@/templates/PreviewEditing.jsx';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ClassicLanding from '@/templates/ClassicLanding.jsx';
import { PostPurchasePreview } from '@/templates/PostPurchaseContent.jsx';

// A separate viewport makes the preview use the exact public mobile/desktop styles.
const DOCUMENT = '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="preview-root"></div></body></html>';
export default function LandingFrame({ view, mode, target = 'landing', onSelectSection }) {
  const [root, setRoot] = useState(null);
  const viewportRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);
  const frameWidth = mode === 'mobile' ? 390 : 1040;
  const scale = size.width ? Math.min(1, size.width / frameWidth) : 1;
  function ready(event) {
    const doc = event.currentTarget.contentDocument;
    doc.head.querySelectorAll('[data-preview-style]').forEach(node => node.remove());
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(node => {
      const copy = node.cloneNode(true);
      copy.setAttribute('data-preview-style', '');
      doc.head.append(copy);
    });
    setRoot(doc.getElementById('preview-root'));
  }
  return <div ref={viewportRef} className={`landing-preview-viewport ${mode === 'mobile' ? 'is-mobile' : ''}`}>
    <div className="landing-preview-canvas" style={{ width: frameWidth * scale }}>
      <iframe title="Vista previa de tu landing" srcDoc={DOCUMENT} onLoad={ready} style={{ width: frameWidth, height: size.height ? size.height / scale : '100%', transform: `scale(${scale})`, transformOrigin: 'top left' }} />
    </div>
    {root && createPortal(<PreviewEditing onSelectSection={onSelectSection}>{target === 'landing' ? <ClassicLanding view={view} /> : <PostPurchasePreview view={view} downsell={target === 'post-downsell'} />}</PreviewEditing>, root)}
  </div>;
}
