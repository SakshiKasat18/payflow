import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import jobsRouter from './routes/jobs.js';
import payrollRouter from './routes/payroll.js';
import analyticsRouter from './routes/analytics.js';

const app = express();

// Trust reverse proxy (Render / Cloudflare / Envoy) for accurate client IP in rate limiting
app.set('trust proxy', 1);

// ─── Core Middleware ─────────────────────────────────────────────────────────

app.use(cors({
  origin: env.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/analytics', analyticsRouter);

// ─── Error Handling ──────────────────────────────────────────────────────────

app.use(notFound);
app.use(errorHandler);

// ─── Server Start ─────────────────────────────────────────────────────────────

const isTestEnv =
  process.env['NODE_ENV'] === 'test' ||
  process.argv.some((arg) => arg.includes('test') || arg.includes('__tests__'));

if (!isTestEnv) {
  const server = app.listen(env.port, '0.0.0.0', () => {
    logger.info({
      port: env.port,
      host: '0.0.0.0',
      environment: env.nodeEnv,
      clientUrl: env.clientUrl,
    }, `PayFlow API listening on 0.0.0.0:${env.port}`);
  });

  // Graceful shutdown
  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app;


