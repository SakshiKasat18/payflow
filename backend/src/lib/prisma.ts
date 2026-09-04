import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';

// Singleton pattern — prevents multiple Prisma Client instances in dev (tsx watch hot reload)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? [{ emit: 'stdout', level: 'error' }]
        : [{ emit: 'stdout', level: 'error' }],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

logger.debug('Prisma client initialized');
