import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly buckets = new Map<string, Bucket>();
  private readonly redis: Redis | null;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const url = config.get<string>('REDIS_URL');
    this.redis = url ? new Redis(url, { maxRetriesPerRequest: 2 }) : null;
  }

  async consume(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    if (this.redis) {
      try {
        return await this.consumeRedis(key, limit, windowMs);
      } catch {
        // Fall back to the in-memory bucket if Redis is unavailable.
      }
    }
    return this.consumeMemory(key, limit, windowMs);
  }

  reset(): void {
    this.buckets.clear();
  }

  onModuleDestroy(): void {
    this.redis?.disconnect();
  }

  private async consumeRedis(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    const redisKey = `ratelimit:${key}`;
    const count = await this.redis!.incr(redisKey);
    if (count === 1) {
      await this.redis!.pexpire(redisKey, windowMs);
    }
    const ttl = await this.redis!.pttl(redisKey);

    if (count > limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(ttl / 1_000)),
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: 0,
    };
  }

  private consumeMemory(
    key: string,
    limit: number,
    windowMs: number,
  ): RateLimitResult {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });

      if (this.buckets.size > 5_000) {
        this.prune(now);
      }

      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        retryAfterSeconds: 0,
      };
    }

    bucket.count += 1;

    if (bucket.count > limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((bucket.resetAt - now) / 1_000),
        ),
      };
    }

    return {
      allowed: true,
      remaining: limit - bucket.count,
      retryAfterSeconds: 0,
    };
  }

  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}