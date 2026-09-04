-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('valid', 'invalid', 'duplicate');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_jobs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'pending',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timesheet_rows" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "employeeId" TEXT,
    "employeeCode" TEXT NOT NULL,
    "employeeName" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clockIn" TEXT NOT NULL,
    "clockOut" TEXT NOT NULL,
    "hourlyRate" DECIMAL(10,2) NOT NULL,
    "hoursWorked" DECIMAL(8,2),
    "regularHours" DECIMAL(8,2),
    "overtimeHours" DECIMAL(8,2),
    "grossPay" DECIMAL(12,2),
    "validationStatus" "ValidationStatus" NOT NULL DEFAULT 'valid',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_reports" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "totalPayroll" DECIMAL(14,2) NOT NULL,
    "totalRegularHours" DECIMAL(10,2) NOT NULL,
    "totalOvertimeHours" DECIMAL(10,2) NOT NULL,
    "averageHoursPerEmployee" DECIMAL(8,2) NOT NULL,
    "overtimeCostPercentage" DECIMAL(6,2) NOT NULL,
    "stdDeviationHours" DECIMAL(8,2) NOT NULL,
    "departmentMetrics" JSONB NOT NULL,
    "weeklyTrend" JSONB NOT NULL,
    "topOvertimeEmployees" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "employees_organizationId_idx" ON "employees"("organizationId");

-- CreateIndex
CREATE INDEX "employees_department_idx" ON "employees"("department");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organizationId_employeeCode_key" ON "employees"("organizationId", "employeeCode");

-- CreateIndex
CREATE INDEX "payroll_jobs_organizationId_idx" ON "payroll_jobs"("organizationId");

-- CreateIndex
CREATE INDEX "payroll_jobs_organizationId_status_idx" ON "payroll_jobs"("organizationId", "status");

-- CreateIndex
CREATE INDEX "payroll_jobs_organizationId_createdAt_idx" ON "payroll_jobs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "timesheet_rows_jobId_idx" ON "timesheet_rows"("jobId");

-- CreateIndex
CREATE INDEX "timesheet_rows_jobId_validationStatus_idx" ON "timesheet_rows"("jobId", "validationStatus");

-- CreateIndex
CREATE INDEX "timesheet_rows_employeeCode_date_idx" ON "timesheet_rows"("employeeCode", "date");

-- CreateIndex
CREATE INDEX "timesheet_rows_department_idx" ON "timesheet_rows"("department");

-- CreateIndex
CREATE INDEX "timesheet_rows_date_idx" ON "timesheet_rows"("date");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_reports_jobId_key" ON "payroll_reports"("jobId");

-- CreateIndex
CREATE INDEX "payroll_reports_jobId_idx" ON "payroll_reports"("jobId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_jobs" ADD CONSTRAINT "payroll_jobs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_rows" ADD CONSTRAINT "timesheet_rows_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "payroll_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timesheet_rows" ADD CONSTRAINT "timesheet_rows_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_reports" ADD CONSTRAINT "payroll_reports_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "payroll_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
