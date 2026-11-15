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

  it('normalizes video URLs without embedding arbitrary pages', () => {
    expect(videoSource('https://youtu.be/dQw4w9WgXcQ?t=10')).toEqual({ kind: 'embed', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
    expect(videoSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual(videoSource('https://youtu.be/dQw4w9WgXcQ'));
    expect(videoSource('https://vimeo.com/123456789/abc123')).toEqual({ kind: 'embed', src: 'https://player.vimeo.com/video/123456789?h=abc123' });
    expect(videoSource('https://player.vimeo.com/video/123456789?h=abc123')).toEqual(videoSource('https://vimeo.com/123456789/abc123'));
    expect(videoSource('https://cdn.example.com/video.MP4?token=test')).toEqual({ kind: 'video', src: 'https://cdn.example.com/video.MP4?token=test' });
    for (const url of ['', 'javascript:alert(1)', 'data:text/html,a', 'http://example.com/a.mp4', 'https://user:pass@example.com/a.mp4', 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ', 'https://example.com/embed', 'https://youtube.com/watch?v=invalid']) expect(videoSource(url)).toBeNull();
  });
});
