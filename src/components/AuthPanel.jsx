import { useEffect, useId, useRef, useState } from 'react';
import { useConvexAuth, useQuery } from 'convex/react';
import { makeFunctionReference } from 'convex/server';
import { ArrowRight, Check, CircleAlert, Eye, EyeOff, LoaderCircle, LockKeyhole, LogOut, Mail, UserRound } from 'lucide-react';
import { authClient } from '../lib/auth-client.js';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Skeleton } from './ui/skeleton';

const currentUser = makeFunctionReference('auth:getCurrentUser');

export default function AuthPanel({ headingAs = 'h2' }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(currentUser, isAuthenticated ? {} : 'skip');
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const pending = useRef(false);
  const errorRef = useRef(null);
  const id = useId();

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError('');
    const fields = new FormData(event.currentTarget);
    try {
      const credentials = { email: fields.get('email').trim(), password: fields.get('password') };
      const result = register
        ? await authClient.signUp.email({ ...credentials, name: fields.get('name').trim() })
        : await authClient.signIn.email(credentials);
      if (result.error) setError(register ? 'No se pudo crear la cuenta. Revisá los datos o intentá iniciar sesión.' : 'No se pudo iniciar sesión. Revisá tu email y contraseña.');
    } catch { setError('No se pudo conectar. Volvé a intentar.'); }
    finally { pending.current = false; setBusy(false); }
  }

  async function signOut() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError('');
    try {
      const result = await authClient.signOut();
      if (result.error) setError('No se pudo cerrar la sesión. Volvé a intentar.');
    } catch { setError('No se pudo conectar. Volvé a intentar.'); }
    finally { pending.current = false; setBusy(false); }
  }

  const errorMessage = error && <Alert variant="destructive" ref={errorRef} tabIndex={-1} id={`${id}-error`}>
    <CircleAlert aria-hidden="true" /><AlertDescription>{error}</AlertDescription>
  </Alert>;

  if (isLoading) return <div className="auth-panel space-y-6" role="status" aria-label="Verificando sesión">
    <Skeleton className="size-12 rounded-xl" />
    <div className="space-y-3"><Skeleton className="h-9 w-3/4" /><Skeleton className="h-4 w-full" /></div>
    <Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" />
    <span className="sr-only">Verificando sesión…</span>
  </div>;

  if (isAuthenticated) return <Card className="auth-panel gap-7 border-0 bg-transparent py-0 shadow-none" aria-labelledby={`${id}-title`}>
    <CardHeader className="gap-3 px-0">
      <span className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-border bg-accent text-accent-foreground"><Check size={23} aria-hidden="true" /></span>
      <CardTitle as={headingAs} id={`${id}-title`} className="text-3xl font-semibold tracking-tight">Ya estás adentro.</CardTitle>
      <CardDescription className="text-sm leading-7">Tu sesión está activa. Este es tu punto de partida.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6 px-0">
      <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground"><UserRound size={19} aria-hidden="true" /></span>
        <div className="min-w-0 space-y-1" aria-live="polite">{user
          ? <><p className="break-words text-sm font-semibold">{user.name}</p><p className="break-all text-xs text-muted-foreground">{user.email}</p></>
          : <p className="text-sm text-muted-foreground">Cargando tu cuenta…</p>}</div>
      </div>
      {errorMessage}
      <Button className="w-full" size="lg" variant="outline" onClick={signOut} disabled={busy}>
        {busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
        {busy ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </Button>
    </CardContent>
  </Card>;

  return <Card className="auth-panel gap-7 border-0 bg-transparent py-0 shadow-none" aria-labelledby={`${id}-title`}>
    <CardHeader className="gap-3 px-0">
      <span className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-xs"><LockKeyhole size={22} strokeWidth={1.7} aria-hidden="true" /></span>
      <CardTitle as={headingAs} id={`${id}-title`} className="text-[30px] font-semibold leading-tight tracking-tight sm:text-[32px]">{register ? 'Creá tu cuenta.' : 'Qué bueno verte.'}</CardTitle>
      <CardDescription className="text-sm leading-7">{register ? 'Un primer paso para empezar a construir.' : 'Ingresá tus datos para continuar en tu espacio.'}</CardDescription>
    </CardHeader>
    <CardContent className="px-0">
      <form key={register ? 'register' : 'login'} onSubmit={submit} className="space-y-5" aria-busy={busy} aria-describedby={error ? `${id}-error` : undefined}>
        {register && <div className="space-y-2.5">
          <Label htmlFor={`${id}-name`}>Nombre completo</Label>
          <Input id={`${id}-name`} name="name" autoComplete="name" placeholder="Tu nombre" required maxLength={120} disabled={busy} className="h-12 bg-card px-3.5" />
        </div>}
        <div className="space-y-2.5">
          <Label htmlFor={`${id}-email`}>Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id={`${id}-email`} name="email" type="email" autoComplete="email" placeholder="nombre@empresa.com" autoCapitalize="none" spellCheck={false} required disabled={busy} className="h-12 bg-card pr-3.5 pl-10" />
          </div>
        </div>
        <div className="space-y-2.5">
          <Label htmlFor={`${id}-password`}>Contraseña</Label>
          <div className="relative">
            <Input id={`${id}-password`} name="password" type={showPassword ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'Creá una contraseña' : 'Tu contraseña'} minLength={8} maxLength={128} required disabled={busy} className="h-12 bg-card pr-12 pl-3.5" aria-describedby={register ? `${id}-password-hint` : undefined} />
            <Button type="button" variant="ghost" size="icon" className="absolute top-1/2 right-0.5 size-11 -translate-y-1/2 text-muted-foreground" disabled={busy} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} aria-controls={`${id}-password`}>
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
          {register && <p id={`${id}-password-hint`} className="text-xs leading-5 text-muted-foreground">Usá entre 8 y 128 caracteres.</p>}
        </div>
        {errorMessage}
        <Button type="submit" disabled={busy} className="h-12 w-full gap-3 text-sm" size="lg">
          {busy ? <><LoaderCircle className="animate-spin" aria-hidden="true" />{register ? 'Creando tu cuenta…' : 'Ingresando…'}</> : <>{register ? 'Crear mi cuenta' : 'Iniciar sesión'}<ArrowRight aria-hidden="true" /></>}
        </Button>
      </form>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-x-1 border-t pt-6 text-xs text-muted-foreground">
        <span>{register ? '¿Ya tenés una cuenta?' : '¿Primera vez por acá?'}</span>
        <Button variant="link" className="h-11 px-1 text-xs font-semibold" type="button" disabled={busy} onClick={() => { setRegister(!register); setShowPassword(false); setError(''); }}>
          {register ? 'Iniciá sesión' : 'Creá tu cuenta'}
        </Button>
      </div>
    </CardContent>
  </Card>;
}
