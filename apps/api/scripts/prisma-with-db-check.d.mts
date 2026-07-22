interface ChildProcessLike {
  once(event: 'error', listener: (error: Error) => void): this;
  once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
}

interface PrismaRunOptions {
  spawnProcess?: (
    executable: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv; stdio: 'inherit' },
  ) => ChildProcessLike;
  nodeExecutable?: string;
  prismaCliPath?: string;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  writeError?: (...values: unknown[]) => void;
}

interface MainOptions {
  verify?: (options: { reportSuccess: boolean }) => Promise<unknown>;
  run?: (
    args: string[],
    options: { writeError: (...values: unknown[]) => void },
  ) => Promise<number>;
  writeError?: (...values: unknown[]) => void;
}

export declare function resolvePrismaCliPath(): string;
export declare function runPrismaCli(args: string[], options?: PrismaRunOptions): Promise<number>;
export declare function main(args?: string[], options?: MainOptions): Promise<number>;
