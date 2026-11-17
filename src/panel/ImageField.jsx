import { createContext, useContext, useId, useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { FileUp, ImageUp, Video } from 'lucide-react';
import { api } from '@/lib/api.js';
import { errorText } from '@/lib/format.js';
import { Button } from '@/components/ui/button';
import { videoSource } from '../../shared/post-purchase.js';
import { MEDIA, mediaError } from '../../shared/media.js';
import './image-field.css';

export const UploadContext = createContext(null);

// Files go directly to Convex Storage. Only a validated storage URL reaches the draft.
export function useMediaUpload() {
  const uploadUrl = useMutation(api.media.uploadUrl), finalize = useMutation(api.media.finalize);
  const [pending, setPending] = useState(0);
  async function upload(file, kind = 'image') {
    const invalid = mediaError(kind, file);
    if (invalid) throw new Error(invalid);
    setPending(count => count + 1);
    try {
      let result;
      try {
        const response = await fetch(await uploadUrl(), { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
        if (!response.ok) throw new Error('upload');
        result = await finalize({ storageId: (await response.json()).storageId, kind });
      } catch (failure) { throw new Error(errorText(failure, 'No se pudo subir el archivo. Volvé a intentar.')); }
      if (result.error) throw new Error(result.error);
      return result.url;
    }
    finally { setPending(count => count - 1); }
  }
  upload.pending = pending > 0;
  return upload;
}

export function ImageField(props) { return <MediaField {...props} kind="image" />; }
export function VideoField(props) { return <MediaField {...props} kind="video" />; }
export function FileField(props) { return <MediaField {...props} kind="file" />; }

function MediaField({ kind, label = 'Archivo', hint, value, onChange, compact = false, disabled = false, uploadOnly = false }) {
  const upload = useContext(UploadContext), input = useRef(null), lock = useRef(false), id = useId();
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [filename, setFilename] = useState('');
  const rule = MEDIA[kind];
  const noun = kind === 'image' ? 'foto' : kind === 'video' ? 'video' : 'archivo';
  const Icon = kind === 'image' ? ImageUp : kind === 'video' ? Video : FileUp;
  const blocked = disabled || busy || !upload;
  async function pick(file) {
    if (!file || blocked || lock.current || input.current?.matches(':disabled')) return;
    const invalid = mediaError(kind, file);
    if (invalid) { setError(invalid); if (input.current) input.current.value = ''; return; }
    lock.current = true; setBusy(true); setError('');
    try { const url = await upload(file, kind); onChange(url); setFilename(file.name); }
    catch (e) { setError(e?.message || 'No se pudo subir el archivo.'); }
    finally { lock.current = false; setBusy(false); if (input.current) input.current.value = ''; }
  }
  return <div className={`image-field ${compact ? 'is-compact' : ''} ${uploadOnly && !compact ? 'is-large' : ''}`} aria-busy={busy}
    onDragOver={e => { if (!blocked && e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
    onDrop={e => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
    <label className="image-field-label" htmlFor={id}>{label}</label>
    <div className="image-field-row">
      <div className="image-field-thumb">{value && kind === 'image' ? <img src={value} alt={label} /> : <Icon aria-hidden="true" />}</div>
      <div className="image-field-actions">
        <input id={id} ref={input} type="file" accept={rule.types.join(',')} disabled={blocked} hidden onChange={e => pick(e.target.files?.[0])} />
        <Button type="button" variant="outline" size="sm" disabled={blocked} aria-label={`${value ? 'Cambiar' : 'Subir'} ${label.toLowerCase()}`} onClick={() => input.current?.click()}>{busy ? 'Subiendo…' : `${value ? 'Cambiar' : 'Subir'} ${noun}`}</Button>
        {value && <Button type="button" variant="ghost" size="sm" disabled={disabled || busy} aria-label={`Quitar ${label.toLowerCase()}`} onClick={() => { onChange(''); setFilename(''); setError(''); }}>Quitar</Button>}
      </div>
    </div>
    {kind === 'video' && value && videoSource(value)?.kind !== 'embed' && <video className="media-field-video" src={value} controls playsInline preload="metadata" aria-label={label} />}
    {value && <p className="text-xs break-all text-muted-foreground">{filename || `${kind === 'image' ? 'Imagen cargada' : kind === 'video' ? 'Video cargado' : 'Archivo cargado'}`}</p>}
    <p className="text-xs leading-5 text-muted-foreground">{rule.formats}, hasta {rule.maxMB} MB. Elegí un archivo o arrastralo acá.</p>
    {!upload && <p className="image-field-error" role="alert">La carga de archivos no está disponible. Volvé a abrir el editor.</p>}
    {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    {busy && <p role="status" className="text-xs">Subiendo archivo… Esperá a que termine para guardar.</p>}
    {error && <p className="image-field-error" role="alert">{error}</p>}
  </div>;
}
