# PayFlow — Employee Timesheet & Payroll Analytics Platform

> **Workforce. Simplified.**  
> A full-stack payroll calculation, timesheet validation, and workforce analytics platform capable of processing 10,000+ timesheet rows with weekly overtime reconciliation.
>
> **Live Demo:** [https://payflow-brown-chi.vercel.app/login](https://payflow-brown-chi.vercel.app/login)
> **Note:** The live demo may take 50+ seconds to respond after periods of inactivity because the backend is hosted on Render’s free tier and spins down when idle.

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [Key Features](#-key-features)
3. [Architecture & System Design](#-architecture--system-design)
4. [Design Decisions & Engineering Tradeoffs](#-design-decisions--engineering-tradeoffs)
5. [Tech Stack](#-tech-stack)
6. [Prerequisites & Quick Start](#-prerequisites--quick-start)
7. [Environment Configuration](#-environment-configuration)
8. [Database Setup & Migrations](#-database-setup--migrations)
9. [API Reference](#-api-reference)
10. [Worker Pool & Processing Engine](#-worker-pool--processing-engine)
11. [Timesheet Validation Rules](#-timesheet-validation-rules)
12. [Payroll Engine & Mathematical Specification](#-payroll-engine--mathematical-specification)
13. [Workforce Analytics & Statistical Formulas](#-workforce-analytics--statistical-formulas)
14. [Reprocessing & Annotated CSV Export](#-reprocessing--annotated-csv-export)
15. [Security, RBAC & Multi-Tenant Isolation](#-security-rbac--multi-tenant-isolation)
16. [Canonical Sample Datasets](#-canonical-sample-datasets)
17. [Performance Benchmarks](#-performance-benchmarks)
18. [Testing & Quality Assurance](#-testing--quality-assurance)
19. [Known Limitations & Future Roadmap](#-known-limitations--future-roadmap)
20. [AI-Assisted Development Disclosure](#-ai-assisted-development-disclosure)

---

## 🌟 Project Overview

PayFlow bridges the gap between raw employee punch-clock records and mathematically reconciled payroll. In operational environments, timesheets contain clock errors, overlapping shifts, duplicate entries, and multi-day shifts that span weekly overtime caps.

PayFlow ingests raw CSV/JSON timesheets, submits them across an isolated worker thread pool for high-throughput validation, flags duplicate and overlapping shifts deterministically, calculates daily overtime ($>8\text{h/day}$) and weekly overtime ($>40\text{h/week}$) without double-counting, enforces role-based access control, and provides interactive analytics across departments and payroll periods.

---

## ✨ Key Features

- **Bounded Asynchronous Processing**: Ingests and processes 10,000+ timesheet rows via Piscina worker threads with interactive progress polling.
- **Deterministic Validation & Deduplication**: Enforces 8 strict validation rules, flags exact duplicate punches, and detects overlapping shift intervals for the same employee/day.
- **Two-Tier Overtime Engine**:
  - Daily Overtime: Hours worked beyond 8.0 hours in a single shift paid at $1.5\times$ base rate.
  - Weekly Overtime Reconciliation: Once cumulative regular hours reach 40.0 hours in an ISO calendar week (Mon–Sun), subsequent regular hours convert to overtime without double-counting daily overtime.
- **Role-Based Access Control (RBAC)**: Distinct permissions for `ADMIN`, `HR`, and `EMPLOYEE` roles enforced via server-side JWT claims and route guards.
- **Tenant Isolation**: All organizations, users, employees, jobs, timesheets, and reports are partitioned and verified from JWT session identity.
- **Interactive Executive Dashboard**: KPI cards, department gross pay charts, regular vs. overtime donut charts, weekly payroll trends, and top overtime earner leaderboards.
- **Employee Self-Service Portal**: Authenticated employee view (`/api/payroll/me`) providing personal shift history, historical payslips, and hours breakdown.
- **Idempotent Reprocessing**: Re-evaluate completed jobs after wage adjustments without duplicating database records.
- **Annotated CSV Export**: Streams CSV files containing calculated regular hours, overtime hours, gross pay, validation status, and error messages.
- **Ingestion Rate Limiting**: Protects timesheet upload endpoints against burst traffic (20 requests / 20 minutes per IP).

---

## 🏛 Architecture & System Design

```
                                 PayFlow Architecture
                                 ═════════════════════

   ┌────────────────────────────────────────────────────────────────────────┐
   │                    Frontend (React 18 + Vite · Vercel)                 │
   │  Dashboard · Upload · Jobs · Payroll Ledger · Departments · Reports   │
   └───────────────────────────────────┬────────────────────────────────────┘
                                       │ HTTPS / Authenticated Bearer JWT
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │                    Express REST API (Node.js · Render)                 │
   │                                                                        │
   │   ┌────────────────┐   ┌────────────────┐   ┌──────────────────────┐  │
   │   │  Auth & RBAC   │   │  Jobs Router   │   │ Payroll / Analytics  │  │
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
   │               │   - Daily OT calculation       │       │              │
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
   │                     PostgreSQL Database (Neon Serverless)              │
   │    organizations · users · employees · payroll_jobs · timesheet_rows   │
   │                         payroll_reports                                │
   └────────────────────────────────────────────────────────────────────────┘
```

---

## ⚖️ Design Decisions & Engineering Tradeoffs

| Decision | Chosen Approach | Why Chosen | Tradeoff / Consideration |
|---|---|---|---|
| **Worker Concurrency** | Bounded Piscina thread pool (`maxThreads: 4`, 1,000-row chunks) | Keeps CPU-heavy row parsing off the main event loop; prevents out-of-memory crashes | Thread pool startup overhead for very small files (<10 rows) |
| **Database & ORM** | PostgreSQL (Neon) + Prisma ORM | Relational integrity, structured foreign keys, composite indexes, and type-safe migrations | Requires formal schema migration management compared with a document store |
| **Job Synchronization** | Short-polling on `/api/jobs/:id` (`pending` → `completed`) | Resilient across load balancers, serverless proxies, and transient disconnects | Generates periodic HTTP status requests during active processing |
| **Two-Stage Processing** | Worker validation decoupled from weekly overtime reconciliation | Separates single-shift validation from multi-shift weekly aggregation for code clarity | Requires multi-pass chronological in-memory aggregation |
| **Weekly OT Math** | Chronological sorting by `date ASC, clockIn ASC` per ISO workweek | Enforces 40.0h regular cap while strictly preventing double-counting of daily OT | Requires pre-sorting shifts across the workweek before computing gross pay |
| **Persistence Strategy** | Batched `$transaction` writes (500 rows/batch) | Prevents connection pool exhaustion and eliminates $N+1$ insert latency | Requires chunking and error containment logic |
| **Auth & Isolation** | Stateless JWT (`ADMIN`, `HR`, `EMPLOYEE`) with `organizationId` claims | High performance, zero server-side session cache dependencies across distributed instances | Immediate token revocation requires token denylist |
| **Data Preservation** | Raw rows stored in `PayrollJob.rawData` | Enables one-click idempotent reprocessing without requiring users to re-upload files | Consumes modest additional database JSON storage |
| **Processing Delay** | `ROW_PROCESSING_DELAY_MS` (5ms demo default, 0ms benchmark) | Demonstrates interactive progress polling while allowing full-speed raw benchmarking | Demo run times reflect simulated per-row processing cost |

---

## 🛠 Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend UI** | React 18, TypeScript, Tailwind CSS, Vite | Fast HMR, responsive layout, strict type safety |
| **Visuals & Charts** | Lucide React, Recharts | Accessible icons and responsive SVG data visualization |
| **Backend API** | Node.js, Express, TypeScript (`tsx`) | Robust REST API with asynchronous execution |
| **Worker Threads** | Piscina (`worker_threads`) | Thread pool utilizing multi-core CPUs for parallel parsing |
| **Database & ORM** | PostgreSQL (Neon), Prisma ORM | ACID transactions, typed schemas, optimized migrations |
| **Authentication** | JWT (`jsonwebtoken`), `bcryptjs` (12 rounds) | Stateless cryptographic authentication |
| **Logging** | Pino | High-speed structured JSON logging |

---

## 🚀 Prerequisites & Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or later
- **npm**: v9.0.0 or later
- **PostgreSQL**: PostgreSQL 14+ (Neon, Supabase, or local instance)

### 1. Repository Setup
```bash
git clone https://github.com/SakshiKasat18/payflow.git
cd payflow
```

### 2. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env and supply DATABASE_URL and JWT_SECRET

npm install
npm run db:generate   # Generates Prisma client
npm run db:migrate    # Applies database migrations
npm run db:seed       # Seeds demo accounts
npm run dev           # Starts backend API on http://localhost:3001
```

### 3. Frontend Setup
```bash
cd ../frontend
cp .env.example .env

npm install
npm run dev           # Starts Vite dev server on http://localhost:5173
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
| `ROW_PROCESSING_DELAY_MS` | Per-row worker delay (`5`ms for demo, `0`ms for benchmarking) | `5` |

### `frontend/.env`
| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Base backend API URL | `http://localhost:3001/api` |

---

## 🗄 Database Setup & Migrations

PayFlow uses Prisma ORM with referential integrity and indexes for fast multi-tenant queries.

```bash
cd backend
npx prisma migrate dev --name init_schema  # Run migrations
npx prisma db seed                         # Seed demo organization & accounts
npx prisma studio                          # Open Prisma Studio GUI
```

### Schema Structure
```
Organization (Root Multi-Tenant Boundary)
  ├── User[] (Admin / HR / Employee accounts with Role enum)
  ├── Employee[] (Workforce records with unique code per organization)
  └── PayrollJob[] (Timesheet file processing lifecycles)
        ├── TimesheetRow[] (Raw & validated shift punches)
        └── PayrollReport (Aggregated period analytics)
```

---

## 📡 API Reference

All protected endpoints require an `Authorization: Bearer <token>` header.

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| `POST` | `/api/auth/signup` | Register new user and organization | Public |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token | Public |
| `GET` | `/api/auth/me` | Fetch authenticated user identity and role | Authenticated |
| `POST` | `/api/jobs/upload` | Upload CSV/JSON file (Rate limit: 20 req/20 min) | Admin, HR |
| `GET` | `/api/jobs` | List timesheet upload jobs for organization | Admin, HR |
| `GET` | `/api/jobs/:id` | Fetch job details, status counts, and error samples | Admin, HR |
| `POST` | `/api/jobs/:id/process` | Re-trigger processing for a pending/failed job | Admin, HR |
| `POST` | `/api/jobs/:id/reprocess` | Idempotent reprocessing alias | Admin, HR |
| `GET` | `/api/jobs/:id/payroll` | Fetch reconciled payroll ledger rows | Admin, HR |
| `GET` | `/api/jobs/:id/analytics` | Fetch company and department analytics for a job | Admin, HR |
| `POST` | `/api/jobs/:id/analytics/generate`| Recalculate and regenerate analytics | Admin, HR |
| `GET` | `/api/jobs/:id/employees/:code` | Fetch granular employee shift details | Admin, HR |
| `GET` | `/api/jobs/:id/export` | Stream annotated CSV export for a specific job | Admin, HR |
| `GET` | `/api/payroll/dashboard` | Organization-wide summary metrics | Admin, HR |
| `GET` | `/api/payroll/me` | Fetch personal payroll ledger and shifts | Employee |
| `GET` | `/api/payroll/me/dashboard` | Fetch personal payroll summary metrics | Employee |
| `GET` | `/api/analytics/overview` | Organization analytics overview | Admin, HR |
| `GET` | `/api/analytics/departments` | Department metrics breakdown | Admin, HR |
| `GET` | `/api/analytics/weekly-trends` | Weekly payroll trends breakdown | Admin, HR |
| `GET` | `/api/analytics/export/csv` | Stream latest annotated CSV export | Admin, HR |
| `GET` | `/api/health` | Service health check | Public |

---

## ⚡ Worker Pool & Processing Engine

PayFlow uses **Piscina** to manage a worker thread pool (`maxThreads: 4`) executing CPU-bound validation in parallel without blocking the Express event loop.

### Ingestion Lifecycle
1. **Upload**: Accepts `.csv` or `.json` up to 50 MB; verifies column headers.
2. **Job Staging**: Creates `PayrollJob` record with status `pending` (returns `201 Created` immediately).
3. **Worker Dispatch**: Feeds rows to Piscina pool in 1,000-row chunks.
4. **Validation**: Thread parses timestamps, checks date rules, verifies positive rates, and computes daily overtime.
5. **Deduplication**: In-memory indexing checks for exact `employee_id + date + clock_in` duplicates and overlapping shift intervals.
6. **Batch Persistence**: Bulk upserts `Employee` records and persists `TimesheetRow` records in batches of 500.
7. **Reconciliation**: Computes weekly overtime caps, department rollups, and statistical variance.

---

## 🛡 Timesheet Validation Rules

PayFlow enforces **8 strict validation rules**:

| # | Rule Name | Validation Condition | Outcome if Violated |
|---|---|---|---|
| 1 | **Required Fields** | `employee_id`, `employee_name`, `department`, `date`, `clock_in`, `clock_out`, `hourly_rate` present | Status: `invalid` |
| 2 | **Date Validity** | Must parse to a valid Gregorian date (`YYYY-MM-DD`) | Status: `invalid` |
| 3 | **No Future Dates** | `date <= current_date` | Status: `invalid` |
| 4 | **Clock Format** | `HH:MM` 24-hour format ($00 \le HH \le 23$, $00 \le MM \le 59$) | Status: `invalid` |
| 5 | **Clock Order** | `clock_out > clock_in` (Overnight shifts rejected) | Status: `invalid` |
| 6 | **Positive Wage** | `hourly_rate > 0` | Status: `invalid` |
| 7 | **Exact Duplicate** | Same `employee_id` + `date` + `clock_in` already seen | Status: `duplicate` |
| 8 | **Overlapping Shifts** | Interval $[ci_1, co_1)$ overlaps $[ci_2, co_2)$ for same employee/date | Status: `duplicate` |

---

## 🧮 Payroll Engine & Mathematical Specification

### 1. Daily Overtime Calculation
For each individual shift:
$$\text{hoursWorked} = \frac{\text{clockOutMinutes} - \text{clockInMinutes}}{60}$$
$$\text{dailyRegularHours} = \min(\text{hoursWorked}, 8.0)$$
$$\text{dailyOvertimeHours} = \max(0, \text{hoursWorked} - 8.0)$$

### 2. Weekly Overtime Reconciliation Algorithm
Weekly overtime caps regular hours at 40.0 hours per workweek (Monday to Sunday, ISO-8601):

```typescript
For each employee in an ISO calendar week:
  Sort valid shifts chronologically (date ASC, clock_in ASC)
  weeklyRegularUsed = 0.0

  For each shift:
    rate = shift.hourlyRate
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
Daily overtime hours ($>8\text{h/day}$) are **never** added to `weeklyRegularUsed`. Only regular hours accumulate toward the 40-hour threshold. When regular hours exceed 40h, only the excess non-overtime hours are converted to overtime at $1.5\times$.

---

## 📊 Workforce Analytics & Statistical Formulas

### 1. Department Metrics
$$\text{Department Total Pay} = \sum_{\text{dept}} \text{effectiveGrossPay}$$
$$\text{Department Overtime \%} = \frac{\text{Department Overtime Pay}}{\text{Department Total Pay}} \times 100$$

### 2. Population Standard Deviation of Total Hours
$$\mu = \frac{1}{N} \sum_{i=1}^N H_i, \quad \sigma = \sqrt{\frac{1}{N} \sum_{i=1}^N (H_i - \mu)^2}$$
where $H_i$ is total hours worked by employee $i$, and $N$ is the number of distinct active employees.

### 3. Top 5 Overtime Contributors
Sorted by $\text{totalOvertimeHours}$ descending, broken deterministically by $\text{employeeCode}$ ascending.

---

## 🔄 Reprocessing & Annotated CSV Export

- **Reprocessing (`POST /api/jobs/:id/process`)**: Re-evaluates raw rows against updated rates and rules. Uses `deleteMany` on previous job rows and transactional upsert on reports for idempotency.
- **Annotated CSV Export (`GET /api/jobs/:id/export`)**: Produces an export with full audit fields:
  ```csv
  employee_id,employee_name,department,date,clock_in,clock_out,hourly_rate,hours_worked,regular_hours,overtime_hours,gross_pay,validation_status,error_message
  EMP-001,Alice Johnson,Engineering,2026-08-04,09:00,17:00,250.00,8.00,8.00,0.00,2000.00,valid,
  EMP-004,David Park,HR,2026-08-04,10:00,09:00,180.00,0.00,0.00,0.00,0.00,invalid,clock_out (09:00) must be after clock_in (10:00)
  ```

---

## 🔒 Security, RBAC & Multi-Tenant Isolation

1. **Role-Based Access Control**: `ADMIN`, `HR`, and `EMPLOYEE` roles. Administrative paths are restricted to `ADMIN` and `HR`, while employees have dedicated self-service views.
2. **Tenant Scoping**: `organizationId` is always decoded from the verified JWT in `requireAuth` middleware. Handlers never accept `organizationId` from client query parameters or request bodies.
3. **Password Security**: Passwords hashed with `bcryptjs` at 12 salt rounds.
4. **Authentication Protection**: Invalid email and password attempts return identical `Invalid email or password` (401) responses to prevent user enumeration.
5. **Information Disclosure Prevention**: Nonexistent jobs or resources belonging to another organization return a generic `404 Not Found`. Production 500 responses sanitize stack traces.
6. **Upload Rate Limiting**: `express-rate-limit` enforces a 20 request / 20 minute limit on `POST /api/jobs/upload`.

---

## 📁 Canonical Sample Datasets

Located in `sample-data/`:

| Filename | Data Rows | Scenario Tested |
|---|---|---|
| `sample_timesheet_standard_valid.csv` | 6 | Standard shifts across Engineering, Sales, Marketing, HR. 100% valid; exercises daily regular and overtime calculations. |
| `sample_timesheet_edge_cases_invalid.csv` | 5 | Edge-case fixtures testing missing fields, negative rates, future dates, invalid clock formats, duplicate punches, and overlapping shift intervals. |
| `sample_timesheet_weekly_overtime.csv` | 16 | Multi-day shifts for employees exceeding 40h in a Monday–Sunday workweek. Demonstrates weekly overtime reconciliation without double-counting. |
| `sample_timesheet_100_rows.csv` | 100 | Multi-department medium bulk timesheet for ingestion throughput, pagination, and multi-department analytics verification. |

---

## ⚡ Performance Benchmarks

Benchmark executed on 10,000 synthetic timesheet rows with 250 distinct employees (`ROW_PROCESSING_DELAY_MS=0`):

| Metric | Result | Target Requirement |
|---|---|---|
| **Worker Parsing & Validation Throughput** | **43,668 rows/sec** (229 ms) | $> 5,000\text{ rows/sec}$ |
| **End-to-End Processing (Upload, DB Insert & Reconciliation)** | **Verified well under 60-second threshold** | $< 60\text{ seconds}$ |
| **Memory Heap Delta during 10k Run** | **14.2 MB** | $< 100\text{ MB}$ |
| **Database Operations** | Batched (500 rows/batch, no $N+1$) | Zero sequential loops |

---

## 🧪 Testing & Quality Assurance

```bash
# Run backend test suite (61 automated tests — 100% pass rate)
cd backend && npx tsx --test src/__tests__/*.test.ts

# Run TypeScript compilation checks
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit

# Run Frontend production build
cd frontend && npm run build
```

### Test Coverage Breakdown
```
✔ Security & Authentication Tests (4 tests)
✔ Validation & Edge Case Tests (12 tests)
✔ Payroll Calculation & Overtime Tests (22 tests)
✔ RBAC Authorization & Security Suite (17 tests)
✔ Audit Remediation & Regression Suite (4 tests)
✔ Upload Rate Limiting Unit Tests (1 test)
✔ 10,000+ Row Bulk Processing Benchmark (1 test)
─────────────────────────────────────────────────────────────
Total: 61 / 61 passed (100% pass rate)
```

---

## ⚠️ Known Limitations & Future Roadmap

- **Overnight Shifts Crossing Midnight**: Shifts where `clock_out < clock_in` are flagged as invalid per assignment specification. Supporting overnight shifts would require splitting shifts across calendar day boundaries.
- **Timezone Assumptions**: The timesheet CSV format does not carry timezone metadata; timestamps are parsed and evaluated under consistent local clock-time assumptions.
- **PDF Payslip Generation**: Currently supports annotated CSV export; PDF payslip generation can be integrated with `@react-pdf/renderer` or `puppeteer`.

---

## 🤖 AI-Assisted Development Disclosure

Generative AI coding tools were utilized during the development of PayFlow as an engineering copilot for:

- **Architecture Exploration**: Evaluating high-throughput worker pool strategies and comparing bounded worker threads against stream transformers.
- **Edge-Case Analysis**: Identifying complex timesheet boundary conditions (e.g. shifts pushing cumulative hours from 38h to 46h where 2h is daily OT and 6h is regular, requiring 2h regular + 4h weekly OT reconciliation).
- **Test Generation**: Drafting test fixtures for boundary validation, malformed time formats, duplicate punch detection, and mock JWT verification.
- **Documentation & UI Refinement**: Assisting in structuring markdown tables, mathematical formulas, and UI design token consistency.

**Developer Review & Verification:**  
All AI suggestions were reviewed, audited, and tested. Every mathematical payroll reconciliation algorithm, database schema design, security policy, RBAC guard, and worker batching strategy was verified through automated tests (61/61 passing, 100% pass rate), strict TypeScript checks (`tsc --noEmit`), production bundle builds, and end-to-end testing.
