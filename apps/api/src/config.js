import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1),
  MYSQL_SSL: z.enum(['true', 'false']).default('true'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('8h'),
  AUTH_COOKIE_NAME: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/).default('labtrack_session'),
  AUTH_COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('none'),
  AUTH_COOKIE_SECURE: z.enum(['true', 'false']).default('true'),
  AUTH_COOKIE_MAX_AGE_MS: z.coerce.number().int().min(60_000).default(28_800_000),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  JUDGE0_API_URL: z.string().default(''),
  JUDGE0_API_KEY: z.string().default(''),
  ENABLE_AI_ASSISTANCE: z.enum(['true', 'false']).default('false'),
  LLM_PROVIDER: z.enum(['mock', 'gemini', 'openai']).default('mock'),
  LLM_API_KEY: z.string().default(''),
  LLM_MODEL: z.string().default('gemini-1.5-flash'),
  LLM_BASE_URL: z.string().default(''),
  AI_RATE_LIMIT_HOURLY_MAX: z.coerce.number().int().min(1).default(5),
});

export function loadConfig(env = process.env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid API configuration: ${details}`);
  }
  const value = parsed.data;
  const cookieSecure = value.AUTH_COOKIE_SECURE === 'true';
  if (value.AUTH_COOKIE_SAME_SITE === 'none' && !cookieSecure) {
    throw new Error('AUTH_COOKIE_SAME_SITE=none requires AUTH_COOKIE_SECURE=true.');
  }
  return Object.freeze({
    environment: value.NODE_ENV,
    port: value.PORT,
    databaseUrl: value.DATABASE_URL,
    mysqlSsl: value.MYSQL_SSL === 'true',
    jwtSecret: value.JWT_SECRET,
    jwtExpiresIn: value.JWT_EXPIRES_IN,
    cookieName: value.AUTH_COOKIE_NAME,
    cookieSameSite: value.AUTH_COOKIE_SAME_SITE,
    cookieSecure,
    cookieMaxAgeMs: value.AUTH_COOKIE_MAX_AGE_MS,
    loginRateLimitWindowMs: value.LOGIN_RATE_LIMIT_WINDOW_MS,
    loginRateLimitMax: value.LOGIN_RATE_LIMIT_MAX,
    judge0ApiUrl: value.JUDGE0_API_URL || '',
    judge0ApiKey: value.JUDGE0_API_KEY || '',
    enableAiAssistance: value.ENABLE_AI_ASSISTANCE === 'true',
    llmProvider: value.LLM_PROVIDER,
    llmApiKey: value.LLM_API_KEY,
    llmModel: value.LLM_MODEL,
    llmBaseUrl: value.LLM_BASE_URL,
    aiRateLimitHourlyMax: value.AI_RATE_LIMIT_HOURLY_MAX,
  });
}
