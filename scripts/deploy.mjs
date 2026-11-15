import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const message = process.argv.slice(2).join(' ');

if (!message.trim()) {
  console.error('Uso: npm run deploy -- "mensaje del commit"');
  process.exit(1);
}

const cwd = fileURLToPath(new URL('..', import.meta.url));
const steps = [
  ['git', ['add', '.']],
  ['git', ['commit', '-am', message]],
  ['git', ['push', 'origin', 'main']],
  [process.execPath, ['--env-file=.env', '--run=deploy:convex']],
];

for (const [command, args] of steps) {
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
