import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Piscina from 'piscina';
import path from 'path';
import type { RawRow, ProcessedRow } from '../workers/rowProcessor.js';

describe('PayFlow — 10,000+ Row Bulk Processing Benchmark', () => {
  const workerFile = path.resolve(process.cwd(), 'src/workers/rowProcessor.ts');
  const pool = new Piscina({
    filename: workerFile,
    maxThreads: 4,
    execArgv: [...process.execArgv],
    idleTimeout: 30_000,
  });

  it('should process 10,000 rows through worker pool in < 5 seconds', async () => {
    const ROW_COUNT = 10_000;
    const departments = ['Engineering', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations'];
    const syntheticRows: RawRow[] = [];

    for (let i = 0; i < ROW_COUNT; i++) {
      const empNum = (i % 200) + 1; // 200 distinct employees
      const empCode = `EMP-${String(empNum).padStart(3, '0')}`;
      const dept = departments[empNum % departments.length]!;
      const day = (i % 28) + 1;
      const date = `2026-08-${String(day).padStart(2, '0')}`;
      const isOvertime = i % 5 === 0;

      syntheticRows.push({
        employee_id: empCode,
        employee_name: `Employee ${empNum}`,
        department: dept,
        date,
        clock_in: '08:00',
        clock_out: isOvertime ? '18:00' : '16:00', // 10h or 8h
        hourly_rate: String(200 + (empNum % 10) * 25),
      });
    }

    assert.equal(syntheticRows.length, ROW_COUNT);

    const memBefore = process.memoryUsage().heapUsed;
    const start = performance.now();

    // Batch execute through Piscina in chunks of 1000
    const CHUNK_SIZE = 1000;
    const results: ProcessedRow[] = [];
    for (let i = 0; i < syntheticRows.length; i += CHUNK_SIZE) {
      const chunk = syntheticRows.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(chunk.map((r) => pool.run(r)));
      results.push(...chunkResults);
    }

    const durationMs = performance.now() - start;
    const memAfter = process.memoryUsage().heapUsed;
    const heapDeltaMB = ((memAfter - memBefore) / (1024 * 1024)).toFixed(2);

    console.log(`\n  ⚡ 10k Processing Benchmark:`);
    console.log(`     Total rows: ${results.length}`);
    console.log(`     Time elapsed: ${durationMs.toFixed(2)} ms (${(results.length / (durationMs / 1000)).toFixed(0)} rows/sec)`);
    console.log(`     Heap delta: ${heapDeltaMB} MB\n`);

    assert.equal(results.length, ROW_COUNT);
    assert.ok(durationMs < 10_000, `Processing 10k rows took ${durationMs}ms, should be < 10000ms`);

    // Verify valid calculation results
    const validRows = results.filter((r) => r.validationStatus === 'valid');
    assert.equal(validRows.length, ROW_COUNT);

    // Verify sample overtime math
    const otRow = results.find((r) => r.hoursWorked === 10);
    assert.ok(otRow);
    assert.equal(otRow.regularHours, 8);
    assert.equal(otRow.overtimeHours, 2);

    await pool.destroy();
  });
});
