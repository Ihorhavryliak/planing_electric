import { findRoutePenetrations, polylineLength } from '@drawmyplace/calculations';
import type {
  PublicDimension,
  PublicOpening,
  PublicPoint,
  PublicRoom,
  PublicRoute,
  PublicWall,
} from '@drawmyplace/contracts';
import { createPortal } from 'react-dom';
import { useI18n } from '@/features/i18n/i18n-context';

export type CanvasHoverTarget =
  | { kind: 'point'; id: string }
  | { kind: 'route'; id: string }
  | { kind: 'wall'; id: string }
  | { kind: 'room'; id: string }
  | { kind: 'opening'; id: string }
  | { kind: 'dimension'; id: string };

export interface RouteHoverDetails {
  requiredLength?: number | null;
  planLength?: number | null;
  verticalLength?: number | null;
  wasteLength?: number | null;
  drops?: number;
}

export interface CanvasHoverTooltipProps {
  target: CanvasHoverTarget;
  x: number;
  y: number;
  longPress: boolean;
  points: readonly PublicPoint[];
  routes: readonly PublicRoute[];
  walls: readonly PublicWall[];
  openings: readonly PublicOpening[];
  rooms: readonly PublicRoom[];
  dimensions: readonly PublicDimension[];
  circuits?: readonly { id: string; name: string }[];
  materialNames?: Readonly<Record<string, string>>;
  routeDetails?: Readonly<Record<string, RouteHoverDetails>>;
  metersPerUnit: number | null;
  wallHeightMeters: number;
}

function polygonArea(points: readonly { x: number; y: number }[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (a && b) sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function polygonPerimeter(points: readonly { x: number; y: number }[]): number {
  let total = 0;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    if (a && b) total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

export function CanvasHoverTooltip(props: CanvasHoverTooltipProps) {
  const { t, formatMeters, formatNumber } = useI18n();
  const { target, metersPerUnit } = props;
  const rows: { label: string; value: string }[] = [];
  let title: string;
  let subtitle: string;
  let tone: string;

  const meters = (drawingUnits: number) =>
    metersPerUnit === null
      ? `${formatNumber(drawingUnits, { maximumFractionDigits: 2 })} ${t('units.unit')}`
      : formatMeters(drawingUnits * metersPerUnit);

  if (target.kind === 'point') {
    const point = props.points.find((item) => item.id === target.id);
    if (!point) return null;
    title = point.label?.trim() || t(`editor.point.${point.type}`);
    subtitle = point.properties.subtype
      ? t(`devices.subtype.${point.properties.subtype}`)
      : t(`editor.point.${point.type}`);
    tone = '#38bdf8';
    const circuit = point.properties.circuitId
      ? props.circuits?.find((item) => item.id === point.properties.circuitId)
      : null;
    const attached = props.routes.filter(
      (route) =>
        route.startPointId === point.id || route.endPointId === point.id,
    ).length;
    rows.push({
      label: t('hover.circuit'),
      value: circuit
        ? `${circuit.id} · ${circuit.name}`
        : point.properties.circuitId ?? t('circuits.none'),
    });
    if (point.mountingHeight !== null) {
      rows.push({
        label: t('hover.mountingHeight'),
        value: `${formatNumber(point.mountingHeight, {
          maximumFractionDigits: 2,
        })} m`,
      });
    }
    rows.push({
      label: t('hover.attachedRoutes'),
      value: String(attached),
    });
  } else if (target.kind === 'route') {
    const route = props.routes.find((item) => item.id === target.id);
    if (!route) return null;
    const details = props.routeDetails?.[route.id];
    title = route.circuitId
      ? route.circuitId
      : t('editor.routeN', {
          index: props.routes.findIndex((item) => item.id === route.id) + 1,
        });
    subtitle = t('editor.cableRoute');
    tone = '#fb923c';
    const material = route.materialId
      ? props.materialNames?.[route.materialId]
      : null;
    rows.push({
      label: t('hover.cable'),
      value: material ?? t('editor.defaultCable'),
    });
    rows.push({
      label: t('hover.mounting'),
      value: t(`mounting.${route.settings.mounting ?? 'none'}`),
    });
    rows.push({
      label: t('hover.length'),
      value:
        details?.requiredLength !== undefined &&
        details.requiredLength !== null
          ? formatMeters(details.requiredLength)
          : meters(polylineLength(route.geometry)),
    });
    if (details?.planLength !== undefined && details.planLength !== null) {
      rows.push({
        label: t('hover.planLength'),
        value: formatMeters(details.planLength),
      });
    }
    if (
      details?.verticalLength !== undefined &&
      details.verticalLength !== null
    ) {
      rows.push({
        label: t('hover.verticalLength'),
        value: formatMeters(details.verticalLength),
      });
    }
    if (details?.wasteLength !== undefined && details.wasteLength !== null) {
      rows.push({
        label: t('hover.wasteLength'),
        value: formatMeters(details.wasteLength),
      });
    }
    if (details?.drops !== undefined) {
      rows.push({
        label: t('hover.drops'),
        value: String(details.drops),
      });
    }
    rows.push({
      label: t('hover.penetrations'),
      value: String(
        findRoutePenetrations({ id: route.id, geometry: route.geometry }, props.walls)
          .length,
      ),
    });
    rows.push({
      label: t('hover.pinnedEnds'),
      value: `${route.startPointId ? t('routePins.start') : '—'} / ${
        route.endPointId ? t('routePins.end') : '—'
      }`,
    });
  } else if (target.kind === 'wall') {
    const wall = props.walls.find((item) => item.id === target.id);
    if (!wall) return null;
    title = wall.label?.trim() || t('editor.walls');
    subtitle = t('hover.wall');
    tone = '#a78bfa';
    const length = polylineLength(wall.geometry);
    const openings = props.openings.filter((item) => item.wallId === wall.id);
    const openingArea = openings.reduce(
      (sum, item) => sum + item.width * item.height,
      0,
    );
    const height = props.wallHeightMeters;
    const gross = metersPerUnit === null ? null : length * metersPerUnit * height;
    const net =
      gross === null
        ? null
        : Math.max(0, gross - openingArea * (metersPerUnit ?? 0) ** 2);
    rows.push({ label: t('hover.length'), value: meters(length) });
    rows.push({
      label: t('hover.height'),
      value: `${formatNumber(height, { maximumFractionDigits: 2 })} m`,
    });
    rows.push({
      label: t('hover.thickness'),
      value: `${formatNumber(wall.thickness ?? 0, {
        maximumFractionDigits: 2,
      })} ${t('units.unit')}`,
    });
    rows.push({
      label: t('hover.wallArea'),
      value:
        gross === null || net === null
          ? '—'
          : `${formatNumber(gross, { maximumFractionDigits: 2 })} / ${formatNumber(
              net,
              { maximumFractionDigits: 2 },
            )} m²`,
    });
    rows.push({
      label: t('hover.openings'),
      value: String(openings.length),
    });
  } else if (target.kind === 'room') {
    const room = props.rooms.find((item) => item.id === target.id);
    if (!room) return null;
    title = room.name?.trim() || t('editor.rooms');
    subtitle = t('hover.room');
    tone = '#34d399';
    const scale = metersPerUnit ?? 0;
    rows.push({
      label: t('hover.area'),
      value:
        metersPerUnit === null
          ? '—'
          : `${formatNumber(polygonArea(room.boundary) * scale * scale, {
              maximumFractionDigits: 2,
            })} m²`,
    });
    rows.push({
      label: t('hover.perimeter'),
      value:
        metersPerUnit === null
          ? '—'
          : formatMeters(polygonPerimeter(room.boundary) * scale),
    });
  } else if (target.kind === 'opening') {
    const opening = props.openings.find((item) => item.id === target.id);
    if (!opening) return null;
    const wall = props.walls.find((item) => item.id === opening.wallId);
    title = opening.label?.trim() || t(`editor.opening.${opening.type}`);
    subtitle = opening.type === 'door' ? t('editor.addDoor') : t('editor.addWindow');
    tone = opening.type === 'door' ? '#fbbf24' : '#38bdf8';
    const scale = metersPerUnit ?? 0;
    rows.push({
      label: t('hover.size'),
      value:
        metersPerUnit === null
          ? '—'
          : `${formatNumber(opening.width * scale, {
              maximumFractionDigits: 2,
            })} × ${formatNumber(opening.height * scale, {
              maximumFractionDigits: 2,
            })} m`,
    });
    rows.push({
      label: t('hover.offset'),
      value: meters(opening.offset),
    });
    rows.push({
      label: t('hover.insideWall'),
      value:
        wall && polylineLength(wall.geometry) >= opening.offset + opening.width
          ? t('hover.yes')
          : t('hover.no'),
    });
  } else {
    const dimension = props.dimensions.find((item) => item.id === target.id);
    if (!dimension) return null;
    title = t('editor.dimensions');
    subtitle = t('hover.dimension');
    tone = '#f472b6';
    const length = Math.hypot(
      dimension.pointB.x - dimension.pointA.x,
      dimension.pointB.y - dimension.pointA.y,
    );
    rows.push({ label: t('hover.value'), value: meters(length) });
  }

  const width = 252;
  const estimatedHeight = 92 + rows.length * 20;
  const left =
    props.x + 12 + width > window.innerWidth
      ? Math.max(8, props.x - 12 - width)
      : props.x + 12;
  const top =
    props.y + 12 + estimatedHeight > window.innerHeight
      ? Math.max(8, props.y - 12 - estimatedHeight)
      : props.y + 12;

  return createPortal(
    <div
      role={props.longPress ? 'status' : 'tooltip'}
      aria-live={props.longPress ? 'polite' : undefined}
      data-testid="canvas-hover-tooltip"
      className="pointer-events-none fixed z-[95] rounded-xl border border-white/15 bg-slate-950/95 p-3 text-slate-100 shadow-2xl shadow-black/50 backdrop-blur"
      style={{ left, top, width }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: tone }}
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold">{title}</p>
          <p className="truncate text-[10px] text-slate-400">{subtitle}</p>
        </div>
      </div>
      <dl className="mt-2 space-y-1">
        {rows.map((row, index) => (
          <div
            key={`${row.label}-${index}`}
            className="flex items-baseline justify-between gap-3 text-[10px]"
          >
            <dt className="text-slate-500">{row.label}</dt>
            <dd className="text-right font-medium tabular-nums text-slate-200">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>,
    document.body,
  );
}
