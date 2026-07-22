import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { config as loadEnv } from 'dotenv';
import pg from 'pg';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = dirname(scriptPath);
const workspaceRoot = resolve(scriptDirectory, '../../..');
const envPath = resolve(workspaceRoot, '.env');

loadEnv({ path: envPath, quiet: true });

export async function verifyDatabase({
  connectionString = process.env.DATABASE_URL,
  reportSuccess = true,
  writeOutput = console.log,
} = {}) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Create the repository-root .env file first.');
  }

  const client = new pg.Client({ connectionString });

  try {
    await client.connect();
    const { rows } = await client.query(
      'SELECT current_database(), current_user, PostGIS_version();',
    );
    const result = {
      database: rows[0].current_database,
      user: rows[0].current_user,
      postgis: rows[0].postgis_version,
    };

    if (reportSuccess) {
      writeOutput(JSON.stringify(result, null, 2));
    }

    return result;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function runVerification() {
  try {
    await verifyDatabase();
    return 0;
  } catch (error) {
    console.error('Database verification failed.');
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

const isDirectInvocation =
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === pathToFileURL(scriptPath).href;

if (isDirectInvocation) {
  process.exitCode = await runVerification();
}
