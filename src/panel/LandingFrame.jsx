import { useState } from 'react';
import { createPortal } from 'react-dom';
import ClassicLanding from '@/templates/ClassicLanding.jsx';
import { PostPurchasePreview } from '@/templates/PostPurchaseContent.jsx';

// A separate viewport makes the preview use the exact public mobile/desktop styles.
const DOCUMENT = '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="preview-root"></div></body></html>';
export default function LandingFrame({ view, mode, target = 'landing' }) {
  const [root, setRoot] = useState(null);
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
  return <div className={`landing-preview-viewport ${mode === 'mobile' ? 'is-mobile' : ''}`}>
    <iframe title="Vista previa de tu landing" srcDoc={DOCUMENT} onLoad={ready} />
    {root && createPortal(target === 'landing' ? <ClassicLanding view={view} /> : <PostPurchasePreview view={view} downsell={target === 'post-downsell'} />, root)}
  </div>;
}
