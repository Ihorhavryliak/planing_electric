import type { UnderlaySettings } from '@drawmyplace/contracts';
import type { Vec2 } from './editor-geometry';

/**
 * Automatic floor-plan analysis.
 *
 * The underlay image is rasterized on a small canvas, converted to a binary
 * "wall" mask (long dark runs), and split into horizontal/vertical wall bands.
 * Double lines of a drawn wall are merged, collinear pieces are joined, and the
 * free space between the walls is flood-filled to find rooms. Door openings are
 * sealed before the flood fill so a doorway does not merge two rooms into one.
 *
 * The result is expressed in plan units, so the caller can create walls and
 * rooms through the regular drawing API.
 */

const MAX_WORK_SIZE = 1000;
const MAX_ROOM_VERTICES = 180;

export interface AnalysisWall {
  geometry: Vec2[];
  thickness: number;
}

export interface AnalysisRoom {
  boundary: Vec2[];
  /** Area in square plan units. */
  area: number;
}

export interface PlanAnalysis {
  rooms: AnalysisRoom[];
  walls: AnalysisWall[];
  /** Detected wall thickness in plan units. */
  wallThickness: number;
  imageWidth: number;
  imageHeight: number;
  /** PNG data URL with the detection painted over the underlay. */
  preview: string;
  /** Share of the image covered by wall pixels, for the summary. */
  wallCoverage: number;
}

type SegmentAxis = 'h' | 'v';

interface Segment {
  axis: SegmentAxis;
  /** Perpendicular coordinate (row for horizontal, column for vertical). */
  pos: number;
  /** Start of the run along the axis. */
  a: number;
  /** End of the run along the axis. */
  b: number;
  thickness: number;
}

interface Band {
  a1: number;
  a2: number;
  b1: number;
  b2: number;
}

interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface WorkRaster {
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  pixels: Uint8ClampedArray;
}

function rasterize(image: HTMLImageElement): WorkRaster {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const ratio = Math.min(
    1,
    MAX_WORK_SIZE / Math.max(sourceWidth, sourceHeight),
  );
  const width = Math.max(16, Math.round(sourceWidth * ratio));
  const height = Math.max(16, Math.round(sourceHeight * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Canvas is not available');
  }

  // Flatten transparent PNGs on white so the threshold sees real lines.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  return {
    width,
    height,
    canvas,
    context,
    pixels: context.getImageData(0, 0, width, height).data,
  };
}

function otsuThreshold(gray: Uint8Array): number {
  const histogram = new Array<number>(256).fill(0);

  for (const value of gray) {
    histogram[value] = (histogram[value] ?? 0) + 1;
  }

  const total = gray.length;
  let sum = 0;

  for (let value = 0; value < 256; value += 1) {
    sum += value * (histogram[value] ?? 0);
  }

  let weightBackground = 0;
  let sumBackground = 0;
  let best = 0;
  let bestVariance = -1;

  for (let value = 0; value < 256; value += 1) {
    const count = histogram[value] ?? 0;
    weightBackground += count;

    if (weightBackground === 0) continue;

    const weightForeground = total - weightBackground;

    if (weightForeground === 0) break;

    sumBackground += value * count;
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance =
      weightBackground *
      weightForeground *
      (meanBackground - meanForeground) *
      (meanBackground - meanForeground);

    if (variance > bestVariance) {
      bestVariance = variance;
      best = value;
    }
  }

  return best;
}

function buildWallMask(raster: WorkRaster): Uint8Array {
  const { width, height, pixels } = raster;
  const gray = new Uint8Array(width * height);

  for (let index = 0; index < gray.length; index += 1) {
    const red = pixels[index * 4] ?? 255;
    const green = pixels[index * 4 + 1] ?? 255;
    const blue = pixels[index * 4 + 2] ?? 255;
    gray[index] = Math.round((red * 299 + green * 587 + blue * 114) / 1000);
  }

  const threshold = Math.min(205, Math.max(55, otsuThreshold(gray)));
  const mask = new Uint8Array(gray.length);
  let darkCount = 0;
  let lightCount = 0;

  for (let index = 0; index < gray.length; index += 1) {
    const value = gray[index] ?? 255;

    if (value < threshold) {
      mask[index] = 1;
      darkCount += 1;
    } else if (value > 255 - threshold) {
      lightCount += 1;
    }
  }

  // Blueprints are often light lines on a dark background.
  const inverted = darkCount > lightCount && darkCount > gray.length * 0.5;

  if (inverted) {
    for (let index = 0; index < gray.length; index += 1) {
      mask[index] = mask[index] === 1 ? 0 : 1;
    }
  }

  return keepLongRuns(mask, width, height);
}

/**
 * Keeps only pixels that belong to a long horizontal or vertical run. Text,
 * hatching and small furniture symbols disappear at this step.
 */
function keepLongRuns(
  mask: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const minRun = Math.max(9, Math.round(width * 0.018));
  const kept = new Uint8Array(mask.length);

  for (let y = 0; y < height; y += 1) {
    let x = 0;

    while (x < width) {
      while (x < width && mask[y * width + x] !== 1) x += 1;
      const start = x;

      while (x < width && mask[y * width + x] === 1) x += 1;

      if (x - start >= minRun) {
        for (let index = start; index < x; index += 1) {
          kept[y * width + index] = 1;
        }
      }
    }
  }

  for (let x = 0; x < width; x += 1) {
    let y = 0;

    while (y < height) {
      while (y < height && mask[y * width + x] !== 1) y += 1;
      const start = y;

      while (y < height && mask[y * width + x] === 1) y += 1;

      if (y - start >= minRun) {
        for (let index = start; index < y; index += 1) {
          kept[index * width + x] = 1;
        }
      }
    }
  }

  return kept;
}

function sharedLength(
  a1: number,
  a2: number,
  b1: number,
  b2: number,
): number {
  return Math.min(a2, b2) - Math.max(a1, b1) + 1;
}

function extractBands(
  isWall: (along: number, across: number) => boolean,
  along: number,
  across: number,
): Band[] {
  const bands: Band[] = [];
  let open: Band[] = [];

  for (let acrossIndex = 0; acrossIndex < across; acrossIndex += 1) {
    const next: Band[] = [];
    let alongIndex = 0;

    while (alongIndex < along) {
      while (alongIndex < along && !isWall(alongIndex, acrossIndex)) {
        alongIndex += 1;
      }

      if (alongIndex >= along) break;

      const start = alongIndex;

      while (alongIndex < along && isWall(alongIndex, acrossIndex)) {
        alongIndex += 1;
      }

      const end = alongIndex - 1;
      const length = end - start + 1;
      let matched: Band | undefined;

      for (const band of open) {
        if (band.b2 !== acrossIndex - 1) continue;

        const shared = sharedLength(band.a1, band.a2, start, end);

        if (
          shared >=
          Math.max(band.a2 - band.a1 + 1, length) * 0.6
        ) {
          matched = band;
          break;
        }
      }

      if (matched) {
        matched.b2 = acrossIndex;
        matched.a1 = Math.min(matched.a1, start);
        matched.a2 = Math.max(matched.a2, end);
        next.push(matched);
      } else {
        const band: Band = {
          a1: start,
          a2: end,
          b1: acrossIndex,
          b2: acrossIndex,
        };
        bands.push(band);
        next.push(band);
      }
    }

    open = next;
  }

  return bands;
}

/**
 * Floor plans usually draw a wall as two thin parallel lines. Bands that run
 * next to each other and are thin are merged into a single wall with the full
 * thickness.
 */
function mergeCloseBands(
  bands: Band[],
  maxGap: number,
  maxThickness: number,
): Band[] {
  const list = bands.slice();
  let changed = true;

  while (changed) {
    changed = false;

    for (let first = 0; first < list.length && !changed; first += 1) {
      const a = list[first];

      if (!a) continue;

      for (let second = first + 1; second < list.length; second += 1) {
        const b = list[second];

        if (!b) continue;

        const shared = sharedLength(a.a1, a.a2, b.a1, b.a2);
        const minLength = Math.min(a.a2 - a.a1 + 1, b.a2 - b.a1 + 1);

        if (shared < minLength * 0.65) continue;

        const gap =
          a.b1 > b.b2
            ? a.b1 - b.b2 - 1
            : b.b1 > a.b2
              ? b.b1 - a.b2 - 1
              : -1;

        if (gap < 0 || gap > maxGap) continue;

        const thicknessA = a.b2 - a.b1 + 1;
        const thicknessB = b.b2 - b.b1 + 1;

        if (thicknessA > maxThickness || thicknessB > maxThickness) continue;

        if (thicknessA + thicknessB + gap > maxThickness * 3) continue;

        list[first] = {
          a1: Math.min(a.a1, b.a1),
          a2: Math.max(a.a2, b.a2),
          b1: Math.min(a.b1, b.b1),
          b2: Math.max(a.b2, b.b2),
        };
        list.splice(second, 1);
        changed = true;
        break;
      }
    }
  }

  return list;
}

function makeSnapper(
  values: number[],
  tolerance: number,
): (value: number) => number {
  const sorted = [...values].sort((left, right) => left - right);
  const centers: number[] = [];
  let sum = 0;
  let count = 0;

  for (const value of sorted) {
    if (count === 0 || value - sum / count <= tolerance) {
      sum += value;
      count += 1;
    } else {
      centers.push(sum / count);
      sum = value;
      count = 1;
    }
  }

  if (count > 0) {
    centers.push(sum / count);
  }

  return (value: number) => {
    let best = value;
    let bestDistance = tolerance;

    for (const center of centers) {
      const distance = Math.abs(center - value);

      if (distance <= bestDistance) {
        bestDistance = distance;
        best = center;
      }
    }

    return best;
  };
}

function mergeSegments(
  segments: Segment[],
  positionTolerance: number,
  joinGap: number,
): Segment[] {
  const sorted = [...segments].sort(
    (left, right) => left.pos - right.pos || left.a - right.a,
  );
  const merged: Segment[] = [];

  for (const segment of sorted) {
    const last = merged[merged.length - 1];

    if (
      last &&
      last.axis === segment.axis &&
      Math.abs(last.pos - segment.pos) <= positionTolerance &&
      segment.a <= last.b + joinGap
    ) {
      last.b = Math.max(last.b, segment.b);
      last.thickness = Math.max(last.thickness, segment.thickness);
      continue;
    }

    merged.push({ ...segment });
  }

  return merged;
}

function detectSegments(
  mask: Uint8Array,
  width: number,
  height: number,
): Segment[] {
  const isWall = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;

  const horizontalBands = mergeCloseBands(
    extractBands(isWall, width, height),
    Math.max(3, Math.round(height * 0.03)),
    Math.max(4, Math.round(height * 0.045)),
  );
  const verticalBands = mergeCloseBands(
    extractBands((y, x) => isWall(x, y), height, width),
    Math.max(3, Math.round(width * 0.03)),
    Math.max(4, Math.round(width * 0.045)),
  );

  const minLength = Math.max(12, Math.round(Math.max(width, height) * 0.03));
  const maxThickness = Math.round(Math.max(width, height) * 0.09);

  const horizontal: Segment[] = [];
  const vertical: Segment[] = [];
  const horizontalPositions: number[] = [];
  const verticalPositions: number[] = [];

  for (const band of horizontalBands) {
    const thickness = band.b2 - band.b1 + 1;
    const length = band.a2 - band.a1 + 1;

    if (length < minLength || thickness > maxThickness) continue;

    horizontal.push({
      axis: 'h',
      pos: (band.b1 + band.b2) / 2,
      a: band.a1,
      b: band.a2,
      thickness,
    });
    horizontalPositions.push((band.b1 + band.b2) / 2);
  }

  for (const band of verticalBands) {
    const thickness = band.b2 - band.b1 + 1;
    const length = band.a2 - band.a1 + 1;

    if (length < minLength || thickness > maxThickness) continue;

    vertical.push({
      axis: 'v',
      pos: (band.b1 + band.b2) / 2,
      a: band.a1,
      b: band.a2,
      thickness,
    });
    verticalPositions.push((band.b1 + band.b2) / 2);
  }

  const snapHorizontal = makeSnapper(
    horizontalPositions,
    Math.max(2, Math.round(height * 0.012)),
  );
  const snapVertical = makeSnapper(
    verticalPositions,
    Math.max(2, Math.round(width * 0.012)),
  );

  for (const segment of horizontal) {
    segment.pos = snapHorizontal(segment.pos);
  }

  for (const segment of vertical) {
    segment.pos = snapVertical(segment.pos);
  }

  return mergeSegments(
    [
      ...mergeSegments(horizontal, 2, 3),
      ...mergeSegments(vertical, 2, 3),
    ],
    2,
    3,
  );
}

function drawBlockedSegment(
  blocked: Uint8Array,
  width: number,
  height: number,
  segment: Segment,
  minimumThickness = 3,
): void {
  const half = Math.max(
    1,
    Math.round(Math.max(segment.thickness, minimumThickness) / 2),
  );

  if (segment.axis === 'h') {
    const fromY = Math.max(0, Math.round(segment.pos) - half);
    const toY = Math.min(height - 1, Math.round(segment.pos) + half);
    const fromX = Math.max(0, Math.round(segment.a));
    const toX = Math.min(width - 1, Math.round(segment.b));

    for (let y = fromY; y <= toY; y += 1) {
      for (let x = fromX; x <= toX; x += 1) {
        blocked[y * width + x] = 1;
      }
    }

    return;
  }

  const fromX = Math.max(0, Math.round(segment.pos) - half);
  const toX = Math.min(width - 1, Math.round(segment.pos) + half);
  const fromY = Math.max(0, Math.round(segment.a));
  const toY = Math.min(height - 1, Math.round(segment.b));

  for (let y = fromY; y <= toY; y += 1) {
    for (let x = fromX; x <= toX; x += 1) {
      blocked[y * width + x] = 1;
    }
  }
}

function sealDoorways(
  blocked: Uint8Array,
  width: number,
  height: number,
  segments: Segment[],
  maxGap: number,
): Segment[] {
  const groups = new Map<string, Segment[]>();
  const seals: Segment[] = [];

  for (const segment of segments) {
    const key = `${segment.axis}:${Math.round(segment.pos * 2)}`;
    const group = groups.get(key);

    if (group) {
      group.push(segment);
    } else {
      groups.set(key, [segment]);
    }
  }

  for (const group of groups.values()) {
    group.sort((left, right) => left.a - right.a);

    for (let index = 0; index < group.length - 1; index += 1) {
      const current = group[index];
      const next = group[index + 1];

      if (!current || !next) continue;

      const gap = next.a - current.b;

      if (gap < 3 || gap > maxGap) continue;

      const thickness = Math.max(current.thickness, next.thickness);
      const seal: Segment = {
        axis: current.axis,
        pos: (current.pos + next.pos) / 2,
        a: current.b,
        b: next.a,
        thickness,
      };
      drawBlockedSegment(blocked, width, height, seal, 2);
      seals.push(seal);
    }
  }

  return seals;
}

interface Region {
  label: number;
  area: number;
  box: Box;
  touches: { top: boolean; left: boolean; right: boolean; bottom: boolean };
}

function findRegions(
  blocked: Uint8Array,
  width: number,
  height: number,
): { labels: Int32Array; regions: Region[] } {
  const labels = new Int32Array(width * height).fill(-1);
  const stack = new Int32Array(width * height);
  const regions: Region[] = [];
  let nextLabel = 0;

  for (let start = 0; start < blocked.length; start += 1) {
    if (blocked[start] === 1 || labels[start] !== -1) continue;

    const label = nextLabel;
    nextLabel += 1;
    let top = Number.POSITIVE_INFINITY;
    let left = Number.POSITIVE_INFINITY;
    let right = 0;
    let bottom = 0;
    let area = 0;
    let touchesTop = false;
    let touchesLeft = false;
    let touchesRight = false;
    let touchesBottom = false;
    let stackSize = 1;
    stack[0] = start;
    labels[start] = label;

    while (stackSize > 0) {
      stackSize -= 1;
      const index = stack[stackSize] ?? 0;
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (y === 0) touchesTop = true;
      if (y === height - 1) touchesBottom = true;
      if (x === 0) touchesLeft = true;
      if (x === width - 1) touchesRight = true;

      const neighbours = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];

      for (const neighbour of neighbours) {
        if (neighbour < 0) continue;
        if (blocked[neighbour] === 1) continue;
        if (labels[neighbour] !== -1) continue;

        labels[neighbour] = label;
        stack[stackSize] = neighbour;
        stackSize += 1;
      }
    }

    regions.push({
      label,
      area,
      box: { x1: left, y1: top, x2: right, y2: bottom },
      touches: {
        top: touchesTop,
        left: touchesLeft,
        right: touchesRight,
        bottom: touchesBottom,
      },
    });
  }

  return { labels, regions };
}

function polygonArea(points: Vec2[]): number {
  let area = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];

    if (!current || !next) continue;

    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
}

function perpendicularDistance(point: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);

  if (length < 1e-9) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }

  return Math.abs(dy * point.x - dx * point.y + b.x * a.y - b.y * a.x) / length;
}

function simplifyChain(points: Vec2[], epsilon: number): Vec2[] {
  if (points.length <= 2) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const pending: Array<[number, number]> = [[0, points.length - 1]];

  while (pending.length > 0) {
    const range = pending.pop();

    if (!range) continue;
    const [first, last] = range;

    if (last <= first + 1) continue;

    const start = points[first];
    const end = points[last];

    if (!start || !end) continue;

    let farthest = 0;
    let farthestIndex = first;

    for (let index = first + 1; index < last; index += 1) {
      const point = points[index];

      if (!point) continue;
      const distance = perpendicularDistance(point, start, end);

      if (distance > farthest) {
        farthest = distance;
        farthestIndex = index;
      }
    }

    if (farthest > epsilon) {
      keep[farthestIndex] = 1;
      pending.push([first, farthestIndex], [farthestIndex, last]);
    }
  }

  return points.filter((_, index) => keep[index] === 1);
}

function simplifyPolygon(points: Vec2[], epsilon: number): Vec2[] {
  if (points.length <= 3) return points;

  let farthestIndex = 1;
  let farthestDistance = -1;

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const first = points[0];

    if (!point || !first) continue;
    const distance = Math.hypot(point.x - first.x, point.y - first.y);

    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthestIndex = index;
    }
  }

  const firstChain = simplifyChain(points.slice(0, farthestIndex + 1), epsilon);
  const secondChain = simplifyChain(
    [...points.slice(farthestIndex), points[0] as Vec2],
    epsilon,
  );

  return [...firstChain.slice(0, -1), ...secondChain.slice(0, -1)];
}

function traceContour(
  labels: Int32Array,
  width: number,
  height: number,
  label: number,
  box: Box,
): Vec2[] {
  const inside = (x: number, y: number) =>
    x >= 0 &&
    y >= 0 &&
    x < width &&
    y < height &&
    labels[y * width + x] === label;

  interface Crack {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  const cracks: Crack[] = [];

  for (let y = box.y1; y <= box.y2; y += 1) {
    for (let x = box.x1; x <= box.x2; x += 1) {
      if (!inside(x, y)) continue;

      if (!inside(x, y - 1)) cracks.push({ x1: x, y1: y, x2: x + 1, y2: y });
      if (!inside(x + 1, y)) {
        cracks.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 });
      }
      if (!inside(x, y + 1)) {
        cracks.push({ x1: x + 1, y1: y + 1, x2: x, y2: y + 1 });
      }
      if (!inside(x - 1, y)) cracks.push({ x1: x, y1: y + 1, x2: x, y2: y });
    }
  }

  if (cracks.length === 0) return [];

  const byStart = new Map<string, number[]>();

  cracks.forEach((crack, index) => {
    const key = `${crack.x1},${crack.y1}`;
    const list = byStart.get(key);

    if (list) {
      list.push(index);
    } else {
      byStart.set(key, [index]);
    }
  });

  const used = new Uint8Array(cracks.length);
  let best: Vec2[] = [];
  let bestArea = 0;

  for (let start = 0; start < cracks.length; start += 1) {
    if (used[start] === 1) continue;

    const polygon: Vec2[] = [];
    let current = start;
    let guard = 0;

    while (guard <= cracks.length) {
      guard += 1;

      if (used[current] === 1) break;

      used[current] = 1;
      const crack = cracks[current];

      if (!crack) break;
      polygon.push({ x: crack.x1, y: crack.y1 });
      const candidates = byStart.get(`${crack.x2},${crack.y2}`) ?? [];
      const next = candidates.find((index) => used[index] !== 1);

      if (next === undefined) break;

      current = next;
    }

    if (polygon.length < 4) continue;

    const area = Math.abs(polygonArea(polygon));

    if (area > bestArea) {
      bestArea = area;
      best = polygon;
    }
  }

  return best;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }

  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

class PointGrid {
  private readonly cells = new Map<string, Vec2[]>();

  private readonly tolerance: number;

  constructor(tolerance: number) {
    this.tolerance = Math.max(0.001, tolerance);
  }

  add(point: Vec2): Vec2 {
    const cellX = Math.floor(point.x / this.tolerance);
    const cellY = Math.floor(point.y / this.tolerance);

    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const cell = this.cells.get(`${cellX + dx}:${cellY + dy}`);

        if (!cell) continue;

        for (const candidate of cell) {
          if (
            Math.abs(candidate.x - point.x) <= this.tolerance &&
            Math.abs(candidate.y - point.y) <= this.tolerance
          ) {
            return candidate;
          }
        }
      }
    }

    const stored = { x: point.x, y: point.y };
    const key = `${cellX}:${cellY}`;
    const cell = this.cells.get(key);

    if (cell) {
      cell.push(stored);
    } else {
      this.cells.set(key, [stored]);
    }

    return stored;
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function toPlanPoint(
  point: Vec2,
  width: number,
  height: number,
  underlay: UnderlaySettings,
): Vec2 {
  const scale = underlay.scale || 1;
  const radians = (underlay.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = (point.x - width / 2) * scale;
  const dy = (point.y - height / 2) * scale;

  return {
    x: round(underlay.offsetX + dx * cos - dy * sin),
    y: round(underlay.offsetY + dx * sin + dy * cos),
  };
}

function renderPreview(
  raster: WorkRaster,
  rooms: Vec2[][],
  segments: Segment[],
): string {
  const { context } = raster;
  context.save();
  context.lineJoin = 'round';
  context.lineCap = 'round';

  for (const room of rooms) {
    context.beginPath();
    room.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
    context.closePath();
    context.fillStyle = 'rgba(45, 212, 191, 0.18)';
    context.strokeStyle = 'rgba(45, 212, 191, 0.95)';
    context.lineWidth = 1.6;
    context.fill();
    context.stroke();
  }

  context.strokeStyle = 'rgba(13, 148, 136, 1)';
  context.lineWidth = 2.5;

  for (const segment of segments) {
    context.beginPath();

    if (segment.axis === 'h') {
      context.moveTo(segment.a, segment.pos);
      context.lineTo(segment.b, segment.pos);
    } else {
      context.moveTo(segment.pos, segment.a);
      context.lineTo(segment.pos, segment.b);
    }

    context.stroke();
  }

  context.restore();
  context.globalAlpha = 1;

  return raster.canvas.toDataURL('image/png');
}

interface LineWall {
  horizontal: boolean;
  pos: number;
  a: number;
  b: number;
  thickness: number;
}

function mergeCollinearWalls(
  walls: AnalysisWall[],
  tolerance: number,
): AnalysisWall[] {
  const horizontal: LineWall[] = [];
  const vertical: LineWall[] = [];
  const other: AnalysisWall[] = [];

  for (const wall of walls) {
    const [from, to] = wall.geometry;

    if (!from || !to) continue;

    if (Math.abs(from.y - to.y) <= tolerance) {
      horizontal.push({
        horizontal: true,
        pos: (from.y + to.y) / 2,
        a: Math.min(from.x, to.x),
        b: Math.max(from.x, to.x),
        thickness: wall.thickness,
      });
    } else if (Math.abs(from.x - to.x) <= tolerance) {
      vertical.push({
        horizontal: false,
        pos: (from.x + to.x) / 2,
        a: Math.min(from.y, to.y),
        b: Math.max(from.y, to.y),
        thickness: wall.thickness,
      });
    } else {
      other.push(wall);
    }
  }

  const merge = (items: LineWall[]): AnalysisWall[] => {
    const sorted = [...items].sort(
      (left, right) => left.pos - right.pos || left.a - right.a,
    );
    const merged: LineWall[] = [];

    for (const item of sorted) {
      const last = merged[merged.length - 1];

      if (
        last &&
        Math.abs(last.pos - item.pos) <= tolerance &&
        item.a <= last.b + tolerance
      ) {
        last.a = Math.min(last.a, item.a);
        last.b = Math.max(last.b, item.b);
        last.thickness = Math.max(last.thickness, item.thickness);
        continue;
      }

      merged.push({ ...item });
    }

    return merged.map((item) => ({
      thickness: item.thickness,
      geometry: item.horizontal
        ? [
            { x: round(item.a), y: round(item.pos) },
            { x: round(item.b), y: round(item.pos) },
          ]
        : [
            { x: round(item.pos), y: round(item.a) },
            { x: round(item.pos), y: round(item.b) },
          ],
    }));
  };

  return [...merge(horizontal), ...merge(vertical), ...other];
}

/**
 * Removes the sealed doorway spans from the walls, so a detected room edge
 * does not turn a door into a solid wall.
 */
function subtractDoorways(
  walls: AnalysisWall[],
  seals: AnalysisWall[],
  tolerance: number,
): AnalysisWall[] {
  const result: AnalysisWall[] = [];

  for (const wall of walls) {
    const [from, to] = wall.geometry;

    if (!from || !to) continue;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);

    if (length < 0.01) continue;

    const ux = dx / length;
    const uy = dy / length;
    const cuts: Array<[number, number]> = [];

    for (const seal of seals) {
      const [start, end] = seal.geometry;

      if (!start || !end) continue;
      if (perpendicularDistance(start, from, to) > tolerance) continue;
      if (perpendicularDistance(end, from, to) > tolerance) continue;

      const first = (start.x - from.x) * ux + (start.y - from.y) * uy;
      const second = (end.x - from.x) * ux + (end.y - from.y) * uy;
      const cutFrom = Math.max(0, Math.min(first, second));
      const cutTo = Math.min(length, Math.max(first, second));

      if (cutTo - cutFrom > 0.5) {
        cuts.push([cutFrom, cutTo]);
      }
    }

    if (cuts.length === 0) {
      result.push(wall);
      continue;
    }

    cuts.sort((left, right) => left[0] - right[0]);
    const pointAt = (distance: number) => ({
      x: round(from.x + ux * distance),
      y: round(from.y + uy * distance),
    });
    let cursor = 0;

    for (const [cutFrom, cutTo] of cuts) {
      if (cutFrom - cursor > 1) {
        result.push({
          geometry: [pointAt(cursor), pointAt(cutFrom)],
          thickness: wall.thickness,
        });
      }

      cursor = Math.max(cursor, cutTo);
    }

    if (length - cursor > 1) {
      result.push({
        geometry: [pointAt(cursor), pointAt(length)],
        thickness: wall.thickness,
      });
    }
  }

  return result;
}

interface AnalysisOptions {
  /** Meters per plan unit, when the plan is calibrated. */
  metersPerUnit?: number | null;
}

/**
 * Analyzes an already rasterized wall mask. Exposed separately so the room
 * detection can be tested without a real image.
 */
export function analyzeWallMask(
  mask: Uint8Array,
  width: number,
  height: number,
  underlay: UnderlaySettings,
  options: AnalysisOptions = {},
): {
  rooms: AnalysisRoom[];
  walls: AnalysisWall[];
  wallThickness: number;
  wallCoverage: number;
  imageRooms: Vec2[][];
  segments: Segment[];
} {
  const segments = detectSegments(mask, width, height);
  const doorGap = (() => {
    const maxDimension = Math.max(width, height);
    const metersPerUnit = options.metersPerUnit ?? null;
    const scale = Math.abs(underlay.scale) || 1;

    if (metersPerUnit && metersPerUnit > 0) {
      const pixelsPerMeter = 1 / (metersPerUnit * scale);
      return Math.min(
        Math.round(maxDimension * 0.15),
        Math.max(8, Math.round(pixelsPerMeter * 1.1)),
      );
    }

    return Math.min(140, Math.max(16, Math.round(maxDimension * 0.08)));
  })();
  const blocked = new Uint8Array(width * height);

  for (const segment of segments) {
    drawBlockedSegment(blocked, width, height, segment);
  }

  const seals = sealDoorways(blocked, width, height, segments, doorGap);

  const { labels, regions } = findRegions(blocked, width, height);
  const minArea = Math.max(
    260,
    Math.round((width * height) / 260),
    options.metersPerUnit
      ? Math.round(
          0.8 / (options.metersPerUnit * Math.abs(underlay.scale || 1)) ** 2,
        )
      : 0,
  );

  const usable = regions
    .filter((region) => {
      if (region.area < minArea) return false;

      const boxWidth = region.box.x2 - region.box.x1 + 1;
      const boxHeight = region.box.y2 - region.box.y1 + 1;

      if (boxWidth < 12 || boxHeight < 12) return false;

      const outsideBorder =
        region.touches.top &&
        region.touches.bottom &&
        region.touches.left &&
        region.touches.right;

      return !outsideBorder;
    })
    .sort((left, right) => right.area - left.area);

  const snapX = makeSnapper(
    segments.filter((segment) => segment.axis === 'v').map((s) => s.pos),
    Math.max(3, Math.round(width * 0.012)),
  );
  const snapY = makeSnapper(
    segments.filter((segment) => segment.axis === 'h').map((s) => s.pos),
    Math.max(3, Math.round(height * 0.012)),
  );

  const imageRooms: Vec2[][] = [];
  const rooms: AnalysisRoom[] = [];
  const grid = new PointGrid(
    Math.max(0.75, Math.abs(underlay.scale || 1) * 1.5),
  );

  for (const region of usable) {
    let contour = traceContour(labels, width, height, region.label, region.box);

    if (contour.length < 4) continue;

    contour = simplifyPolygon(contour, 1.4);

    if (contour.length > MAX_ROOM_VERTICES) {
      contour = simplifyPolygon(contour, 3.5);
    }

    if (contour.length > MAX_ROOM_VERTICES) {
      contour = simplifyPolygon(contour, 7);
    }

    if (contour.length < 3) continue;

    const snapped = contour.map((point) => ({
      x: snapX(point.x),
      y: snapY(point.y),
    }));

    const cleaned = snapped.filter((point, index) => {
      const next = snapped[(index + 1) % snapped.length];

      return !next || Math.hypot(point.x - next.x, point.y - next.y) > 0.5;
    });

    if (cleaned.length < 3) continue;

    const areaPixels = Math.abs(polygonArea(cleaned));

    if (areaPixels < minArea) continue;

    const boundary = cleaned.map((point) =>
      grid.add(toPlanPoint(point, width, height, underlay)),
    );
    const deduplicated = boundary.filter((point, index) => {
      const next = boundary[(index + 1) % boundary.length];

      return !next || point !== next;
    });

    if (deduplicated.length < 3) continue;

    imageRooms.push(cleaned);
    rooms.push({
      boundary: deduplicated,
      area: Math.abs(polygonArea(deduplicated)),
    });
  }

  // Build the shared vertex graph, then one wall per unique room edge.
  const pointIds = new Map<Vec2, number>();
  const pointsById: Vec2[] = [];

  const idOf = (point: Vec2) => {
    const existing = pointIds.get(point);

    if (existing !== undefined) return existing;

    const id = pointsById.length;
    pointIds.set(point, id);
    pointsById.push(point);

    return id;
  };

  for (const room of rooms) {
    for (const point of room.boundary) idOf(point);
  }

  const wallThicknessPixels = median(
    segments.map((segment) => segment.thickness).filter((value) => value > 0),
  );
  const scale = Math.abs(underlay.scale) || 1;
  const defaultThickness = Math.min(
    400,
    Math.max(1, round((wallThicknessPixels || 6) * scale)),
  );
  const seenEdges = new Set<string>();
  const walls: AnalysisWall[] = [];
  const vertexTolerance = Math.max(0.75, Math.abs(underlay.scale || 1) * 1.5);

  for (const room of rooms) {
    for (let index = 0; index < room.boundary.length; index += 1) {
      const current = room.boundary[index];
      const next = room.boundary[(index + 1) % room.boundary.length];

      if (!current || !next) continue;

      const first = idOf(current);
      const second = idOf(next);

      if (first === second) continue;

      const key =
        first < second ? `${first}:${second}` : `${second}:${first}`;

      if (seenEdges.has(key)) continue;

      seenEdges.add(key);
      walls.push({
        geometry: [current, next],
        thickness: defaultThickness,
      });
    }
  }

  const doorwaySeals: AnalysisWall[] = seals.map((seal) => ({
    thickness: defaultThickness,
    geometry: [
      toPlanPoint(
        seal.axis === 'h'
          ? { x: seal.a, y: seal.pos }
          : { x: seal.pos, y: seal.a },
        width,
        height,
        underlay,
      ),
      toPlanPoint(
        seal.axis === 'h'
          ? { x: seal.b, y: seal.pos }
          : { x: seal.pos, y: seal.b },
        width,
        height,
        underlay,
      ),
    ],
  }));
  const mergedWalls = subtractDoorways(
    mergeCollinearWalls(walls, vertexTolerance),
    doorwaySeals,
    vertexTolerance * 1.5,
  );
  walls.length = 0;
  walls.push(...mergedWalls);

  // No enclosed room could be found (e.g. an open sketch): fall back to the
  // detected wall lines themselves so the user still gets a starting point.
  if (rooms.length === 0) {
    for (const segment of segments) {
      const from = toPlanPoint(
        segment.axis === 'h'
          ? { x: segment.a, y: segment.pos }
          : { x: segment.pos, y: segment.a },
        width,
        height,
        underlay,
      );
      const to = toPlanPoint(
        segment.axis === 'h'
          ? { x: segment.b, y: segment.pos }
          : { x: segment.pos, y: segment.b },
        width,
        height,
        underlay,
      );

      if (Math.hypot(to.x - from.x, to.y - from.y) < 1) continue;

      walls.push({
        geometry: [from, to],
        thickness: defaultThickness,
      });
    }
  }

  const wallCoverage =
    mask.reduce((sum, value) => sum + value, 0) / (width * height);

  return {
    rooms,
    walls,
    wallThickness: defaultThickness,
    wallCoverage,
    imageRooms,
    segments,
  };
}

export function analyzePlanImage(
  image: HTMLImageElement,
  underlay: UnderlaySettings,
  options: AnalysisOptions = {},
): PlanAnalysis {
  const raster = rasterize(image);
  const mask = buildWallMask(raster);
  const analysis = analyzeWallMask(
    mask,
    raster.width,
    raster.height,
    underlay,
    options,
  );
  const preview = renderPreview(raster, analysis.imageRooms, analysis.segments);

  return {
    rooms: analysis.rooms,
    walls: analysis.walls,
    wallThickness: analysis.wallThickness,
    imageWidth: raster.width,
    imageHeight: raster.height,
    preview,
    wallCoverage: analysis.wallCoverage,
  };
}

export function analysisAreaSquareMeters(
  analysis: Pick<PlanAnalysis, 'rooms'>,
  metersPerUnit: number | null,
): number | null {
  if (!metersPerUnit) return null;

  const total = analysis.rooms.reduce((sum, room) => sum + room.area, 0);

  return total * metersPerUnit * metersPerUnit;
}
