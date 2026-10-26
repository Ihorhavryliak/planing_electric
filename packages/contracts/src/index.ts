import { z } from 'zod';

export * from './auth';
export * from './devices';
export * from './device-library';
export * from './drawing';
export * from './estimate';
export * from './floor';
export * from './invitation';
export * from './material';
export * from './opening';
export * from './organization';
export * from './project';
export * from './structure';
export * from './variant';

export const uuidSchema = z.string().uuid();

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.union([z.string(), z.array(z.string())]),
  path: z.string(),
  timestamp: z.string().datetime(),
});

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
  timestamp: z.string().datetime(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
