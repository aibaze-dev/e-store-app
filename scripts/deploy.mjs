import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const message = process.argv.slice(2).join(' ');

if (!message.trim()) {
  console.error('Uso: npm run deploy -- "mensaje del commit"');
  process.exit(1);
}

const cwd = fileURLToPath(new URL('..', import.meta.url));
const branch = spawnSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8' });
if (branch.status !== 0 || branch.stdout.trim() !== 'main') {
  console.error('Ejecutá el deploy desde main para publicar el mismo código que se envía a origin/main.');
  process.exit(1);
}
const steps = [
  ['git', ['add', '.']],
  ['git', ['commit', '-am', message]],
  ['git', ['push', 'origin', 'main']],
  [process.execPath, ['--env-file=.env', '--run=deploy:convex']],
];

for (const [command, args] of steps) {
  if (command === 'git' && args[0] === 'commit') {
    const changes = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd });
    if (changes.status === 0) {
      console.log('Sin cambios nuevos: se vuelve a desplegar el commit actual.');
      continue;
    }
    if (changes.status !== 1) process.exit(changes.status ?? 1);
  }
  if (command === process.execPath) {
    // --run does not pass Node's --env-file settings to the script process.
    try {
      process.loadEnvFile(join(cwd, '.env'));
    } catch (error) {
      console.error(`No se pudo cargar .env: ${error.message}`);
      process.exit(1);
    }
  }
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
