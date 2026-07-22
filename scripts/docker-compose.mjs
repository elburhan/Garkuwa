import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const rootDirectory = resolve(process.cwd());
const dockerExecutable = process.platform === 'win32' ? 'docker.exe' : 'docker';

const child = spawn(
  dockerExecutable,
  ['compose', '--env-file', '.env', '-f', 'infrastructure/docker-compose.yml', 'up', '-d'],
  {
    cwd: rootDirectory,
    stdio: 'inherit',
    env: process.env,
  },
);

child.on('error', (error) => {
  console.error('Docker could not be started.');
  console.error(
    'Install Docker Desktop or Docker Engine with Compose support and ensure the `docker` command is on PATH.',
  );
  console.error(
    'If Docker is already installed, restart your terminal or sign out/in to refresh PATH.',
  );
  console.error(error.message);
  process.exit(1);
});

child.on('exit', (code) => {
  if (code !== 0) {
    console.error('Docker compose failed.');
    console.error(
      'Install Docker Desktop or Docker Engine with Compose support and ensure the `docker` command is on PATH.',
    );
    console.error(
      'If Docker is already installed, restart your terminal or sign out/in to refresh PATH.',
    );
  }

  process.exit(code ?? 1);
});
