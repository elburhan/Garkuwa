import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('docker compose wrapper', () => {
  it('documents how to resolve a missing Docker installation', () => {
    const scriptPath = resolve(process.cwd(), '..', '..', 'scripts', 'docker-compose.mjs');
    const scriptContents = readFileSync(scriptPath, 'utf8');

    expect(scriptContents).toContain('Docker Desktop');
    expect(scriptContents).toContain(
      "['compose', '--env-file', '.env', '-f', 'infrastructure/docker-compose.yml', 'up', '-d']",
    );
  });
});
