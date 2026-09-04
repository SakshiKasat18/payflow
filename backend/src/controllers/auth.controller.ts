import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

interface AppError extends Error {
  statusCode?: number;
}

function handleError(err: unknown, res: Response, next: NextFunction): void {
  const e = err as AppError;
  if (e.statusCode && e.statusCode < 500) {
    res.status(e.statusCode).json({ success: false, error: { message: e.message } });
  } else {
    next(err);
  }
}

// POST /api/auth/signup
export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.signup(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    handleError(err, res, next);
  }
}

// POST /api/auth/login
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    handleError(err, res, next);
  }
}

// GET /api/auth/me  (requires auth middleware)
export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = (req as AuthenticatedRequest).user;
    const user = await authService.getMe(userId);
    res.json({ success: true, data: user });
  } catch (err) {
    handleError(err, res, next);
  }
}
