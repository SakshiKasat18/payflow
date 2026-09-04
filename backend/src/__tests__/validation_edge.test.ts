import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import processRow, { RawRow } from '../workers/rowProcessor.js';

describe('PayFlow — Validation & Edge Case Tests', () => {
  const baseValidRow: RawRow = {
    employee_id: 'EMP-001',
    employee_name: 'Alice Johnson',
    department: 'Engineering',
    date: '2026-08-04',
    clock_in: '09:00',
    clock_out: '17:00',
    hourly_rate: '250.00',
  };

  it('RULE: Valid standard 8h shift passes validation', () => {
    const res = processRow(baseValidRow);
    assert.equal(res.validationStatus, 'valid');
    assert.equal(res.hoursWorked, 8);
    assert.equal(res.regularHours, 8);
    assert.equal(res.overtimeHours, 0);
    assert.equal(res.grossPay, 2000);
    assert.equal(res.errorMessage, null);
  });

  it('RULE: Missing required fields are flagged as invalid', () => {
    const invalidRow: RawRow = { ...baseValidRow, employee_id: '' };
    const res = processRow(invalidRow);
    assert.equal(res.validationStatus, 'invalid');
    assert.ok(res.errorMessage?.includes('Missing required field: employee_id'));
  });

  it('RULE: Negative hourly rate is flagged as invalid', () => {
    const invalidRow: RawRow = { ...baseValidRow, hourly_rate: '-250' };
    const res = processRow(invalidRow);
    assert.equal(res.validationStatus, 'invalid');
    assert.ok(res.errorMessage?.includes('hourly_rate must be a positive number'));
  });

  it('RULE: Zero hourly rate is flagged as invalid', () => {
    const invalidRow: RawRow = { ...baseValidRow, hourly_rate: '0' };
    const res = processRow(invalidRow);
    assert.equal(res.validationStatus, 'invalid');
    assert.ok(res.errorMessage?.includes('hourly_rate must be a positive number'));
  });

  it('RULE: Non-numeric hourly rate is flagged as invalid', () => {
    const invalidRow: RawRow = { ...baseValidRow, hourly_rate: 'ABC' };
    const res = processRow(invalidRow);
    assert.equal(res.validationStatus, 'invalid');
    assert.ok(res.errorMessage?.includes('hourly_rate must be a positive number'));
  });

  it('RULE: Invalid date format is flagged as invalid', () => {
    const invalidRow: RawRow = { ...baseValidRow, date: 'invalid-date' };
    const res = processRow(invalidRow);
    assert.equal(res.validationStatus, 'invalid');
    assert.ok(res.errorMessage?.includes('Invalid date'));
  });

  it('RULE: Future date is flagged as invalid', () => {
    const invalidRow: RawRow = { ...baseValidRow, date: '2099-01-01' };
    const res = processRow(invalidRow);
    assert.equal(res.validationStatus, 'invalid');
    assert.ok(res.errorMessage?.includes('Date cannot be in the future'));
  });

  it('RULE: Invalid clock_in format is flagged as invalid', () => {
    const invalidRow: RawRow = { ...baseValidRow, clock_in: '25:99' };
    const res = processRow(invalidRow);
    assert.equal(res.validationStatus, 'invalid');
    assert.ok(res.errorMessage?.includes('Invalid clock_in time'));
  });

  it('RULE: Invalid clock_out format is flagged as invalid', () => {
    const invalidRow: RawRow = { ...baseValidRow, clock_out: '12:80' };
    const res = processRow(invalidRow);
    assert.equal(res.validationStatus, 'invalid');
    assert.ok(res.errorMessage?.includes('Invalid clock_out time'));
  });

  it('RULE: clock_out equal to clock_in is flagged as invalid (zero duration)', () => {
    const invalidRow: RawRow = { ...baseValidRow, clock_in: '09:00', clock_out: '09:00' };
    const res = processRow(invalidRow);
    assert.equal(res.validationStatus, 'invalid');
    assert.ok(res.errorMessage?.includes('clock_out (09:00) must be after clock_in (09:00)'));
  });

  it('RULE: clock_out before clock_in is flagged as invalid (overnight shifts rejected by rule)', () => {
    const invalidRow: RawRow = { ...baseValidRow, clock_in: '22:00', clock_out: '06:00' };
    const res = processRow(invalidRow);
    assert.equal(res.validationStatus, 'invalid');
    assert.ok(res.errorMessage?.includes('clock_out (06:00) must be after clock_in (22:00)'));
  });

  it('RULE: Daily overtime calculated correctly for 10h shift at ₹300/hr', () => {
    const shift10h: RawRow = { ...baseValidRow, clock_in: '08:00', clock_out: '18:00', hourly_rate: '300' };
    const res = processRow(shift10h);
    assert.equal(res.validationStatus, 'valid');
    assert.equal(res.hoursWorked, 10);
    assert.equal(res.regularHours, 8);
    assert.equal(res.overtimeHours, 2);
    // Gross: (8 * 300) + (2 * 300 * 1.5) = 2400 + 900 = 3300
    assert.equal(res.grossPay, 3300);
  });
});
