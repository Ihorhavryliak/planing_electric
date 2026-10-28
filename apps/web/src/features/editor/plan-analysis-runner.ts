import type { UnderlaySettings } from '@drawmyplace/contracts';
import {
  drawAnalysisPreview,
  type PlanAnalysis,
  type WallMaskAnalysis,
  type WorkRaster,
} from './plan-analysis';

interface RunnerOptions {
  metersPerUnit?: number | null;
  detectOpenings?: boolean;
}

interface WorkerResponse {
  id: number;
  result?: WallMaskAnalysis;
  error?: string;
}

export interface AnalysisRun {
  promise: Promise<PlanAnalysis>;
  cancel: () => void;
}

/**
 * Runs the pixel-heavy analysis inside a module worker so the editor stays
 * responsive, and paints the preview back on the main thread.
 */
export function runPlanAnalysis(
  raster: WorkRaster,
  underlay: UnderlaySettings,
  options: RunnerOptions = {},
): AnalysisRun {
  const worker = new Worker(
    new URL('./plan-analysis.worker.ts', import.meta.url),
    { type: 'module' },
  );
  let rejectRun: ((error: Error) => void) | null = null;

  const promise = new Promise<PlanAnalysis>((resolve, reject) => {
    rejectRun = reject;

    const id = Date.now();

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) return;

      if (event.data.error || !event.data.result) {
        reject(new Error(event.data.error ?? 'Plan analysis failed'));
        return;
      }

      const result = event.data.result;

      resolve({
        rooms: result.rooms,
        walls: result.walls,
        openings: result.openings,
        wallThickness: result.wallThickness,
        imageWidth: raster.width,
        imageHeight: raster.height,
        preview: drawAnalysisPreview(
          raster.canvas,
          result.imageRooms,
          result.segments,
        ),
        wallCoverage: result.wallCoverage,
      });
    };

    worker.onerror = (event) => {
      reject(new Error(event.message || 'Plan analysis failed'));
    };

    worker.postMessage(
      {
        id,
        pixels: raster.pixels,
        width: raster.width,
        height: raster.height,
        underlay,
        options,
      },
      [raster.pixels.buffer],
    );
  }).finally(() => {
    worker.terminate();
  });

  return {
    promise,
    cancel: () => {
      worker.terminate();
      rejectRun?.(new Error('Plan analysis cancelled'));
    },
  };
}
