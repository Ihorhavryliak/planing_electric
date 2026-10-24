import { describe, expect, it } from 'vitest';
import { RateLimitService } from '../src/modules/auth/rate-limit.service';

describe('RateLimitService', () => {
  it('allows requests up to the limit and rejects the next one', () => {
    const limiter = new RateLimitService();

    expect(limiter.consume('ip:route', 2, 60_000)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(limiter.consume('ip:route', 2, 60_000)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(limiter.consume('ip:route', 2, 60_000)).toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it('keeps separate buckets for different keys', () => {
    const limiter = new RateLimitService();

    limiter.consume('first', 1, 60_000);
    limiter.consume('first', 1, 60_000);

    expect(limiter.consume('second', 1, 60_000).allowed).toBe(true);
  });

  it('reports a retry delay that does not exceed the window', () => {
    const limiter = new RateLimitService();

    limiter.consume('key', 1, 60_000);
    limiter.consume('key', 1, 60_000);

    const denied = limiter.consume('key', 1, 60_000);

    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60);
  });
});
