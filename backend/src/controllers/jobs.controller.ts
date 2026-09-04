import { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import { parseFileToRows, processJob } from '../services/jobs.service.js';

interface AppError extends Error { statusCode?: number; }

function handleError(err: unknown, res: Response, next: NextFunction): void {
  const e = err as AppError;
  if (e.statusCode && e.statusCode < 500) {
    res.status(e.statusCode).json({ success: false, error: { message: e.message } });
  } else { next(err); }
}

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

// POST /api/jobs/upload  — multipart/form-data with file field "timesheet"
export async function upload(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { organizationId } = (req as AuthenticatedRequest).user;

  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ success: false, error: { message: 'No file uploaded. Send a file in the "timesheet" field.' } });
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      res.status(400).json({ success: false, error: { message: `File too large. Maximum allowed size is 50 MB.` } });
      return;
    }

    if (file.size === 0) {
      res.status(400).json({ success: false, error: { message: 'Uploaded file is empty.' } });
      return;
    }

    logger.info({ organizationId, filename: file.originalname, bytes: file.size }, 'Upload received');

    // Parse rows from buffer immediately to catch format errors early
    const rawRows = await parseFileToRows(file.buffer, file.mimetype, file.originalname);

    if (rawRows.length === 0) {
      res.status(400).json({ success: false, error: { message: 'File contains no data rows.' } });
      return;
    }

    // Validate that required columns exist
    const sample = rawRows[0];
    const required = ['employee_id', 'employee_name', 'department', 'date', 'clock_in', 'clock_out', 'hourly_rate'];
    const missing = required.filter((col) => !(col in sample));
    if (missing.length > 0) {
      res.status(400).json({
        success: false,
        error: { message: `Missing required columns: ${missing.join(', ')}` },
      });
      return;
    }

    // Create job record — store raw data as JSON for processing
    const job = await prisma.payrollJob.create({
      data: {
        organizationId,
        filename: file.originalname,
        status: 'pending',
        totalRows: rawRows.length,
        // HACK: store raw rows in errorMessage temporarily until processed
        // We use a separate field approach: cast to any for the rawData column
        ...(({ rawData: JSON.stringify(rawRows) } as unknown) as object),
      },
    });

    logger.info({ jobId: job.id, organizationId, totalRows: rawRows.length }, 'Job created, triggering processing');

    // Trigger processing async (fire-and-forget so upload responds immediately)
    processJob(job.id, organizationId).catch((err) => {
      logger.error({ jobId: job.id, err }, 'Background processing failed');
    });

    res.status(201).json({
      success: true,
      data: {
        jobId: job.id,
        filename: job.filename,
        totalRows: rawRows.length,
        status: 'pending',
      },
    });
  } catch (err) {
    handleError(err, res, next);
  }
}

// GET /api/jobs — list all jobs for the authenticated org
export async function listJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { organizationId } = (req as AuthenticatedRequest).user;
  try {
    const jobs = await prisma.payrollJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        status: true,
        totalRows: true,
        validRows: true,
        invalidRows: true,
        duplicateRows: true,
        processedRows: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        errorMessage: true,
      },
    });

    res.json({ success: true, data: jobs });
  } catch (err) {
    handleError(err, res, next);
  }
}

// GET /api/jobs/:id — single job detail (auth + org scope check)
export async function getJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const { id } = req.params;

  try {
    const job = await prisma.payrollJob.findFirst({
      where: { id, organizationId }, // org isolation enforced
      include: {
        timesheetRows: {
          where: { validationStatus: 'invalid' },
          select: {
            id: true, employeeCode: true, employeeName: true, department: true,
            date: true, clockIn: true, clockOut: true, validationStatus: true, errorMessage: true,
          },
          take: 100, // cap to avoid huge responses
        },
      },
    });

    if (!job) {
      res.status(404).json({ success: false, error: { message: 'Job not found' } });
      return;
    }

    // Compute duration in seconds
    const durationMs = job.startedAt && job.completedAt
      ? job.completedAt.getTime() - job.startedAt.getTime()
      : null;

    res.json({
      success: true,
      data: {
        id: job.id,
        filename: job.filename,
        status: job.status,
        totalRows: job.totalRows,
        validRows: job.validRows,
        invalidRows: job.invalidRows,
        duplicateRows: job.duplicateRows,
        processedRows: job.processedRows,
        durationMs,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        errorMessage: job.status === 'failed' ? job.errorMessage : null,
        invalidRowSamples: job.timesheetRows,
      },
    });
  } catch (err) {
    handleError(err, res, next);
  }
}

// POST /api/jobs/:id/process — reprocess a failed or pending job
export async function reprocess(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { organizationId } = (req as AuthenticatedRequest).user;
  const { id } = req.params;

  try {
    const job = await prisma.payrollJob.findFirst({
      where: { id, organizationId },
    });

    if (!job) {
      res.status(404).json({ success: false, error: { message: 'Job not found' } });
      return;
    }

    if (job.status === 'processing') {
      res.status(409).json({ success: false, error: { message: 'Job is already being processed' } });
      return;
    }

    // Reset job state
    await prisma.payrollJob.update({
      where: { id },
      data: {
        status: 'pending',
        errorMessage: null,
        validRows: 0,
        invalidRows: 0,
        duplicateRows: 0,
        processedRows: 0,
        startedAt: null,
        completedAt: null,
      },
    });

    logger.info({ jobId: id, organizationId }, 'Job reprocess triggered');

    processJob(id, organizationId).catch((err) => {
      logger.error({ jobId: id, err }, 'Reprocess failed');
    });

    res.json({ success: true, data: { jobId: id, status: 'pending' } });
  } catch (err) {
    handleError(err, res, next);
  }
}
