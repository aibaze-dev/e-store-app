import { afterEach, describe, expect, it, vi } from 'vitest';
import { artifacts } from '../src/artifacts/registry.js';
import { artifactComponents } from '../src/artifacts/components.js';
import { artifactUrl, resolveSubdomain } from '../src/lib/site.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('artifact registry', () => {
  it('has unique, URL-safe slugs', () => {
    const slugs = artifacts.map(artifact => artifact.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('registers exactly one component for every metadata entry', () => {
    expect(Object.keys(artifactComponents).sort()).toEqual(artifacts.map(artifact => artifact.slug).sort());
    for (const component of Object.values(artifactComponents)) {
      expect(component?.$$typeof).toBe(Symbol.for('react.lazy'));
    }
  });
});

describe('public artifact URLs', () => {
  it('uses the configured base origin even on a store subdomain', () => {
    vi.stubEnv('VITE_SITE_URL', 'https://example.com/');
    vi.stubGlobal('window', { location: { origin: 'https://store.example.com', hostname: 'store.example.com' } });
    expect(artifactUrl('planificador-semanal')).toBe('https://example.com/a/planificador-semanal');
    expect(resolveSubdomain()).toBe('store');
  });

  it('preserves the configured port and ignores path, query and fragment', () => {
    vi.stubEnv('VITE_SITE_URL', 'http://localhost:5173/anything?preview=1#test');
    expect(artifactUrl('calculadora-2')).toBe('http://localhost:5173/a/calculadora-2');
  });

  it.each(['', 'invalid'])('falls back to the current origin without a valid site URL (%s)', value => {
    vi.stubEnv('VITE_SITE_URL', value);
    vi.stubGlobal('window', { location: { origin: 'http://localhost:5173' } });
    expect(artifactUrl('planificador')).toBe('http://localhost:5173/a/planificador');
  });
});
