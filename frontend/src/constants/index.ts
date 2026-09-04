import type { ProcessingJob, EmployeePayroll, DepartmentPayroll, WeeklyTrend, KPIMetrics } from '@/types';

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

// ─── Mock KPI Data ────────────────────────────────────────────────────────────
// NOTE: All data below is MOCK DATA for Phase 1 UI development only.

export const MOCK_KPI: KPIMetrics = {
  totalEmployees: 126,
  totalPayroll: 482450,
  totalHours: 4218,
  overtimeHours: 632,
  changeEmployees: 12,
  changePayroll: 8.2,
  changeHours: 5,
};

// ─── Mock Processing Jobs ─────────────────────────────────────────────────────

export const MOCK_JOBS: ProcessingJob[] = [
  {
    id: 'job-001',
    fileName: 'september_timesheet.csv',
    uploadedAt: '2026-09-01T10:42:00Z',
    totalRows: 1248,
    validRows: 1236,
    invalidRows: 12,
    duplicateRows: 0,
    status: 'completed',
    processedAt: '2026-09-01T10:44:12Z',
    durationMs: 132000,
    organizationId: 'org-001',
  },
  {
    id: 'job-002',
    fileName: 'august_timesheet.csv',
    uploadedAt: '2026-08-01T09:18:00Z',
    totalRows: 982,
    validRows: 960,
    invalidRows: 22,
    duplicateRows: 0,
    status: 'completed',
    processedAt: '2026-08-01T09:20:08Z',
    durationMs: 128000,
    organizationId: 'org-001',
  },
  {
    id: 'job-003',
    fileName: 'july_timesheet.csv',
    uploadedAt: '2026-07-01T11:05:00Z',
    totalRows: 1034,
    validRows: 1002,
    invalidRows: 32,
    duplicateRows: 0,
    status: 'completed',
    processedAt: '2026-07-01T11:07:22Z',
    durationMs: 142000,
    organizationId: 'org-001',
  },
  {
    id: 'job-004',
    fileName: 'june_timesheet.csv',
    uploadedAt: '2026-06-01T16:21:00Z',
    totalRows: 876,
    validRows: 841,
    invalidRows: 35,
    duplicateRows: 0,
    status: 'failed',
    organizationId: 'org-001',
  },
  {
    id: 'job-005',
    fileName: 'may_timesheet.csv',
    uploadedAt: '2026-05-01T14:11:00Z',
    totalRows: 1122,
    validRows: 1101,
    invalidRows: 21,
    duplicateRows: 0,
    status: 'completed',
    processedAt: '2026-05-01T14:13:30Z',
    durationMs: 150000,
    organizationId: 'org-001',
  },
];

// ─── Mock Top Overtime Employees ──────────────────────────────────────────────

export const MOCK_TOP_OVERTIME: EmployeePayroll[] = [
  { employeeId: 'EMP-101', employeeName: 'Rahul Sharma', department: 'Engineering', regularHours: 168, overtimeHours: 28.5, grossPay: 42750, hourlyRate: 225 },
  { employeeId: 'EMP-102', employeeName: 'Priya Shah', department: 'Design', regularHours: 168, overtimeHours: 24.0, grossPay: 36000, hourlyRate: 190 },
  { employeeId: 'EMP-103', employeeName: 'Karan Bhatt', department: 'Sales', regularHours: 168, overtimeHours: 21.5, grossPay: 31200, hourlyRate: 170 },
  { employeeId: 'EMP-104', employeeName: 'Neha Kapoor', department: 'Operations', regularHours: 168, overtimeHours: 18.0, grossPay: 27900, hourlyRate: 150 },
  { employeeId: 'EMP-105', employeeName: 'Arjun Mehta', department: 'Support', regularHours: 168, overtimeHours: 16.5, grossPay: 24800, hourlyRate: 140 },
];

// ─── Mock Department Payroll ──────────────────────────────────────────────────

export const MOCK_DEPARTMENT_PAYROLL: DepartmentPayroll[] = [
  { department: 'Engineering', totalEmployees: 28, totalRegularHours: 4704, totalOvertimeHours: 184, totalGrossPay: 195000 },
  { department: 'Sales', totalEmployees: 22, totalRegularHours: 3696, totalOvertimeHours: 112, totalGrossPay: 128000 },
  { department: 'Design', totalEmployees: 14, totalRegularHours: 2352, totalOvertimeHours: 88, totalGrossPay: 95000 },
  { department: 'Operations', totalEmployees: 18, totalRegularHours: 3024, totalOvertimeHours: 96, totalGrossPay: 82000 },
  { department: 'HR', totalEmployees: 12, totalRegularHours: 2016, totalOvertimeHours: 64, totalGrossPay: 58000 },
  { department: 'Finance', totalEmployees: 16, totalRegularHours: 2688, totalOvertimeHours: 72, totalGrossPay: 72000 },
  { department: 'Support', totalEmployees: 16, totalRegularHours: 2688, totalOvertimeHours: 16, totalGrossPay: 52450 },
];

// ─── Mock Weekly Trend ────────────────────────────────────────────────────────

export const MOCK_WEEKLY_TREND: WeeklyTrend[] = [
  { week: 'Jul 14', totalPay: 98000, regularPay: 84000, overtimePay: 14000 },
  { week: 'Jul 21', totalPay: 105000, regularPay: 89000, overtimePay: 16000 },
  { week: 'Jul 28', totalPay: 112000, regularPay: 95000, overtimePay: 17000 },
  { week: 'Aug 4',  totalPay: 108000, regularPay: 91000, overtimePay: 17000 },
  { week: 'Aug 11', totalPay: 118000, regularPay: 100000, overtimePay: 18000 },
  { week: 'Aug 18', totalPay: 124000, regularPay: 104000, overtimePay: 20000 },
  { week: 'Aug 25', totalPay: 131000, regularPay: 110000, overtimePay: 21000 },
  { week: 'Sep 1',  totalPay: 145000, regularPay: 120000, overtimePay: 25000 },
];

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
