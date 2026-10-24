import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  paginationQuerySchema,
  uuidSchema,
} from './index';

describe('shared contracts', () => {
  it('accepts UUIDs and rejects arbitrary ids', () => {
    expect(uuidSchema.parse(randomUUID())).toBeTruthy();
    expect(() => uuidSchema.parse('project-1')).toThrow();
  });

  it('applies pagination defaults and bounds', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationQuerySchema.parse({ page: '2', pageSize: '50' })).toEqual({
      page: 2,
      pageSize: 50,
    });
    expect(() => paginationQuerySchema.parse({ pageSize: 101 })).toThrow();
  });

  it('validates the API error shape', () => {
    const parsed = apiErrorSchema.parse({
      statusCode: 404,
      error: 'Not Found',
      message: 'Resource not found',
      path: '/api/v1/projects/missing',
      timestamp: new Date().toISOString(),
    });

    expect(parsed.statusCode).toBe(404);
  });
});
