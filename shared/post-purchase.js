export const POST_PURCHASE_CONTENT = {
  postPurchase: {
    eyebrow: 'Oferta especial para vos', title: '', subtitle: '', description: '',
    ctaText: 'Sí, lo quiero', declineText: 'No, gracias',
    downsellTitle: 'Una oportunidad más',
    downsellText: 'Sumá este producto con un descuento especial.',
    downsellCtaText: 'Sí, lo quiero con descuento',
  },
  postPurchaseBenefits: { enabled: true, title: 'Qué incluye esta oferta', subtitle: '', items: [] },
  postPurchaseVideo: { enabled: false, title: 'Conocé esta oferta', url: '' },
};

export function postPurchaseContent(content = {}) {
  return Object.fromEntries(Object.entries(POST_PURCHASE_CONTENT).map(([key, defaults]) => [key, { ...defaults, ...content[key] }]));
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
    return /\.(mp4|webm|ogv)$/i.test(url.pathname) ? { kind: 'video', src: url.href } : null;
  } catch { return null; }
}
