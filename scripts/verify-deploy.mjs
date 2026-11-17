import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function assetsIn(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await assetsIn(path));
    else if (entry.isFile() && /\.(js|css)$/.test(entry.name)) files.push(path);
  }
  return files;
}

// Read back the public bytes, including lazy chunks, instead of trusting only
// the upload command's exit status. Nothing is written to the deployment.
export async function verifyDeployment({ siteUrl, distDir, fetchImpl = fetch }) {
  if (!siteUrl) throw new Error('Falta VITE_CONVEX_SITE_URL o SITE_URL para verificar el sitio publicado.');
  const base = new URL(siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('La URL del sitio debe ser HTTP(S), sin credenciales, consulta ni fragmento.');
  }
  const index = await readFile(resolve(distDir, 'index.html'));
  const files = await assetsIn(distDir);
  if (!files.length) throw new Error('El build no contiene archivos JS/CSS; ejecutá el build antes de verificar.');
  const compare = async (url, expected, name) => {
    const response = await fetchImpl(url, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`${name}: el sitio respondió HTTP ${response.status}.`);
    if (digest(Buffer.from(await response.arrayBuffer())) !== digest(expected)) {
      throw new Error(`${name}: el archivo publicado no coincide con dist. El sitio puede estar sirviendo otra versión o un deploy simultáneo.`);
    }
  };
  await compare(base, index, 'HTML principal');
  for (let i = 0; i < files.length; i += 4) {
    await Promise.all(files.slice(i, i + 4).map(async file => {
      const name = relative(distDir, file).split(sep).join('/');
      await compare(new URL(name, base), await readFile(file), name);
    }));
  }
  // Detect another publisher replacing the entry point during verification.
  await compare(base, index, 'HTML principal al finalizar');
  return { url: base.href, fingerprint: digest(index).slice(0, 12), assets: files.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await verifyDeployment({
      siteUrl: process.env.VITE_CONVEX_SITE_URL || process.env.SITE_URL,
      distDir: fileURLToPath(new URL('../dist', import.meta.url)),
    });
    console.log(`Deploy OK · ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`No se pudo verificar el deploy: ${error.message}`);
    process.exitCode = 1;
  }
}
