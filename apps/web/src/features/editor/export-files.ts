import type {
  PublicFloor,
  PublicMaterial,
  PublicProject,
} from '@drawmyplace/contracts';
import { getPlanDrawing } from './drawing-api';
import { listFloors } from './editor-api';
import { listMaterials } from './materials-api';
import { getProject } from '@/features/projects/projects-api';

export interface ProjectExportFloor extends PublicFloor {
  drawing: Awaited<ReturnType<typeof getPlanDrawing>> | null;
}

export interface ProjectExport {
  format: 'drawmyplace-project';
  version: 1;
  exportedAt: string;
  project: PublicProject;
  floors: ProjectExportFloor[];
  materials: PublicMaterial[];
}

function safeFileName(value: string): string {
  return (
    value
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'drawmyplace'
  );
}

export function downloadTextFile(
  fileName: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  downloadBlob(fileName, blob);
}

export function downloadBytes(
  fileName: string,
  bytes: Uint8Array,
  mimeType: string,
): void {
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([buffer], { type: mimeType });
  downloadBlob(fileName, blob);
}

function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = safeFileName(fileName);
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadSvg(fileName: string, svg: string): void {
  downloadTextFile(fileName, svg, 'image/svg+xml');
}

/** Gathers the whole server project, including every floor plan drawing. */
export async function loadProjectExport(
  projectId: string,
): Promise<ProjectExport> {
  const [project, floors, materials] = await Promise.all([
    getProject(projectId),
    listFloors(projectId),
    listMaterials(),
  ]);
  const withDrawings: ProjectExportFloor[] = await Promise.all(
    floors.map(async (floor) => ({
      ...floor,
      drawing: floor.plan ? await getPlanDrawing(floor.plan.id) : null,
    })),
  );

  return {
    format: 'drawmyplace-project',
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    floors: withDrawings,
    materials,
  };
}

export function projectExportFileName(project: PublicProject): string {
  return `${safeFileName(project.name)}-project.json`;
}
