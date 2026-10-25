import { z } from 'zod';

const COORD_LIMIT = 10_000_000;
const LABEL_MAX = 80;

export const MAX_WALL_VERTICES = 500;
export const MAX_ROOM_VERTICES = 200;

const structurePointSchema = z.object({
  x: z.number().min(-COORD_LIMIT).max(COORD_LIMIT),
  y: z.number().min(-COORD_LIMIT).max(COORD_LIMIT),
});

const structureLabelSchema = z.string().trim().max(LABEL_MAX);

function pointsDiffer(
  a: { x: number; y: number },
  b: { x: number; y: number },
): boolean {
  return a.x !== b.x || a.y !== b.y;
}

// --------------------------------------------------------------------- walls

export const wallGeometrySchema = z
  .array(structurePointSchema)
  .min(2, 'A wall needs at least two points')
  .max(MAX_WALL_VERTICES);

const wallThicknessSchema = z.number().min(0).max(100_000).nullable();

export const createWallSchema = z.object({
  geometry: wallGeometrySchema,
  thickness: wallThicknessSchema.optional(),
  label: structureLabelSchema.nullable().optional(),
});

export const updateWallSchema = z
  .object({
    geometry: wallGeometrySchema.optional(),
    thickness: wallThicknessSchema.optional(),
    label: structureLabelSchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  });

export const publicWallSchema = z.object({
  id: z.string().uuid(),
  floorId: z.string().uuid(),
  geometry: wallGeometrySchema,
  thickness: z.number().nullable(),
  label: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

// --------------------------------------------------------------------- rooms

export const roomBoundarySchema = z
  .array(structurePointSchema)
  .min(3, 'A room needs at least three boundary points')
  .max(MAX_ROOM_VERTICES);

const roomNameSchema = z.string().trim().min(1).max(LABEL_MAX);

export const createRoomSchema = z.object({
  name: roomNameSchema.default('Room'),
  boundary: roomBoundarySchema,
});

export const updateRoomSchema = z
  .object({
    name: roomNameSchema.optional(),
    boundary: roomBoundarySchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  });

export const publicRoomSchema = z.object({
  id: z.string().uuid(),
  floorId: z.string().uuid(),
  name: z.string(),
  boundary: roomBoundarySchema,
  updatedAt: z.string().datetime(),
});

// ---------------------------------------------------------------- dimensions

const dimensionOffsetSchema = z.number().min(-1_000_000).max(1_000_000);

export const createDimensionSchema = z
  .object({
    pointA: structurePointSchema,
    pointB: structurePointSchema,
    offset: dimensionOffsetSchema.default(0),
    label: structureLabelSchema.nullable().optional(),
  })
  .refine((value) => pointsDiffer(value.pointA, value.pointB), {
    message: 'Dimension points must not coincide',
    path: ['pointB'],
  });

export const updateDimensionSchema = z
  .object({
    pointA: structurePointSchema.optional(),
    pointB: structurePointSchema.optional(),
    offset: dimensionOffsetSchema.optional(),
    label: structureLabelSchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'Provide at least one field to update',
  })
  .refine(
    (value) =>
      !value.pointA ||
      !value.pointB ||
      pointsDiffer(value.pointA, value.pointB),
    {
      message: 'Dimension points must not coincide',
      path: ['pointB'],
    },
  );

export const publicDimensionSchema = z.object({
  id: z.string().uuid(),
  floorId: z.string().uuid(),
  pointA: structurePointSchema,
  pointB: structurePointSchema,
  offset: z.number(),
  label: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export type CreateWallInput = z.infer<typeof createWallSchema>;
export type UpdateWallInput = z.infer<typeof updateWallSchema>;
export type PublicWall = z.infer<typeof publicWallSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type PublicRoom = z.infer<typeof publicRoomSchema>;
export type CreateDimensionInput = z.infer<typeof createDimensionSchema>;
export type UpdateDimensionInput = z.infer<typeof updateDimensionSchema>;
export type PublicDimension = z.infer<typeof publicDimensionSchema>;
