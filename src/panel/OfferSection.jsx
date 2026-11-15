import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

export default function OfferSection({ id, title, summary, icon: Icon, defaultOpen = false, children }) {
  const { hash } = useLocation();
  const ref = useRef(null);

  useEffect(() => {
    if (hash !== `#${id}`) return;
    ref.current.open = true;
    ref.current.scrollIntoView({ block: 'start' });
  }, [hash, id]);

  return <details ref={ref} id={id} className="offer-form-section rounded-xl border bg-card text-card-foreground shadow-sm" open={defaultOpen || undefined}>
    <summary className="flex cursor-pointer items-center gap-3 rounded-xl p-5 sm:p-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><Icon className="size-5" aria-hidden="true" /></span>
      <span className="min-w-0 flex-1"><h2 className="text-base font-semibold">{title}</h2><span className="mt-1 block break-words text-sm text-muted-foreground">{summary}</span></span>
      <ChevronDown className="offer-section-chevron size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </summary>
    <div className="border-t py-6">{children}</div>
  </details>;
}
