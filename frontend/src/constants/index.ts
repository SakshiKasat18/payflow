// ─── Routes ────────────────────────────────────────────────────────────────

export const ROUTES = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  DASHBOARD: '/dashboard',
  UPLOAD: '/upload',
  JOBS: '/jobs',
  PAYROLL: '/payroll',
  EMPLOYEES: '/employees',
  DEPARTMENTS: '/departments',
  REPORTS: '/reports',
  SETTINGS: '/settings',
} as const;

// ─── Format Utilities ─────────────────────────────────────────────────────────

export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

export const formatNumber = (n: number): string =>
  new Intl.NumberFormat('en-IN').format(n);

export const formatHours = (hours: number): string => {
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(hours);
  return `${formatted}h`;
};

export const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

export const formatDateShort = (iso: string): string =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
