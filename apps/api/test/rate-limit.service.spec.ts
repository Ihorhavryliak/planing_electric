import type { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';
import { RateLimitService } from '../src/modules/auth/rate-limit.service';

function createLimiter(): RateLimitService {
  const config = {
    get: () => undefined,
  } as unknown as ConfigService;
  return new RateLimitService(config);
}

describe('RateLimitService', () => {
  it('allows requests up to the limit and rejects the next one', async () => {
    const limiter = createLimiter();

    expect(await limiter.consume('ip:route', 2, 60_000)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(await limiter.consume('ip:route', 2, 60_000)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(await limiter.consume('ip:route', 2, 60_000)).toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it('keeps separate buckets for different keys', async () => {
    const limiter = createLimiter();

    await limiter.consume('first', 1, 60_000);
    await limiter.consume('first', 1, 60_000);

    expect((await limiter.consume('second', 1, 60_000)).allowed).toBe(true);
  });

  it('reports a retry delay that does not exceed the window', async () => {
    const limiter = createLimiter();

    await limiter.consume('key', 1, 60_000);
    await limiter.consume('key', 1, 60_000);

    const denied = await limiter.consume('key', 1, 60_000);

    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    expect(denied.retryAfterSeconds).toBeLessThanOrEqual(60);
  });
});
