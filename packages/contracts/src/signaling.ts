import { z } from 'zod';

/** Discipline of a cable route / signaling loop. */
export const signalingSystemSchema = z.enum([
  'power',
  'security',
  'fire',
  'cctv',
  'pa',
  'data',
]);

export type SignalingSystem = z.infer<typeof signalingSystemSchema>;

export const signalingLoopTypeSchema = z.enum([
  'security',
  'fire',
  'combined',
  'access',
  'cctv',
  'pa',
]);

export type SignalingLoopType = z.infer<typeof signalingLoopTypeSchema>;

export const signalingTopologySchema = z.enum(['radial', 'loop', 'bus']);
export type SignalingTopology = z.infer<typeof signalingTopologySchema>;

const loopIdSchema = z.string().trim().min(1).max(40);
const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a #rrggbb color');

export const signalingLoopSchema = z.object({
  id: loopIdSchema,
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(60),
  type: signalingLoopTypeSchema,
  topology: signalingTopologySchema.default('radial'),
  /** Distribution board / control panel point id, when linked. */
  panelId: z.string().uuid().nullable().optional(),
  zone: z.number().int().min(0).max(999).nullable().optional(),
  color: colorSchema.default('#2f6bd8'),
  cableMaterialId: z.string().uuid().nullable().optional(),
  maxLength: z.number().positive().max(100_000).optional(),
  maxDevices: z.number().int().positive().max(2_000).optional(),
  voltageV: z.number().positive().max(1_000).optional(),
});

export type SignalingLoop = z.infer<typeof signalingLoopSchema>;

export const signalingSettingsSchema = z.object({
  loops: z.array(signalingLoopSchema).max(200).default([]),
});

export type SignalingSettings = z.infer<typeof signalingSettingsSchema>;

export const DEFAULT_SIGNALING_SETTINGS: SignalingSettings = { loops: [] };

export function normalizeSignalingSettings(value: unknown): SignalingSettings {
  const parsed = signalingSettingsSchema.safeParse(value);

  return parsed.success ? parsed.data : DEFAULT_SIGNALING_SETTINGS;
}

/** Point-level signaling assignment. */
export const pointSignalingSchema = z.object({
  loopId: loopIdSchema.nullable().optional(),
  /** Address for addressable systems (1–254 typical). */
  address: z.number().int().min(0).max(9_999).nullable().optional(),
  zone: z.number().int().min(0).max(999).nullable().optional(),
});

/** Route discipline, stored alongside mounting/circuit settings. */
export const routeSystemSchema = signalingSystemSchema.optional();
