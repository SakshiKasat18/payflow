import 'dotenv/config';

const requireEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  port: parseInt(process.env['PORT'] ?? '5000', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  databaseUrl: process.env['DATABASE_URL'] ?? '',
  jwtSecret: process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production',
  clientUrl: requireEnv('CLIENT_URL', 'http://localhost:5173'),
  isDevelopment: (process.env['NODE_ENV'] ?? 'development') === 'development',
  isProduction: process.env['NODE_ENV'] === 'production',
} as const;
