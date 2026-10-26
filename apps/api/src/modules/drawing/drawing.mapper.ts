import {
  point2DSchema,
  pointPropertiesSchema,
  routeGeometrySchema,
  routeSettingsSchema,
  lengthUnitSchema,
  roomBoundarySchema,
  wallGeometrySchema,
  type PublicCalibration,
  type PublicDimension,
  type PublicOpening,
  type PublicPoint,
  type PublicRoom,
  type PublicRoute,
  type PublicWall,
} from '@drawmyplace/contracts';
import type {
  CalibrationRow,
  DimensionRow,
  OpeningRow,
  PointRow,
  RoomRow,
  RouteRow,
  WallRow,
} from './drawing.repository';

export function toPublicCalibration(row: CalibrationRow): PublicCalibration {
  return {
    planId: row.planId,
    pointA: point2DSchema.parse(row.pointA),
    pointB: point2DSchema.parse(row.pointB),
    realDistance: row.knownDistance,
    unit: lengthUnitSchema.parse(row.unit),
    metersPerUnit: row.metersPerPixel,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicWall(row: WallRow): PublicWall {
  return {
    id: row.id,
    floorId: row.floorId,
    geometry: wallGeometrySchema.parse(row.geometry),
    thickness: row.thickness,
    label: row.label,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicOpening(row: OpeningRow): PublicOpening {
  return {
    id: row.id,
    floorId: row.floorId,
    wallId: row.wallId,
    type: row.type,
    offset: row.offset,
    width: row.width,
    height: row.height,
    sillHeight: row.sillHeight,
    flipped: row.flipped,
    label: row.label,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicRoom(row: RoomRow): PublicRoom {
  return {
    id: row.id,
    floorId: row.floorId,
    name: row.name,
    boundary: roomBoundarySchema.parse(row.boundary),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicDimension(row: DimensionRow): PublicDimension {
  return {
    id: row.id,
    floorId: row.floorId,
    pointA: point2DSchema.parse(row.pointA),
    pointB: point2DSchema.parse(row.pointB),
    offset: row.offset,
    label: row.label,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicPoint(row: PointRow): PublicPoint {
  return {
    id: row.id,
    floorId: row.floorId,
    type: row.type,
    x: row.x,
    y: row.y,
    rotation: row.rotation,
    label: row.label,
    mountingHeight: row.mountingHeight,
    properties: pointPropertiesSchema.parse(row.properties),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicRoute(row: RouteRow): PublicRoute {
  return {
    id: row.id,
    floorId: row.floorId,
    circuitId: row.circuitId,
    materialId: row.materialId,
    startPointId: row.startPointId,
    endPointId: row.endPointId,
    geometry: routeGeometrySchema.parse(row.geometry),
    settings: routeSettingsSchema.parse(row.settings),
    updatedAt: row.updatedAt.toISOString(),
  };
}
