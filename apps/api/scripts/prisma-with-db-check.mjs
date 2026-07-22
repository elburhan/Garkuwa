import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { constants as osConstants } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { verifyDatabase } from './verify-db.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const scriptDirectory = dirname(scriptPath);
const apiWorkspace = resolve(scriptDirectory, '..');
const require = createRequire(import.meta.url);

export function resolvePrismaCliPath() {
  return require.resolve('prisma/build/index.js');
}

export function buildPrismaCliArgs(args, prismaCliPath = resolvePrismaCliPath()) {
  return [prismaCliPath, ...args];
}

export function getPrismaCliInvocationArgs(args, prismaCliPath = resolvePrismaCliPath()) {
  return [prismaCliPath, ...args];
}

function signalExitCode(signal) {
  const signalNumber = osConstants.signals[signal];
  return typeof signalNumber === 'number' ? 128 + signalNumber : 1;
}

export function runPrismaCli(
  args,
  {
    spawnProcess = spawn,
    nodeExecutable = process.execPath,
    prismaCliPath,
    cwd = apiWorkspace,
    env = process.env,
    writeError = console.error,
  } = {},
) {
  return new Promise((resolveExitCode) => {
    let settled = false;
    let child;

    const finish = (exitCode) => {
      if (!settled) {
        settled = true;
        resolveExitCode(exitCode);
      }
    };

    try {
      const resolvedPrismaCliPath = prismaCliPath ?? resolvePrismaCliPath();
      child = spawnProcess(
        nodeExecutable,
        getPrismaCliInvocationArgs(args, resolvedPrismaCliPath),
        {
          cwd,
          env,
          stdio: 'inherit',
        },
      );
    } catch (error) {
      writeError('Prisma CLI could not be started.');
      writeError(error instanceof Error ? error.message : String(error));
      finish(1);
      return;
    }

    child.once('error', (error) => {
      writeError('Prisma CLI could not be started.');
      writeError(error.message);
      finish(1);
    });

    child.once('exit', (code, signal) => {
      if (signal) {
        writeError(`Prisma CLI was terminated by ${signal}.`);
        finish(signalExitCode(signal));
        return;
      }

      finish(code ?? 1);
    });
  });
}

export async function main(
  args = process.argv.slice(2),
  { verify = verifyDatabase, run = runPrismaCli, writeError = console.error } = {},
) {
  try {
    await verify({ reportSuccess: false });
  } catch (error) {
    writeError('Database preflight failed. Prisma was not started.');
    writeError(error instanceof Error ? error.message : String(error));
    writeError('Start the local PostGIS container with: pnpm docker:up');
    writeError('Then verify connectivity and PostGIS with: pnpm db:verify');
    return 1;
  }

  return run(args, { writeError });
}

const isDirectInvocation =
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === pathToFileURL(scriptPath).href;

if (isDirectInvocation) {
  process.exitCode = await main();
}
