import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { signToken, verifyToken } from '../utils/jwt.js';

describe('PayFlow — Security & Authentication Tests', () => {
  const samplePayload = {
    userId: 'user-cmtm-12345',
    organizationId: 'org-cmtm-67890',
    email: 'admin.demo@payflow.local',
    role: 'ADMIN' as const,
  };

  it('should sign and verify JWT correctly with valid claims', () => {
    const token = signToken(samplePayload);
    assert.ok(typeof token === 'string' && token.length > 20, 'Token should be a non-empty string');

    const decoded = verifyToken(token);
    assert.equal(decoded.userId, samplePayload.userId);
    assert.equal(decoded.organizationId, samplePayload.organizationId);
    assert.equal(decoded.email, samplePayload.email);
    assert.equal(decoded.role, samplePayload.role);
  });

  it('should reject tampered JWT tokens', () => {
    const token = signToken(samplePayload);
    const tampered = token.slice(0, -5) + 'xxxxx';
    assert.throws(() => {
      verifyToken(tampered);
    }, /invalid|signature|jwt/i);
  });

  it('should reject malformed tokens', () => {
    assert.throws(() => {
      verifyToken('not.a.valid.jwt.token');
    });
  });

  it('organizationId in JWT payload must never be empty or undefined', () => {
    const token = signToken(samplePayload);
    const decoded = verifyToken(token);
    assert.ok(decoded.organizationId && decoded.organizationId.length > 0);
  });
});
