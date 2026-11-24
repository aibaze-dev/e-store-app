import { useState } from 'react';
import { Languages, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { ErrorAlert } from '@/components/Field.jsx';
import { errorText } from '@/lib/format.js';
import { LANGUAGES } from '../../shared/translate.js';

// Translates every text of the landing or the quiz with AI. `onTranslate(language)` does the
// work and saves the result as a draft; this control only picks the language and shows progress.
export default function TranslateControl({ what, disabled, onTranslate, onBusy }) {
  const [language, setLanguage] = useState('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    if (busy) return;
    setBusy(true); onBusy?.(true); setError('');
    try { await onTranslate(language); }
    catch (failure) { setError(errorText(failure, 'No se pudo traducir. Volvé a intentar; tu borrador sigue intacto.')); }
    finally { setBusy(false); onBusy?.(false); }
  }
  return <div className="landing-wizard is-closed translate-control" aria-busy={busy}>
    <Languages aria-hidden="true" />
    <div><strong>Traducir {what}</strong><p>Traducimos todos los textos con IA y los guardamos como borrador. Las fotos, los colores, los precios y lo publicado no cambian. Puede tardar hasta un minuto.</p></div>
    <div className="landing-wizard-actions">
      <NativeSelect className="w-auto" aria-label="Idioma de destino" value={language} disabled={disabled || busy} onChange={event => setLanguage(event.target.value)}>
        {Object.entries(LANGUAGES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
      </NativeSelect>
      <Button type="button" variant="outline" disabled={disabled || busy} onClick={run}>{busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Languages aria-hidden="true" />}{busy ? 'Traduciendo…' : 'Traducir'}</Button>
    </div>
    <ErrorAlert>{error}</ErrorAlert>
  </div>;
}
