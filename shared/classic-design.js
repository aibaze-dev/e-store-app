// Shared by the classic editor, renderer and server. New sections are opt-in.
export const CLASSIC_ACCENT = '#f56b20';
export const CLASSIC_STORY = {
  introduction: { enabled: false, eyebrow: 'A new way to get started', title: '', subtitle: '', text: '', badge: '' },
  transformation: { enabled: false, eyebrow: 'Before and after', title: '', subtitle: '', imageUrl: '', imageAlt: '' },
  about: { enabled: false, eyebrow: 'About us', title: '', subtitle: '', text: '', imageUrl: '', imageAlt: '', signature: '' },
  showcase: { enabled: false, eyebrow: 'What’s inside', title: '', subtitle: '', imageUrl: '', imageAlt: '' },
  comparison: { enabled: false, eyebrow: 'Choose how to get started', title: '', subtitle: '', items: [], badge: '', ctaText: '' },
  // The order builder lists the store's extras; it only shows when the store has any.
  combo: { enabled: true, eyebrow: 'Build your bundle', title: 'Your order', subtitle: '', upsellText: 'Add extras at a discount with this order', allText: 'Add all extras', ctaText: 'Go to checkout', note: 'Secure checkout' },
};

// Landing texts accept two marks: *resaltado* and **negrita**. Anywhere else they are removed.
export function plainText(text) {
  return String(text || '').replace(/\*\*([^*]+)\*\*|\*([^*]+)\*/g, '$1$2');
}

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

// Split only a trailing legacy highlight: other layouts keep their original order.
// An explicitly empty accent stays empty when the seller clears that field.
export function splitHeroTitle(hero = {}) {
  const title = typeof hero?.title === 'string' ? hero.title : '';
  if (typeof hero?.titleAccent === 'string') return { title, titleAccent: hero.titleAccent };
  const match = title.match(/^([^*]+?)\s+\*([^*]+)\*\s*$/);
  return match ? { title: match[1].trimEnd(), titleAccent: match[2] } : { title, titleAccent: '' };
}
