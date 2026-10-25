import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SignedLink {
  expires: number;
  sig: string;
}

@Injectable()
export class SignedLinksService {
  private readonly secret: string;
  private readonly ttlSeconds: number;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.secret = config.getOrThrow<string>('EXPORT_LINK_SECRET');
    this.ttlSeconds = config.getOrThrow<number>('EXPORT_LINK_TTL_SECONDS');
  }

  create(path: string): SignedLink {
    const expires = Math.floor(Date.now() / 1000) + this.ttlSeconds;
    return { expires, sig: this.sign(path, expires) };
  }

  verify(path: string, expires: number, sig: string): boolean {
    if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) {
      return false;
    }
    const expected = this.sign(path, expires);
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private sign(path: string, expires: number): string {
    return createHmac('sha256', this.secret)
      .update(`${path}:${expires}`)
      .digest('base64url');
  }
}