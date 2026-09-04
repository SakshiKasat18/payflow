/**
 * PayFlow — Payroll Analytics Service
 *
 * Responsibilities:
 *  1. Weekly overtime reconciliation (daily OT + weekly 40h cap, no double-counting)
 *  2. PayrollReport generation (aggregates, dept metrics, weekly trend, top OT employees)
 *  3. Payroll row listing (for Payroll page)
 *  4. Employee payroll detail (per-employee with day-by-day rows)
 *  5. CSV export
 *
 * OVERTIME ALGORITHM (documented per assignment requirement):
 *  Per row, the Phase 3 worker already computed daily OT using the 8h/day rule.
 *  This service then applies the weekly 40-regular-hour cap across all shifts
 *  for the same employee in the same ISO calendar week.
 *
 *  For each employee, grouped by ISO week (Mon-Sun):
 *    Sort rows chronologically by date, then clock_in.
 *    Track weeklyRegularUsed = 0.
 *    For each shift:
 *      rowDailyOT    = pre-computed daily overtime hours (from Phase 3 worker)
 *      rowDailyReg   = pre-computed daily regular hours (from Phase 3 worker)
 *      regularSlack  = max(0, 40 - weeklyRegularUsed)
 *      effectiveReg  = min(rowDailyReg, regularSlack)
 *      weeklyOT      = rowDailyReg - effectiveReg   (hours pushed OT by weekly cap)
 *      totalOT       = rowDailyOT + weeklyOT
 *      weeklyRegularUsed += effectiveReg
 *      grossPay = effectiveReg * rate + totalOT * rate * 1.5
 *
 *  This prevents any hour from being counted as both daily and weekly overtime.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import { stringify as csvStringify } from 'csv-stringify/sync';
import { PAYROLL_RULES } from '../config/payroll.constants.js';

// ─── Shared types (re-exported for controllers) ───────────────────────────────

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
  week: string;      // e.g. "2026-W35"
  weekLabel: string; // e.g. "Aug 25"
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

export interface PayrollReportData {
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

// ─── ISO week helpers ─────────────────────────────────────────────────────────

/** Returns "YYYY-Www" for a Date, e.g. "2026-W35". ISO 8601: week starts Monday. */
function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7; // 1=Mon … 7=Sun
  date.setUTCDate(date.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Returns "Mon D" label from an ISO week string like "2026-W35". */
function weekLabel(weekStr: string): string {
  const [year, wk] = weekStr.split('-W').map(Number);
  // Monday of that week
  const jan4 = new Date(Date.UTC(year!, 0, 4));
  const dayOfWeek = (jan4.getUTCDay() || 7) - 1; // 0=Mon
  const monday = new Date(jan4.getTime() - dayOfWeek * 86400000 + ((wk! - 1) * 7) * 86400000);
  return monday.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ─── Population std deviation ─────────────────────────────────────────────────

/** Population standard deviation of total hours per employee. */
function populationStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ─── Weekly OT reconciliation ─────────────────────────────────────────────────

interface RawTimesheetRow {
  id?: string;
  date: Date;
  clockIn: string;
  hourlyRate: Prisma.Decimal;
  hoursWorked: Prisma.Decimal | null;
  regularHours: Prisma.Decimal | null;
  overtimeHours: Prisma.Decimal | null;
  grossPay: Prisma.Decimal | null;
  employeeCode: string;
  employeeName: string;
  department: string;
  clockOut: string;
  validationStatus: string;
}

interface ReconciledRow {
  id?: string;
  date: Date;
  clockIn: string;
  clockOut: string;
  hoursWorked: number;
  effectiveRegularHours: number;
  effectiveOvertimeHours: number;
  effectiveGrossPay: number;
  hourlyRate: number;
  employeeCode: string;
  employeeName: string;
  department: string;
}

const { WEEKLY_REGULAR_CAP, OT_MULTIPLIER } = PAYROLL_RULES;

/**
 * Apply weekly 40h regular cap on top of daily OT already computed by Phase 3.
 * Returns reconciled rows with corrected regular/OT hours and gross pay.
 */
function reconcileWeeklyOvertime(rows: RawTimesheetRow[]): ReconciledRow[] {
  // Only reconcile valid rows
  const valid = rows.filter((r) => r.validationStatus === 'valid');

  // Group by employee, then by ISO week
  const byEmpWeek = new Map<string, RawTimesheetRow[]>();
  for (const row of valid) {
    const week = isoWeek(row.date);
    const key = `${row.employeeCode}||${week}`;
    const existing = byEmpWeek.get(key) ?? [];
    existing.push(row);
    byEmpWeek.set(key, existing);
  }

  const resultMap = new Map<string, ReconciledRow>();

  for (const [, weekRows] of byEmpWeek.entries()) {
    // Sort chronologically: date ASC, then clock_in ASC
    weekRows.sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      return a.clockIn.localeCompare(b.clockIn);
    });

    let weeklyRegularUsed = 0;

    for (const row of weekRows) {
      const rate = Number(row.hourlyRate);
      const dailyReg = Number(row.regularHours ?? 0);
      const dailyOT = Number(row.overtimeHours ?? 0);
      const hoursWorked = Number(row.hoursWorked ?? 0);

      // How much regular capacity remains this week?
      const regularSlack = Math.max(0, WEEKLY_REGULAR_CAP - weeklyRegularUsed);
      // Effective regular is capped at both daily limit and weekly limit
      const effectiveReg = Math.min(dailyReg, regularSlack);
      // Weekly overtime: hours pushed OT by the weekly cap (not already OT by daily rule)
      const weeklyExtraOT = dailyReg - effectiveReg;
      const effectiveOT = dailyOT + weeklyExtraOT;

      weeklyRegularUsed += effectiveReg;

      const effectiveGrossPay = parseFloat(
        (effectiveReg * rate + effectiveOT * rate * OT_MULTIPLIER).toFixed(2),
      );

      const rowKey = `${row.employeeCode}||${row.date.toISOString()}||${row.clockIn}`;
      resultMap.set(rowKey, {
        id: row.id,
        date: row.date,
        clockIn: row.clockIn,
        clockOut: row.clockOut,
        hoursWorked,
        effectiveRegularHours: parseFloat(effectiveReg.toFixed(4)),
        effectiveOvertimeHours: parseFloat(effectiveOT.toFixed(4)),
        effectiveGrossPay,
        hourlyRate: rate,
        employeeCode: row.employeeCode,
        employeeName: row.employeeName,
        department: row.department,
      });
    }
  }

  return Array.from(resultMap.values());
}

// ─── Generate / upsert PayrollReport ─────────────────────────────────────────

export async function generatePayrollReport(jobId: string, organizationId: string): Promise<PayrollReportData> {
  const jobLog = logger.child({ jobId, organizationId });
  jobLog.info('PAYROLL_CALCULATION_STARTED');

  // Fetch all valid rows for this job
  const rawRows = await prisma.timesheetRow.findMany({
    where: { jobId, validationStatus: 'valid' },
    select: {
      id: true,
      date: true, clockIn: true, clockOut: true,
      hourlyRate: true, hoursWorked: true,
      regularHours: true, overtimeHours: true, grossPay: true,
      employeeCode: true, employeeName: true, department: true,
      validationStatus: true,
    },
    orderBy: [{ date: 'asc' }, { clockIn: 'asc' }],
  });

  if (rawRows.length === 0) {
    jobLog.warn('No valid rows found, generating zero report');
    return buildZeroReport(jobId);
  }

  // Apply weekly OT reconciliation
  const reconciled = reconcileWeeklyOvertime(rawRows as RawTimesheetRow[]);

  // ── Persist reconciled regularHours, overtimeHours, and grossPay back to TimesheetRow in database ──
  const rowsToUpdate = reconciled.filter((r) => r.id);
  const UPDATE_BATCH_SIZE = 250;
  for (let i = 0; i < rowsToUpdate.length; i += UPDATE_BATCH_SIZE) {
    const batch = rowsToUpdate.slice(i, i + UPDATE_BATCH_SIZE);
    await prisma.$transaction(
      batch.map((r) =>
        prisma.timesheetRow.update({
          where: { id: r.id },
          data: {
            regularHours: r.effectiveRegularHours,
            overtimeHours: r.effectiveOvertimeHours,
            grossPay: r.effectiveGrossPay,
          },
        }),
      ),
    );
  }

  jobLog.info({ reconciledRows: reconciled.length }, 'PAYROLL_CALCULATION_COMPLETED');

  // ── Company-wide aggregates ──
  const totalRegularHours = reconciled.reduce((s, r) => s + r.effectiveRegularHours, 0);
  const totalOvertimeHours = reconciled.reduce((s, r) => s + r.effectiveOvertimeHours, 0);
  const totalPayroll = reconciled.reduce((s, r) => s + r.effectiveGrossPay, 0);
  const totalOvertimePay = reconciled.reduce(
    (s, r) => s + r.effectiveOvertimeHours * r.hourlyRate * OT_MULTIPLIER, 0,
  );
  const uniqueEmployees = new Set(reconciled.map((r) => r.employeeCode));
  const employeeCount = uniqueEmployees.size;
  const averageHoursPerEmployee = employeeCount > 0
    ? (totalRegularHours + totalOvertimeHours) / employeeCount
    : 0;
  const overtimeCostPercentage = totalPayroll > 0
    ? (totalOvertimePay / totalPayroll) * 100
    : 0;

  // ── Std deviation of total hours per employee ──
  const hoursByEmployee = new Map<string, number>();
  for (const r of reconciled) {
    hoursByEmployee.set(r.employeeCode, (hoursByEmployee.get(r.employeeCode) ?? 0) + r.hoursWorked);
  }
  const stdDeviationHours = populationStdDev(Array.from(hoursByEmployee.values()));

  // ── Department metrics ──
  const deptMap = new Map<string, {
    employees: Set<string>;
    totalHours: number; regularHours: number; overtimeHours: number;
    regularPay: number; overtimePay: number; totalPay: number;
  }>();

  for (const r of reconciled) {
    const d = deptMap.get(r.department) ?? {
      employees: new Set(), totalHours: 0, regularHours: 0,
      overtimeHours: 0, regularPay: 0, overtimePay: 0, totalPay: 0,
    };
    d.employees.add(r.employeeCode);
    d.totalHours += r.hoursWorked;
    d.regularHours += r.effectiveRegularHours;
    d.overtimeHours += r.effectiveOvertimeHours;
    d.regularPay += r.effectiveRegularHours * r.hourlyRate;
    d.overtimePay += r.effectiveOvertimeHours * r.hourlyRate * OT_MULTIPLIER;
    d.totalPay += r.effectiveGrossPay;
    deptMap.set(r.department, d);
  }

  const departmentMetrics: DepartmentMetric[] = Array.from(deptMap.entries())
    .map(([dept, d]) => ({
      department: dept,
      employeeCount: d.employees.size,
      totalHours: parseFloat(d.totalHours.toFixed(2)),
      regularHours: parseFloat(d.regularHours.toFixed(2)),
      overtimeHours: parseFloat(d.overtimeHours.toFixed(2)),
      regularPay: parseFloat(d.regularPay.toFixed(2)),
      overtimePay: parseFloat(d.overtimePay.toFixed(2)),
      totalPay: parseFloat(d.totalPay.toFixed(2)),
      overtimePct: d.totalPay > 0 ? parseFloat(((d.overtimePay / d.totalPay) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.totalPay - a.totalPay);

  // ── Weekly trend ──
  const weekMap = new Map<string, { regularPay: number; overtimePay: number; regularHours: number; overtimeHours: number }>();
  for (const r of reconciled) {
    const wk = isoWeek(r.date);
    const w = weekMap.get(wk) ?? { regularPay: 0, overtimePay: 0, regularHours: 0, overtimeHours: 0 };
    w.regularPay += r.effectiveRegularHours * r.hourlyRate;
    w.overtimePay += r.effectiveOvertimeHours * r.hourlyRate * OT_MULTIPLIER;
    w.regularHours += r.effectiveRegularHours;
    w.overtimeHours += r.effectiveOvertimeHours;
    weekMap.set(wk, w);
  }

  const weeklyTrend: WeeklyTrendPoint[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([wk, w]) => ({
      week: wk,
      weekLabel: weekLabel(wk),
      totalPay: parseFloat((w.regularPay + w.overtimePay).toFixed(2)),
      regularPay: parseFloat(w.regularPay.toFixed(2)),
      overtimePay: parseFloat(w.overtimePay.toFixed(2)),
      regularHours: parseFloat(w.regularHours.toFixed(2)),
      overtimeHours: parseFloat(w.overtimeHours.toFixed(2)),
    }));

  // ── Top 5 overtime employees ──
  const empMap = new Map<string, {
    name: string; dept: string;
    overtimeHours: number; totalHours: number;
    overtimePay: number; totalPay: number;
  }>();

  for (const r of reconciled) {
    const e = empMap.get(r.employeeCode) ?? {
      name: r.employeeName, dept: r.department,
      overtimeHours: 0, totalHours: 0, overtimePay: 0, totalPay: 0,
    };
    e.overtimeHours += r.effectiveOvertimeHours;
    e.totalHours += r.hoursWorked;
    e.overtimePay += r.effectiveOvertimeHours * r.hourlyRate * OT_MULTIPLIER;
    e.totalPay += r.effectiveGrossPay;
    empMap.set(r.employeeCode, e);
  }

  const topOvertimeEmployees: TopOvertimeEmployee[] = Array.from(empMap.entries())
    .map(([code, e]) => ({
      employeeCode: code,
      employeeName: e.name,
      department: e.dept,
      totalOvertimeHours: parseFloat(e.overtimeHours.toFixed(2)),
      totalHours: parseFloat(e.totalHours.toFixed(2)),
      overtimePay: parseFloat(e.overtimePay.toFixed(2)),
      totalPay: parseFloat(e.totalPay.toFixed(2)),
    }))
    .sort((a, b) => {
      const diff = b.totalOvertimeHours - a.totalOvertimeHours;
      return diff !== 0 ? diff : a.employeeCode.localeCompare(b.employeeCode); // deterministic tie-break
    })
    .slice(0, 5);

  const reportData: PayrollReportData = {
    jobId,
    totalPayroll: parseFloat(totalPayroll.toFixed(2)),
    totalRegularHours: parseFloat(totalRegularHours.toFixed(2)),
    totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
    averageHoursPerEmployee: parseFloat(averageHoursPerEmployee.toFixed(2)),
    overtimeCostPercentage: parseFloat(overtimeCostPercentage.toFixed(2)),
    stdDeviationHours: parseFloat(stdDeviationHours.toFixed(2)),
    departmentMetrics,
    weeklyTrend,
    topOvertimeEmployees,
  };

  // ── Upsert PayrollReport (idempotent) ──
  await prisma.payrollReport.upsert({
    where: { jobId },
    update: {
      totalPayroll: reportData.totalPayroll,
      totalRegularHours: reportData.totalRegularHours,
      totalOvertimeHours: reportData.totalOvertimeHours,
      averageHoursPerEmployee: reportData.averageHoursPerEmployee,
      overtimeCostPercentage: reportData.overtimeCostPercentage,
      stdDeviationHours: reportData.stdDeviationHours,
      departmentMetrics: reportData.departmentMetrics as unknown as Prisma.InputJsonValue,
      weeklyTrend: reportData.weeklyTrend as unknown as Prisma.InputJsonValue,
      topOvertimeEmployees: reportData.topOvertimeEmployees as unknown as Prisma.InputJsonValue,
    },
    create: {
      jobId,
      totalPayroll: reportData.totalPayroll,
      totalRegularHours: reportData.totalRegularHours,
      totalOvertimeHours: reportData.totalOvertimeHours,
      averageHoursPerEmployee: reportData.averageHoursPerEmployee,
      overtimeCostPercentage: reportData.overtimeCostPercentage,
      stdDeviationHours: reportData.stdDeviationHours,
      departmentMetrics: reportData.departmentMetrics as unknown as Prisma.InputJsonValue,
      weeklyTrend: reportData.weeklyTrend as unknown as Prisma.InputJsonValue,
      topOvertimeEmployees: reportData.topOvertimeEmployees as unknown as Prisma.InputJsonValue,
    },
  });

  jobLog.info('PAYROLL_REPORT_GENERATED');
  return reportData;
}

function buildZeroReport(jobId: string): PayrollReportData {
  return {
    jobId,
    totalPayroll: 0, totalRegularHours: 0, totalOvertimeHours: 0,
    averageHoursPerEmployee: 0, overtimeCostPercentage: 0, stdDeviationHours: 0,
    departmentMetrics: [], weeklyTrend: [], topOvertimeEmployees: [],
  };
}

// ─── Payroll row listing (for Payroll page) ───────────────────────────────────

export async function getPayrollRows(jobId: string): Promise<PayrollRow[]> {
  const rows = await prisma.timesheetRow.findMany({
    where: { jobId, validationStatus: 'valid' },
    select: {
      id: true,
      employeeCode: true, employeeName: true, department: true,
      hourlyRate: true, hoursWorked: true,
      regularHours: true, overtimeHours: true, grossPay: true,
      date: true, clockIn: true, clockOut: true,
      validationStatus: true,
    },
    orderBy: [{ date: 'asc' }, { clockIn: 'asc' }],
  });

  const reconciled = reconcileWeeklyOvertime(rows as RawTimesheetRow[]);

  // Aggregate by employee
  const byEmp = new Map<string, PayrollRow>();
  for (const r of reconciled) {
    const existing = byEmp.get(r.employeeCode);
    if (existing) {
      existing.totalHours = parseFloat((existing.totalHours + r.hoursWorked).toFixed(2));
      existing.regularHours = parseFloat((existing.regularHours + r.effectiveRegularHours).toFixed(2));
      existing.overtimeHours = parseFloat((existing.overtimeHours + r.effectiveOvertimeHours).toFixed(2));
      existing.regularPay = parseFloat((existing.regularPay + r.effectiveRegularHours * r.hourlyRate).toFixed(2));
      existing.overtimePay = parseFloat((existing.overtimePay + r.effectiveOvertimeHours * r.hourlyRate * OT_MULTIPLIER).toFixed(2));
      existing.grossPay = parseFloat((existing.grossPay + r.effectiveGrossPay).toFixed(2));
    } else {
      byEmp.set(r.employeeCode, {
        employeeCode: r.employeeCode,
        employeeName: r.employeeName,
        department: r.department,
        hourlyRate: r.hourlyRate,
        totalHours: parseFloat(r.hoursWorked.toFixed(2)),
        regularHours: parseFloat(r.effectiveRegularHours.toFixed(2)),
        overtimeHours: parseFloat(r.effectiveOvertimeHours.toFixed(2)),
        regularPay: parseFloat((r.effectiveRegularHours * r.hourlyRate).toFixed(2)),
        overtimePay: parseFloat((r.effectiveOvertimeHours * r.hourlyRate * OT_MULTIPLIER).toFixed(2)),
        grossPay: parseFloat(r.effectiveGrossPay.toFixed(2)),
      });
    }
  }

  return Array.from(byEmp.values()).sort((a, b) => a.employeeCode.localeCompare(b.employeeCode));
}

// ─── Employee payroll detail ──────────────────────────────────────────────────

export async function getEmployeePayrollDetail(
  jobId: string,
  employeeCode: string,
): Promise<EmployeePayrollDetail | null> {
  const cleanCode = employeeCode.trim();
  const rows = await prisma.timesheetRow.findMany({
    where: {
      jobId,
      OR: [
        { employeeCode: { equals: cleanCode, mode: 'insensitive' } },
        { employeeCode: { equals: cleanCode.replace(/[-_]/g, ''), mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      date: true, clockIn: true, clockOut: true,
      hourlyRate: true, hoursWorked: true,
      regularHours: true, overtimeHours: true, grossPay: true,
      employeeCode: true, employeeName: true, department: true,
      validationStatus: true,
    },
    orderBy: [{ date: 'asc' }, { clockIn: 'asc' }],
  });

  if (rows.length === 0) return null;

  const firstRow = rows[0]!;
  const reconciled = reconcileWeeklyOvertime(rows as RawTimesheetRow[]);

  // Build day-level detail rows
  const detailRows = reconciled.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    clockIn: r.clockIn,
    clockOut: r.clockOut,
    hoursWorked: parseFloat(r.hoursWorked.toFixed(2)),
    regularHours: parseFloat(r.effectiveRegularHours.toFixed(2)),
    overtimeHours: parseFloat(r.effectiveOvertimeHours.toFixed(2)),
    grossPay: parseFloat(r.effectiveGrossPay.toFixed(2)),
    validationStatus: 'valid',
  }));

  const totalHours = detailRows.reduce((s, r) => s + r.hoursWorked, 0);
  const regularHours = detailRows.reduce((s, r) => s + r.regularHours, 0);
  const overtimeHours = detailRows.reduce((s, r) => s + r.overtimeHours, 0);
  const grossPay = detailRows.reduce((s, r) => s + r.grossPay, 0);

  return {
    employeeCode: firstRow.employeeCode,
    employeeName: firstRow.employeeName,
    department: firstRow.department,
    hourlyRate: Number(firstRow.hourlyRate),
    totalHours: parseFloat(totalHours.toFixed(2)),
    regularHours: parseFloat(regularHours.toFixed(2)),
    overtimeHours: parseFloat(overtimeHours.toFixed(2)),
    grossPay: parseFloat(grossPay.toFixed(2)),
    rows: detailRows,
  };
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export async function generateExportCsv(jobId: string): Promise<string> {
  const rows = await prisma.timesheetRow.findMany({
    where: { jobId },
    select: {
      id: true,
      employeeCode: true, employeeName: true, department: true,
      date: true, clockIn: true, clockOut: true, hourlyRate: true,
      hoursWorked: true, regularHours: true, overtimeHours: true,
      grossPay: true, validationStatus: true, errorMessage: true,
    },
    orderBy: [{ date: 'asc' }, { clockIn: 'asc' }],
  });

  // Reconcile weekly overtime across all valid rows
  const validRows = rows.filter((r) => r.validationStatus === 'valid');
  const reconciled = reconcileWeeklyOvertime(validRows as RawTimesheetRow[]);
  const reconciledMap = new Map<string, ReconciledRow>();
  for (const r of reconciled) {
    if (r.id) {
      reconciledMap.set(r.id, r);
    } else {
      const key = `${r.employeeCode}||${r.date.toISOString()}||${r.clockIn}`;
      reconciledMap.set(key, r);
    }
  }

  const records = rows.map((r) => {
    const key = `${r.employeeCode}||${r.date.toISOString()}||${r.clockIn}`;
    const rec = r.id ? reconciledMap.get(r.id) : reconciledMap.get(key);

    const regularHours = rec ? rec.effectiveRegularHours : (r.regularHours ? Number(r.regularHours) : null);
    const overtimeHours = rec ? rec.effectiveOvertimeHours : (r.overtimeHours ? Number(r.overtimeHours) : null);
    const grossPay = rec ? rec.effectiveGrossPay : (r.grossPay ? Number(r.grossPay) : null);

    return {
      employee_id: r.employeeCode,
      employee_name: r.employeeName,
      department: r.department,
      date: r.date.toISOString().slice(0, 10),
      clock_in: r.clockIn,
      clock_out: r.clockOut,
      hourly_rate: Number(r.hourlyRate).toFixed(2),
      hours_worked: r.hoursWorked ? Number(r.hoursWorked).toFixed(2) : '',
      regular_hours: regularHours !== null ? regularHours.toFixed(2) : '',
      overtime_hours: overtimeHours !== null ? overtimeHours.toFixed(2) : '',
      gross_pay: grossPay !== null ? grossPay.toFixed(2) : '',
      validation_status: r.validationStatus,
      error_message: r.errorMessage ?? '',
    };
  });

  const csv = csvStringify(records, { header: true });
  logger.info({ jobId, rowCount: records.length }, 'EXPORT_GENERATED');
  return csv;
}

// ─── Dashboard analytics (cross-job, org-scoped) ─────────────────────────────

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
  recentJobs: {
    id: string; filename: string; status: string;
    totalRows: number; validRows: number; invalidRows: number; createdAt: Date;
  }[];
}

export async function getDashboardAnalytics(organizationId: string): Promise<DashboardAnalytics> {
  // Find the most recent completed job for this org
  const latestReport = await prisma.payrollReport.findFirst({
    where: { job: { organizationId } },
    orderBy: { createdAt: 'desc' },
    include: { job: true },
  });

  // Recent 5 jobs
  const recentJobs = await prisma.payrollJob.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true, filename: true, status: true,
      totalRows: true, validRows: true, invalidRows: true, createdAt: true,
    },
  });

  if (!latestReport) {
    return {
      totalPayroll: 0, totalHours: 0, totalRegularHours: 0, totalOvertimeHours: 0,
      totalEmployees: 0, averageHoursPerEmployee: 0, overtimeCostPercentage: 0,
      departmentMetrics: [], weeklyTrend: [], topOvertimeEmployees: [],
      recentJobs,
    };
  }

  const r = latestReport;
  const totalHours = Number(r.totalRegularHours) + Number(r.totalOvertimeHours);

  // Count distinct employees in latest report's job
  const empCount = await prisma.timesheetRow.groupBy({
    by: ['employeeCode'],
    where: { jobId: r.jobId, validationStatus: 'valid' },
    _count: { employeeCode: true },
  });

  return {
    totalPayroll: Number(r.totalPayroll),
    totalHours,
    totalRegularHours: Number(r.totalRegularHours),
    totalOvertimeHours: Number(r.totalOvertimeHours),
    totalEmployees: empCount.length,
    averageHoursPerEmployee: Number(r.averageHoursPerEmployee),
    overtimeCostPercentage: Number(r.overtimeCostPercentage),
    departmentMetrics: r.departmentMetrics as unknown as DepartmentMetric[],
    weeklyTrend: r.weeklyTrend as unknown as WeeklyTrendPoint[],
    topOvertimeEmployees: r.topOvertimeEmployees as unknown as TopOvertimeEmployee[],
    recentJobs,
  };
}
