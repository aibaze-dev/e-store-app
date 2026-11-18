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
    expect(legacy.postPurchase.ctaText).toBe('Sí, lo quiero');
    expect(legacy.postPurchaseVideo).toMatchObject({ enabled: false, url: '' });
    const saved = postPurchaseContent({ postPurchaseVideo: { enabled: false, url: 'https://example.com/video.mp4' }, postPurchaseBenefits: { enabled: false, items: [] } });
    expect(saved.postPurchaseVideo.enabled).toBe(false);
    expect(saved.postPurchaseBenefits.enabled).toBe(false);
  });

  it('uses persuasive defaults for the discount steps and upgrades the old default texts', () => {
    const fresh = postPurchaseContent().postPurchase;
    expect(fresh.downsellTitle).not.toBe('Una oportunidad más');
    expect(fresh.finalTitle).toMatch(/Última oportunidad/);
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
  const view = () => ({ content: normalizeContent({}), postPurchaseOffer: offer, downsell: { price: 2000 }, offer: { main: { name: 'Guía', price: 2700 }, bonuses: [], upsells: [] } });
  it('lists every modal even when unavailable, using actual configuration', () => {
    expect(popupJourney(view())).toHaveLength(7);
    expect(popupJourney(view()).every(item => item.enabled)).toBe(true);
    const disabled = popupJourney({ ...view(), downsell: null, postPurchaseOffer: null, content: { popupOptions: { landingExit: false }, checkout: { showExit: false } } });
    expect(disabled).toHaveLength(7);
    expect(disabled.every(item => !item.enabled)).toBe(true);
  });
  it('honors disabled steps and triggers while keeping the existing funnel limits', () => {
    const configured = { ...offer, content: { popupOptions: { postDownsell: false, postOnReturn: false } } };
    const decline = afterDecline(configured, initialFunnel(), 'offer', false);
    expect(decline.stage).toBeNull();
    expect(claimReopen(configured, decline.funnel, 'visibility')).toBeNull();
    const reopened = claimReopen(configured, decline.funnel, 'mouse');
    expect(nextStage(configured, reopened)).toBe('final');
    expect(nextStage({ ...offer, content: { popupOptions: { postEnabled: false } } }, initialFunnel())).toBeNull();
    const noFinal = { ...offer, content: { popupOptions: { postFinal: false } } };
    expect(nextStage(noFinal, { ...initialFunnel(), declined: ['offer', 'downsell'] })).toBeNull();
    expect(popupJourney({ ...view(), content: { popupOptions: { postFinal: false } } }).find(item => item.target === 'post-final').enabled).toBe(false);
  });
  it('preserves legacy CTA and downsell text, explicit blanks, and edits during generation', () => {
    expect(landingExitConfig({ content: { hero: { ctaText: 'Mi CTA' } } }).exitButton).toBe('Mi CTA');
    expect(backPopupConfig({ downsell: { modalTitle: 'Oferta anterior' } }).modalTitle).toBe('Oferta anterior');
    const content = normalizeContent({ landingExit: { exitTitle: 'Nuevo aviso', exitIntro: 'Llevate {producto}' }, postLabels: { paidTitle: 'Listo', linksSubtitle: '' }, backPopup: { modalTitle: '' }, popupOptions: { postOnExit: false } });
    const regenerated = mergeGeneratedContent(content, { hero: { title: 'Título nuevo' } });
    for (const key of ['postLabels', 'landingExit', 'backPopup', 'popupOptions']) expect(regenerated[key]).toEqual(content[key]);
    expect(postLabels(content).linksSubtitle).toBe('');
    expect(backPopupConfig({ content }).modalTitle).toBe('');
    expect(exitIntentCopy({ ...view(), content }, 'landing', String)).toMatchObject({ title: 'Nuevo aviso', intro: 'Llevate Guía' });
  });
});
