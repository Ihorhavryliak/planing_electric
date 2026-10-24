import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth';

describe('auth contracts', () => {
  it('normalizes email and trims the name during registration', () => {
    const parsed = registerSchema.parse({
      email: '  Person@Example.COM ',
      password: 'correct-horse-battery',
      name: '  Ihor  ',
    });

    expect(parsed).toEqual({
      email: 'person@example.com',
      password: 'correct-horse-battery',
      name: 'Ihor',
    });
  });

  it('rejects short registration passwords', () => {
    const result = registerSchema.safeParse({
      email: 'person@example.com',
      password: 'short',
      name: 'Ihor',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        'at least 10 characters',
      );
    }
  });

  it('accepts a valid login payload but normalizes its email', () => {
    expect(
      loginSchema.parse({
        email: ' USER@Example.com ',
        password: 'anything',
      }),
    ).toEqual({
      email: 'user@example.com',
      password: 'anything',
    });
  });

  it('rejects malformed email addresses', () => {
    expect(
      loginSchema.safeParse({
        email: 'not-an-email',
        password: 'anything',
      }).success,
    ).toBe(false);
  });
});
