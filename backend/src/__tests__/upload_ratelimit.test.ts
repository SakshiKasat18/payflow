import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { uploadLimiter } from '../routes/jobs.js';
import type { Request, Response, NextFunction } from 'express';

describe('PayFlow — Upload Rate Limiting Unit Tests', () => {
  it('should allow up to 20 upload requests and reject the 21st with 429 Too Many Requests', async () => {
    let nextCalledCount = 0;
    let rateLimitedResponse: { status: number; body: unknown } | null = null;

    const mockReq = {
      ip: '192.168.1.100',
      headers: {},
      method: 'POST',
      url: '/api/jobs/upload',
      app: {
        get: () => false,
      },
    } as unknown as Request;

    const createMockRes = () => {
      const res: Partial<Response> = {
        statusCode: 200,
        setHeader: () => res as Response,
        getHeader: () => undefined,
        status(code: number) {
          this.statusCode = code;
          return this as Response;
        },
        json(body: unknown) {
          rateLimitedResponse = { status: this.statusCode ?? 200, body };
          return this as Response;
        },
        send(body: unknown) {
          rateLimitedResponse = { status: this.statusCode ?? 200, body };
          return this as Response;
        },
      };
      return res as Response;
    };

    const next: NextFunction = () => {
      nextCalledCount++;
    };

    // Execute 20 requests within the window
    for (let i = 0; i < 20; i++) {
      const res = createMockRes();
      await (uploadLimiter as unknown as (req: Request, res: Response, next: NextFunction) => Promise<void>)(mockReq, res, next);
    }

    assert.equal(nextCalledCount, 20, 'First 20 requests should pass through to next middleware');
    assert.equal(rateLimitedResponse, null, 'No rate limit error should have triggered for first 20 requests');

    // 21st request should be blocked
    const blockedRes = createMockRes();
    await (uploadLimiter as unknown as (req: Request, res: Response, next: NextFunction) => Promise<void>)(mockReq, blockedRes, next);

    assert.equal(nextCalledCount, 20, '21st request should not proceed to next middleware');
    assert.ok(rateLimitedResponse !== null, '21st request should receive rate limit response');
    assert.equal((rateLimitedResponse as { status: number; body: { success: boolean; error: { message: string } } }).status, 429);
  });
});
