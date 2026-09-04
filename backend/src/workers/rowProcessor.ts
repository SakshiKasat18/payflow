/**
 * Piscina worker — runs in a separate thread pool.
 * Validates and normalizes a single timesheet row.
 * Called once per row by the processing service.
 *
 * IMPORTANT: this file must be CommonJS-compatible (no top-level ESM imports).
 * Worker files loaded by Piscina cannot use ESM interop for dynamic import
 * inside the worker thread context. We keep all logic self-contained.
 */

export interface RawRow {
  employee_id: string;
  employee_name: string;
  department: string;
  date: string;
  clock_in: string;
  clock_out: string;
  hourly_rate: string;
  [key: string]: string; // allow extra columns
}

export interface ProcessedRow {
  employeeCode: string;
  employeeName: string;
  department: string;
  date: string;         // YYYY-MM-DD
  clockIn: string;      // HH:MM
  clockOut: string;     // HH:MM
  hourlyRate: number;
  hoursWorked: number;
  regularHours: number;
  overtimeHours: number;
  grossPay: number;
  validationStatus: 'valid' | 'invalid';
  errorMessage: string | null;
}

import { PAYROLL_RULES } from '../config/payroll.constants.js';

const { DAILY_OT_THRESHOLD, OT_MULTIPLIER } = PAYROLL_RULES;

function parseTime(t: string): { h: number; m: number } | null {
  const parts = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!parts) return null;
  const h = parseInt(parts[1], 10);
  const m = parseInt(parts[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function timeToMinutes(t: { h: number; m: number }): number {
  return t.h * 60 + t.m;
}

function minutesToHours(m: number): number {
  return parseFloat((m / 60).toFixed(4));
}

export default async function processRow(raw: RawRow): Promise<ProcessedRow> {
  const envDelay = process.env['ROW_PROCESSING_DELAY_MS'];
  const delayMs = envDelay !== undefined ? parseInt(envDelay, 10) : (process.env['NODE_ENV'] === 'test' ? 0 : 5);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const errors: string[] = [];

  // ── Required field presence ──
  const requiredFields: (keyof RawRow)[] = [
    'employee_id', 'employee_name', 'department',
    'date', 'clock_in', 'clock_out', 'hourly_rate',
  ];
  for (const f of requiredFields) {
    if (!raw[f]?.trim()) errors.push(`Missing required field: ${f}`);
  }

  if (errors.length > 0) {
    return {
      employeeCode: raw['employee_id']?.trim() ?? '',
      employeeName: raw['employee_name']?.trim() ?? '',
      department: raw['department']?.trim() ?? '',
      date: raw['date']?.trim() ?? '',
      clockIn: raw['clock_in']?.trim() ?? '',
      clockOut: raw['clock_out']?.trim() ?? '',
      hourlyRate: 0, hoursWorked: 0, regularHours: 0, overtimeHours: 0, grossPay: 0,
      validationStatus: 'invalid',
      errorMessage: errors.join('; '),
    };
  }

  const employeeCode = raw['employee_id'].trim();
  const employeeName = raw['employee_name'].trim();
  const department = raw['department'].trim();
  const dateStr = raw['date'].trim();
  const clockInStr = raw['clock_in'].trim();
  const clockOutStr = raw['clock_out'].trim();
  const hourlyRateRaw = raw['hourly_rate'].trim();

  // ── Date validation ──
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) {
    errors.push(`Invalid date: "${dateStr}"`);
  } else if (dateObj > new Date()) {
    errors.push(`Date cannot be in the future: "${dateStr}"`);
  }

  // ── Clock time validation ──
  const ciParsed = parseTime(clockInStr);
  const coParsed = parseTime(clockOutStr);
  if (!ciParsed) errors.push(`Invalid clock_in time: "${clockInStr}" (expected HH:MM)`);
  if (!coParsed) errors.push(`Invalid clock_out time: "${clockOutStr}" (expected HH:MM)`);

  // ── Hourly rate ──
  const hourlyRate = parseFloat(hourlyRateRaw);
  if (isNaN(hourlyRate) || hourlyRate <= 0) {
    errors.push(`hourly_rate must be a positive number, got: "${hourlyRateRaw}"`);
  }

  if (errors.length > 0) {
    return {
      employeeCode, employeeName, department,
      date: dateStr, clockIn: clockInStr, clockOut: clockOutStr,
      hourlyRate: isNaN(hourlyRate) ? 0 : hourlyRate,
      hoursWorked: 0, regularHours: 0, overtimeHours: 0, grossPay: 0,
      validationStatus: 'invalid',
      errorMessage: errors.join('; '),
    };
  }

  // ── clock_out after clock_in ──
  const ciMins = timeToMinutes(ciParsed!);
  const coMins = timeToMinutes(coParsed!);
  if (coMins <= ciMins) {
    errors.push(`clock_out (${clockOutStr}) must be after clock_in (${clockInStr})`);
  }

  if (errors.length > 0) {
    return {
      employeeCode, employeeName, department,
      date: dateStr, clockIn: clockInStr, clockOut: clockOutStr,
      hourlyRate, hoursWorked: 0, regularHours: 0, overtimeHours: 0, grossPay: 0,
      validationStatus: 'invalid',
      errorMessage: errors.join('; '),
    };
  }

  // ── Payroll calculation (daily overtime) ──
  const hoursWorked = minutesToHours(coMins - ciMins);
  const regularHours = Math.min(hoursWorked, DAILY_OT_THRESHOLD);
  const overtimeHours = Math.max(0, hoursWorked - DAILY_OT_THRESHOLD);
  const grossPay = parseFloat(
    (regularHours * hourlyRate + overtimeHours * hourlyRate * OT_MULTIPLIER).toFixed(2),
  );

  // Normalize date to YYYY-MM-DD
  const normalizedDate = dateObj.toISOString().slice(0, 10);

  return {
    employeeCode, employeeName, department,
    date: normalizedDate,
    clockIn: `${String(ciParsed!.h).padStart(2, '0')}:${String(ciParsed!.m).padStart(2, '0')}`,
    clockOut: `${String(coParsed!.h).padStart(2, '0')}:${String(coParsed!.m).padStart(2, '0')}`,
    hourlyRate, hoursWorked, regularHours, overtimeHours, grossPay,
    validationStatus: 'valid',
    errorMessage: null,
  };
}
