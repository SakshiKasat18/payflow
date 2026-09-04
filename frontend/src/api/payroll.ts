import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DepartmentMetric {
  department: string;
  employeeCount: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  totalPay: number;
  overtimePct: number;
}

export interface WeeklyTrendPoint {
  week: string;
  weekLabel: string;
  totalPay: number;
  regularPay: number;
  overtimePay: number;
  regularHours: number;
  overtimeHours: number;
}

export interface TopOvertimeEmployee {
  employeeCode: string;
  employeeName: string;
  department: string;
  totalOvertimeHours: number;
  totalHours: number;
  overtimePay: number;
  totalPay: number;
}

export interface Analytics {
  jobId: string;
  totalPayroll: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  averageHoursPerEmployee: number;
  overtimeCostPercentage: number;
  stdDeviationHours: number;
  departmentMetrics: DepartmentMetric[];
  weeklyTrend: WeeklyTrendPoint[];
  topOvertimeEmployees: TopOvertimeEmployee[];
  generatedAt: string;
}

export interface PayrollRow {
  employeeCode: string;
  employeeName: string;
  department: string;
  hourlyRate: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  regularPay: number;
  overtimePay: number;
  grossPay: number;
}

export interface EmployeePayrollDetail {
  employeeCode: string;
  employeeName: string;
  department: string;
  hourlyRate: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  grossPay: number;
  rows: {
    date: string;
    clockIn: string;
    clockOut: string;
    hoursWorked: number;
    regularHours: number;
    overtimeHours: number;
    grossPay: number;
    validationStatus: string;
  }[];
}

export interface RecentJob {
  id: string;
  filename: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  createdAt: string;
}

export interface DashboardAnalytics {
  totalPayroll: number;
  totalHours: number;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalEmployees: number;
  averageHoursPerEmployee: number;
  overtimeCostPercentage: number;
  departmentMetrics: DepartmentMetric[];
  weeklyTrend: WeeklyTrendPoint[];
  topOvertimeEmployees: TopOvertimeEmployee[];
  recentJobs: RecentJob[];
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchDashboardAnalytics(): Promise<DashboardAnalytics> {
  const { data } = await apiClient.get<{ success: true; data: DashboardAnalytics }>('/payroll/dashboard');
  return data.data;
}

export async function fetchJobPayroll(jobId: string): Promise<PayrollRow[]> {
  const { data } = await apiClient.get<{ success: true; data: PayrollRow[] }>(`/jobs/${jobId}/payroll`);
  return data.data;
}

export async function fetchJobAnalytics(jobId: string): Promise<Analytics> {
  const { data } = await apiClient.get<{ success: true; data: Analytics }>(`/jobs/${jobId}/analytics`);
  return data.data;
}

export async function fetchEmployeeDetail(jobId: string, employeeCode: string): Promise<EmployeePayrollDetail> {
  const { data } = await apiClient.get<{ success: true; data: EmployeePayrollDetail }>(
    `/jobs/${jobId}/employees/${encodeURIComponent(employeeCode)}`,
  );
  return data.data;
}

export async function regenerateAnalytics(jobId: string): Promise<Analytics> {
  const { data } = await apiClient.post<{ success: true; data: Analytics }>(`/jobs/${jobId}/analytics/generate`);
  return data.data;
}

export function getExportUrl(jobId: string): string {
  return `${apiClient.defaults.baseURL}/jobs/${jobId}/export`;
}
