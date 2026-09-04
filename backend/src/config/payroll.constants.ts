/**
 * PayFlow — Payroll & Overtime Business Rules Constants
 * Standard rules per assignment specifications:
 *  - Daily Overtime Threshold: 8 hours
 *  - Weekly Regular Hours Cap: 40 hours
 *  - Overtime Rate Multiplier: 1.5x
 */

export const PAYROLL_RULES = {
  DAILY_OT_THRESHOLD: 8,
  WEEKLY_REGULAR_CAP: 40,
  OT_MULTIPLIER: 1.5,
} as const;
