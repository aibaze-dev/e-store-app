// Language selection shared by every public artifact. No React components here,
// so tests and plain modules can import it.
import { createContext, useContext } from 'react';
import brand from '../config/brandData.json';

export const LANGUAGES = [
  { code: 'en', label: 'English', locale: 'en-US', promptName: 'English' },
  { code: 'es', label: 'Español', locale: 'es', promptName: 'Spanish' },
  { code: 'pt', label: 'Português', locale: 'pt-BR', promptName: 'Portuguese' },
];
export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGE_KEY = 'ateneo:artifact-language:v1';

export const isLanguage = value => LANGUAGES.some(item => item.code === value);
export const languageInfo = code => LANGUAGES.find(item => item.code === code) || LANGUAGES[0];

// `?lang=es` (or es-AR, pt-BR…) lets a store link open an artifact in its language.
export function languageFromSearch(search) {
  const value = new URLSearchParams(search || '').get('lang')?.trim().toLowerCase().slice(0, 2);
  return isLanguage(value) ? value : null;
}

const browserStorage = () => globalThis.localStorage;

export function readStoredLanguage(storage) {
  try {
    const value = (storage || browserStorage())?.getItem(LANGUAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch { return null; }
}

export function storeLanguage(code, storage) {
  if (!isLanguage(code)) return;
  try { (storage || browserStorage())?.setItem(LANGUAGE_KEY, code); } catch { /* The choice still applies to this page. */ }
}

// Suggestion only: the picker highlights it, the person still chooses.
export function suggestedLanguage(languages = globalThis.navigator?.languages || []) {
  for (const value of languages) {
    const code = String(value).toLowerCase().slice(0, 2);
    if (isLanguage(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}

export function brandNameFor(code) {
  return brand.artifactBrandNames?.[code] || brand.artifactBrandName;
}

const ARTIFACT_NAMES = {
  'project-brief': { es: '¡Tu propia app a medida!', pt: 'Seu próprio app sob medida!' },
  'ai-knowledge': { es: 'Pon a prueba lo que sabes de IA', pt: 'Teste seus conhecimentos de IA' },
  'prompt-builder': { es: 'Constructor de prompts', pt: 'Construtor de prompts' },
  'meeting-prep': { es: 'Prepara tu reunión', pt: 'Prepare sua reunião' },
};

export function artifactNameFor(artifact, code) {
  return ARTIFACT_NAMES[artifact?.slug]?.[code] || artifact?.name;
}

export const LanguageContext = createContext({ lang: DEFAULT_LANGUAGE, setLang: () => {} });

export function useLanguage() {
  const { lang, setLang } = useContext(LanguageContext);
  return { lang, setLang, locale: languageInfo(lang).locale, brandName: brandNameFor(lang) };
}

// Pick the table for the active language, falling back to English per key.
export function useStrings(table) {
  const { lang } = useLanguage();
  return lang === 'en' ? table.en : { ...table.en, ...table[lang] };
}
