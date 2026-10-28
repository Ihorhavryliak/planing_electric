import type { UnderlaySettings } from '@drawmyplace/contracts';
import {
  analyzePixels,
  type WallMaskAnalysis,
} from './plan-analysis';

interface AnalysisRequest {
  id: number;
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  underlay: UnderlaySettings;
  options: {
    metersPerUnit?: number | null;
    detectOpenings?: boolean;
  };
}

interface AnalysisResponse {
  id: number;
  result?: WallMaskAnalysis;
  error?: string;
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<AnalysisRequest>) => void) | null;
  postMessage: (message: AnalysisResponse) => void;
};

scope.onmessage = (event) => {
  const { id, pixels, width, height, underlay, options } = event.data;

  try {
    scope.postMessage({
      id,
      result: analyzePixels(pixels, width, height, underlay, options),
    });
  } catch (error) {
    scope.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
