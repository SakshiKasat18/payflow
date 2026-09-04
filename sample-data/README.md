# Sample Data

This directory contains sample timesheet CSV files for testing the PayFlow upload and processing engine.

## CSV Format

Timesheet uploads must be CSV files with the following headers (case-sensitive):

```
employee_id,employee_name,department,date,clock_in,clock_out,hourly_rate
```

### Field Specifications

| Field | Type | Format | Example | Rules |
|---|---|---|---|---|
| `employee_id` | string | `EMP-XXX` | `EMP-101` | Required, unique identifier |
| `employee_name` | string | Full name | `Sara Iyer` | Required |
| `department` | string | Department name | `Engineering` | Required |
| `date` | date | `YYYY-MM-DD` | `2025-01-13` | Required, must not be in the future |
| `clock_in` | time | `HH:MM` (24h) | `09:00` | Required |
| `clock_out` | time | `HH:MM` (24h) | `18:00` | Required, must be after `clock_in` |
| `hourly_rate` | number | Decimal | `25.00` | Required, must be positive |

## Sample File

```csv
employee_id,employee_name,department,date,clock_in,clock_out,hourly_rate
EMP-101,Sara Iyer,Engineering,2025-01-13,09:00,18:00,25.00
EMP-102,Karan Bhatt,Sales,2025-01-13,09:00,17:00,20.00
EMP-103,Neha Joshi,Engineering,2025-01-13,10:00,19:00,25.00
EMP-104,Vikram Das,Support,2025-01-13,08:00,20:00,18.00
EMP-105,Priya Nair,Sales,2025-01-14,09:00,17:00,20.00
EMP-106,Arjun Rao,Support,2025-01-14,09:00,17:00,18.00
```

## Validation Rules (Phase 2)

The processing engine will validate each row and flag the following:

| Validation | Error Type | Example |
|---|---|---|
| Missing required field | `MISSING_FIELD` | Empty `employee_id` |
| `clock_out` ≤ `clock_in` | `INVALID_TIME_RANGE` | `clock_in=10:00, clock_out=09:30` |
| Overlapping shifts for same employee | `OVERLAPPING_SHIFT` | Two rows for same employee, same day, overlapping times |
| Negative or zero `hourly_rate` | `INVALID_RATE` | `hourly_rate=-20.00` |
| Future date | `FUTURE_DATE` | `date=2099-01-01` |
| Duplicate row (same employee + date + clock_in) | `DUPLICATE_ROW` | Identical rows |

## Payroll Calculation (Phase 2)

```
hours_worked  = clock_out - clock_in (decimal hours)

daily_regular  = min(hours_worked, 8.0)
daily_overtime = max(hours_worked - 8.0, 0)

weekly_regular  = min(total_weekly_hours, 40.0)
weekly_overtime = max(total_weekly_hours - 40.0, 0)

gross_pay = (regular_hours × hourly_rate) + (overtime_hours × hourly_rate × 1.5)
```

## Intentionally Invalid Sample (for testing error handling)

```csv
employee_id,employee_name,department,date,clock_in,clock_out,hourly_rate
EMP-103,Neha Joshi,Engineering,2025-01-13,10:00,09:30,25.00
EMP-101,Sara Iyer,Engineering,2025-01-13,09:00,18:00,25.00
EMP-101,Sara Iyer,Engineering,2025-01-13,09:00,18:00,25.00
EMP-105,Priya Nair,Sales,2025-01-13,09:00,17:00,-20.00
EMP-106,Arjun Rao,Support,2099-01-01,09:00,17:00,18.00
```

Row 1: clock_out before clock_in  
Row 2 + 3: duplicate row  
Row 4: negative hourly_rate  
Row 5: future date  
