/**
 * PayFlow — Demo Seed Script
 *
 * Creates two demo accounts belonging to the same organization.
 * These credentials are DEVELOPMENT/DEMO ONLY — never use in production.
 *
 * Demo Credentials:
 *   Admin/HR:  admin.demo@payflow.local  /  Demo@Payflow2026
 *   Employee:  emp.demo@payflow.local    /  Demo@Payflow2026
 *
 * Run:  npx tsx prisma/seed.ts
 */

import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_ORG_NAME = 'PayFlow Demo Organization';
const DEMO_PASSWORD = 'Demo@Payflow2026';
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('🌱  Running PayFlow demo seed…\n');

  const hash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

  // Upsert the demo organization (idempotent)
  const org = await prisma.organization.upsert({
    where: { id: 'demo-org-payflow-seed-001' },
    update: { name: DEMO_ORG_NAME },
    create: { id: 'demo-org-payflow-seed-001', name: DEMO_ORG_NAME },
  });

  console.log(`✓  Organization: "${org.name}" (${org.id})`);

  // Upsert demo admin/HR user
  const admin = await prisma.user.upsert({
    where: { email: 'admin.demo@payflow.local' },
    update: { passwordHash: hash, name: 'Demo Admin', organizationId: org.id, role: Role.ADMIN },
    create: {
      id: 'demo-user-admin-seed-001',
      name: 'Demo Admin',
      email: 'admin.demo@payflow.local',
      passwordHash: hash,
      organizationId: org.id,
      role: Role.ADMIN,
    },
  });

  console.log(`✓  Admin user:    ${admin.email} (Role: ${admin.role})`);

  // Upsert demo employee record in organization
  const demoEmpRecord = await prisma.employee.upsert({
    where: {
      organizationId_employeeCode: {
        organizationId: org.id,
        employeeCode: 'EMP-101',
      },
    },
    update: { name: 'Demo Employee', department: 'Engineering' },
    create: {
      organizationId: org.id,
      employeeCode: 'EMP-101',
      name: 'Demo Employee',
      department: 'Engineering',
    },
  });

  // Upsert demo employee user linked to Employee
  const emp = await prisma.user.upsert({
    where: { email: 'emp.demo@payflow.local' },
    update: {
      passwordHash: hash,
      name: 'Demo Employee',
      organizationId: org.id,
      role: Role.EMPLOYEE,
      employeeId: demoEmpRecord.id,
    },
    create: {
      id: 'demo-user-emp-seed-001',
      name: 'Demo Employee',
      email: 'emp.demo@payflow.local',
      passwordHash: hash,
      organizationId: org.id,
      role: Role.EMPLOYEE,
      employeeId: demoEmpRecord.id,
    },
  });

  console.log(`✓  Employee user: ${emp.email} (Role: ${emp.role}, Code: ${demoEmpRecord.employeeCode})`);
  console.log('\n✅  Seed complete. Both accounts share org:', org.id);
  console.log('\nDemo credentials (DEVELOPMENT ONLY):');
  console.log('  Admin/HR:  admin.demo@payflow.local  /  Demo@Payflow2026');
  console.log('  Employee:  emp.demo@payflow.local    /  Demo@Payflow2026');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

