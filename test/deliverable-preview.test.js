import { describe, expect, it } from 'vitest';
import { previewMode, safeUrl } from '../src/panel/deliverable-preview.js';

const file = { kind: 'file', url: 'https://demo.convex.cloud/api/storage/abc' };

describe('deliverable preview', () => {
  it('offers external links as links', () => {
    expect(previewMode({ kind: 'link', url: 'https://example.com/club' })).toEqual({ mode: 'link' });
  });

  it('shows PDFs inline and other files as downloads', () => {
    expect(previewMode(file, 'application/pdf; charset=binary')).toEqual({ mode: 'pdf', format: 'PDF' });
    expect(previewMode(file, 'application/epub+zip')).toEqual({ mode: 'download', format: 'EPUB' });
    expect(previewMode(file, 'application/zip')).toEqual({ mode: 'download', format: 'ZIP' });
    expect(previewMode(file, null)).toEqual({ mode: 'download', format: null });
  });

  it('waits for the type before choosing a file preview', () => {
    expect(previewMode(file, undefined)).toEqual({ mode: 'checking' });
  });

  it('treats deliverables without kind as documents', () => {
    expect(previewMode({ url: file.url }, 'application/pdf').mode).toBe('pdf');
  });

  it('never renders unsafe or empty URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBe('');
    expect(previewMode({ kind: 'link', url: 'javascript:alert(1)' })).toEqual({ mode: 'missing' });
    expect(previewMode({ kind: 'file', url: '' }, 'application/pdf')).toEqual({ mode: 'missing' });
  });
});
