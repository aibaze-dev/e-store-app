import { useState } from 'react';
import { CheckCircle2, KeyRound, LoaderCircle } from 'lucide-react';
import { authClient } from '@/lib/auth-client.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ErrorAlert, Field } from '@/components/Field.jsx';
import { useInternalThemeClass } from '@/components/InternalTheme.jsx';

const MIN_LENGTH = 12;

// Sign-up is closed, so this is the only way to rotate the admin password from the app.
// Better Auth checks the current password and, with revokeOtherSessions, signs out every other device.
export default function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const themeClass = useInternalThemeClass();

  function change(value) {
    setOpen(value);
    if (!value) { setError(''); setDone(false); }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const currentPassword = fields.get('currentPassword');
    const newPassword = fields.get('newPassword');
    if (newPassword !== fields.get('confirmPassword')) return setError('Las contraseñas nuevas no coinciden.');
    if (newPassword === currentPassword) return setError('La contraseña nueva tiene que ser distinta de la actual.');
    setBusy(true); setError('');
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (result.error) setError(result.error.code === 'INVALID_PASSWORD' ? 'La contraseña actual no es correcta.' : 'No se pudo cambiar la contraseña. Volvé a intentar.');
      else setDone(true);
    } catch { setError('No se pudo conectar. Volvé a intentar.'); }
    finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={change}>
    <Button variant="ghost" size="icon" className="ml-auto shrink-0 text-muted-foreground" aria-label="Cambiar contraseña" title="Cambiar contraseña" onClick={() => change(true)}>
      <KeyRound aria-hidden="true" />
    </Button>
    <DialogContent className={themeClass}>
      <div className="space-y-2 pr-8">
        <DialogTitle>Cambiar contraseña</DialogTitle>
        <DialogDescription className="text-sm leading-6">Al guardar se cierran las sesiones abiertas en otros dispositivos.</DialogDescription>
      </div>
      {done ? <div className="space-y-5" role="status">
        <p className="flex items-start gap-3 text-sm leading-6"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />Listo. Tu contraseña nueva ya está activa.</p>
        <DialogClose asChild><Button className="w-full">Cerrar</Button></DialogClose>
      </div> : <form onSubmit={submit} className="space-y-5" aria-busy={busy}>
        <Field label="Contraseña actual">{props => <Input {...props} name="currentPassword" type="password" autoComplete="current-password" required maxLength={128} disabled={busy} />}</Field>
        <Field label="Contraseña nueva" hint={`Al menos ${MIN_LENGTH} caracteres. Una frase larga o una generada por tu gestor de contraseñas es ideal.`}>
          {props => <Input {...props} name="newPassword" type="password" autoComplete="new-password" required minLength={MIN_LENGTH} maxLength={128} disabled={busy} />}
        </Field>
        <Field label="Repetí la contraseña nueva">{props => <Input {...props} name="confirmPassword" type="password" autoComplete="new-password" required minLength={MIN_LENGTH} maxLength={128} disabled={busy} />}</Field>
        <ErrorAlert>{error}</ErrorAlert>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <><LoaderCircle className="animate-spin" aria-hidden="true" />Guardando…</> : 'Guardar contraseña'}
        </Button>
      </form>}
    </DialogContent>
  </Dialog>;
}
