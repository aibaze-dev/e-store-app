import { useId } from 'react';
import { CircleAlert } from 'lucide-react';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';

// Label, control and help text wired together. `children` receives the ids to attach.
export function Field({ label, hint, className = '', children }) {
  const id = useId();
  return <div className={`space-y-2.5 ${className}`}>
    <Label htmlFor={id}>{label}</Label>
    {children({ id, 'aria-describedby': hint ? `${id}-hint` : undefined })}
    {hint && <p id={`${id}-hint`} className="text-xs leading-5 text-muted-foreground">{hint}</p>}
  </div>;
}

export function ErrorAlert({ children }) {
  if (!children) return null;
  return <Alert variant="destructive"><CircleAlert aria-hidden="true" /><AlertDescription>{children}</AlertDescription></Alert>;
}

export function PageSkeleton({ label = 'Cargando' }) {
  return <div className="space-y-4" role="status" aria-label={label}>
    <Skeleton className="h-9 w-64 max-w-full" /><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" />
    <span className="sr-only">{label}…</span>
  </div>;
}

export function EmptyState({ title, children }) {
  return <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
    <h2 className="text-lg font-semibold">{title}</h2>
    <div className="mx-auto mt-2 max-w-md space-y-5 text-sm leading-6 text-muted-foreground">{children}</div>
  </div>;
}
