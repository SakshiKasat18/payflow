// ─── Shared backend TypeScript types ─────────────────────────────────────────

// JWT token payload — minimum identity, never include sensitive data
export interface JwtPayload {
  userId: string;
  organizationId: string;
  email: string;
}

// Authenticated request — extends Express Request
import type { Request } from 'express';
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

// Standardized API response envelope
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// Auth DTOs
export interface SignupDto {
  name: string;
  email: string;
  password: string;
  organizationName: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    organizationId: string;
    organizationName: string;
  };
}
