import 'dotenv/config';

const requireEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const isProd = process.env['NODE_ENV'] === 'production';

let jwtSecret = process.env['JWT_SECRET'];
if (isProd && (!jwtSecret || jwtSecret === 'dev-secret-change-in-production')) {
  throw new Error('FATAL: JWT_SECRET environment variable must be set to a secure secret in production.');
}
jwtSecret = jwtSecret ?? 'dev-secret-change-in-production';

export const env = {
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  databaseUrl: process.env['DATABASE_URL'] ?? '',
  jwtSecret,
  clientUrl: requireEnv('CLIENT_URL', 'http://localhost:5173'),
  isDevelopment: (process.env['NODE_ENV'] ?? 'development') === 'development',
  isProduction: isProd,
} as const;
