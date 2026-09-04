import { apiClient } from './client';
import type { User } from '@/types';

// ─── Request/Response shapes ──────────────────────────────────────────────────

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  organizationName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthUser extends User {
  organizationName: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

// ─── Auth API calls ───────────────────────────────────────────────────────────

export async function signup(payload: SignupPayload): Promise<AuthResult> {
  const { data } = await apiClient.post<{ success: true; data: AuthResult }>('/auth/signup', payload);
  return data.data;
}

export async function login(payload: LoginPayload): Promise<AuthResult> {
  const { data } = await apiClient.post<{ success: true; data: AuthResult }>('/auth/login', payload);
  return data.data;
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await apiClient.get<{ success: true; data: AuthUser }>('/auth/me');
  return data.data;
}
