import { useState } from 'react';
import { useAction, useConvex } from 'convex/react';
import { Check, ClipboardPaste, Copy, FileJson, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText } from '@/lib/format.js';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ErrorAlert, Field } from '@/components/Field.jsx';

// Alternative to the AI wizard: copy a prompt into any external chat and paste back its JSON.
// The JSON is cleaned on the server like the wizard's reply, then saved as a draft by the page.
export default function LandingJsonImport({ storeId, hasContent, disabled, onApply, variant = 'outline' }) {
  const convex = useConvex();
  const importJson = useAction(api.landingWizard.importJson);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [json, setJson] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function show() {
    setOpen(true); setError(''); setCopied(false);
    if (prompt) return;
    setLoading(true);
    try { setPrompt(await convex.query(api.landingWizard.importPrompt, { storeId })); }
    catch (failure) { setError(errorText(failure, 'No se pudo preparar el prompt. Volvé a intentar.')); }
    finally { setLoading(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); }
    catch { setError('No se pudo copiar. Seleccioná el texto del prompt y copialo a mano.'); }
  }

  async function submit(event) {
    // The dialog is portaled, but React still bubbles submit to the wizard's form around the button.
    event.preventDefault(); event.stopPropagation();
    if (busy || !json.trim()) return;
    setBusy(true); setError('');
    try {
      await onApply(await importJson({ storeId, json }));
      setOpen(false); setJson('');
    } catch (failure) { setError(errorText(failure, 'No se pudo importar el JSON. Revisalo y volvé a intentar.')); }
    finally { setBusy(false); }
  }

  return <>
    <Button type="button" variant={variant} disabled={disabled} onClick={show}><FileJson aria-hidden="true" />Pegar JSON</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-w-2xl" closeLabel="Cerrar importación">
        <div className="space-y-2 pr-8">
          <DialogTitle className="text-xl">Importar landing desde JSON</DialogTitle>
          <DialogDescription className="text-sm leading-6">Usá cualquier chat de IA (ChatGPT, Claude, Gemini…): copiá el prompt, respondé lo que te pregunte y pegá acá el JSON que te devuelva.</DialogDescription>
        </div>

        <section className="space-y-3" aria-labelledby="json-import-step-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="json-import-step-1" className="text-sm font-semibold">1. Copiá el prompt</h3>
            <Button type="button" variant="outline" size="sm" disabled={!prompt} onClick={copy}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}<span aria-live="polite">{copied ? 'Copiado' : 'Copiar prompt'}</span>
            </Button>
          </div>
          {loading
            ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Preparando el prompt con los datos de tu tienda…</p>
            : prompt && <Textarea readOnly value={prompt} aria-label="Prompt para el chat de IA" className="h-40 font-mono text-xs leading-5" onFocus={event => event.target.select()} />}
          <p className="text-xs leading-5 text-muted-foreground">Incluye el producto, los bonos y el post-compra de esta tienda, las reglas de redacción y la estructura exacta del JSON. También pregunta qué secciones opcionales sumar (tarjetas destacadas, oferta con contador, bonos en tarjetas, resumen de valor y sello de riesgo cero): las que elijas llegan activadas.</p>
        </section>

        <form className="space-y-3" onSubmit={submit} aria-busy={busy}>
          <Field label="2. Pegá el JSON de la respuesta" hint={`Se guarda como borrador con el mismo criterio que el asistente: se conservan tus fotos, precios, color, enlaces y opciones.${hasContent ? ' Los textos actuales de esas secciones se reemplazan.' : ''} No se publica hasta que vos lo decidas.`}>
            {ids => <Textarea {...ids} value={json} onChange={event => setJson(event.target.value)} placeholder={'{\n  "guaranteeDays": 0,\n  "hero": { … }\n}'} className="h-48 font-mono text-xs leading-5" spellCheck={false} disabled={busy} required />}
          </Field>
          <ErrorAlert>{error}</ErrorAlert>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy || !json.trim()}>{busy ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ClipboardPaste aria-hidden="true" />}{busy ? 'Importando…' : 'Importar landing'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
