import { parse as parseCsv } from 'csv-parse';
import Piscina from 'piscina';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import type { RawRow, ProcessedRow } from '../workers/rowProcessor.js';
import { generatePayrollReport } from './payroll.service.js';

// ─── Piscina worker pool ──────────────────────────────────────────────────────
// In dev (tsx watch), workers are .ts files loaded via the inherited tsx loader.
// In production (compiled), workers are .js files in dist/.
const isDev = process.env['NODE_ENV'] !== 'production';
const workerFile = isDev
  ? path.resolve(__dirname, '../workers/rowProcessor.ts')
  : path.resolve(__dirname, '../workers/rowProcessor.js');

function getWorkerExecArgv(): string[] {
  return process.execArgv.filter((arg) =>
    arg.startsWith('--loader') ||
    arg.startsWith('--import') ||
    arg.startsWith('--require') ||
    arg.startsWith('-r') ||
    arg.includes('tsx') ||
    arg.includes('ts-node')
  );
}

const pool = new Piscina({
  filename: workerFile,
  maxThreads: 4,
  execArgv: getWorkerExecArgv(),
  idleTimeout: 30_000,
});

// ─── File parsing ─────────────────────────────────────────────────────────────

export async function parseFileToRows(
  buffer: Buffer,
  mimetype: string,
  originalname: string,
): Promise<RawRow[]> {
  const ext = originalname.toLowerCase();

  if (ext.endsWith('.csv') || mimetype === 'text/csv' || mimetype === 'application/csv') {
    return parseCsvBuffer(buffer);
  }
  if (ext.endsWith('.json') || mimetype === 'application/json') {
    return parseJsonBuffer(buffer);
  }
  throw Object.assign(
    new Error(`Unsupported file type. Expected .csv or .json, got: ${originalname}`),
    { statusCode: 400 },
  );
}

async function parseCsvBuffer(buffer: Buffer): Promise<RawRow[]> {
  return new Promise((resolve, reject) => {
    parseCsv(
      buffer,
      {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      },
      (err, records: RawRow[]) => {
        if (err) reject(Object.assign(new Error(`CSV parse error: ${err.message}`), { statusCode: 400 }));
        else resolve(records);
      },
    );
  });
}

function parseJsonBuffer(buffer: Buffer): RawRow[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer.toString('utf-8'));
  } catch {
    throw Object.assign(new Error('Invalid JSON: could not parse file'), { statusCode: 400 });
  }

  if (!Array.isArray(parsed)) {
    throw Object.assign(new Error('JSON file must contain an array of timesheet rows'), { statusCode: 400 });
  }

  return parsed as RawRow[];
}

// ─── Duplicate / Overlap detection (in-memory across rows in a single job) ───

type RowKey = string; // `${employeeCode}|${date}|${clockIn}`

interface ShiftInterval {
  clockInMins: number;
  clockOutMins: number;
  rowIndex: number;
}

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function overlaps(a: ShiftInterval, b: ShiftInterval): boolean {
  return a.clockInMins < b.clockOutMins && b.clockInMins < a.clockOutMins;
}

// ─── Core processing function ─────────────────────────────────────────────────

export async function processJob(jobId: string, organizationId: string): Promise<void> {
  const jobLog = logger.child({ jobId, organizationId });

  // Mark as processing
  await prisma.payrollJob.update({
    where: { id: jobId },
    data: { status: 'processing', startedAt: new Date() },
  });

  jobLog.info('Job processing started');

  try {
    // Fetch all raw rows for this job (stored during upload)
    const rawRows = await prisma.timesheetRow.findMany({
      where: { jobId },
      orderBy: { createdAt: 'asc' },
    });

    const total = rawRows.length;

    // We stored raw data in errorMessage field temporarily; actual processing happens here.
    // Retrieve the raw data we stored in a temporary staging format.
    // Instead, fetch the associated raw JSON from the job's staging data.
    const job = await prisma.payrollJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');

    jobLog.info({ totalRows: total }, 'Beginning row validation via worker pool');

    // ── Pass raw rows through Piscina pool ──
    // We submit all rows to the pool; Piscina manages the queue internally.
    let rawData: RawRow[] = [];
    const rawDataField = (job as unknown as { rawData: unknown }).rawData;
    if (rawDataField) {
      if (typeof rawDataField === 'string') {
        try { rawData = JSON.parse(rawDataField); } catch {}
      } else if (Array.isArray(rawDataField)) {
        rawData = rawDataField as RawRow[];
      }
    }

    if (rawData.length === 0) {
      // Fallback: reconstruct raw rows from existing TimesheetRows for legacy/reprocessed jobs
      const existingRows = await prisma.timesheetRow.findMany({
        where: { jobId },
        orderBy: [{ date: 'asc' }, { clockIn: 'asc' }],
      });
      if (existingRows.length > 0) {
        rawData = existingRows.map((r) => ({
          employee_id: r.employeeCode,
          employee_name: r.employeeName,
          department: r.department,
          date: r.date.toISOString().slice(0, 10),
          clock_in: r.clockIn,
          clock_out: r.clockOut,
          hourly_rate: String(r.hourlyRate),
        }));
      }
    }

    if (rawData.length === 0) {
      throw Object.assign(new Error('No rows found in uploaded file'), { statusCode: 400 });
    }

    // Submit rows to worker pool in chunks to maintain low memory pressure
    const CHUNK_SIZE = 1000;
    const processed: ProcessedRow[] = [];
    for (let i = 0; i < rawData.length; i += CHUNK_SIZE) {
      const chunk = rawData.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(chunk.map((row) => pool.run(row)));
      processed.push(...chunkResults);
    }

    // ── Duplicate detection: same employee_id + date + clock_in ──
    const seenKeys = new Map<RowKey, number>(); // key → first-seen index
    // ── Overlap detection: same employee + date, overlapping shift windows ──
    const shiftsByEmpDate = new Map<string, ShiftInterval[]>();

    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    const finalRows = processed.map((row, i) => {
      // Already invalid from worker validation
      if (row.validationStatus === 'invalid') {
        invalidCount++;
        return { ...row, finalStatus: 'invalid' as const, finalError: row.errorMessage };
      }

      // Duplicate check
      const key: RowKey = `${row.employeeCode}|${row.date}|${row.clockIn}`;
      if (seenKeys.has(key)) {
        duplicateCount++;
        return { ...row, finalStatus: 'duplicate' as const, finalError: 'Duplicate row: same employee, date and clock_in already seen' };
      }
      seenKeys.set(key, i);

      // Overlap check
      const empDateKey = `${row.employeeCode}|${row.date}`;
      const existingShifts = shiftsByEmpDate.get(empDateKey) ?? [];
      const newShift: ShiftInterval = {
        clockInMins: toMins(row.clockIn),
        clockOutMins: toMins(row.clockOut),
        rowIndex: i,
      };

      const overlappingShift = existingShifts.find((s) => overlaps(s, newShift));
      if (overlappingShift) {
        duplicateCount++;
        return {
          ...row,
          finalStatus: 'duplicate' as const,
          finalError: `Overlapping shift: employee ${row.employeeCode} already has a shift on ${row.date} that overlaps ${row.clockIn}–${row.clockOut}`,
        };
      }

      shiftsByEmpDate.set(empDateKey, [...existingShifts, newShift]);
      validCount++;
      return { ...row, finalStatus: 'valid' as const, finalError: null };
    });

    jobLog.info({ validCount, invalidCount, duplicateCount }, 'Validation complete, persisting rows');

    // ── Batch Upsert / Sync Employee records (no N+1 queries) ──
    const uniqueEmps = new Map<string, { name: string; department: string }>();
    for (const row of finalRows) {
      if (row.employeeCode) {
        uniqueEmps.set(row.employeeCode, { name: row.employeeName, department: row.department });
      }
    }

    const allCodes = Array.from(uniqueEmps.keys());
    const existingEmps = await prisma.employee.findMany({
      where: { organizationId, employeeCode: { in: allCodes } },
      select: { id: true, employeeCode: true },
    });

    const existingCodeSet = new Set(existingEmps.map((e) => e.employeeCode));
    const toCreate = allCodes
      .filter((code) => !existingCodeSet.has(code))
      .map((code) => ({
        organizationId,
        employeeCode: code,
        name: uniqueEmps.get(code)!.name,
        department: uniqueEmps.get(code)!.department,
      }));

    if (toCreate.length > 0) {
      await prisma.employee.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    // Load full ID map in a single query
    const allEmps = await prisma.employee.findMany({
      where: { organizationId, employeeCode: { in: allCodes } },
      select: { id: true, employeeCode: true },
    });
    const empIdMap = new Map<string, string>(allEmps.map((e) => [e.employeeCode, e.id]));

    // ── Delete staging rows and insert processed rows in batch ──
    await prisma.timesheetRow.deleteMany({ where: { jobId } });

    const BATCH_SIZE = 500;
    for (let i = 0; i < finalRows.length; i += BATCH_SIZE) {
      const batch = finalRows.slice(i, i + BATCH_SIZE);
      await prisma.timesheetRow.createMany({
        data: batch.map((row) => ({
          jobId,
          employeeId: empIdMap.get(row.employeeCode) ?? null,
          employeeCode: row.employeeCode,
          employeeName: row.employeeName,
          department: row.department,
          date: new Date(row.date),
          clockIn: row.clockIn,
          clockOut: row.clockOut,
          hourlyRate: row.hourlyRate,
          hoursWorked: row.hoursWorked,
          regularHours: row.regularHours,
          overtimeHours: row.overtimeHours,
          grossPay: row.grossPay,
          validationStatus: row.finalStatus,
          errorMessage: row.finalError ?? null,
        })),
      });
    }

    // ── Update job counters ──
    await prisma.payrollJob.update({
      where: { id: jobId },
      data: {
        status: 'completed',
        totalRows: finalRows.length,
        processedRows: finalRows.length,
        validRows: validCount,
        invalidRows: invalidCount,
        duplicateRows: duplicateCount,
        completedAt: new Date(),
      },
    });

    jobLog.info({ validCount, invalidCount, duplicateCount }, 'Job completed successfully');

    // ── Generate/update PayrollReport ──
    await generatePayrollReport(jobId, organizationId);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    jobLog.error({ err }, 'Job failed during processing');
    await prisma.payrollJob.update({
      where: { id: jobId },
      data: { status: 'failed', errorMessage: message, completedAt: new Date() },
    }).catch(() => {});
    throw err;
  }
}
