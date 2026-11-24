// Languages a catalogue product (ebook or app) can be written in. Products store the `code`;
// the flag only labels it in the panel. Add a language here and both the form and the server accept it.
export const LANGUAGES = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'Inglés', flag: '🇺🇸' },
  { code: 'pt', name: 'Portugués', flag: '🇧🇷' },
  { code: 'fr', name: 'Francés', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'de', name: 'Alemán', flag: '🇩🇪' },
];

export function findLanguage(code) {
  return LANGUAGES.find(language => language.code === code) ?? null;
}
