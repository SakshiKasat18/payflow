# PayFlow — Employee Timesheet & Payroll Analytics Platform

> **Workforce. Simplified.**
> A full-stack, enterprise-grade payroll calculation, timesheet validation, and workforce analytics platform capable of processing 10,000+ timesheet rows in seconds with weekly overtime reconciliation.

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [Key Features](#-key-features)
3. [Architecture & System Design](#-architecture--system-design)
4. [Tech Stack](#-tech-stack)
5. [Prerequisites & Quick Start](#-prerequisites--quick-start)
6. [Environment Configuration](#-environment-configuration)
7. [Database Setup & Migrations](#-database-setup--migrations)
8. [🔑 Demo Credentials](#-demo-credentials-development-only)
9. [API Reference](#-api-reference)
10. [Worker Pool & Processing Engine](#-worker-pool--processing-engine)
11. [Timesheet Validation Rules](#-timesheet-validation-rules)
12. [Payroll Engine & Mathematical Specification](#-payroll-engine--mathematical-specification)
13. [Workforce Analytics & Statistical Formulas](#-workforce-analytics--statistical-formulas)
14. [Reprocessing & Annotated CSV Export](#-reprocessing--annotated-csv-export)
15. [Security & Multi-Tenant Organization Isolation](#-security--multi-tenant-organization-isolation)
16. [Performance Benchmarks (10,000+ Rows)](#-performance-benchmarks-10000-rows)
17. [Testing & Quality Assurance](#-testing--quality-assurance)
18. [Known Limitations & Future Roadmap](#-known-limitations--future-roadmap)
19. [AI-Assisted Development Disclosure](#-ai-assisted-development-disclosure)

---

## 🌟 Project Overview

PayFlow bridges the gap between raw, messy employee punch-clock records and mathematically reconciled payroll. In real-world enterprise environments, timesheets contain clock errors, overlapping shifts, duplicate entries, missing departments, and complex multi-day shifts that span weekly overtime caps.

PayFlow ingests raw CSV/JSON timesheets, submits them across an isolated worker thread pool for high-throughput validation, flags duplicate and overlapping shifts deterministically, calculates daily overtime ($>8\text{h/day}$) and weekly overtime ($>40\text{h/week}$) without double-counting, and renders interactive, real-time analytics across departments and payroll periods.

---

## ✨ Key Features

- **High-Throughput Async Processing**: Ingests and processes 10,000+ timesheet rows in seconds via worker threads with real-time progress polling.
- **Deterministic Validation & Deduplication**: Enforces 7 strict field validations, flags exact duplicate punches, and detects overlapping shift intervals for the same employee/day.
- **Two-Tier Overtime Engine**:
  - Daily Overtime: Hours worked beyond 8.0 hours in a single shift paid at $1.5\times$ base rate.
  - Weekly Overtime Reconciliation: Once an employee's cumulative regular hours reach 40.0 hours in a Monday–Sunday ISO calendar week, subsequent regular hours are converted to overtime without double-counting daily overtime.
- **Enterprise Multi-Tenancy**: Strict multi-tenant isolation where all organizations, users, employees, jobs, timesheets, and reports are partitioned and verified from JWT session identity.
- **Interactive Executive Dashboard**: Live KPI cards, department gross pay bar charts, regular vs. overtime donut charts, weekly payroll trends, and top overtime earner leaderboards.
- **Granular Employee Timesheet Drilldown**: Interactive modals displaying day-by-day punch breakdowns, hours worked, regular/OT split, and gross pay calculations.
- **Idempotent Reprocessing**: Re-evaluate completed jobs after employee wage adjustments without duplicating database records or report data.
- **Annotated CSV Export**: Streams client-side and authenticated server-side CSV files containing calculated regular hours, overtime hours, gross pay, validation status, and error messages.

---

## 🏛 Architecture & System Design

```
                                 PayFlow Architecture
                                 ═════════════════════

   ┌────────────────────────────────────────────────────────────────────────┐
   │                          Frontend (React 18 + Vite)                    │
   │  Dashboard · Upload · Jobs · Payroll Ledger · Departments · Reports   │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │ HTTP / Authenticated Bearer JWT
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                          Express REST API (:3001)                      │
   │                                                                        │
   │   ┌────────────────┐   ┌────────────────┐   ┌──────────────────────┐  │
   │   │  Auth Router   │   │  Jobs Router   │   │ Payroll / Analytics  │  │
   │   │  /api/auth     │   │  /api/jobs     │   │ /api/payroll         │  │
   │   │  (JWT + bcrypt)│   │  (Multipart)   │   │ /api/analytics       │  │
   │   └────────────────┘   └───────┬────────┘   └──────────┬───────────┘  │
   │                                │                       │              │
   │                                ▼                       │              │
   │               ┌────────────────────────────────┐       │              │
   │               │   Piscina Worker Thread Pool   │       │              │
   │               │   (rowProcessor.ts - 4 threads)│       │              │
   │               │   - Schema & Date validation   │       │              │
   │               │   - Clock-time validation      │       │              │
   │               │   - Daily OT math              │       │              │
   │               └────────────────┬───────────────┘       │              │
   │                                │                       │              │
   │                                ▼                       │              │
   │               ┌────────────────────────────────┐       │              │
   │               │ Weekly OT Reconciliation Logic │◄──────┘              │
   │               │ (payroll.service.ts)           │                      │
   │               │ - ISO Week chronological sort  │                      │
   │               │ - 40h regular capacity cap     │                      │
   │               │ - Double-count prevention      │                      │
   │               └────────────────┬───────────────┘                      │
   └────────────────────────────────┼───────────────────────────────────────┘
                                    │ Prisma ORM
                                    ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                     PostgreSQL Database (Neon / Local)                 │
   │    organizations · users · employees · payroll_jobs · timesheet_rows   │
   │                         payroll_reports                                │
   └────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend UI** | React 18, TypeScript, Tailwind CSS, Vite | Fast HMR, responsive layout, type safety |
| **Icons & Visuals** | Lucide React, Recharts | Accessible SVG icons, smooth data visualization |
| **Backend API** | Node.js, Express, TypeScript (`tsx`) | Robust REST API, asynchronous execution |
| **Worker Threads** | Piscina | Worker thread pool utilizing all CPU cores for parallel parsing |
| **Database & ORM** | PostgreSQL (Neon serverless), Prisma ORM | ACID transactions, typed schemas, optimized migrations |
| **Authentication** | JWT (`jsonwebtoken`), `bcryptjs` (12 rounds) | Stateless, industry-standard authentication |
| **Logging** | Pino | High-speed structured JSON logging |

---

## 🚀 Prerequisites & Quick Start

### Prerequisites

- **Node.js**: v18.0.0 or later
- **npm**: v9.0.0 or later
- **PostgreSQL**: PostgreSQL 14+ database (Neon, Supabase, or local instance)

### 1. Repository Setup

```bash
git clone https://github.com/SakshiKasat18/payflow.git
cd payflow
npm install
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env and supply DATABASE_URL and JWT_SECRET

npm install
npm run db:migrate   # Applies database migrations
npm run db:seed      # Seeds deterministic demo accounts
npm run dev          # Starts backend API on http://localhost:3001
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
npm run dev          # Starts Vite dev server on http://localhost:5173
```

---

## ⚙️ Environment Configuration

### `backend/.env`

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@ep-cool-db.neon.tech/payflow?sslmode=require` |
| `JWT_SECRET` | 32+ byte cryptographic secret | `openssl rand -hex 32` |
| `CLIENT_URL` | Allowed CORS origin | `http://localhost:5173` |
| `PORT` | API server port | `3001` |
| `NODE_ENV` | Runtime environment | `development` or `production` |
| `ROW_PROCESSING_DELAY_MS` | Artificial per-row worker processing delay (default `5`ms for demo/assignment compliance, `0`ms for benchmarking) | `5` |


---

## 🗄 Database Setup & Migrations

PayFlow uses Prisma ORM with strict referential integrity and indexes for fast multi-tenant queries.

```bash
# Run migrations
cd backend
npx prisma migrate dev --name init_schema

# Seed demo users & organization
npx prisma db seed

# Open Prisma Studio GUI
npx prisma studio
```

### Prisma Schema Structure

```
Organization (Root Multi-Tenant Boundary)
  ├── User[] (Admin / HR / Employee accounts)
  ├── Employee[] (Upserted workforce participants)
  └── PayrollJob[] (Timesheet file processing lifecycles)
        ├── TimesheetRow[] (Raw & validated shift punches)
        └── PayrollReport (Aggregated period analytics)
```

---

## 🔑 Demo Credentials (DEVELOPMENT ONLY)

> ⚠️ **Notice**: These accounts are seeded for development and evaluation purposes only. **Never deploy demo credentials to production environments.**

| Role | Email | Password | Organization |
|---|---|---|---|
| **Admin / HR** | `admin.demo@payflow.local` | `Demo@Payflow2026` | PayFlow Demo Organization |
| **Employee** | `employee.demo@payflow.local` | `Demo@Payflow2026` | PayFlow Demo Organization |

### Demo Login Shortcut

The Login page includes subtle prefill shortcuts (`Demo Admin / HR` and `Demo Employee`). Clicking a shortcut automatically fills the fields; clicking **Sign In** executes the standard `POST /api/auth/login` authentication pipeline.

---

## 📡 API Reference

All `/api/jobs/*`, `/api/payroll/*`, and `/api/analytics/*` routes require an `Authorization: Bearer <token>` header.

### Authentication

| Method | Route | Description | Status Codes |
|---|---|---|---|
| `POST` | `/api/auth/signup` | Register new user and organization | `201 Created`, `400`, `409 Conflict` |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token | `200 OK`, `401 Unauthorized` |
| `GET` | `/api/auth/me` | Fetch current authenticated user identity | `200 OK`, `401 Unauthorized` |

### Timesheet Upload & Jobs

| Method | Route | Description | Status Codes |
|---|---|---|---|
| `POST` | `/api/jobs/upload` | Upload CSV/JSON file (`multipart/form-data`, field: `timesheet`). Rate-limited to 20 req/20 min per IP. | `201 Created`, `400 Bad Request`, `429 Too Many Requests` |
| `GET` | `/api/jobs` | List all timesheet upload jobs for organization | `200 OK`, `401 Unauthorized` |
| `GET` | `/api/jobs/:id` | Fetch job details, status counts, and error samples | `200 OK`, `404 Not Found` |
| `POST` | `/api/jobs/:id/process` | Re-trigger processing for a pending/failed job | `200 OK`, `404`, `409 Conflict` |
| `POST` | `/api/jobs/:id/reprocess` | Idempotent reprocessing alias | `200 OK`, `404`, `409 Conflict` |

### Payroll & Analytics

| Method | Route | Description | Status Codes |
|---|---|---|---|
| `GET` | `/api/jobs/:id/payroll` | Fetch reconciled payroll ledger rows per employee | `200 OK`, `404 Not Found` |
| `GET` | `/api/jobs/:id/analytics` | Fetch company & department analytics for a job | `200 OK`, `404 Not Found` |
| `POST` | `/api/jobs/:id/analytics/generate` | Idempotently recalculate and regenerate analytics | `200 OK`, `404`, `409` |
| `GET` | `/api/jobs/:id/employees/:code` | Fetch granular employee shift details | `200 OK`, `404 Not Found` |
| `GET` | `/api/jobs/:id/export` | Stream annotated CSV export for a specific job | `200 OK`, `404 Not Found` |
| `GET` | `/api/payroll/dashboard` | Organization-wide summary metrics for executive dashboard | `200 OK`, `401 Unauthorized` |
| `GET` | `/api/analytics/overview` | Organization analytics overview | `200 OK`, `401 Unauthorized` |
| `GET` | `/api/analytics/departments` | Department metrics breakdown | `200 OK`, `401 Unauthorized` |
| `GET` | `/api/analytics/weekly-trends` | Weekly payroll trends breakdown | `200 OK`, `401 Unauthorized` |
| `GET` | `/api/analytics/export/csv` | Stream latest annotated CSV export | `200 OK`, `404 Not Found` |

---

## ⚡ Worker Pool & Processing Engine

PayFlow uses **Piscina** to spawn a pool of worker threads (`maxThreads: 4`) that execute CPU-bound validation in parallel without blocking Express's event loop.

### Ingestion Lifecycle

1. **Upload**: Client streams `.csv` or `.json` up to 50 MB. Fast stream parsing extracts raw records and verifies column headers.
2. **Job Staging**: Creates `PayrollJob` record with status `pending`. Upload returns `201 Created` immediately.
3. **Chunked Worker Dispatch**: Background worker feeds rows to Piscina pool in chunks of 1,000 to keep memory pressure minimal and bounded.
4. **Validation & Normalization**: Each thread parses timestamps, checks date validity, ensures non-future dates, verifies positive rates, and computes daily overtime.
5. **Deduplication & Shift Overlap**: In-memory chronological indexing checks for exact `employee_id + date + clock_in` duplicates and overlapping shift intervals for the same employee on the same date.
6. **Batch Database Persistence**: Bulk upserts `Employee` records without $N+1$ queries and persists `TimesheetRow` records in batches of 500.
7. **Reconciliation & Report Generation**: Triggers `generatePayrollReport` to compute weekly overtime caps, department rollups, weekly curves, and standard deviation.

---

## 🛡 Timesheet Validation Rules

| Rule Name | Validation Condition | Outcome if Violated |
|---|---|---|
| **Required Fields** | `employee_id`, `employee_name`, `department`, `date`, `clock_in`, `clock_out`, `hourly_rate` present | Status: `invalid`, error message attached |
| **Date Validity** | Must parse to a valid Gregorian date (`YYYY-MM-DD`) | Status: `invalid` |
| **No Future Dates** | `date <= current_date` | Status: `invalid` |
| **Clock Format** | `HH:MM` 24-hour format ($00 \le HH \le 23$, $00 \le MM \le 59$) | Status: `invalid` |
| **Clock Order** | `clock_out > clock_in` (Overnight shifts crossing midnight are rejected) | Status: `invalid` |
| **Positive Wage** | `hourly_rate > 0` | Status: `invalid` |
| **Exact Duplicate** | Same `employee_id` + `date` + `clock_in` already seen | Status: `duplicate` |
| **Overlapping Shifts** | Interval $[ci_1, co_1)$ overlaps $[ci_2, co_2)$ for same employee/date | Status: `duplicate` |

---

## 🧮 Payroll Engine & Mathematical Specification

### 1. Daily Overtime Calculation
For each individual shift:
$$\text{hoursWorked} = \frac{\text{clockOutMinutes} - \text{clockInMinutes}}{60}$$
$$\text{dailyRegularHours} = \min(\text{hoursWorked}, 8.0)$$
$$\text{dailyOvertimeHours} = \max(0, \text{hoursWorked} - 8.0)$$

### 2. Weekly Overtime Reconciliation Algorithm
Weekly overtime caps regular hours at 40.0 hours per workweek (Monday to Sunday, ISO-8601).

```typescript
For each employee in an ISO week:
  Sort valid shifts chronologically (date ASC, clock_in ASC)
  weeklyRegularUsed = 0.0

  For each shift:
    rate = hourlyRate
    dailyReg = shift.dailyRegularHours
    dailyOT  = shift.dailyOvertimeHours

    regularCapacityRemaining = max(0, 40.0 - weeklyRegularUsed)
    effectiveReg = min(dailyReg, regularCapacityRemaining)
    weeklyOT     = dailyReg - effectiveReg
    effectiveOT  = dailyOT + weeklyOT

    weeklyRegularUsed += effectiveReg
    effectiveGrossPay  = (effectiveReg * rate) + (effectiveOT * rate * 1.5)
```

### Prevention of Double-Counting
Daily overtime hours ($>8\text{h/day}$) are never counted toward `weeklyRegularUsed`. Only regular hours count toward the 40-hour cap. When regular hours exceed 40h, only the excess non-overtime hours are converted to overtime at $1.5\times$.

---

## 📊 Workforce Analytics & Statistical Formulas

### 1. Department Metrics
$$\text{Department Total Pay} = \sum_{\text{dept}} \text{effectiveGrossPay}$$
$$\text{Department Overtime \%} = \frac{\text{Department Overtime Pay}}{\text{Department Total Pay}} \times 100$$

### 2. Population Standard Deviation of Total Hours
$$\mu = \frac{1}{N} \sum_{i=1}^N H_i, \quad \sigma = \sqrt{\frac{1}{N} \sum_{i=1}^N (H_i - \mu)^2}$$
where $H_i$ is the total hours worked by employee $i$, and $N$ is the total number of distinct active employees.

### 3. Top 5 Overtime Contributors
Sorted by $\text{totalOvertimeHours}$ descending, broken deterministically by $\text{employeeCode}$ ascending.

---

## 🔄 Reprocessing & Annotated CSV Export

- **Reprocessing (`POST /api/jobs/:id/process`)**: Re-evaluates all raw rows against current rates and rules. Uses `deleteMany` on previous job rows and transactional upsert on reports to ensure strict idempotency with zero duplicate rows.
- **Annotated CSV Export (`GET /api/jobs/:id/export`)**: Produces a CSV containing:
  ```csv
  employee_id,employee_name,department,date,clock_in,clock_out,hourly_rate,hours_worked,regular_hours,overtime_hours,gross_pay,validation_status,error_message
  EMP-001,Alice Johnson,Engineering,2026-08-04,09:00,17:00,250.00,8.00,8.00,0.00,2000.00,valid,
  EMP-004,David Park,HR,2026-08-04,10:00,09:00,180.00,0.00,0.00,0.00,0.00,invalid,clock_out (09:00) must be after clock_in (10:00)
  ```

---

## 🔒 Security & Multi-Tenant Organization Isolation

1. **Tenant Scoping**: `organizationId` is always decoded from the verified JWT in `requireAuth` middleware. Handlers never accept `organizationId` from client query parameters or request bodies.
2. **Password Security**: Passwords hashed with `bcryptjs` at 12 salt rounds.
3. **Generic Authentication Messages**: Invalid email and invalid password attempts return identical `Invalid email or password` (401) responses to prevent user enumeration.
4. **Information Disclosure Prevention**: Nonexistent jobs or resources belonging to another organization return a generic `404 Not Found`. Production 500 error responses sanitize internal stack traces.
5. **Git Hygiene**: `.env` and sensitive configurations are strictly ignored.

---

## ⚡ Performance Benchmarks (10,000+ Rows)

Benchmark executed on 10,000 synthetic timesheet rows with 250 distinct employees:

| Metric | Result | Target Requirement |
|---|---|---|
| **Worker Parsing & Validation Throughput** | **43,668 rows/sec** (229 ms) | $> 5,000\text{ rows/sec}$ |
| **End-to-End Upload, DB Insert & Reconciliation** | **39.6 seconds** | $< 60\text{ seconds}$ |
| **Memory Heap Delta during 10k Run** | **14.2 MB** | $< 100\text{ MB}$ |
| **Database Operations** | Batched (500 rows/batch, no $N+1$) | Zero sequential loops |

---

## 🧪 Testing & Quality Assurance

The test suite covers unit math, edge cases, validation rules, authentication security, and 10k bulk benchmarks.

```bash
# Run complete test suite (39 tests across 15 suites)
cd backend
npx tsx --test src/__tests__/*.test.ts

# Run TypeScript compilation checks
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# Run Frontend production build
cd frontend && npm run build
```

### Test Coverage Summary

```
✔ PayFlow — Security & Authentication Tests (4 tests)
✔ PayFlow — Validation & Edge Case Tests (12 tests)
✔ PayFlow — Payroll Calculation & Overtime Tests (22 tests)
✔ PayFlow — 10,000+ Row Bulk Processing Benchmark (1 test)
─────────────────────────────────────────────────────────────
Total: 39 / 39 passed (100% pass rate)
```

---

## ⚠️ Known Limitations & Future Roadmap

- **Overnight Shifts Crossing Midnight**: Shifts where `clock_out < clock_in` are flagged as invalid per assignment specification. Supporting overnight shifts would require splitting shifts across calendar day boundaries.
- **Multiple Timezones**: Dates and times are currently normalized in UTC and local ISO formats. Multi-region timezone conversions could be added in a future release.
- **PDF Payslip Generation**: Currently supports annotated CSV export; PDF payslip generation can be integrated with `@react-pdf/renderer` or `puppeteer`.

---

## 🤖 AI-Assisted Development Disclosure

In accordance with transparent engineering practices, generative AI coding assistants were utilized during the development of PayFlow for architectural planning, scaffolding boilerplate code, drafting test cases, and optimizing high-throughput worker pool batching. All payroll algorithms, reconciliation math, security boundaries, and validation rules were rigorously audited, benchmarked, and verified with automated test suites.
