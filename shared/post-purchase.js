export const POST_PURCHASE_CONTENT = {
  postPurchase: {
    eyebrow: 'Oferta especial para vos', title: '', subtitle: '', description: '',
    ctaText: 'Sí, lo quiero', declineText: 'No, gracias',
    // Second step: same product, lower price. The discount badge and prices are shown apart.
    downsellTitle: 'Esperá: no te vayas sin esto (ahora más barato)',
    downsellText: 'Sabemos que el precio puede frenar. Por eso, solo porque acabás de comprar, te dejamos exactamente el mismo producto con descuento: el mismo contenido completo y el mismo acceso inmediato, por menos. Este precio no se vuelve a mostrar.',
    downsellCtaText: 'Sí, lo quiero a este precio',
    // Last step: the lowest price of the whole offer. After a "No" the modal never comes back.
    finalTitle: 'Última oportunidad: el precio más bajo que vas a ver',
    finalText: 'Lo bajamos una vez más y es definitivo: no hay una oferta mejor para este producto. Sumalo ahora a tu compra con acceso inmediato. Si cerrás esta ventana, no vuelve a aparecer.',
    finalCtaText: 'Sí, lo quiero al precio final',
  },
  postPurchaseBenefits: { enabled: true, title: 'Qué incluye esta oferta', subtitle: '', items: [] },
  postPurchaseVideo: { enabled: false, title: 'Conocé esta oferta', url: '' },
};

// Last post-purchase discount: 10 more points than the store's downsell, or 10% without
// one, never above 90%. The server charges it with this same rule.
export const FINAL_EXTRA_PERCENT = 10;
export function finalPostPurchasePercent(postPurchase = {}) {
  return Math.min((postPurchase.downsellPercent ?? 0) + FINAL_EXTRA_PERCENT, 90);
}

// Pages of the post-purchase preview and the modal step each one shows.
export const POST_PURCHASE_PREVIEW_STAGES = { post: 'offer', 'post-downsell': 'downsell', 'post-final': 'final' };

// Texts saved while these were the defaults follow the current defaults instead.
const LEGACY_DEFAULTS = {
  downsellTitle: 'Una oportunidad más',
  downsellText: 'Sumá este producto con un descuento especial.',
  downsellCtaText: 'Sí, lo quiero con descuento',
};

export function postPurchaseContent(content = {}) {
  const merged = Object.fromEntries(Object.entries(POST_PURCHASE_CONTENT).map(([key, defaults]) => [key, { ...defaults, ...content[key] }]));
  for (const [field, legacy] of Object.entries(LEGACY_DEFAULTS)) {
    if (merged.postPurchase[field] === legacy) merged.postPurchase[field] = POST_PURCHASE_CONTENT.postPurchase[field];
  }
  for (const field of ['finalTitle', 'finalText', 'finalCtaText']) {
    if (typeof merged.postPurchase[field] !== 'string') merged.postPurchase[field] = POST_PURCHASE_CONTENT.postPurchase[field];
  }
  return merged;
}

// Never embed arbitrary HTML/iframes. Accept known video players or direct video files.
export function videoSource(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'].includes(host)) {
      const id = host === 'youtu.be' ? parts[0] : parts[0] === 'watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : '';
      return /^[a-zA-Z0-9_-]{11}$/.test(id || '') ? { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
    }
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
      const id = host === 'player.vimeo.com' && parts[0] === 'video' ? parts[1] : parts[0];
      const hash = url.searchParams.get('h') || (host !== 'player.vimeo.com' ? parts[1] : '');
      if (!/^\d+$/.test(id || '') || (hash && !/^[a-zA-Z0-9]+$/.test(hash))) return null;
      return { kind: 'embed', src: `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ''}` };
    }
    const stored = /^[a-z0-9-]+\.convex\.cloud$/.test(host) && /^\/api\/storage\/[a-zA-Z0-9-]+$/.test(url.pathname);
    return stored || /\.(mp4|webm|ogv)$/i.test(url.pathname) ? { kind: 'video', src: url.href } : null;
  } catch { return null; }
}
