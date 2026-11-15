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

export function readableOn(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#111827' : '#ffffff';
}

// One palette for the public landing and its portaled offer dialogs.
export function classicTheme(value) {
  const accent = /^#[0-9a-f]{6}$/i.test(value || '') ? classicAccent(value) : CLASSIC_ACCENT;
  const standard = accent.toLowerCase() === CLASSIC_ACCENT;
  const shade = factor => '#' + [1, 3, 5].map(i => Math.round(parseInt(accent.slice(i, i + 2), 16) * factor).toString(16).padStart(2, '0')).join('');
  const action = standard ? '#b9380b' : shade(.78);
  return {
    '--sales-accent': accent, '--sales-on-accent': readableOn(accent),
    '--classic-action': action, '--classic-on-action': readableOn(action),
    '--classic-cta-start': standard ? '#ff4d00' : shade(.92),
    '--classic-cta-end': standard ? '#ff9e3d' : accent,
    '--classic-cta-text': standard ? '#ffffff' : readableOn(shade(.92)),
    '--classic-banner-start': standard ? '#e83a00' : shade(.85),
    '--classic-banner-mid': standard ? '#ff5c1a' : accent,
  };
}
