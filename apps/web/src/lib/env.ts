import { z } from 'zod';

const webEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DEPLOYMENT_ENV: z.enum(['local', 'production']).default('local'),
    NEXT_PUBLIC_API_BASE_URL: z.url(),
    NEXT_PUBLIC_APP_URL: z.url(),
  })
  .superRefine((environment, context) => {
    if (environment.DEPLOYMENT_ENV === 'production') {
      for (const key of ['NEXT_PUBLIC_API_BASE_URL', 'NEXT_PUBLIC_APP_URL'] as const) {
        if (new URL(environment[key]).protocol !== 'https:') {
          context.addIssue({
            code: 'custom',
            path: [key],
            message: 'must use HTTPS when DEPLOYMENT_ENV is production',
          });
        }
      }
    }
  });

export type WebEnvironment = z.infer<typeof webEnvironmentSchema>;

export function parseWebEnvironment(input: NodeJS.ProcessEnv): WebEnvironment {
  const result = webEnvironmentSchema.safeParse(input);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid web environment: ${problems}`);
  }
  return result.data;
}

export const webEnvironment = parseWebEnvironment(process.env);
