import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  filename: string;
  status: JobStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  processedRows: number;
  durationMs: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface InvalidRowSample {
  id: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  date: string;
  clockIn: string;
  clockOut: string;
  validationStatus: string;
  errorMessage: string | null;
}

export interface JobDetail extends Job {
  invalidRowSamples: InvalidRowSample[];
}

export interface UploadResult {
  jobId: string;
  filename: string;
  totalRows: number;
  status: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function uploadTimesheet(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append('timesheet', file);
  const { data } = await apiClient.post<{ success: true; data: UploadResult }>(
    '/jobs/upload',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

export async function fetchJobs(): Promise<Job[]> {
  const { data } = await apiClient.get<{ success: true; data: Job[] }>('/jobs');
  return data.data;
}

export async function fetchJob(id: string): Promise<JobDetail> {
  const { data } = await apiClient.get<{ success: true; data: JobDetail }>(`/jobs/${id}`);
  return data.data;
}

export async function reprocessJob(id: string): Promise<{ jobId: string; status: string }> {
  const { data } = await apiClient.post<{ success: true; data: { jobId: string; status: string } }>(
    `/jobs/${id}/process`,
  );
  return data.data;
}
