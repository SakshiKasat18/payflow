# Sample Data & Evaluation Fixtures

This directory contains concrete, ready-to-upload sample timesheet CSV files for evaluating the PayFlow ingestion pipeline, validation engine, and payroll calculation system.

---

## 📁 Available Sample Datasets

| File | Rows | Description / Test Scenario | Expected Outcome |
|---|---|---|---|
| [`sample_timesheet_standard_valid.csv`](sample_timesheet_standard_valid.csv) | 6 | Standard baseline multi-department valid timesheet | 6/6 rows valid, 0 errors, standard daily regular & overtime pay |
| [`sample_timesheet_edge_cases_invalid.csv`](sample_timesheet_edge_cases_invalid.csv) | 5 | Edge case testing: invalid times, duplicate shifts, negative rate, future dates | 4 rows flagged with specific validation errors, 1 row valid |
| [`sample_timesheet_weekly_overtime.csv`](sample_timesheet_weekly_overtime.csv) | 16 | Deterministic weekly 40h reconciliation test (Mon–Sat 48h, Mon–Fri 50h, Mon–Fri 40h) | Demonstrates weekly OT trigger, daily OT non-double-counting, and reconciled gross pay |
| [`sample_timesheet_100_rows.csv`](sample_timesheet_100_rows.csv) | 100 | Multi-employee (10), multi-department (5), multi-week (2 weeks) dataset | Full dashboard analytics, department aggregation, weekly trend, top overtime employees |

---

## 📋 CSV Format Specification

Timesheet uploads must be CSV files with the following required headers (case-sensitive):

```
employee_id,employee_name,department,date,clock_in,clock_out,hourly_rate
```

### Field Specifications

| Field | Type | Format | Example | Validation Rules |
|---|---|---|---|---|
| `employee_id` | string | `EMP-XXX` | `EMP-101` | Required, non-empty employee code |
| `employee_name` | string | Full name | `Sara Iyer` | Required, non-empty name |
| `department` | string | Department name | `Engineering` | Required, department classification |
| `date` | date | `YYYY-MM-DD` | `2026-08-03` | Required, valid calendar date, must not be in the future |
| `clock_in` | time | `HH:MM` (24h) | `09:00` | Required, valid 24-hour time format |
| `clock_out` | time | `HH:MM` (24h) | `18:00` | Required, must be strictly after `clock_in` on the same day |
| `hourly_rate` | number | Decimal | `250.00` | Required, strictly positive number ($> 0$) |

---

## ⚙️ Validation Rules Enforced

The PayFlow processing engine validates every row against the following constraints:

1. **Missing Required Fields**: Empty employee code, name, department, date, time, or rate.
2. **Invalid Date Format / Future Date**: Malformed dates or dates beyond current calendar date.
3. **Invalid Time Range (`clock_out <= clock_in`)**: Zero-duration or overnight shifts (rejected by specification).
4. **Invalid Hourly Rate**: Negative rates, zero rates, or non-numeric values.
5. **Duplicate Shifts**: Same employee, same date, and identical clock-in time within the same batch.
6. **Overlapping Shifts**: Overlapping time intervals for the same employee on the same date (touching boundary shifts like 08:00–12:00 and 12:00–16:00 are permitted).

---

## 💰 Payroll Calculation Rules

1. **Daily Overtime**: Standard daily threshold is **8 hours**.
   $$\text{Daily Regular Hours} = \min(\text{Hours Worked}, 8.0)$$
   $$\text{Daily Overtime Hours} = \max(0, \text{Hours Worked} - 8.0)$$

2. **Weekly Overtime Reconciliation**: Standard regular cap is **40 hours** per ISO week (Monday–Sunday).
   $$\text{Weekly Slack} = \max(0, 40.0 - \text{Weekly Regular Used})$$
   $$\text{Effective Regular Hours} = \min(\text{Daily Regular Hours}, \text{Weekly Slack})$$
   $$\text{Weekly Extra Overtime} = \text{Daily Regular Hours} - \text{Effective Regular Hours}$$
   $$\text{Total Overtime Hours} = \text{Daily Overtime Hours} + \text{Weekly Extra Overtime}$$

3. **Gross Pay**:
   $$\text{Gross Pay} = (\text{Effective Regular Hours} \times \text{Rate}) + (\text{Total Overtime Hours} \times \text{Rate} \times 1.5)$$
