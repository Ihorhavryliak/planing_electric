import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.object({
  name: z.string().min(1),
  count: z.coerce.number().int().positive(),
});

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('returns parsed data for a valid payload', () => {
    expect(pipe.transform({ name: 'Kitchen', count: '3' })).toEqual({
      name: 'Kitchen',
      count: 3,
    });
  });

  it('throws a BadRequestException with field-level messages', () => {
    try {
      pipe.transform({ name: '', count: 0 });
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);

      if (error instanceof BadRequestException) {
        expect(error.getResponse()).toMatchObject({
          error: 'Bad Request',
          message: expect.arrayContaining([
            'name: Too small: expected string to have >=1 characters',
            'count: Too small: expected number to be >0',
          ]),
        });
      }
    }
  });
});
