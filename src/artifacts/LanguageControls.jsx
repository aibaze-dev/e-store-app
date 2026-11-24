import { useState } from 'react';
import { Globe } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { LANGUAGES, suggestedLanguage, useLanguage } from './i18n.js';

const PICKER_TEXT = {
  en: { title: 'Choose your language', description: 'You can change it later from the top of the page.', close: 'Continue in English' },
  es: { title: 'Elige tu idioma', description: 'Puedes cambiarlo después desde la parte superior de la página.', close: 'Continuar en español' },
  pt: { title: 'Escolha seu idioma', description: 'Você pode mudar depois no topo da página.', close: 'Continuar em português' },
};

// Shown on the first visit, before the artifact renders. Dismissing it keeps the suggested language.
export function LanguagePicker({ onChoose }) {
  const [suggested] = useState(suggestedLanguage);
  const text = PICKER_TEXT[suggested];
  return <Dialog open onOpenChange={open => { if (!open) onChoose(suggested); }}>
    <DialogContent className="artifact-theme artifact-language-dialog" lang={suggested} closeLabel={text.close}>
      <div className="artifact-language-heading"><span className="artifact-language-icon"><Globe aria-hidden="true" /></span>
        <DialogTitle>{text.title}</DialogTitle></div>
      <DialogDescription>{text.description}</DialogDescription>
      <div className="artifact-language-options" role="group" aria-label={text.title}>
        {LANGUAGES.map(item => <button key={item.code} type="button" lang={item.code} autoFocus={item.code === suggested}
          className={`artifact-language-option${item.code === suggested ? ' is-suggested' : ''}`} onClick={() => onChoose(item.code)}>
          <strong>{item.label}</strong><span aria-hidden="true">{item.code.toUpperCase()}</span>
        </button>)}
      </div>
    </DialogContent>
  </Dialog>;
}

const SWITCHER_LABEL = { en: 'Language', es: 'Idioma', pt: 'Idioma' };

export function LanguageSwitcher({ className = '' }) {
  const { lang, setLang } = useLanguage();
  return <label className={`artifact-language-switcher ${className}`}>
    <Globe aria-hidden="true" />
    <select aria-label={SWITCHER_LABEL[lang]} value={lang} onChange={event => setLang(event.target.value)}>
      {LANGUAGES.map(item => <option key={item.code} value={item.code} lang={item.code}>{item.label}</option>)}
    </select>
  </label>;
}
