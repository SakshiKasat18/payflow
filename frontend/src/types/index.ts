// ─── API Response Wrappers ────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'hr' | 'employee';

export interface User {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// ─── Processing Job ───────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ProcessingJob {
  id: string;
  fileName: string;
  uploadedAt: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  status: JobStatus;
  processedAt?: string;
  durationMs?: number;
  organizationId: string;
}

// ─── Timesheet Row ────────────────────────────────────────────────────────────

export type RowStatus = 'valid' | 'invalid' | 'duplicate';

export interface TimesheetRow {
  id: string;
  jobId: string;
  employeeId: string;
  employeeName: string;
  department: string;
  date: string;
  clockIn: string;
  clockOut: string;
  hourlyRate: number;
  hoursWorked?: number;
  regularHours?: number;
  overtimeHours?: number;
  grossPay?: number;
  status: RowStatus;
  validationErrors?: string[];
}

// ─── Payroll ─────────────────────────────────────────────────────────────────

export interface PayrollSummary {
  jobId: string;
  periodStart: string;
  periodEnd: string;
  totalEmployees: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalGrossPay: number;
  overtimeCostPercent: number;
}

export interface EmployeePayroll {
  employeeId: string;
  employeeName: string;
  department: string;
  regularHours: number;
  overtimeHours: number;
  grossPay: number;
  hourlyRate: number;
}

export interface DepartmentPayroll {
  department: string;
  totalEmployees: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalGrossPay: number;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface WeeklyTrend {
  week: string;
  totalPay: number;
  regularPay: number;
  overtimePay: number;
}

export interface KPIMetrics {
  totalEmployees: number;
  totalPayroll: number;
  totalHours: number;
  overtimeHours: number;
  changeEmployees?: number;
  changePayroll?: number;
  changeHours?: number;
}

// ─── Table Utilities ──────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc';

export interface SortConfig<T> {
  key: keyof T;
  direction: SortDirection;
}

export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  className?: string;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}
