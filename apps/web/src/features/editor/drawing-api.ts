import type {
  CreateDimensionInput,
  CreateOpeningInput,
  CreatePointInput,
  CreateRoomInput,
  CreateRouteInput,
  CreateWallInput,
  PlanCalculation,
  PlanDrawing,
  PublicCalibration,
  PublicDimension,
  PublicOpening,
  PublicPoint,
  PublicRoom,
  PublicRoute,
  PublicWall,
  SetCalibrationInput,
  UpdateDimensionInput,
  UpdateOpeningInput,
  UpdatePointInput,
  UpdateRoomInput,
  UpdateRouteInput,
  UpdateWallInput,
} from '@drawmyplace/contracts';
import { apiRequest } from '@/lib/api';

export function getPlanDrawing(
  planId: string,
  signal?: AbortSignal,
): Promise<PlanDrawing> {
  return apiRequest<PlanDrawing>(`/plans/${planId}/drawing`, { signal });
}

export function getPlanCalculation(
  planId: string,
  signal?: AbortSignal,
): Promise<PlanCalculation> {
  return apiRequest<PlanCalculation>(`/plans/${planId}/calculation`, {
    signal,
  });
}

export function saveCalibration(
  planId: string,
  input: SetCalibrationInput,
): Promise<PublicCalibration> {
  return apiRequest<PublicCalibration>(`/plans/${planId}/calibration`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function removeCalibration(planId: string): Promise<void> {
  await apiRequest<void>(`/plans/${planId}/calibration`, {
    method: 'DELETE',
  });
}

export function createWall(
  planId: string,
  input: CreateWallInput,
): Promise<PublicWall> {
  return apiRequest<PublicWall>(`/plans/${planId}/walls`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateWall(
  wallId: string,
  input: UpdateWallInput,
): Promise<PublicWall> {
  return apiRequest<PublicWall>(`/walls/${wallId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteWall(wallId: string): Promise<void> {
  await apiRequest<void>(`/walls/${wallId}`, { method: 'DELETE' });
}

export function createOpening(
  planId: string,
  input: CreateOpeningInput,
): Promise<PublicOpening> {
  return apiRequest<PublicOpening>(`/plans/${planId}/openings`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateOpening(
  openingId: string,
  input: UpdateOpeningInput,
): Promise<PublicOpening> {
  return apiRequest<PublicOpening>(`/openings/${openingId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteOpening(openingId: string): Promise<void> {
  await apiRequest<void>(`/openings/${openingId}`, { method: 'DELETE' });
}

export function createRoom(
  planId: string,
  input: CreateRoomInput,
): Promise<PublicRoom> {
  return apiRequest<PublicRoom>(`/plans/${planId}/rooms`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateRoom(
  roomId: string,
  input: UpdateRoomInput,
): Promise<PublicRoom> {
  return apiRequest<PublicRoom>(`/rooms/${roomId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteRoom(roomId: string): Promise<void> {
  await apiRequest<void>(`/rooms/${roomId}`, { method: 'DELETE' });
}

export function createDimension(
  planId: string,
  input: CreateDimensionInput,
): Promise<PublicDimension> {
  return apiRequest<PublicDimension>(`/plans/${planId}/dimensions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateDimension(
  dimensionId: string,
  input: UpdateDimensionInput,
): Promise<PublicDimension> {
  return apiRequest<PublicDimension>(`/dimensions/${dimensionId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteDimension(dimensionId: string): Promise<void> {
  await apiRequest<void>(`/dimensions/${dimensionId}`, { method: 'DELETE' });
}

export function createPoint(
  planId: string,
  input: CreatePointInput,
): Promise<PublicPoint> {
  return apiRequest<PublicPoint>(`/plans/${planId}/points`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePoint(
  pointId: string,
  input: UpdatePointInput,
): Promise<PublicPoint> {
  return apiRequest<PublicPoint>(`/points/${pointId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deletePoint(pointId: string): Promise<void> {
  await apiRequest<void>(`/points/${pointId}`, { method: 'DELETE' });
}

export function createRoute(
  planId: string,
  input: CreateRouteInput,
): Promise<PublicRoute> {
  return apiRequest<PublicRoute>(`/plans/${planId}/routes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateRoute(
  routeId: string,
  input: UpdateRouteInput,
): Promise<PublicRoute> {
  return apiRequest<PublicRoute>(`/routes/${routeId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteRoute(routeId: string): Promise<void> {
  await apiRequest<void>(`/routes/${routeId}`, { method: 'DELETE' });
}
