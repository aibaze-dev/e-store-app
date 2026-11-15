import { useState } from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';

function TestimonialStars() {
  return <span className="sales-testimonial-stars" role="img" aria-label="5 de 5 estrellas">★★★★★</span>;
}

export function Rating({ value, customers }) {
  if (!value) return null;
  return <div className="sales-rating" aria-label={`Calificación: ${value} de 5${customers ? `, ${customers} clientes` : ''}`}>
    <span className="sales-stars" aria-hidden="true"><span>★★★★★</span><span style={{ width: `${value * 20}%` }}>★★★★★</span></span>
    <strong>{value.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</strong>{customers > 0 && <span>({customers.toLocaleString('es-AR')} clientes)</span>}
  </div>;
}

function TestimonialCard({ item }) {
  return item.format === 'chat' ? <figure className="sales-chat" aria-label={`Conversación con ${item.name}`}>
            <figcaption className="sales-chat-header"><span className="sales-chat-avatar" aria-hidden="true">{item.name.trim().slice(0, 1).toUpperCase()}</span><span><strong>{item.name}</strong><TestimonialStars /></span></figcaption>
            <div className="sales-chat-messages">
              {item.openingMessage && <p className="sales-chat-sent">{item.openingMessage}</p>}
              <blockquote className="sales-chat-received">{item.quote}</blockquote>
              {item.closingMessage && <p className="sales-chat-sent">{item.closingMessage}</p>}
            </div>
          </figure> : <figure className={item.imageUrl ? 'sales-testimonial-image' : 'sales-testimonial'}>
            {item.imageUrl ? <a href={item.imageUrl} target="_blank" rel="noreferrer"><img src={item.imageUrl} alt={`Testimonio de ${item.name}`} loading="lazy" /></a> : <Quote aria-hidden="true" />}
            {item.quote && <blockquote>{item.quote}</blockquote>}<figcaption>{item.name}<TestimonialStars /></figcaption>
          </figure>;
}

export default function Testimonials({ section, layout = 'carousel' }) {
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(0, section.items.length - 1));
  const item = section.items[current];
  const move = delta => setIndex((current + delta + section.items.length) % section.items.length);
  return <>
    {layout === 'grid' && <div className="classic-testimonial-grid sales-testimonials">{section.items.map((entry, i) => <TestimonialCard key={i} item={entry} />)}</div>}
    {layout !== 'grid' && item && <div className="sales-carousel" role="region" aria-roledescription="carrusel" aria-label="Testimonios" tabIndex={0} onKeyDown={event => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
    }}>
      <div aria-live="polite" aria-atomic="true">
        <div className="sales-testimonials">
          <TestimonialCard item={item} />
        </div>
      </div>
      {section.items.length > 1 && <div className="sales-carousel-controls">
        <button type="button" onClick={() => move(-1)} aria-label="Testimonio anterior"><ChevronLeft aria-hidden="true" /></button>
        {section.items.map((_, i) => <button key={i} type="button" aria-label={`Ver testimonio ${i + 1}`} aria-pressed={current === i} onClick={() => setIndex(i)}><span /></button>)}
        <button type="button" onClick={() => move(1)} aria-label="Testimonio siguiente"><ChevronRight aria-hidden="true" /></button>
      </div>}
    </div>}
    <div className="sales-metrics">
      {section.customers > 0 && <p><strong>{section.customers.toLocaleString('es-AR')}+</strong><span>Clientes</span></p>}
      {section.rating > 0 && <p><strong>{section.rating.toLocaleString('es-AR', { maximumFractionDigits: 1 })}</strong><span>Calificación</span></p>}
      {section.satisfaction > 0 && <p><strong>{section.satisfaction}%</strong><span>Satisfacción</span></p>}
    </div>
  </>;
}
