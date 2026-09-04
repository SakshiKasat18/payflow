import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode ?? 500;
  const isProd = process.env['NODE_ENV'] === 'production';
  const message = (statusCode === 500 && isProd) ? 'Internal Server Error' : (err.message ?? 'Internal Server Error');

  logger.error({
    err,
    req: {
      method: req.method,
      url: req.url,
      ip: req.ip,
    },
    statusCode,
  }, 'Request error');

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(!isProd && { stack: err.stack }),
    },
  });
};
