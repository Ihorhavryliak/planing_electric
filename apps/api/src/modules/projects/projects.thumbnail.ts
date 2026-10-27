interface ThumbnailPoint {
  x: number;
  y: number;
}

interface ThumbnailLine {
  geometry: readonly ThumbnailPoint[];
}

export interface ProjectThumbnailData {
  walls: ThumbnailLine[];
  rooms: { boundary: readonly ThumbnailPoint[] }[];
  points: { x: number; y: number; type: string }[];
  routes: ThumbnailLine[];
}

const WIDTH = 320;
const HEIGHT = 180;
const PADDING = 14;

const POINT_COLORS: Record<string, string> = {
  socket: '#0ea5e9',
  switch: '#8b5cf6',
  light: '#f59e0b',
  panel: '#f43f5e',
  junction: '#10b981',
  custom: '#64748b',
};

function round(value: number): string {
  return value.toFixed(1);
}

/**
 * Renders a compact, dependency-free SVG preview from plan geometry.
 * Only numbers are interpolated, so the output is safe to serve as a string.
 */
export function renderProjectThumbnail(
  data: ProjectThumbnailData,
): string | null {
  const allPoints: ThumbnailPoint[] = [
    ...data.walls.flatMap((item) => item.geometry),
    ...data.rooms.flatMap((item) => item.boundary),
    ...data.points.map((point) => ({ x: point.x, y: point.y })),
    ...data.routes.flatMap((item) => item.geometry),
  ];

  if (allPoints.length === 0) return null;

  const xs = allPoints.map((point) => point.x);
  const ys = allPoints.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const planWidth = Math.max(1, maxX - minX);
  const planHeight = Math.max(1, maxY - minY);
  const scale = Math.min(
    (WIDTH - PADDING * 2) / planWidth,
    (HEIGHT - PADDING * 2) / planHeight,
  );
  const offsetX = (WIDTH - planWidth * scale) / 2;
  const offsetY = (HEIGHT - planHeight * scale) / 2;
  const map = (point: ThumbnailPoint) => ({
    x: (point.x - minX) * scale + offsetX,
    y: (point.y - minY) * scale + offsetY,
  });
  const polyline = (geometry: readonly ThumbnailPoint[]) =>
    geometry
      .map((point) => {
        const mapped = map(point);
        return `${round(mapped.x)},${round(mapped.y)}`;
      })
      .join(' ');

  const rooms = data.rooms
    .filter((room) => room.boundary.length > 2)
    .map(
      (room) =>
        `<polygon points="${polyline(room.boundary)}" fill="#e8eef6" stroke="#d7e0eb" stroke-width="1" />`,
    )
    .join('');
  const walls = data.walls
    .filter((wall) => wall.geometry.length > 1)
    .map(
      (wall) =>
        `<polyline points="${polyline(wall.geometry)}" fill="none" stroke="#334155" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />`,
    )
    .join('');
  const routes = data.routes
    .filter((route) => route.geometry.length > 1)
    .map(
      (route) =>
        `<polyline points="${polyline(route.geometry)}" fill="none" stroke="#2f6bd8" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 2" />`,
    )
    .join('');
  const points = data.points
    .map((point) => {
      const mapped = map(point);
      return `<circle cx="${round(mapped.x)}" cy="${round(mapped.y)}" r="2.4" fill="${POINT_COLORS[point.type] ?? '#64748b'}" />`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img"><rect width="${WIDTH}" height="${HEIGHT}" fill="#f8fafc" />${rooms}${walls}${routes}${points}</svg>`;
}
