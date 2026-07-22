import { EventEmitter } from 'node:events';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { main, resolvePrismaCliPath, runPrismaCli } from '../scripts/prisma-with-db-check.mjs';

class FakeChildProcess extends EventEmitter {}

function createSpy<Arguments extends unknown[], Result>(
  implementation: (...args: Arguments) => Result,
) {
  const calls: Arguments[] = [];
  const spy = (...args: Arguments): Result => {
    calls.push(args);
    return implementation(...args);
  };

  return { calls, spy };
}

describe('Prisma database command wrapper', () => {
  it('resolves the installed Prisma CLI JavaScript entry point', () => {
    const cliPath = resolvePrismaCliPath();

    expect(cliPath.replaceAll('\\', '/')).toContain('/prisma/build/index.js');
    expect(existsSync(cliPath)).toBe(true);
  });

  it('documents actionable guidance when the database is unavailable', async () => {
    const scriptPath = resolve(process.cwd(), 'scripts/prisma-with-db-check.mjs');
    const scriptContents = readFileSync(scriptPath, 'utf8');
    const writeError = createSpy<unknown[], undefined>(() => undefined);
    const run = createSpy<[string[]], Promise<number>>(async () => 0);

    await expect(
      main(['migrate', 'status'], {
        verify: async () => {
          throw new Error('connection refused');
        },
        run: run.spy,
        writeError: writeError.spy,
      }),
    ).resolves.toBe(1);

    expect(run.calls).toHaveLength(0);
    expect(writeError.calls).toContainEqual(['Database preflight failed. Prisma was not started.']);
    expect(scriptContents).toContain('pnpm docker:up');
    expect(scriptContents).toContain('pnpm db:verify');
  });

  it('runs the preflight before forwarding every Prisma argument', async () => {
    const order: string[] = [];
    const verify = createSpy(async () => {
      order.push('verify');
    });
    const run = createSpy(async (args: string[]) => {
      order.push('run');
      expect(args).toEqual(['migrate', 'dev', '--name', 'staff identity']);
      return 0;
    });

    await expect(
      main(['migrate', 'dev', '--name', 'staff identity'], {
        verify: verify.spy,
        run: run.spy,
      }),
    ).resolves.toBe(0);
    expect(order).toEqual(['verify', 'run']);
  });

  it('builds Prisma CLI arguments without shell-specific wrapping', async () => {
    // @ts-expect-error - the helper exports are runtime-only and intentionally exercised here.
    const { buildPrismaCliArgs, getPrismaCliInvocationArgs } =
      await import('../scripts/prisma-with-db-check.mjs');

    expect(buildPrismaCliArgs(['migrate', 'status'], '/tmp/prisma.js')).toEqual([
      '/tmp/prisma.js',
      'migrate',
      'status',
    ]);

    const args = await new Promise<string[]>((resolve) => {
      resolve(getPrismaCliInvocationArgs(['migrate', 'dev', '--name', 'staff identity']));
    });

    expect(args[0]).toContain('prisma\\build\\index.js');
    expect(args).toEqual([args[0], 'migrate', 'dev', '--name', 'staff identity']);
  });

  it('spawns the Prisma JavaScript entry point with the current Node executable', async () => {
    const child = new FakeChildProcess();
    const spawnProcess = createSpy(() => child);
    const env = { DATABASE_URL: 'postgresql://example.invalid/database' };
    const result = runPrismaCli(['migrate', 'status'], {
      spawnProcess: spawnProcess.spy,
      nodeExecutable: 'node-executable',
      prismaCliPath: 'prisma-cli.js',
      cwd: 'api-workspace',
      env,
    });

    child.emit('exit', 0, null);

    await expect(result).resolves.toBe(0);
    expect(spawnProcess.calls).toEqual([
      [
        'node-executable',
        ['prisma-cli.js', 'migrate', 'status'],
        { cwd: 'api-workspace', env, stdio: 'inherit' },
      ],
    ]);
  });

  it('returns Prisma failures and handles startup errors and signals', async () => {
    const failedChild = new FakeChildProcess();
    const failedResult = runPrismaCli([], {
      spawnProcess: () => failedChild,
      prismaCliPath: 'prisma-cli.js',
    });
    failedChild.emit('exit', 7, null);
    await expect(failedResult).resolves.toBe(7);

    const writeError = createSpy<unknown[], undefined>(() => undefined);
    await expect(
      runPrismaCli([], {
        spawnProcess: () => {
          throw new Error('spawn failed');
        },
        prismaCliPath: 'prisma-cli.js',
        writeError: writeError.spy,
      }),
    ).resolves.toBe(1);
    expect(writeError.calls).toContainEqual(['Prisma CLI could not be started.']);

    const erroredChild = new FakeChildProcess();
    const erroredResult = runPrismaCli([], {
      spawnProcess: () => erroredChild,
      prismaCliPath: 'prisma-cli.js',
      writeError: writeError.spy,
    });
    erroredChild.emit('error', new Error('asynchronous spawn failure'));
    await expect(erroredResult).resolves.toBe(1);

    const signaledChild = new FakeChildProcess();
    const signaledResult = runPrismaCli([], {
      spawnProcess: () => signaledChild,
      prismaCliPath: 'prisma-cli.js',
      writeError: writeError.spy,
    });
    signaledChild.emit('exit', null, 'SIGTERM');
    await expect(signaledResult).resolves.toBe(143);
  });
});
