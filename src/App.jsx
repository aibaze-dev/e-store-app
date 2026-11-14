import { ArrowUpRight, Layers3, Orbit, Sparkles } from 'lucide-react';
import AuthPanel from './components/AuthPanel.jsx';
import brand from './config/brandData.json';

export default function App() {
  return <main className="auth-layout">
    <aside className="auth-story" aria-label="Bienvenida">
      <div className="auth-brand">
        {brand.logoUrl ? <img src={brand.logoUrl} alt={brand.name} style={{ width: 64, height: 48, objectFit: 'contain' }} /> : <span className="auth-brand-mark" aria-hidden="true"><Layers3 size={22} strokeWidth={1.7} /></span>}
        <span>{brand.shortName}<span className="auth-brand-dot">.</span></span>
      </div>

      <div className="auth-story-content">
        <p className="auth-eyebrow"><span /> UN NUEVO PUNTO DE PARTIDA</p>
        <h2>Grandes ideas.<br />Un espacio para<br /><span>hacerlas realidad.</span></h2>
        <p className="auth-story-description">Tu próximo capítulo empieza acá.<br />Entrá y seguí construyendo lo que viene.</p>

        <div className="auth-illustration" aria-hidden="true">
          <div className="auth-orbit auth-orbit-outer" />
          <div className="auth-orbit auth-orbit-inner" />
          <div className="auth-orbit-axis" />
          <div className="auth-orbit-center"><Layers3 size={42} strokeWidth={1.25} /></div>
          <span className="auth-orbit-node auth-orbit-node-one"><Sparkles size={21} strokeWidth={1.5} /></span>
          <span className="auth-orbit-node auth-orbit-node-two"><Orbit size={23} strokeWidth={1.5} /></span>
          <span className="auth-orbit-point" />
          <span className="auth-illustration-caption">DE LA IDEA A LA ACCIÓN <ArrowUpRight size={13} /></span>
        </div>
      </div>

      <div className="auth-story-footer"><span>Hecho para lo que viene.</span><span>Una idea a la vez.</span></div>
    </aside>

    <section className="auth-content" aria-label="Acceso a tu cuenta">
      <div className="auth-content-top"><span>TU ESPACIO DE TRABAJO</span><span className="auth-content-rule" /></div>
      <div className="auth-form-container"><AuthPanel headingAs="h1" /></div>
      <p className="auth-content-footer">El siguiente paso empieza con vos.</p>
    </section>
  </main>;
}
