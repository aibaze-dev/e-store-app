import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyDeployment } from '../scripts/verify-deploy.mjs';

const directories = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture() {
  const distDir = await mkdtemp(join(tmpdir(), 'deploy-check-'));
  directories.push(distDir);
  await mkdir(join(distDir, 'assets'));
  const published = new Map([
    ['/', '<html><script src="/assets/main.js"></script></html>'],
    ['/assets/main.js', 'import("./lazy.js");'],
    ['/assets/lazy.js', 'export const current = true;'],
    ['/assets/main.css', '.purchase-toast { border: 0; }'],
  ]);
  await Promise.all([...published].map(([path, body]) => writeFile(join(distDir, path === '/' ? 'index.html' : path.slice(1)), body)));
  const requests = [];
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname;
    requests.push({ path, options });
    return new Response(published.get(path) ?? 'Not found', { status: published.has(path) ? 200 : 404 });
  };
  return { distDir, published, requests, fetchImpl, siteUrl: 'https://example.convex.site' };
}

describe('public deployment verification', () => {
  it('checks HTML, CSS and lazy chunks and bypasses the request cache', async () => {
    const f = await fixture();
    expect(await verifyDeployment(f)).toMatchObject({ url: f.siteUrl + '/', assets: 3 });
    expect(f.requests.filter(r => r.path === '/')).toHaveLength(2);
    expect(f.requests.some(r => r.path === '/assets/lazy.js')).toBe(true);
    expect(f.requests.every(r => r.options.cache === 'no-store')).toBe(true);
  });
  it('rejects an older HTML even when the server returns success', async () => {
    const f = await fixture(); f.published.set('/', '<html>Old build</html>');
    await expect(verifyDeployment(f)).rejects.toThrow('HTML principal: el archivo publicado no coincide');
  });
  it('rejects stale CSS and missing lazy chunks', async () => {
    const f = await fixture(); f.published.set('/assets/main.css', '.old { border: 1px dashed black; }');
    await expect(verifyDeployment(f)).rejects.toThrow('assets/main.css');
    f.published.set('/assets/main.css', '.purchase-toast { border: 0; }');
    f.published.delete('/assets/lazy.js');
    await expect(verifyDeployment(f)).rejects.toThrow('HTTP 404');
  });
  it('detects an entry point replaced by a competing deploy during verification', async () => {
    const f = await fixture(); let htmlRequests = 0;
    const fetchImpl = async (url, options) => {
      if (new URL(url).pathname === '/' && ++htmlRequests === 2) return new Response('Another build');
      return f.fetchImpl(url, options);
    };
    await expect(verifyDeployment({ ...f, fetchImpl })).rejects.toThrow('HTML principal al finalizar');
  });
  it('refuses an unspecified deployment URL', async () => {
    await expect(verifyDeployment({ distDir: '/unused' })).rejects.toThrow('Falta VITE_CONVEX_SITE_URL');
  });
});
