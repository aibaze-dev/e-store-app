// Shared by the classic editor, renderer and server. New sections are opt-in.
export const CLASSIC_ACCENT = '#f56b20';
export const CLASSIC_STORY = {
  introduction: { enabled: false, eyebrow: 'A new way to get started', title: '', subtitle: '', text: '', badge: '' },
  transformation: { enabled: false, eyebrow: 'Before and after', title: '', subtitle: '', imageUrl: '', imageAlt: '' },
  about: { enabled: false, eyebrow: 'About us', title: '', subtitle: '', text: '', imageUrl: '', imageAlt: '', signature: '' },
  showcase: { enabled: false, eyebrow: 'What’s inside', title: '', subtitle: '', imageUrl: '', imageAlt: '', videoUrl: '' },
  comparison: { enabled: false, eyebrow: 'Choose how to get started', title: '', subtitle: '', items: [], badge: '', ctaText: '' },
  // Blocks taken from long-form sales pages. Bonus cards and the value summary read the store's offer.
  highlights: { enabled: false, eyebrow: 'What you get', title: 'Made to be easy to use', subtitle: '', items: [] },
  offerTimer: { enabled: false, eyebrow: 'Limited-time offer', title: 'Get the complete package today', subtitle: '', badge: '', priceNote: 'One-time payment · no subscription', text: '', ctaText: '', note: '' },
  bonusCards: { enabled: false, eyebrow: 'Included with your purchase', title: 'Bonuses that come with it, free', subtitle: '', ctaText: '', note: '' },
  valueStack: { enabled: false, eyebrow: 'Everything you get', title: 'All of this for a single payment', subtitle: '', items: [], ctaText: '', note: '' },
  // A seal the seller uploads plus a promise. Visual only: it does not read the store's guarantee.
  riskFree: { enabled: false, title: 'Zero risk for you', text: '', imageUrl: '', imageAlt: '' },
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

const HEX = /^#[0-9a-f]{6}$/i;
// Darker and lighter versions of one color, as hex so their contrast can be measured.
function tones(color) {
  const channels = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  const hex = values => '#' + values.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('');
  return { shade: factor => hex(channels.map(channel => channel * factor)), tint: weight => hex(channels.map(channel => 255 - (255 - channel) * weight)) };
}
const highlightOn = (text, { shade, tint }) => text === '#ffffff' ? tint(.25) : shade(.4);

// One palette for the public landing, the purchase pages and their portaled offer dialogs.
// Every surface, ink and shadow is a mix of the chosen color, so no page keeps the default orange.
// `bar`, `button` and `heroButton` are the optional colors of the offer bar, of every landing
// button and of the hero's button; without them they follow the accent. The hero's button
// takes its own color first, then the buttons' color.
export function classicTheme(value, { bar, button, heroButton } = {}) {
  const accent = HEX.test(value || '') ? classicAccent(value) : CLASSIC_ACCENT;
  const standard = accent.toLowerCase() === CLASSIC_ACCENT;
  const { shade, tint } = tones(accent);
  const mix = (percent, base, color = accent) => `color-mix(in srgb, ${color} ${percent}%, ${base})`;
  // Text and edges in the accent; a light accent is darkened until it reads on white.
  const action = standard ? '#b9380b' : readableOn(shade(.78)) === '#ffffff' ? shade(.78) : shade(.45);
  const ctaStart = standard ? '#ff4d00' : shade(.92);
  const ctaEnd = standard ? '#ff9e3d' : accent;
  const ctaText = standard ? '#ffffff' : readableOn(ctaStart);
  const bannerStart = standard ? '#e83a00' : shade(.85);
  const bannerMid = standard ? '#ff5c1a' : accent;
  const highlight = standard ? '#ffe9a8' : highlightOn(ctaText, { shade, tint });
  const own = HEX.test(bar || '') ? tones(bar) : null;
  const barText = own ? readableOn(own.shade(.92)) : ctaText;
  const buttons = HEX.test(button || '') ? tones(button) : null;
  const btnStart = buttons ? buttons.shade(.92) : ctaStart;
  const btnEnd = buttons ? button : ctaEnd;
  const btnText = buttons ? readableOn(btnStart) : ctaText;
  const heroColor = HEX.test(heroButton || '') ? heroButton : buttons ? button : null;
  const hero = heroColor ? tones(heroColor) : null;
  return {
    '--sales-accent': accent, '--sales-on-accent': readableOn(accent),
    '--classic-action': action, '--classic-on-action': readableOn(action),
    '--classic-cta-start': ctaStart, '--classic-cta-end': ctaEnd, '--classic-cta-text': ctaText,
    '--classic-banner-start': bannerStart, '--classic-banner-mid': bannerMid, '--classic-accent-ink': standard ? bannerStart : action,
    // Offer bar at the top of the landing.
    '--classic-bar-start': own ? own.shade(.85) : bannerStart, '--classic-bar-mid': own ? bar : bannerMid, '--classic-bar-end': own ? own.tint(.82) : ctaEnd,
    '--classic-bar-text': barText, '--classic-bar-highlight': own ? highlightOn(barText, own) : highlight, '--classic-bar-glow': mix(38, 'transparent', own ? bar : accent),
    // Every button of the landing; the gradients of icons and badges keep the accent.
    '--classic-btn-start': btnStart, '--classic-btn-end': btnEnd, '--classic-btn-text': btnText, '--classic-btn-glow': mix(38, 'transparent', buttons ? button : accent),
    // The hero's button, with the darker edge that gives it relief.
    '--classic-hero-cta-start': hero ? hero.shade(.92) : ctaStart, '--classic-hero-cta-end': hero ? heroColor : ctaEnd,
    '--classic-hero-cta-text': hero ? readableOn(hero.shade(.92)) : ctaText, '--classic-hero-cta-edge': hero ? hero.shade(.62) : action,
    // Text and rules: neutral greys carrying a little of the accent.
    '--classic-ink': mix(12, '#141414'), '--classic-text': mix(10, '#404040'), '--classic-muted': mix(10, '#707070'), '--classic-faint': mix(10, '#a0a0a0'),
    '--classic-line': mix(12, '#f0f0f0'), '--classic-rule': mix(5, '#e8e8e8'),
    // Light surfaces, from paper to the borders of selected cards.
    '--classic-paper': mix(4, '#fff'), '--classic-cream': mix(9, '#fff'), '--classic-peach': mix(20, '#fff'), '--classic-edge': mix(35, '#fff'), '--classic-edge-strong': mix(55, '#fff'),
    // Dark sections and what is written on them.
    '--classic-night': mix(9, '#080808'), '--classic-night-2': mix(15, '#0a0a0a'), '--classic-night-3': mix(20, '#0c0c0c'), '--classic-deep': mix(55, '#0a0a0a'),
    '--classic-night-edge': mix(40, '#0a0a0a'), '--classic-night-line': mix(55, '#2a2a2a'), '--classic-night-accent': mix(50, '#fff'), '--classic-on-night': mix(14, '#ececec'),
    // Highlights: gold with the default orange, tints of the accent with any other color.
    '--classic-gold-start': standard ? '#ffdc92' : tint(.3), '--classic-gold-end': standard ? '#ffb648' : tint(.5), '--classic-on-gold': standard ? '#4a2a05' : readableOn(tint(.5)),
    '--classic-highlight': highlight, '--classic-night-highlight': standard ? '#ffe9a8' : tint(.3),
    // Testimonial stars are always yellow: like green and red, the color carries the meaning.
    '--classic-star': '#f5b301',
    // Discount badges: red with the default orange, the accent otherwise.
    '--classic-badge': standard ? '#ff3b1f' : action, '--classic-on-badge': standard ? '#ffffff' : readableOn(action),
    // Fixed buy button: blue next to the default orange, the buttons' gradient otherwise.
    '--classic-sticky-bg': standard && !buttons ? 'linear-gradient(90deg, #2f5bff, #2f8cff 55%, #38c6ff)' : `linear-gradient(135deg, ${btnStart}, ${btnEnd})`,
    '--classic-sticky-text': standard && !buttons ? '#ffffff' : btnText, '--classic-sticky-glow': standard && !buttons ? '#2f6bff59' : mix(38, 'transparent', buttons ? button : accent),
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
