import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest, UserRole } from '../types/index.js';
import { logger } from '../config/logger.js';

/**
 * requireRole — RBAC authorization middleware.
 *
 * Verifies that the authenticated user possesses one of the allowed roles.
 * Security: Role identity is derived exclusively from the verified JWT payload.
 *
 * Status codes:
 * - 401: Unauthenticated
 * - 403: Forbidden (Authenticated but insufficient role)
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user || !authReq.user.role) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required' },
      });
      return;
    }

    if (!allowedRoles.includes(authReq.user.role)) {
      logger.warn(
        {
          userId: authReq.user.userId,
          userRole: authReq.user.role,
          requiredRoles: allowedRoles,
          path: req.originalUrl,
          method: req.method,
        },
        'RBAC authorization failed: insufficient permissions',
      );

      res.status(403).json({
        success: false,
        error: { message: 'Forbidden: Insufficient permissions for this resource' },
      });
      return;
    }

    next();
  };
}
