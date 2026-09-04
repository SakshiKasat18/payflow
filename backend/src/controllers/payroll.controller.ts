import { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import {
  generatePayrollReport,
  getPayrollRows,
  getEmployeePayrollDetail,
  generateExportCsv,
  getDashboardAnalytics,
} from '../services/payroll.service.js';

interface AppError extends Error { statusCode?: number; }
function handleError(err: unknown, res: Response, next: NextFunction): void {
  const e = err as AppError;
  if (e.statusCode && e.statusCode < 500) {
    res.status(e.statusCode).json({ success: false, error: { message: e.message } });
  } else { next(err); }
}

/** Assert job belongs to the org. Returns job or throws 404. */
async function requireOrgJob(jobId: string, organizationId: string) {
  const job = await prisma.payrollJob.findFirst({ where: { id: jobId, organizationId } });
  if (!job) throw Object.assign(new Error('Job not found'), { statusCode: 404 });
  return job;
}

// GET /api/payroll/dashboard
export async function getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { organizationId } = (req as AuthenticatedRequest).user;
  try {
    const data = await getDashboardAnalytics(organizationId);
    res.json({ success: true, data });
  } catch (err) { handleError(err, res, next); }
}

// GET /api/jobs/:id/payroll
export async function getPayroll(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const { id: jobId } = req.params;
  try {
    await requireOrgJob(jobId, organizationId);
    const rows = await getPayrollRows(jobId);
    res.json({ success: true, data: rows });
  } catch (err) { handleError(err, res, next); }
}

// GET /api/jobs/:id/analytics
export async function getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const { id: jobId } = req.params;
  try {
    await requireOrgJob(jobId, organizationId);
    const report = await prisma.payrollReport.findUnique({ where: { jobId } });
    if (!report) {
      res.status(404).json({ success: false, error: { message: 'No analytics available. Job may still be processing.' } });
      return;
    }
    res.json({
      success: true,
      data: {
        jobId: report.jobId,
        totalPayroll: Number(report.totalPayroll),
        totalRegularHours: Number(report.totalRegularHours),
        totalOvertimeHours: Number(report.totalOvertimeHours),
        averageHoursPerEmployee: Number(report.averageHoursPerEmployee),
        overtimeCostPercentage: Number(report.overtimeCostPercentage),
        stdDeviationHours: Number(report.stdDeviationHours),
        departmentMetrics: report.departmentMetrics,
        weeklyTrend: report.weeklyTrend,
        topOvertimeEmployees: report.topOvertimeEmployees,
        generatedAt: report.createdAt,
      },
    });
  } catch (err) { handleError(err, res, next); }
}

// GET /api/jobs/:id/employees/:employeeCode
export async function getEmployeeDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const { id: jobId, employeeCode } = req.params;
  try {
    await requireOrgJob(jobId, organizationId);
    const detail = await getEmployeePayrollDetail(jobId, employeeCode!);
    if (!detail) {
      res.status(404).json({ success: false, error: { message: 'Employee not found in this job' } });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (err) { handleError(err, res, next); }
}

// GET /api/jobs/:id/export
export async function exportCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const { id: jobId } = req.params;
  try {
    const job = await requireOrgJob(jobId, organizationId);
    const csv = await generateExportCsv(jobId);
    const safeFilename = job.filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll_${safeFilename}"`);
    res.send(csv);
  } catch (err) { handleError(err, res, next); }
}

// POST /api/jobs/:id/analytics/generate  (manual regeneration)
export async function regenerateAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const { id: jobId } = req.params;
  try {
    const job = await requireOrgJob(jobId, organizationId);
    if (job.status !== 'completed') {
      res.status(409).json({ success: false, error: { message: 'Analytics can only be regenerated for completed jobs' } });
      return;
    }
    const report = await generatePayrollReport(jobId, organizationId);
    logger.info({ jobId }, 'PAYROLL_REPROCESS_COMPLETED');
    res.json({ success: true, data: report });
  } catch (err) { handleError(err, res, next); }
}

export async function getAnalyticsOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { organizationId } = (req as AuthenticatedRequest).user;
  try {
    const data = await getDashboardAnalytics(organizationId);
    res.json({ success: true, data });
  } catch (err) { handleError(err, res, next); }
}

// GET /api/analytics/departments
export async function getDepartmentAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { organizationId } = (req as AuthenticatedRequest).user;
  try {
    const data = await getDashboardAnalytics(organizationId);
    res.json({ success: true, data: data.departmentMetrics });
  } catch (err) { handleError(err, res, next); }
}

// GET /api/analytics/weekly-trends
export async function getWeeklyTrendsAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { organizationId } = (req as AuthenticatedRequest).user;
  try {
    const data = await getDashboardAnalytics(organizationId);
    res.json({ success: true, data: data.weeklyTrend });
  } catch (err) { handleError(err, res, next); }
}

// GET /api/analytics/export/csv
export async function exportLatestCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { organizationId } = (req as AuthenticatedRequest).user;
  try {
    const latestJob = await prisma.payrollJob.findFirst({
      where: { organizationId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });
    if (!latestJob) {
      res.status(404).json({ success: false, error: { message: 'No completed payroll job found to export' } });
      return;
    }
    const csv = await generateExportCsv(latestJob.id);
    const safeFilename = latestJob.filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll_${safeFilename}"`);
    res.send(csv);
  } catch (err) { handleError(err, res, next); }
}
