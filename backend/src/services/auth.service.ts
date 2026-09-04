import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../utils/jwt.js';
import { logger } from '../config/logger.js';
import type { SignupDto, LoginDto, AuthResponseDto } from '../types/index.js';

const BCRYPT_ROUNDS = 12;

// ─── Validation helpers ───────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters';
  return null;
}

// ─── Auth Service ─────────────────────────────────────────────────────────────

export async function signup(dto: SignupDto): Promise<AuthResponseDto> {
  const { name, email, password, organizationName } = dto;

  // Validate inputs
  if (!name?.trim()) throw Object.assign(new Error('Name is required'), { statusCode: 400 });
  if (!isValidEmail(email)) throw Object.assign(new Error('Invalid email address'), { statusCode: 400 });
  const pwError = validatePassword(password);
  if (pwError) throw Object.assign(new Error(pwError), { statusCode: 400 });
  if (!organizationName?.trim()) throw Object.assign(new Error('Organization name is required'), { statusCode: 400 });

  // Check duplicate email
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw Object.assign(new Error('An account with this email already exists'), { statusCode: 409 });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Create organization + user in one transaction
  const { user, organization } = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: organizationName.trim() },
    });
    const user = await tx.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        passwordHash,
        organizationId: organization.id,
      },
    });
    return { user, organization };
  });

  logger.info({ userId: user.id, orgId: organization.id }, 'New user signed up');

  const token = signToken({
    userId: user.id,
    organizationId: organization.id,
    email: user.email,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      organizationId: organization.id,
      organizationName: organization.name,
    },
  };
}

export async function login(dto: LoginDto): Promise<AuthResponseDto> {
  const { email, password } = dto;

  if (!email || !password) {
    throw Object.assign(new Error('Email and password are required'), { statusCode: 400 });
  }

  // Generic error prevents user enumeration attacks
  const INVALID_CREDENTIALS = Object.assign(
    new Error('Invalid email or password'),
    { statusCode: 401 },
  );

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { organization: true },
  });

  if (!user) throw INVALID_CREDENTIALS;

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) throw INVALID_CREDENTIALS;

  logger.info({ userId: user.id, orgId: user.organizationId }, 'User logged in');

  const token = signToken({
    userId: user.id,
    organizationId: user.organizationId,
    email: user.email,
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
    },
  };
}

export async function getMe(userId: string): Promise<AuthResponseDto['user']> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { organization: true },
  });

  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
  };
}
