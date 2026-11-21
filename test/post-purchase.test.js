import { popupJourney } from '../shared/popup-journey.js';
import { postLabels, landingExitConfig, backPopupConfig } from '../shared/purchase-copy.js';
import { initialFunnel, nextStage, afterDecline, claimReopen } from '../src/storefront/postPurchaseFunnel.js';
import { normalizeContent, mergeGeneratedContent } from '../src/templates/content.js';
import { exitIntentCopy } from '../src/storefront/exitIntent.js';
import { describe, expect, it } from 'vitest';
import { postPurchaseContent, videoSource } from '../shared/post-purchase.js';

describe('post-purchase presentation', () => {
  it('keeps legacy offers usable and respects video and section visibility', () => {
    const legacy = postPurchaseContent();
    expect(legacy.postPurchase.title).toBe('');
    expect(legacy.postPurchase.ctaText).toBe('Yes, add it to my order');
    expect(legacy.postPurchaseVideo).toMatchObject({ enabled: false, url: '' });
    const saved = postPurchaseContent({ postPurchaseVideo: { enabled: false, url: 'https://example.com/video.mp4' }, postPurchaseBenefits: { enabled: false, items: [] } });
    expect(saved.postPurchaseVideo.enabled).toBe(false);
    expect(saved.postPurchaseBenefits.enabled).toBe(false);
  });

  it('uses persuasive defaults for the discount steps and upgrades the old default texts', () => {
    const fresh = postPurchaseContent().postPurchase;
    expect(fresh.downsellTitle).not.toBe('Una oportunidad más');
    expect(fresh.finalTitle).toMatch(/Last chance/);
    expect(fresh.finalCtaText).toBeTruthy();
    const old = postPurchaseContent({ postPurchase: { downsellTitle: 'Una oportunidad más', downsellText: 'Sumá este producto con un descuento especial.', downsellCtaText: 'Sí, lo quiero con descuento' } }).postPurchase;
    expect(old).toMatchObject({ downsellTitle: fresh.downsellTitle, downsellText: fresh.downsellText, downsellCtaText: fresh.downsellCtaText, finalTitle: fresh.finalTitle });
    const custom = postPurchaseContent({ postPurchase: { downsellTitle: 'Mi título', finalTitle: 'Mi cierre', finalText: '' } }).postPurchase;
    expect(custom).toMatchObject({ downsellTitle: 'Mi título', finalTitle: 'Mi cierre', finalText: '' });
  });

  it('normalizes video URLs without embedding arbitrary pages', () => {
    expect(videoSource('https://youtu.be/dQw4w9WgXcQ?t=10')).toEqual({ kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
    expect(videoSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual(videoSource('https://youtu.be/dQw4w9WgXcQ'));
    expect(videoSource('https://vimeo.com/123456789/abc123')).toEqual({ kind: 'embed', src: 'https://player.vimeo.com/video/123456789?h=abc123' });
    expect(videoSource('https://player.vimeo.com/video/123456789?h=abc123')).toEqual(videoSource('https://vimeo.com/123456789/abc123'));
    expect(videoSource('https://cdn.example.com/video.MP4?token=test')).toEqual({ kind: 'video', src: 'https://cdn.example.com/video.MP4?token=test' });
    for (const url of ['', 'javascript:alert(1)', 'data:text/html,a', 'http://example.com/a.mp4', 'https://user:pass@example.com/a.mp4', 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ', 'https://example.com/embed', 'https://youtube.com/watch?v=invalid']) expect(videoSource(url)).toBeNull();
  });
});

describe('editable popups and their preview map', () => {
  const offer = { name: 'Curso', price: 4700, downsellPrice: 3760, finalPrice: 3290, content: {} };
  const view = () => ({ content: normalizeContent({}), postPurchaseOffer: offer, downsell: { price: 2000, finalPrice: 1730 }, offer: { main: { name: 'Guía', price: 2700 }, bonuses: [], upsells: [] } });
  it('lists every modal even when unavailable, using actual configuration', () => {
    expect(popupJourney(view())).toHaveLength(7);
    expect(popupJourney(view()).every(item => item.enabled)).toBe(true);
    const disabled = popupJourney({ ...view(), downsell: null, postPurchaseOffer: null, content: { popupOptions: { landingExit: false }, checkout: { showExit: false } } });
    expect(disabled).toHaveLength(7);
    expect(disabled.filter(item => item.enabled).map(item => item.target)).toEqual(['popup-exit-landing', 'popup-exit-checkout']);
    const noTriggers = popupJourney({ ...view(), content: { popupOptions: { postOnLoad: false, postOnReturn: false, postOnExit: false } } });
    expect(noTriggers.find(item => item.target === 'post').enabled).toBe(true);
    expect(noTriggers.find(item => item.target === 'post-final').enabled).toBe(false);
    const onlyOnLoad = popupJourney({ ...view(), content: { popupOptions: { postOnReturn: false, postOnExit: false } } });
    expect(onlyOnLoad.find(item => item.target === 'post-downsell').enabled).toBe(true);
    expect(onlyOnLoad.find(item => item.target === 'post-final').enabled).toBe(false);
  });
  it('honors disabled steps and triggers while keeping the existing funnel limits', () => {
    const configured = { ...offer, content: { popupOptions: { postDownsell: false, postOnReturn: false } } };
    const decline = afterDecline(configured, initialFunnel(), 'offer', false);
    expect(decline.stage).toBeNull();
    expect(claimReopen(configured, decline.funnel, 'visibility')).toBeNull();
    const reopened = claimReopen(configured, decline.funnel, 'mouse');
    expect(nextStage(configured, reopened)).toBe('final');
    expect(nextStage({ ...offer, content: { popupOptions: { postEnabled: false, postOnLoad: false } } }, initialFunnel())).toBe('offer');
    const noFinal = { ...offer, content: { popupOptions: { postFinal: false } } };
    expect(nextStage(noFinal, { ...initialFunnel(), declined: ['offer', 'downsell'] })).toBeNull();
    expect(popupJourney({ ...view(), content: { popupOptions: { postFinal: false } } }).find(item => item.target === 'post-final').enabled).toBe(false);
  });
  it('preserves legacy CTA and downsell text, explicit blanks, and edits during generation', () => {
    expect(landingExitConfig({ content: { hero: { ctaText: 'Mi CTA' } } }).exitButton).toBe('Mi CTA');
    expect(backPopupConfig({ downsell: { modalTitle: 'Oferta anterior' } }).modalTitle).toBe('Oferta anterior');
    const content = normalizeContent({ landingExit: { exitTitle: 'Nuevo aviso', exitIntro: 'Llevate {producto}' }, postLabels: { paidTitle: 'Listo', linksSubtitle: '' }, backPopup: { modalTitle: '', modalSubtitle: '' }, popupOptions: { postOnExit: false } });
    const regenerated = mergeGeneratedContent(content, { hero: { title: 'Título nuevo' } });
    for (const key of ['postLabels', 'landingExit', 'backPopup', 'popupOptions']) expect(regenerated[key]).toEqual(content[key]);
    expect(postLabels(content).linksSubtitle).toBe('');
    // Optional descriptions may stay empty; titles and actions never render blank.
    expect(backPopupConfig({ content }).modalSubtitle).toBe('');
    expect(backPopupConfig({ content }).modalTitle).toBe('Wait! We have a gift for you 🎁');
    expect(postLabels({ postLabels: { open: '  ', close: '' } })).toMatchObject({ open: 'Open', close: 'Close' });
    expect(exitIntentCopy({ ...view(), content }, 'landing', String)).toMatchObject({ title: 'Nuevo aviso', intro: 'Llevate Guía' });
  });
});

describe('thank-you downloads', async () => {
  const { isDownloadable, downloadName } = await import('../src/storefront/download.js');
  it('offers a download for files and keeps pages as links only', () => {
    expect(isDownloadable({ kind: 'file', url: 'https://example.com/x' })).toBe(true);
    expect(isDownloadable({ kind: 'link', url: 'https://example.com/book.pdf' })).toBe(false);
    expect(isDownloadable({ url: 'https://happy-cat-123.convex.cloud/api/storage/abc-123' })).toBe(true);
    expect(isDownloadable({ url: 'https://cdn.example.com/ebook.PDF?token=1' })).toBe(true);
    expect(isDownloadable({ url: 'https://site.example.com/a/prompt-builder' })).toBe(false);
    expect(isDownloadable({ url: 'not a url' })).toBe(false);
  });
  it('names the saved file after the deliverable with the right extension', () => {
    expect(downloadName('Educación, Formación y Tecnología', 'application/pdf')).toBe('Educacion-Formacion-y-Tecnologia.pdf');
    expect(downloadName('Guide', '', 'https://cdn.example.com/files/guide.EPUB')).toBe('Guide.epub');
    expect(downloadName('book.pdf', 'application/pdf')).toBe('book.pdf');
    expect(downloadName('', 'application/zip')).toBe('download.zip');
  });
  it('has default texts for the celebration and the download button', () => {
    const labels = postLabels();
    expect(labels.celebrationTitle).toBeTruthy();
    expect(labels.celebrationText).toContain('{producto}');
    expect(labels.download).toBeTruthy();
  });
});

describe('thank-you delivery order', async () => {
  const { groupDeliveries } = await import('../src/storefront/delivery-groups.js');
  it('puts the main product first, then free bonuses, then added products', () => {
    const links = [
      { productName: 'Upsell', role: 'upsell' }, { productName: 'Bonus', role: 'bonus' },
      { productName: 'After purchase', role: 'post_purchase' }, { productName: 'Book', role: 'main' }, { productName: 'Book PDF', role: 'main' },
    ];
    expect(groupDeliveries(links).map(group => [group.key, group.links.map(link => link.productName)])).toEqual([
      ['main', ['Book', 'Book PDF']], ['bonus', ['Bonus']], ['extras', ['Upsell', 'After purchase']],
    ]);
  });
  it('keeps old orders without roles as one list and handles empty orders', () => {
    expect(groupDeliveries([{ productName: 'A' }, { productName: 'B' }])).toEqual([{ key: 'all', links: [{ productName: 'A' }, { productName: 'B' }] }]);
    expect(groupDeliveries([])).toEqual([]);
  });
});

describe('delivery email', async () => {
  const { deliveryEmail } = await import('../convex/emails.ts');
  const base = {
    status: 'paid', email: { status: 'pending', attempts: 0 }, storeName: 'Ateneo', buyer: { email: 'a@example.com', name: '' },
    currency: 'USD', total: 2700, charged: null, reviewReason: 'amount', paymentIntentId: '',
    items: [{ name: 'Bonus site', role: 'bonus', price: 0 }, { name: 'Ebook', role: 'main', price: 2000 }, { name: 'Extra', role: 'upsell', price: 700 }],
    deliveries: [
      { productName: 'Bonus site', title: 'Prompt builder', url: 'https://site.example.com/a/prompt-builder', kind: 'link', role: 'bonus' },
      { productName: 'Ebook', title: 'PDF', url: 'https://files.example.com/book.pdf', kind: 'file', role: 'main', coverUrl: 'https://files.example.com/cover.jpg' },
      { productName: 'Extra', title: 'Workbook', url: 'https://files.example.com/extra.pdf', kind: 'file', role: 'upsell' },
    ],
  };
  it('orders the library like the page and names web deliverables as a site', () => {
    const { html, text, subject } = deliveryEmail(base);
    expect(subject).toBe('Your access to Ateneo');
    expect(html.indexOf('Ebook')).toBeLessThan(html.indexOf('Bonus site'));
    expect(html.indexOf('Bonus site')).toBeLessThan(html.indexOf('Workbook'));
    expect(html).toContain('https://files.example.com/cover.jpg');
    expect(html).toContain('Web portal');
    expect(html).toContain('Visit site');
    expect(text).toContain('Bonus site · Prompt builder (Free) [Web portal]: https://site.example.com/a/prompt-builder');
    expect(text).toContain('Total paid: $27.00');
    expect(text).toMatch(/^Thank you for your purchase!\n\nHi,\nYour payment is confirmed/);
    expect(text.indexOf('Ebook: $20.00')).toBeLessThan(text.indexOf('Bonus site: Free'));
  });
  it('uses the store texts and color, and escapes buyer data', () => {
    const { html, subject } = deliveryEmail({ ...base, buyer: { email: 'a@example.com', name: '<b>Ana</b>' }, presentation: { accentColor: '#2f6fed', postLabels: { emailSubject: 'Tus accesos de {tienda}', paidTitle: '¡Gracias por tu compra!' } } });
    expect(subject).toBe('Tus accesos de Ateneo');
    expect(html).toContain('¡Gracias por tu compra!');
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
    expect(html).not.toContain('<b>Ana</b>');
    expect(html.toLowerCase()).toContain('#2f6fed');
  });
});
