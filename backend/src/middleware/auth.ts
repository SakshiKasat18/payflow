import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { logger } from '../config/logger.js';

/**
 * requireAuth — JWT authentication middleware.
 *
 * Reads the Bearer token from Authorization header, verifies it,
 * and attaches the decoded payload to req.user.
 *
 * SECURITY: organizationId is always derived from the verified JWT —
 * never from query params or request body. This enforces org isolation.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required' },
      });
      return;
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    // Attach the authenticated identity — all downstream handlers use this
    (req as AuthenticatedRequest).user = payload;

    next();
  } catch (err) {
    logger.warn({ err }, 'Auth middleware: invalid token');
    res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token' },
    });
  }
}
