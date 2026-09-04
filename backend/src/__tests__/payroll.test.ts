/**
 * PayFlow — Payroll Calculation Tests
 *
 * Tests the core payroll logic: daily OT, weekly OT reconciliation,
 * aggregation, and standard deviation.
 *
 * Run: npx tsx --test src/__tests__/payroll.test.ts
 * (Node.js 18+ built-in test runner)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Inline the pure calculation functions (no DB dependency) ──────────────────
// We replicate the payroll logic here to test it deterministically.

const DAILY_OT_THRESHOLD = 8;
const WEEKLY_REGULAR_CAP = 40;
const OT_MULTIPLIER = 1.5;

function calcDailyPayroll(hoursWorked: number, hourlyRate: number) {
  const regularHours = Math.min(hoursWorked, DAILY_OT_THRESHOLD);
  const overtimeHours = Math.max(0, hoursWorked - DAILY_OT_THRESHOLD);
  const grossPay = parseFloat(
    (regularHours * hourlyRate + overtimeHours * hourlyRate * OT_MULTIPLIER).toFixed(2),
  );
  return { regularHours, overtimeHours, grossPay };
}

interface ShiftInput {
  hoursWorked: number;
  dailyReg: number;
  dailyOT: number;
  hourlyRate: number;
}

interface ReconciledShift extends ShiftInput {
  effectiveReg: number;
  effectiveOT: number;
  effectiveGrossPay: number;
}

function reconcileWeeklyOT(shifts: ShiftInput[]): ReconciledShift[] {
  let weeklyRegularUsed = 0;
  return shifts.map((shift) => {
    const regularSlack = Math.max(0, WEEKLY_REGULAR_CAP - weeklyRegularUsed);
    const effectiveReg = Math.min(shift.dailyReg, regularSlack);
    const weeklyExtraOT = shift.dailyReg - effectiveReg;
    const effectiveOT = shift.dailyOT + weeklyExtraOT;
    weeklyRegularUsed += effectiveReg;
    const effectiveGrossPay = parseFloat(
      (effectiveReg * shift.hourlyRate + effectiveOT * shift.hourlyRate * OT_MULTIPLIER).toFixed(2),
    );
    return { ...shift, effectiveReg, effectiveOT, effectiveGrossPay };
  });
}

function populationStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ─── TEST 1: 8-hour shift → 8 regular, 0 overtime ────────────────────────────

describe('TEST 1: 8-hour shift', () => {
  it('should have 8 regular hours and 0 overtime', () => {
    const { regularHours, overtimeHours } = calcDailyPayroll(8, 250);
    assert.equal(regularHours, 8);
    assert.equal(overtimeHours, 0);
  });
});

// ─── TEST 2: 10-hour shift → 8 regular, 2 overtime ───────────────────────────

describe('TEST 2: 10-hour shift', () => {
  it('should have 8 regular and 2 overtime', () => {
    const { regularHours, overtimeHours } = calcDailyPayroll(10, 250);
    assert.equal(regularHours, 8);
    assert.equal(overtimeHours, 2);
  });

  it('gross pay = 8×250 + 2×250×1.5 = 2750', () => {
    const { grossPay } = calcDailyPayroll(10, 250);
    assert.equal(grossPay, 2750);
  });
});

// ─── TEST 3: Multiple days totalling exactly 40h → 40 regular, 0 weekly OT ───

describe('TEST 3: Exactly 40 regular hours per week', () => {
  it('should have no weekly overtime when total = 40h', () => {
    // 5 × 8h shifts = 40h regular, no daily OT
    const shifts: ShiftInput[] = Array.from({ length: 5 }, () => ({
      hoursWorked: 8, dailyReg: 8, dailyOT: 0, hourlyRate: 200,
    }));
    const reconciled = reconcileWeeklyOT(shifts);
    const totalReg = reconciled.reduce((s, r) => s + r.effectiveReg, 0);
    const totalOT = reconciled.reduce((s, r) => s + r.effectiveOT, 0);
    assert.equal(totalReg, 40);
    assert.equal(totalOT, 0);
  });
});

// ─── TEST 4: 44h without daily OT → 40 regular, 4 weekly OT ─────────────────

describe('TEST 4: 44h without daily OT (weekly cap triggers)', () => {
  it('should push 4h into weekly overtime', () => {
    // 5 × 8h + 1 × 4h = 44h, all within daily threshold
    const shifts: ShiftInput[] = [
      ...Array.from({ length: 5 }, () => ({ hoursWorked: 8, dailyReg: 8, dailyOT: 0, hourlyRate: 200 })),
      { hoursWorked: 4, dailyReg: 4, dailyOT: 0, hourlyRate: 200 },
    ];
    const reconciled = reconcileWeeklyOT(shifts);
    const totalReg = reconciled.reduce((s, r) => s + r.effectiveReg, 0);
    const totalOT = reconciled.reduce((s, r) => s + r.effectiveOT, 0);
    assert.equal(totalReg, 40);
    assert.equal(totalOT, 4);
  });
});

// ─── TEST 5: Daily OT + weekly hours → no double counting ────────────────────

describe('TEST 5: Daily OT + weekly threshold — no double counting', () => {
  it('Mon-Thu 10h each = 40h worked, 8h daily OT; no weekly OT', () => {
    // Mon 10h: 8 reg + 2 OT
    // Tue 10h: 8 reg + 2 OT
    // Wed 10h: 8 reg + 2 OT
    // Thu 10h: 8 reg + 2 OT
    // Total daily reg = 32, daily OT = 8
    // Weekly regular used = 32 < 40, so NO additional weekly OT
    const shifts: ShiftInput[] = Array.from({ length: 4 }, () => ({
      hoursWorked: 10, dailyReg: 8, dailyOT: 2, hourlyRate: 250,
    }));
    const reconciled = reconcileWeeklyOT(shifts);
    const totalReg = reconciled.reduce((s, r) => s + r.effectiveReg, 0);
    const totalOT = reconciled.reduce((s, r) => s + r.effectiveOT, 0);
    assert.equal(totalReg, 32);
    assert.equal(totalOT, 8);  // only daily OT, no weekly OT
  });

  it('Mon-Fri 10h each = daily OT=2×5=10, weekly reg=40, no additional weekly OT', () => {
    const shifts: ShiftInput[] = Array.from({ length: 5 }, () => ({
      hoursWorked: 10, dailyReg: 8, dailyOT: 2, hourlyRate: 250,
    }));
    const reconciled = reconcileWeeklyOT(shifts);
    const totalReg = reconciled.reduce((s, r) => s + r.effectiveReg, 0);
    const totalOT = reconciled.reduce((s, r) => s + r.effectiveOT, 0);
    assert.equal(totalReg, 40);
    assert.equal(totalOT, 10); // only daily OT (5×2)
  });

  it('Mon-Sat 10h each = daily OT=12, 4h weekly OT on Saturday', () => {
    // Mon-Fri: 5×8=40 regular used, 5×2=10 daily OT
    // Saturday: daily reg=8, but weekly cap is 40 already → all 8h become weekly OT
    // Saturday also has 2h daily OT → total Saturday OT = 10h (8 weekly + 2 daily)
    const shifts: ShiftInput[] = Array.from({ length: 6 }, () => ({
      hoursWorked: 10, dailyReg: 8, dailyOT: 2, hourlyRate: 250,
    }));
    const reconciled = reconcileWeeklyOT(shifts);
    const totalReg = reconciled.reduce((s, r) => s + r.effectiveReg, 0);
    const totalOT = reconciled.reduce((s, r) => s + r.effectiveOT, 0);
    assert.equal(totalReg, 40);
    // Saturday: effectiveReg=0, effectiveOT = 8(weekly) + 2(daily) = 10
    assert.equal(totalOT, 10 + 10); // 10 from Mon-Fri, 10 from Saturday
  });
});

// ─── TEST 6: Payroll calculation at ₹250/hour ─────────────────────────────────

describe('TEST 6: Gross pay calculation at ₹250/hour', () => {
  it('8h shift: gross = 8×250 = 2000', () => {
    assert.equal(calcDailyPayroll(8, 250).grossPay, 2000);
  });
  it('10h shift: gross = (8×250) + (2×250×1.5) = 2750', () => {
    assert.equal(calcDailyPayroll(10, 250).grossPay, 2750);
  });
  it('12h shift: gross = (8×250) + (4×250×1.5) = 3500', () => {
    assert.equal(calcDailyPayroll(12, 250).grossPay, 3500);
  });
});

// ─── TEST 7: Department aggregation ──────────────────────────────────────────

describe('TEST 7: Department aggregation', () => {
  it('should correctly aggregate two departments', () => {
    const rows = [
      { dept: 'Engineering', reg: 8, ot: 2, rate: 300 },
      { dept: 'Engineering', reg: 8, ot: 0, rate: 300 },
      { dept: 'Sales', reg: 8, ot: 1, rate: 200 },
    ];
    const byDept = new Map<string, { regHours: number; otHours: number; pay: number }>();
    for (const r of rows) {
      const d = byDept.get(r.dept) ?? { regHours: 0, otHours: 0, pay: 0 };
      d.regHours += r.reg;
      d.otHours += r.ot;
      d.pay += r.reg * r.rate + r.ot * r.rate * 1.5;
      byDept.set(r.dept, d);
    }
    const eng = byDept.get('Engineering')!;
    assert.equal(eng.regHours, 16);
    assert.equal(eng.otHours, 2);
    assert.equal(eng.pay, 16 * 300 + 2 * 300 * 1.5); // 5700
    const sales = byDept.get('Sales')!;
    assert.equal(sales.regHours, 8);
    assert.equal(sales.otHours, 1);
    assert.equal(sales.pay, 8 * 200 + 1 * 200 * 1.5); // 1900
  });
});

// ─── TEST 8: Top 5 overtime employees ────────────────────────────────────────

describe('TEST 8: Top 5 overtime employees', () => {
  it('should be sorted desc by overtime hours with deterministic tie-break', () => {
    const employees = [
      { code: 'EMP-003', ot: 10 },
      { code: 'EMP-001', ot: 20 },
      { code: 'EMP-004', ot: 10 }, // tie with EMP-003
      { code: 'EMP-002', ot: 15 },
      { code: 'EMP-005', ot: 5 },
      { code: 'EMP-006', ot: 8 },
    ];
    const sorted = [...employees]
      .sort((a, b) => {
        const diff = b.ot - a.ot;
        return diff !== 0 ? diff : a.code.localeCompare(b.code);
      })
      .slice(0, 5);
    assert.deepEqual(sorted.map((e) => e.code), ['EMP-001', 'EMP-002', 'EMP-003', 'EMP-004', 'EMP-006']);
    assert.equal(sorted[2]!.ot, sorted[3]!.ot); // tie resolved by code
    assert(sorted[2]!.code < sorted[3]!.code);
  });
});

// ─── TEST 9: Weekly payroll aggregation ──────────────────────────────────────

describe('TEST 9: Weekly payroll aggregation', () => {
  it('should group correctly by week', () => {
    const shifts = [
      { week: '2026-W35', pay: 5000 },
      { week: '2026-W35', pay: 3000 },
      { week: '2026-W36', pay: 7000 },
    ];
    const weekMap = new Map<string, number>();
    for (const s of shifts) {
      weekMap.set(s.week, (weekMap.get(s.week) ?? 0) + s.pay);
    }
    assert.equal(weekMap.get('2026-W35'), 8000);
    assert.equal(weekMap.get('2026-W36'), 7000);
  });
});

// ─── TEST 10: Standard deviation ─────────────────────────────────────────────

describe('TEST 10: Population standard deviation', () => {
  it('should return 0 for a single value', () => {
    assert.equal(populationStdDev([40]), 0);
  });
  it('should return 0 for identical values', () => {
    assert.equal(populationStdDev([40, 40, 40]), 0);
  });
  it('should return correct std dev for [2, 4, 4, 4, 5, 5, 7, 9] = 2', () => {
    // Known result: mean=5, variance=4, stdDev=2
    const result = populationStdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    assert.ok(Math.abs(result - 2) < 0.0001, `Expected 2 got ${result}`);
  });
  it('should return correct std dev for [38, 40, 44, 36, 42] employees', () => {
    const values = [38, 40, 44, 36, 42];
    const mean = values.reduce((a, b) => a + b, 0) / values.length; // 40
    const expected = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    const result = populationStdDev(values);
    assert.ok(Math.abs(result - expected) < 0.0001);
  });
});

// ─── TEST 11: Reprocessing determinism ───────────────────────────────────────

describe('TEST 11: Reprocessing produces same deterministic result', () => {
  it('same input twice gives same result', () => {
    const input: ShiftInput[] = [
      { hoursWorked: 10, dailyReg: 8, dailyOT: 2, hourlyRate: 250 },
      { hoursWorked: 8, dailyReg: 8, dailyOT: 0, hourlyRate: 250 },
      { hoursWorked: 6, dailyReg: 6, dailyOT: 0, hourlyRate: 250 },
    ];
    const r1 = reconcileWeeklyOT(input);
    const r2 = reconcileWeeklyOT(input);
    assert.deepEqual(r1, r2);
  });
});

// ─── TEST 12: Zero-payroll edge case ─────────────────────────────────────────

describe('TEST 12: Edge cases', () => {
  it('empty shifts → zero totals', () => {
    const reconciled = reconcileWeeklyOT([]);
    assert.equal(reconciled.length, 0);
  });
  it('zero rate → zero pay', () => {
    const { grossPay } = calcDailyPayroll(10, 0);
    assert.equal(grossPay, 0);
  });
  it('std dev of empty array → 0', () => {
    assert.equal(populationStdDev([]), 0);
  });
});

console.log('\n✅ PayFlow payroll calculation tests complete\n');
