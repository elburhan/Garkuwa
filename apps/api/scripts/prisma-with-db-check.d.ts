export function resolvePrismaCliPath(): string;

export function buildPrismaCliArgs(args: string[], prismaCliPath?: string): string[];

export function getPrismaCliInvocationArgs(args: string[], prismaCliPath?: string): string[];

export function runPrismaCli(
  args: string[],
  options?: {
    spawnProcess?: (...args: unknown[]) => unknown;
    nodeExecutable?: string;
    prismaCliPath?: string;
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    writeError?: (...args: unknown[]) => void;
  },
): Promise<number>;

export async function main(
  args?: string[],
  options?: {
    verify?: (...args: unknown[]) => Promise<unknown>;
    run?: (...args: unknown[]) => Promise<number>;
    writeError?: (...args: unknown[]) => void;
  },
): Promise<number>;
