import { createContext, useContext, useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { ImageUp } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText } from '@/lib/format.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import './image-field.css';

// The editor page provides the upload function (Convex storage); without it only URLs work.
export const UploadContext = createContext(null);
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

// Uploads straight to Convex storage; the server checks type and size before returning the URL.
export function useImageUpload() {
  const uploadUrl = useMutation(api.quizzes.imageUploadUrl), imageUrl = useMutation(api.quizzes.imageUrl);
  return async function upload(file) {
    let result;
    try {
      const response = await fetch(await uploadUrl(), { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      if (!response.ok) throw new Error('upload');
      result = await imageUrl({ storageId: (await response.json()).storageId });
    } catch (failure) { throw new Error(errorText(failure, 'No se pudo subir la imagen. Volvé a intentar.')); }
    if (result.error) throw new Error(result.error);
    return result.url;
  };
}

// `uploadOnly` hides the URL option: the photo is picked or dragged from the computer.
export function ImageField({ label = 'Imagen', hint, value, onChange, compact = false, disabled = false, uploadOnly = false }) {
  const upload = useContext(UploadContext), input = useRef(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [paste, setPaste] = useState(false);
  async function pick(file) {
    if (!file || disabled) return;
    if (!ACCEPT.includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Elegí una imagen JPG, PNG, WebP, GIF o AVIF de hasta 5 MB.'); return; }
    setBusy(true); setError('');
    try { onChange(await upload(file)); } catch (e) { setError(e?.message || 'No se pudo subir la imagen.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  const byUrl = !uploadOnly || !upload;
  return <div className={`image-field ${compact ? 'is-compact' : ''} ${uploadOnly && !compact ? 'is-large' : ''}`}
    onDragOver={e => { if (upload && e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
    onDrop={e => { const file = e.dataTransfer.files?.[0]; if (upload && file) { e.preventDefault(); pick(file); } }}>
    <span className="image-field-label">{label}</span>
    <div className="image-field-row">
      <div className="image-field-thumb">{value ? <img src={value} alt="" /> : <ImageUp aria-hidden="true" />}</div>
      <div className="image-field-actions">
        <input ref={input} type="file" accept={ACCEPT.join(',')} hidden onChange={e => pick(e.target.files?.[0])} />
        {upload && <Button type="button" variant="outline" size="sm" disabled={busy || disabled} onClick={() => input.current?.click()}>{busy ? 'Subiendo…' : value ? (uploadOnly ? 'Cambiar foto' : 'Cambiar') : (uploadOnly ? 'Subir foto' : 'Subir')}</Button>}
        {byUrl && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setPaste(!paste)}>URL</Button>}
        {value && <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange('')}>Quitar</Button>}
      </div>
    </div>
    {uploadOnly && upload && <p className="text-xs leading-5 text-muted-foreground">JPG, PNG, WebP, GIF o AVIF de hasta 5 MB. También podés arrastrarla hasta acá.</p>}
    {byUrl && (paste || (!upload && !value)) && <Input type="url" placeholder="https://…" value={value || ''} disabled={disabled} onChange={e => onChange(e.target.value)} aria-label={`URL: ${label}`} />}
    {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    {error && <p className="image-field-error" role="alert">{error}</p>}
  </div>;
}
