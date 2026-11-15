// Shared by the classic editor, renderer and server. New sections are opt-in.
export const CLASSIC_ACCENT = '#f56b20';
export const CLASSIC_STORY = {
  introduction: { enabled: false, eyebrow: 'Una nueva forma de empezar', title: '', subtitle: '', text: '' },
  transformation: { enabled: false, eyebrow: 'La transformación', title: '', subtitle: '', imageUrl: '', imageAlt: '' },
  about: { enabled: false, eyebrow: 'Quiénes somos', title: '', subtitle: '', text: '', imageUrl: '', imageAlt: '', signature: '' },
  showcase: { enabled: false, eyebrow: 'Qué viene adentro', title: '', subtitle: '', imageUrl: '', imageAlt: '' },
  comparison: { enabled: false, eyebrow: 'Elegí cómo empezar', title: '', subtitle: '', items: [] },
};

export function classicAccent(value) {
  // Replace only the previous template default; retain personalized brand colors.
  return !value || value.toLowerCase() === '#f59e0b' ? CLASSIC_ACCENT : value;
}
