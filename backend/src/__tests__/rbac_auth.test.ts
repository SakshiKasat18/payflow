/**
 * PayFlow — Role-Based Access Control (RBAC) & Authorization Test Suite
 *
 * Validates:
 * 1. RBAC Middleware enforcement (ADMIN, HR, EMPLOYEE)
 * 2. Route protection for Admin/HR vs Employee endpoints
 * 3. Employee self-service data scoping (/api/payroll/me)
 * 4. Cross-organization tenant isolation
 * 5. Role escalation prevention on signup
 * 6. 401 unauthenticated & 403 forbidden status codes
 */

process.env.NODE_ENV = 'test';

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../server.js';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../utils/jwt.js';
import { requireRole } from '../middleware/rbac.js';
import { signup } from '../services/auth.service.js';
import type { Request, Response } from 'express';

describe('PayFlow — RBAC Authorization & Security Suite', () => {
  let server: http.Server;
  let baseUrl: string;

  let testOrgId: string;
  let testAdminToken: string;
  let testHrToken: string;
  let testEmpToken: string;
  let testEmpId: string;

  let otherOrgId: string;

  before(async () => {
    // 1. Create a dedicated test organization
    const org = await prisma.organization.create({
      data: { name: 'RBAC Test Org 1' },
    });
    testOrgId = org.id;

    // 2. Create Admin user
    const adminUser = await prisma.user.create({
      data: {
        name: 'Test Admin',
        email: `admin_${Date.now()}@payflow.test`,
        passwordHash: 'dummy_hash',
        organizationId: testOrgId,
        role: 'ADMIN',
      },
    });
    testAdminToken = signToken({
      userId: adminUser.id,
      organizationId: testOrgId,
      email: adminUser.email,
      role: 'ADMIN',
    });

    // 3. Create HR user
    const hrUser = await prisma.user.create({
      data: {
        name: 'Test HR',
        email: `hr_${Date.now()}@payflow.test`,
        passwordHash: 'dummy_hash',
        organizationId: testOrgId,
        role: 'HR',
      },
    });
    testHrToken = signToken({
      userId: hrUser.id,
      organizationId: testOrgId,
      email: hrUser.email,
      role: 'HR',
    });

    // 4. Create Employee entity and Employee user
    const empRecord = await prisma.employee.create({
      data: {
        organizationId: testOrgId,
        employeeCode: 'EMP-RBAC-01',
        name: 'Test Employee One',
        department: 'Operations',
      },
    });
    testEmpId = empRecord.id;

    const empUser = await prisma.user.create({
      data: {
        name: 'Test Employee One',
        email: `emp_${Date.now()}@payflow.test`,
        passwordHash: 'dummy_hash',
        organizationId: testOrgId,
        role: 'EMPLOYEE',
        employeeId: testEmpId,
      },
    });
    testEmpToken = signToken({
      userId: empUser.id,
      organizationId: testOrgId,
      email: empUser.email,
      role: 'EMPLOYEE',
      employeeId: testEmpId,
      employeeCode: empRecord.employeeCode,
    });

    // 5. Create a second isolated organization
    const otherOrg = await prisma.organization.create({
      data: { name: 'RBAC Isolated Org 2' },
    });
    otherOrgId = otherOrg.id;

    // 6. Spin up test HTTP server on random free port
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    // Teardown HTTP server
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    // Clean up test organizations
    if (testOrgId) {
      await prisma.organization.delete({ where: { id: testOrgId } }).catch(() => {});
    }
    if (otherOrgId) {
      await prisma.organization.delete({ where: { id: otherOrgId } }).catch(() => {});
    }
  });

  // ─── 1. Middleware Unit Tests ───────────────────────────────────────────────

  it('RBAC Middleware: Allows authorized ADMIN role', () => {
    const middleware = requireRole(['ADMIN', 'HR']);
    let calledNext = false;

    const mockReq = {
      user: { userId: '1', organizationId: '1', email: 'a@b.com', role: 'ADMIN' },
    } as unknown as Request;
    const mockRes = {
      status: () => mockRes,
      json: () => mockRes,
    } as unknown as Response;

    middleware(mockReq, mockRes, () => { calledNext = true; });
    assert.equal(calledNext, true, 'Next should be called for ADMIN');
  });

  it('RBAC Middleware: Allows authorized HR role', () => {
    const middleware = requireRole(['ADMIN', 'HR']);
    let calledNext = false;

    const mockReq = {
      user: { userId: '2', organizationId: '1', email: 'hr@b.com', role: 'HR' },
    } as unknown as Request;
    const mockRes = {
      status: () => mockRes,
      json: () => mockRes,
    } as unknown as Response;

    middleware(mockReq, mockRes, () => { calledNext = true; });
    assert.equal(calledNext, true, 'Next should be called for HR');
  });

  it('RBAC Middleware: Rejects EMPLOYEE role with 403 Forbidden', () => {
    const middleware = requireRole(['ADMIN', 'HR']);
    let calledNext = false;
    let statusCode = 0;
    let responseBody: unknown = null;

    const mockReq = {
      user: { userId: '3', organizationId: '1', email: 'e@b.com', role: 'EMPLOYEE' },
      originalUrl: '/api/jobs',
      method: 'GET',
    } as unknown as Request;

    const mockRes = {
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: (body: unknown) => {
        responseBody = body;
        return mockRes;
      },
    } as unknown as Response;

    middleware(mockReq, mockRes, () => { calledNext = true; });
    assert.equal(calledNext, false, 'Next should NOT be called for EMPLOYEE');
    assert.equal(statusCode, 403, 'Should return HTTP 403 Forbidden');
    assert.ok((responseBody as { error: { message: string } }).error.message.includes('Forbidden'));
  });

  // ─── 2. Route Protection & Status Code Tests ───────────────────────────────

  it('Unauthenticated requests return 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/dashboard`);
    assert.equal(res.status, 401);
    const body = (await res.json()) as { success: boolean; error: { message: string } };
    assert.equal(body.success, false);
    assert.ok(body.error.message.includes('Authentication required'));
  });

  it('ADMIN can access organization payroll dashboard', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/dashboard`, {
      headers: { Authorization: `Bearer ${testAdminToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    assert.equal(body.success, true);
  });

  it('ADMIN can access analytics overview', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/overview`, {
      headers: { Authorization: `Bearer ${testAdminToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { success: boolean };
    assert.equal(body.success, true);
  });

  it('ADMIN can access jobs listing', async () => {
    const res = await fetch(`${baseUrl}/api/jobs`, {
      headers: { Authorization: `Bearer ${testAdminToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { success: boolean; data: unknown[] };
    assert.equal(body.success, true);
  });

  it('HR can access organization payroll dashboard', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/dashboard`, {
      headers: { Authorization: `Bearer ${testHrToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { success: boolean };
    assert.equal(body.success, true);
  });

  it('HR can access analytics endpoints', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/departments`, {
      headers: { Authorization: `Bearer ${testHrToken}` },
    });
    assert.equal(res.status, 200);
  });

  it('EMPLOYEE is forbidden (403) from organization payroll dashboard', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/dashboard`, {
      headers: { Authorization: `Bearer ${testEmpToken}` },
    });
    assert.equal(res.status, 403, 'Employee must receive 403 on org payroll dashboard');
    const body = (await res.json()) as { success: boolean; error: { message: string } };
    assert.equal(body.success, false);
    assert.ok(body.error.message.includes('Forbidden'));
  });

  it('EMPLOYEE is forbidden (403) from jobs listing', async () => {
    const res = await fetch(`${baseUrl}/api/jobs`, {
      headers: { Authorization: `Bearer ${testEmpToken}` },
    });
    assert.equal(res.status, 403, 'Employee must receive 403 on jobs listing');
  });

  it('EMPLOYEE is forbidden (403) from analytics overview & departments', async () => {
    const res1 = await fetch(`${baseUrl}/api/analytics/overview`, {
      headers: { Authorization: `Bearer ${testEmpToken}` },
    });
    assert.equal(res1.status, 403);

    const res2 = await fetch(`${baseUrl}/api/analytics/departments`, {
      headers: { Authorization: `Bearer ${testEmpToken}` },
    });
    assert.equal(res2.status, 403);
  });

  it('EMPLOYEE is forbidden (403) from organization CSV export', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/export/csv`, {
      headers: { Authorization: `Bearer ${testEmpToken}` },
    });
    assert.equal(res.status, 403);
  });

  // ─── 3. Employee Self Endpoints (/api/payroll/me) ───────────────────────────

  it('EMPLOYEE can access personal payroll via /api/payroll/me', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/me`, {
      headers: { Authorization: `Bearer ${testEmpToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      success: boolean;
      data: { employeeName: string; employeeCode: string | null; totalHours: number };
    };
    assert.equal(body.success, true);
    assert.equal(body.data.employeeName, 'Test Employee One');
  });

  it('EMPLOYEE can access personal dashboard summary via /api/payroll/me/dashboard', async () => {
    const res = await fetch(`${baseUrl}/api/payroll/me/dashboard`, {
      headers: { Authorization: `Bearer ${testEmpToken}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      success: boolean;
      data: { employeeName: string; payslips: unknown[] };
    };
    assert.equal(body.success, true);
    assert.equal(body.data.employeeName, 'Test Employee One');
  });

  // ─── 4. Role Escalation Prevention ──────────────────────────────────────────

  it('Public signup sets org creator as ADMIN and ignores arbitrary role escalation payload', async () => {
    const signupData = {
      name: 'Attacker Attempting Escalation',
      email: `attack_${Date.now()}@payflow.test`,
      password: 'SecurePassword123!',
      organizationName: 'New Org From Signup',
      role: 'SUPER_ADMIN_CUSTOM', // Should be ignored
    };

    const res = await signup(signupData as unknown as Parameters<typeof signup>[0]);
    assert.equal(res.user.role, 'ADMIN', 'Organization creator is assigned standard ADMIN role');

    // Verify in DB directly
    const createdUser = await prisma.user.findUnique({ where: { id: res.user.id } });
    assert.equal(createdUser?.role, 'ADMIN');

    // Cleanup
    await prisma.organization.delete({ where: { id: res.user.organizationId } });
  });

  // ─── 5. Tenant Isolation & Data Scoping ─────────────────────────────────────

  it('Cross-organization isolation: User in Org 1 cannot access data in Org 2', async () => {
    // Create a job in Org 2
    const org2Job = await prisma.payrollJob.create({
      data: {
        organizationId: otherOrgId,
        filename: 'org2_private_timesheet.csv',
        status: 'completed',
        totalRows: 1,
      },
    });

    // Admin from Org 1 tries to access Org 2 job payroll
    const res = await fetch(`${baseUrl}/api/jobs/${org2Job.id}/payroll`, {
      headers: { Authorization: `Bearer ${testAdminToken}` },
    });
    assert.equal(res.status, 404, 'Must return 404 to prevent resource enumeration across tenants');
  });

});
