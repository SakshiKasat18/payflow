import axios from 'axios';

/**
 * Central Axios instance.
 * - Reads VITE_API_URL from env (falls back to /api for Vite proxy)
 * - Automatically injects Bearer token from localStorage on every request
 * - Transforms 4xx/5xx errors into a consistent shape
 */
const API_BASE = import.meta.env['VITE_API_URL'] ?? '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ─── Request interceptor: attach auth token ───────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('payflow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor: normalize errors ──────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const message =
        error.response?.data?.error?.message ??
        error.response?.data?.message ??
        error.message ??
        'An unexpected error occurred';
      return Promise.reject(new Error(message));
    }
    return Promise.reject(error);
  },
);
