import { z } from 'zod';

const webEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_API_BASE_URL: z.url(),
  NEXT_PUBLIC_APP_URL: z.url(),
});

const parsedEnvironment = webEnvironmentSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

if (!parsedEnvironment.success) {
  throw new Error(`Invalid web environment: ${z.prettifyError(parsedEnvironment.error)}`);
}

export const webEnvironment = parsedEnvironment.data;
