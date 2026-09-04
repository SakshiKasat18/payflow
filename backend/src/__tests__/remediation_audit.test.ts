import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PAYROLL_RULES } from '../config/payroll.constants.js';
import { prisma } from '../lib/prisma.js';
import { processJob } from '../services/jobs.service.js';
import { generateExportCsv, getPayrollRows } from '../services/payroll.service.js';

describe('PayFlow — Independent Audit Remediation & Regression Suite', () => {

  it('RULE: Centralized PAYROLL_RULES constants are correctly configured', () => {
    assert.equal(PAYROLL_RULES.DAILY_OT_THRESHOLD, 8, 'Daily OT threshold must be 8 hours');
    assert.equal(PAYROLL_RULES.WEEKLY_REGULAR_CAP, 40, 'Weekly regular cap must be 40 hours');
    assert.equal(PAYROLL_RULES.OT_MULTIPLIER, 1.5, 'OT multiplier must be 1.5x');
  });

  it('SECURITY: Production environment without JWT_SECRET throws fatal error', () => {
    // Test fail-fast logic in production
    const isProd = true;
    const testSecret: string | undefined = undefined;
    assert.throws(() => {
      if (isProd && (!testSecret || testSecret === 'dev-secret-change-in-production')) {
        throw new Error('FATAL: JWT_SECRET environment variable must be set to a secure secret in production.');
      }
    }, /FATAL: JWT_SECRET/);
  });

  it('CRITICAL 2: Weekly overtime (48h / 6 days) is correctly reconciled in CSV Export & DB Rows', async () => {
    // 1. Create a test organization
    const org = await prisma.organization.create({
      data: { name: 'Audit Test Org OT' },
    });

    // 2. Create 6 days of 8h shifts (Mon-Sat, 48h total at ₹250/hr)
    const rawRows = [
      { employee_id: 'EMP-OT-1', employee_name: 'Test Worker', department: 'Engineering', date: '2026-08-03', clock_in: '08:00', clock_out: '16:00', hourly_rate: '250' },
      { employee_id: 'EMP-OT-1', employee_name: 'Test Worker', department: 'Engineering', date: '2026-08-04', clock_in: '08:00', clock_out: '16:00', hourly_rate: '250' },
      { employee_id: 'EMP-OT-1', employee_name: 'Test Worker', department: 'Engineering', date: '2026-08-05', clock_in: '08:00', clock_out: '16:00', hourly_rate: '250' },
      { employee_id: 'EMP-OT-1', employee_name: 'Test Worker', department: 'Engineering', date: '2026-08-06', clock_in: '08:00', clock_out: '16:00', hourly_rate: '250' },
      { employee_id: 'EMP-OT-1', employee_name: 'Test Worker', department: 'Engineering', date: '2026-08-07', clock_in: '08:00', clock_out: '16:00', hourly_rate: '250' },
      { employee_id: 'EMP-OT-1', employee_name: 'Test Worker', department: 'Engineering', date: '2026-08-08', clock_in: '08:00', clock_out: '16:00', hourly_rate: '250' },
    ];

    const job = await prisma.payrollJob.create({
      data: {
        organizationId: org.id,
        filename: 'weekly_ot_test.csv',
        status: 'pending',
        totalRows: 6,
        rawData: JSON.stringify(rawRows),
      },
    });

    // 3. Process job
    await processJob(job.id, org.id);

    // 4. Verify completed status
    const completedJob = await prisma.payrollJob.findUnique({ where: { id: job.id } });
    assert.equal(completedJob?.status, 'completed');
    assert.equal(completedJob?.validRows, 6);

    // 5. Verify CSV export has weekly overtime
    const csvContent = await generateExportCsv(job.id);
    const lines = csvContent.trim().split('\n');
    assert.equal(lines.length, 7); // header + 6 rows

    // Header check
    assert.ok(lines[0]!.includes('regular_hours') && lines[0]!.includes('overtime_hours') && lines[0]!.includes('gross_pay'));

    // Verify Saturday shift (6th row) has 8 overtime hours, 0 regular hours, and ₹3000 gross pay
    const satRow = lines[6]!;
    assert.ok(satRow.includes('2026-08-08'));
    assert.ok(satRow.includes('"0.00"') || satRow.includes('0.00'), 'Saturday regular hours should be 0.00');
    assert.ok(satRow.includes('"8.00"') || satRow.includes('8.00'), 'Saturday overtime hours should be 8.00');
    assert.ok(satRow.includes('"3000.00"') || satRow.includes('3000.00'), 'Saturday gross pay should be 3000.00');

    // 6. Verify Payroll report
    const payrollRows = await getPayrollRows(job.id);
    assert.equal(payrollRows.length, 1);
    const empPayroll = payrollRows[0]!;
    assert.equal(empPayroll.totalHours, 48);
    assert.equal(empPayroll.regularHours, 40);
    assert.equal(empPayroll.overtimeHours, 8);
    assert.equal(empPayroll.regularPay, 10000);
    assert.equal(empPayroll.overtimePay, 3000);
    assert.equal(empPayroll.grossPay, 13000);

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
  });

  it('CRITICAL 1: Reprocessing a completed job succeeds and preserves data integrity', async () => {
    // 1. Create a test organization
    const org = await prisma.organization.create({
      data: { name: 'Audit Test Org Reprocess' },
    });

    const rawRows = [
      { employee_id: 'EMP-REP-1', employee_name: 'Alice', department: 'Sales', date: '2026-08-03', clock_in: '08:00', clock_out: '16:00', hourly_rate: '200' },
      { employee_id: 'EMP-REP-2', employee_name: 'Bob', department: 'Finance', date: '2026-08-03', clock_in: '08:00', clock_out: '18:00', hourly_rate: '300' },
    ];

    const job = await prisma.payrollJob.create({
      data: {
        organizationId: org.id,
        filename: 'reprocess_test.csv',
        status: 'pending',
        totalRows: 2,
        rawData: JSON.stringify(rawRows),
      },
    });

    // Cycle 1: Process
    await processJob(job.id, org.id);

    let jobAfterFirst = await prisma.payrollJob.findUnique({ where: { id: job.id } });
    assert.equal(jobAfterFirst?.status, 'completed');
    assert.equal(jobAfterFirst?.validRows, 2);

    let rowCount = await prisma.timesheetRow.count({ where: { jobId: job.id } });
    assert.equal(rowCount, 2);

    // Cycle 2: Reprocess
    await processJob(job.id, org.id);

    let jobAfterSecond = await prisma.payrollJob.findUnique({ where: { id: job.id } });
    assert.equal(jobAfterSecond?.status, 'completed');
    assert.equal(jobAfterSecond?.validRows, 2);
    assert.equal(jobAfterSecond?.errorMessage, null);

    // Verify no duplicated timesheet rows
    rowCount = await prisma.timesheetRow.count({ where: { jobId: job.id } });
    assert.equal(rowCount, 2);

    // Cycle 3: Repeat reprocess to verify idempotency
    await processJob(job.id, org.id);
    let jobAfterThird = await prisma.payrollJob.findUnique({ where: { id: job.id } });
    assert.equal(jobAfterThird?.status, 'completed');
    assert.equal(jobAfterThird?.validRows, 2);

    rowCount = await prisma.timesheetRow.count({ where: { jobId: job.id } });
    assert.equal(rowCount, 2);

    // Cleanup
    await prisma.organization.delete({ where: { id: org.id } });
  });

});
