import {
  calculationSettingsSchema,
  editorViewportSchema,
  underlaySettingsSchema,
  type PublicFloor,
  type PublicPlan,
} from '@drawmyplace/contracts';
import type { FloorRow } from './floors.repository';
import type { PlanRow } from './plans.repository';

export function toPublicPlan(plan: PlanRow): PublicPlan {
  return {
    id: plan.id,
    floorId: plan.floorId,
    sourceType: plan.sourceType,
    mimeType: plan.mimeType,
    page: plan.page,
    hasFile: plan.fileKey !== null,
    hasPreview: plan.previewKey !== null,
    underlay: underlaySettingsSchema.parse(plan.underlay),
    viewport: editorViewportSchema.parse(plan.viewport),
    calculationSettings: calculationSettingsSchema.parse(
      plan.calculationSettings ?? {},
    ),
    version: plan.version,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

export function toPublicFloor(
  floor: FloorRow,
  plan: PlanRow | null,
): PublicFloor {
  return {
    id: floor.id,
    projectId: floor.projectId,
    name: floor.name,
    sortOrder: floor.sortOrder,
    plan: plan ? toPublicPlan(plan) : null,
    createdAt: floor.createdAt.toISOString(),
    updatedAt: floor.updatedAt.toISOString(),
  };
}
