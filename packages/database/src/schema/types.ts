export interface Point2D {
  x: number;
  y: number;
}

export interface UnderlaySettings {
  opacity?: number;
  visible?: boolean;
  locked?: boolean;
  rotation?: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface CalculationSettings {
  wastePercent?: number;
  defaultVerticalDropMeters?: number;
}
