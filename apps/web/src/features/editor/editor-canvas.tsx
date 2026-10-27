import { findPenetrations } from '@drawmyplace/calculations';
import type {
  Circuit,
  DeviceSubtype,
  EditorViewport,
  ElectricalPointType,
  PublicCalibration,
  PublicDimension,
  PublicOpening,
  PublicPoint,
  PublicRoom,
  PublicRoute,
  PublicWall,
  SignalingLoop,
  UnderlaySettings,
} from '@drawmyplace/contracts';
import { deviceProduct } from '@drawmyplace/contracts';
import {
  Box,
  BrickWall,
  Cable,
  CornerDownRight,
  Crosshair,
  Download,
  Grid3x3,
  Hand,
  Lightbulb,
  Magnet,
  Maximize2,
  MousePointer2,
  Plug,
  Redo2,
  Ruler,
  RulerDimensionLine,
  Shapes,
  SquareDashed,
  ToggleRight,
  Undo2,
  Zap,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/features/i18n/i18n-context';
import { useTheme } from '@/features/theme/theme-context';
import { drawCalibrationOverlay } from './calibration-overlay';
import {
  distanceBetween,
  findPointAt,
  geometryIntersectsBounds,
  gridStep,
  isClick,
  niceStep,
  pointInBounds,
  screenToWorld,
  snapToStep,
  visibleWorldBounds,
  type Vec2,
} from './editor-geometry';
import {
  drawOpeningsOverlay,
  findOpeningAt,
  type OpeningRenderItem,
} from './opening-overlay';
import { drawPointsOverlay, type PointRenderItem } from './point-overlay';
import { drawRoutesOverlay, type RouteRenderItem } from './route-overlay';
import {
  drawSignalingCoverage,
  type SignalingCoverageItem,
} from './signaling-overlay';
import type { EditorLayers } from './editor-layers';
import {
  drawStructureOverlay,
  type DimensionRenderItem,
  type RoomRenderItem,
  type StructureDraft,
  type WallRenderItem,
} from './structure-overlay';
import {
  findDimensionAt,
  findPolylineAt,
  findRoomAt,
  findVertexAt,
  offsetFromPointer,
  translateGeometry,
} from './structure-geometry';
import {
  findRouteAt,
  findRouteSegmentHandleAt,
  isDoubleClick,
  moveRouteEndsForPoint,
  snapToPoint,
  type ClickRecord,
} from './route-geometry';
import {
  POINT_SYMBOL_LIST,
  symbolForShortcut,
} from './point-symbols';
import {
  CanvasHoverTooltip,
  type CanvasHoverTarget,
  type RouteHoverDetails,
} from './canvas-hover-tooltip';

export type EditorTool =
  | 'select'
  | 'pan'
  | 'calibrate'
  | 'place'
  | 'route'
  | 'wall'
  | 'room'
  | 'dimension';
type DragMode =
  | 'pan'
  | 'underlay'
  | 'point'
  | 'vertex'
  | 'insert'
  | 'wall-vertex'
  | 'wall-body'
  | 'room-vertex'
  | 'room-body'
  | 'dimension';

/** Toolbar icons; exhaustive, so a new point type needs an icon here. */
const POINT_ICONS: Record<ElectricalPointType, LucideIcon> = {
  socket: Plug,
  switch: ToggleRight,
  light: Lightbulb,
  panel: Zap,
  junction: Box,
  custom: Shapes,
};

/** A press that moves less than this many pixels is a click, not a drag. */
const DRAG_THRESHOLD_PX = 4;

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 8;
const DEFAULT_BLANK_WIDTH = 1200;
const DEFAULT_BLANK_HEIGHT = 800;
const COORD_LIMIT = 10_000_000;

interface DragState {
  mode: DragMode;
  pointerId: number;
  startX: number;
  startY: number;
  startViewport: EditorViewport;
  startUnderlay: UnderlaySettings;
  zoom: number;
  /** Plain left click with the calibrate tool: a release without movement picks a point. */
  picksPoint: boolean;
  /** Plain left click with the place tool: a release without movement places a point. */
  placesPoint: boolean;
  /** Select tool on empty space: a release without movement clears the selection. */
  clearsSelection: boolean;
  /** Point being dragged (mode 'point') and where it started, in world units. */
  pointId: string | null;
  startPointWorld: Vec2 | null;
  /** Becomes true once a point drag passes the click threshold. */
  moved: boolean;
  /** Plain left click with the route tool: a release without movement adds a bend. */
  addsRouteVertex: boolean;
  /** Plain left click with the wall/room tools: a release adds a vertex. */
  addsWallVertex: boolean;
  addsRoomVertex: boolean;
  /** Plain left click with the dimension tool: a release picks an anchor. */
  picksDimensionPoint: boolean;
  /** Select tool over a route: a release without movement selects it. */
  selectsRouteId: string | null;
  selectsWallId: string | null;
  selectsRoomId: string | null;
  selectsDimensionId: string | null;
  /** Route vertex being dragged (mode 'vertex'); `startPointWorld` is its start. */
  routeId: string | null;
  vertexIndex: number | null;
  vertexIsEnd: boolean;
  /** Segment midpoint handle clicked with the select tool (mode 'insert'). */
  midpoint: {
    routeId: string;
    insertIndex: number;
    at: Vec2;
  } | null;
  /** Wall/room vertex or body being dragged. */
  wallId: string | null;
  wallVertexIndex: number | null;
  wallStartGeometry: Vec2[] | null;
  roomId: string | null;
  roomVertexIndex: number | null;
  roomStartBoundary: Vec2[] | null;
  /** Dimension line being dragged (mode 'dimension'). */
  dimensionId: string | null;
  dimensionStartOffset: number | null;
}

export interface PlacementRequest {
  type: ElectricalPointType;
  subtype: DeviceSubtype;
  /** Optional standard-library article to store on the new point. */
  productId?: string | null;
  /** Changes on every palette click so repeated selections retrigger placement. */
  nonce: number;
}

export interface ToolRequest {
  tool: EditorTool;
  pointType?: ElectricalPointType;
  /** Changes on every request so repeated selections retrigger the tool. */
  nonce: number;
}

interface EditorCanvasProps {
  image: HTMLImageElement | null;
  placementRequest?: PlacementRequest | null;
  toolRequest?: ToolRequest | null;
  fitRequest?: number;
  readOnly?: boolean;
  underlay: UnderlaySettings;
  viewport: EditorViewport;
  autoFit: boolean;
  calibration: PublicCalibration | null;
  walls: readonly PublicWall[];
  selectedWallId: string | null;
  openings: readonly PublicOpening[];
  selectedOpeningId: string | null;
  rooms: readonly PublicRoom[];
  selectedRoomId: string | null;
  dimensions: readonly PublicDimension[];
  selectedDimensionId: string | null;
  points: readonly PublicPoint[];
  selectedPointId: string | null;
  routes: readonly PublicRoute[];
  selectedRouteId: string | null;
  saveStatus?: { label: string; tone: 'ok' | 'pending' | 'error' } | null;
  circuits?: readonly Circuit[];
  signalingLoops?: readonly SignalingLoop[];
  layers?: EditorLayers;
  onCalibrationPoints: (pointA: Vec2, pointB: Vec2) => void;
  onSelectPoint: (id: string | null) => void;
  onCreatePoint: (
    type: ElectricalPointType,
    at: Vec2,
    subtype: DeviceSubtype | null,
    productId?: string | null,
  ) => void;
  onMovePoint: (id: string, at: Vec2) => void;
  onDeletePoint: (id: string) => void;
  onSelectRoute: (id: string | null) => void;
  onCreateRoute: (geometry: Vec2[]) => void;
  onMoveRouteVertex: (routeId: string, index: number, at: Vec2) => void;
  onInsertRouteVertex: (routeId: string, index: number, at: Vec2) => void;
  onRemoveRouteVertex: (routeId: string, index: number) => void;
  onDeleteRoute: (id: string) => void;
  onSelectWall: (id: string | null) => void;
  onCreateWall: (geometry: Vec2[]) => void;
  onMoveWall: (id: string, geometry: Vec2[]) => void;
  onDeleteWall: (id: string) => void;
  onSelectRoom: (id: string | null) => void;
  onCreateRoom: (boundary: Vec2[]) => void;
  onMoveRoom: (id: string, boundary: Vec2[]) => void;
  onDeleteRoom: (id: string) => void;
  onSelectDimension: (id: string | null) => void;
  onCreateDimension: (pointA: Vec2, pointB: Vec2, offset: number) => void;
  onMoveDimensionOffset: (id: string, offset: number) => void;
  onDeleteDimension: (id: string) => void;
  metersPerUnit: number | null;
  /** Hover hints can be switched off in editor preferences. */
  hoverHints?: boolean;
  routeDetails?: Readonly<Record<string, RouteHoverDetails>>;
  materialNames?: Readonly<Record<string, string>>;
  wallHeightMeters?: number;
  onUnderlayChange: (underlay: UnderlaySettings) => void;
  onViewportChange: (viewport: EditorViewport) => void;
  canUndo: boolean;
  canRedo: boolean;
  historyBusy: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewport: EditorViewport,
  light = false,
): void {
  const left = viewport.x - width / (2 * viewport.zoom);
  const right = viewport.x + width / (2 * viewport.zoom);
  const top = viewport.y - height / (2 * viewport.zoom);
  const bottom = viewport.y + height / (2 * viewport.zoom);
  const majorStep = niceStep(90 / viewport.zoom);
  const minorStep = majorStep / 5;

  context.lineWidth = 1;

  const drawLines = (step: number, color: string) => {
    context.beginPath();

    for (
      let x = Math.ceil(left / step) * step;
      x <= right;
      x += step
    ) {
      const screenX = Math.round((x - viewport.x) * viewport.zoom + width / 2) + 0.5;
      context.moveTo(screenX, 0);
      context.lineTo(screenX, height);
    }

    for (
      let y = Math.ceil(top / step) * step;
      y <= bottom;
      y += step
    ) {
      const screenY = Math.round((y - viewport.y) * viewport.zoom + height / 2) + 0.5;
      context.moveTo(0, screenY);
      context.lineTo(width, screenY);
    }

    context.strokeStyle = color;
    context.stroke();
  };

  drawLines(
    minorStep,
    light ? 'rgba(90, 99, 108, 0.035)' : 'rgba(148, 163, 184, 0.055)',
  );
  drawLines(
    majorStep,
    light ? 'rgba(90, 99, 108, 0.08)' : 'rgba(148, 163, 184, 0.12)',
  );

  context.strokeStyle = light
    ? 'rgba(47, 107, 216, 0.2)'
    : 'rgba(251, 191, 36, 0.22)';
  context.beginPath();

  const originX = (0 - viewport.x) * viewport.zoom + width / 2;
  const originY = (0 - viewport.y) * viewport.zoom + height / 2;

  if (originX >= 0 && originX <= width) {
    context.moveTo(Math.round(originX) + 0.5, 0);
    context.lineTo(Math.round(originX) + 0.5, height);
  }

  if (originY >= 0 && originY <= height) {
    context.moveTo(0, Math.round(originY) + 0.5);
    context.lineTo(width, Math.round(originY) + 0.5);
  }

  context.stroke();
}

function drawUnderlay(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  viewport: EditorViewport,
  underlay: UnderlaySettings,
  image: HTMLImageElement | null,
): void {
  if (
    !image ||
    !underlay.visible ||
    !image.complete ||
    image.naturalWidth === 0
  ) {
    return;
  }

  const screenX =
    (underlay.offsetX - viewport.x) * viewport.zoom + width / 2;
  const screenY =
    (underlay.offsetY - viewport.y) * viewport.zoom + height / 2;

  context.save();
  context.globalAlpha = underlay.opacity;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.translate(screenX, screenY);
  context.rotate((underlay.rotation * Math.PI) / 180);
  context.scale(
    viewport.zoom * underlay.scale,
    viewport.zoom * underlay.scale,
  );
  context.drawImage(
    image,
    -image.naturalWidth / 2,
    -image.naturalHeight / 2,
  );

  context.globalAlpha = 1;
  context.lineWidth = 1 / (viewport.zoom * underlay.scale);
  context.strokeStyle = 'rgba(251, 191, 36, 0.32)';
  context.strokeRect(
    -image.naturalWidth / 2,
    -image.naturalHeight / 2,
    image.naturalWidth,
    image.naturalHeight,
  );
  context.restore();
}

export function EditorCanvas({
  image,
  placementRequest,
  toolRequest,
  fitRequest,
  readOnly = false,
  underlay,
  viewport,
  autoFit,
  calibration,
  walls,
  selectedWallId,
  openings,
  selectedOpeningId,
  rooms,
  selectedRoomId,
  dimensions,
  selectedDimensionId,
  points,
  selectedPointId,
  routes,
  selectedRouteId,
  saveStatus = null,
  circuits = [],
  signalingLoops = [],
  layers,
  onCalibrationPoints,
  onSelectPoint,
  onCreatePoint,
  onMovePoint,
  onDeletePoint,
  onSelectRoute,
  onCreateRoute,
  onMoveRouteVertex,
  onInsertRouteVertex,
  onRemoveRouteVertex,
  onDeleteRoute,
  onSelectWall,
  onCreateWall,
  onMoveWall,
  onDeleteWall,
  onSelectRoom,
  onCreateRoom,
  onMoveRoom,
  onDeleteRoom,
  onSelectDimension,
  onCreateDimension,
  onMoveDimensionOffset,
  onDeleteDimension,
  metersPerUnit,
  hoverHints = true,
  routeDetails = {},
  materialNames = {},
  wallHeightMeters = 2.7,
  onUnderlayChange,
  onViewportChange,
  canUndo,
  canRedo,
  historyBusy,
  onUndo,
  onRedo,
}: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const autoFitPendingRef = useRef(autoFit);
  const { t } = useI18n();
  const { resolved } = useTheme();
  const canvasLight = resolved === 'light';
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tool, setTool] = useState<EditorTool>('select');
  const [spaceDown, setSpaceDown] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hoveringUnderlay, setHoveringUnderlay] = useState(false);
  const [calibrationDraft, setCalibrationDraft] = useState<Vec2[]>([]);
  const [cursorWorld, setCursorWorld] = useState<Vec2 | null>(null);
  const [placeType, setPlaceType] = useState<ElectricalPointType>('socket');
  const [placeSubtype, setPlaceSubtype] = useState<DeviceSubtype | null>(null);
  const [placeProductId, setPlaceProductId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(true);
  const [orthoEnabled, setOrthoEnabled] = useState(false);
  const [hoverWorld, setHoverWorld] = useState<Vec2 | null>(null);
  const coordinateRef = useRef<HTMLSpanElement>(null);
  const [hoveringPoint, setHoveringPoint] = useState(false);
  const [hoverTooltip, setHoverTooltip] = useState<{
    target: CanvasHoverTarget;
    x: number;
    y: number;
    longPress: boolean;
  } | null>(null);
  const [pointDrag, setPointDrag] = useState<{ id: string; at: Vec2 } | null>(
    null,
  );
  const [routeDraft, setRouteDraft] = useState<Vec2[]>([]);
  const [vertexDrag, setVertexDrag] = useState<{
    routeId: string;
    index: number;
    at: Vec2;
  } | null>(null);
  const [selectedVertex, setSelectedVertex] = useState<{
    routeId: string;
    index: number;
  } | null>(null);
  const [wallDraft, setWallDraft] = useState<Vec2[]>([]);
  const [roomDraft, setRoomDraft] = useState<Vec2[]>([]);
  const [dimensionDraft, setDimensionDraft] = useState<Vec2[]>([]);
  const [wallDrag, setWallDrag] = useState<{
    id: string;
    geometry: Vec2[];
  } | null>(null);
  const [roomDrag, setRoomDrag] = useState<{
    id: string;
    boundary: Vec2[];
  } | null>(null);
  const [dimensionDrag, setDimensionDrag] = useState<{
    id: string;
    offset: number;
  } | null>(null);
  const lastClickRef = useRef<ClickRecord | null>(null);
  const hoverTargetRef = useRef<CanvasHoverTarget | null>(null);
  const hoverPointerRef = useRef<Vec2 | null>(null);
  const hoverShowTimerRef = useRef<number | null>(null);
  const hoverHideTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const imageRef = useRef(image);
  const underlayRef = useRef(underlay);
  const viewportRef = useRef(viewport);
  const toolRef = useRef(tool);
  const spaceRef = useRef(spaceDown);
  const sizeRef = useRef(size);
  const onUnderlayChangeRef = useRef(onUnderlayChange);
  const onViewportChangeRef = useRef(onViewportChange);
  const onUndoRef = useRef(onUndo);
  const onRedoRef = useRef(onRedo);
  const calibrationDraftRef = useRef(calibrationDraft);
  const onCalibrationPointsRef = useRef(onCalibrationPoints);
  const pointsRef = useRef(points);
  const selectedPointIdRef = useRef(selectedPointId);
  const placeTypeRef = useRef(placeType);
  const placeSubtypeRef = useRef(placeSubtype);
  const placeProductIdRef = useRef(placeProductId);
  const layersRef = useRef(layers);
  layersRef.current = layers;

  const clearHoverTimers = useCallback(() => {
    if (hoverShowTimerRef.current !== null) {
      window.clearTimeout(hoverShowTimerRef.current);
      hoverShowTimerRef.current = null;
    }
    if (hoverHideTimerRef.current !== null) {
      window.clearTimeout(hoverHideTimerRef.current);
      hoverHideTimerRef.current = null;
    }
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const hideHoverTooltip = useCallback(
    (immediate = false) => {
      if (hoverShowTimerRef.current !== null) {
        window.clearTimeout(hoverShowTimerRef.current);
        hoverShowTimerRef.current = null;
      }
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (hoverHideTimerRef.current !== null) {
        window.clearTimeout(hoverHideTimerRef.current);
        hoverHideTimerRef.current = null;
      }
      hoverTargetRef.current = null;

      if (immediate) {
        setHoverTooltip(null);
        return;
      }

      hoverHideTimerRef.current = window.setTimeout(() => {
        setHoverTooltip(null);
      }, 80);
    },
    [],
  );

  const showHoverTooltip = useCallback(
    (
      target: CanvasHoverTarget,
      screen: Vec2,
      longPress = false,
    ) => {
      if (hoverHideTimerRef.current !== null) {
        window.clearTimeout(hoverHideTimerRef.current);
        hoverHideTimerRef.current = null;
      }
      hoverTargetRef.current = target;

      if (longPress) {
        if (hoverShowTimerRef.current !== null) {
          window.clearTimeout(hoverShowTimerRef.current);
          hoverShowTimerRef.current = null;
        }
        setHoverTooltip({
          target,
          x: screen.x,
          y: screen.y,
          longPress: true,
        });
        return;
      }

      if (
        hoverTooltip?.target.kind === target.kind &&
        hoverTooltip.target.id === target.id
      ) {
        setHoverTooltip((previous) =>
          previous ? { ...previous, x: screen.x, y: screen.y } : previous,
        );
        return;
      }

      setHoverTooltip(null);
      if (hoverShowTimerRef.current !== null) {
        window.clearTimeout(hoverShowTimerRef.current);
      }
      hoverShowTimerRef.current = window.setTimeout(() => {
        hoverShowTimerRef.current = null;
        if (
          hoverTargetRef.current === target ||
          (hoverTargetRef.current?.kind === target.kind &&
            hoverTargetRef.current.id === target.id)
        ) {
          setHoverTooltip({
            target,
            x: screen.x,
            y: screen.y,
            longPress: false,
          });
        }
      }, 350);
    },
    [hoverTooltip],
  );

  const findHoverTarget = useCallback(
    (screen: Vec2): CanvasHoverTarget | null => {
      const currentLayers = layersRef.current;
      const viewportNow = viewportRef.current;
      const sizeNow = sizeRef.current;
      const bounds = visibleWorldBounds(viewportNow, sizeNow);

      if (currentLayers?.points !== false) {
        const pointId = findPointAt(
          pointsRef.current.filter((point) => pointInBounds(point, bounds)),
          screen,
          viewportNow,
          sizeNow,
        );
        if (pointId) return { kind: 'point', id: pointId };
      }
      if (currentLayers?.routes !== false) {
        const routeId = findRouteAt(
          routesRef.current.filter((route) =>
            geometryIntersectsBounds(route.geometry, bounds),
          ),
          screen,
          viewportNow,
          sizeNow,
        );
        if (routeId) return { kind: 'route', id: routeId };
      }
      if (currentLayers?.openings !== false) {
        const openingId = findOpeningAt(
          openings,
          walls,
          screen,
          viewportNow,
          sizeNow,
        );
        if (openingId) return { kind: 'opening', id: openingId };
      }
      if (currentLayers?.walls !== false) {
        const wallId = findPolylineAt(walls, screen, viewportNow, sizeNow);
        if (wallId) return { kind: 'wall', id: wallId };
      }
      if (currentLayers?.rooms !== false) {
        const roomId = findRoomAt(rooms, screen, viewportNow, sizeNow);
        if (roomId) return { kind: 'room', id: roomId };
      }
      if (currentLayers?.dimensions !== false) {
        const dimensionId = findDimensionAt(
          dimensions,
          screen,
          viewportNow,
          sizeNow,
        );
        if (dimensionId) return { kind: 'dimension', id: dimensionId };
      }
      return null;
    },
    [dimensions, openings, rooms, walls],
  );
  const snapRef = useRef(snapEnabled);
  const orthoRef = useRef(orthoEnabled);
  const readOnlyRef = useRef(readOnly);
  const lastFitRequestRef = useRef(0);
  const onSelectPointRef = useRef(onSelectPoint);
  const onCreatePointRef = useRef(onCreatePoint);
  const onMovePointRef = useRef(onMovePoint);
  const onDeletePointRef = useRef(onDeletePoint);
  const routesRef = useRef(routes);
  const selectedRouteIdRef = useRef(selectedRouteId);
  const routeDraftRef = useRef(routeDraft);
  const onSelectRouteRef = useRef(onSelectRoute);
  const onCreateRouteRef = useRef(onCreateRoute);
  const onMoveRouteVertexRef = useRef(onMoveRouteVertex);
  const onInsertRouteVertexRef = useRef(onInsertRouteVertex);
  const onRemoveRouteVertexRef = useRef(onRemoveRouteVertex);
  const onDeleteRouteRef = useRef(onDeleteRoute);
  const selectedVertexRef = useRef(selectedVertex);
  const wallsRef = useRef(walls);
  const selectedWallIdRef = useRef(selectedWallId);
  const roomsRef = useRef(rooms);
  const selectedRoomIdRef = useRef(selectedRoomId);
  const dimensionsRef = useRef(dimensions);
  const selectedDimensionIdRef = useRef(selectedDimensionId);
  const wallDraftRef = useRef(wallDraft);
  const roomDraftRef = useRef(roomDraft);
  const dimensionDraftRef = useRef(dimensionDraft);
  const onSelectWallRef = useRef(onSelectWall);
  const onCreateWallRef = useRef(onCreateWall);
  const onMoveWallRef = useRef(onMoveWall);
  const onDeleteWallRef = useRef(onDeleteWall);
  const onSelectRoomRef = useRef(onSelectRoom);
  const onCreateRoomRef = useRef(onCreateRoom);
  const onMoveRoomRef = useRef(onMoveRoom);
  const onDeleteRoomRef = useRef(onDeleteRoom);
  const onSelectDimensionRef = useRef(onSelectDimension);
  const onCreateDimensionRef = useRef(onCreateDimension);
  const onMoveDimensionOffsetRef = useRef(onMoveDimensionOffset);
  const onDeleteDimensionRef = useRef(onDeleteDimension);

  imageRef.current = image;
  underlayRef.current = underlay;
  viewportRef.current = viewport;
  toolRef.current = tool;
  spaceRef.current = spaceDown;
  sizeRef.current = size;
  onUnderlayChangeRef.current = onUnderlayChange;
  onViewportChangeRef.current = onViewportChange;
  onUndoRef.current = onUndo;
  onRedoRef.current = onRedo;
  calibrationDraftRef.current = calibrationDraft;
  onCalibrationPointsRef.current = onCalibrationPoints;
  pointsRef.current = points;
  selectedPointIdRef.current = selectedPointId;
  placeTypeRef.current = placeType;
  placeSubtypeRef.current = placeSubtype;
  placeProductIdRef.current = placeProductId;
  snapRef.current = snapEnabled;
  orthoRef.current = orthoEnabled;
  readOnlyRef.current = readOnly;
  onSelectPointRef.current = onSelectPoint;
  onCreatePointRef.current = onCreatePoint;
  onMovePointRef.current = onMovePoint;
  onDeletePointRef.current = onDeletePoint;
  routesRef.current = routes;
  selectedRouteIdRef.current = selectedRouteId;
  routeDraftRef.current = routeDraft;
  onSelectRouteRef.current = onSelectRoute;
  onCreateRouteRef.current = onCreateRoute;
  onMoveRouteVertexRef.current = onMoveRouteVertex;
  onInsertRouteVertexRef.current = onInsertRouteVertex;
  onRemoveRouteVertexRef.current = onRemoveRouteVertex;
  onDeleteRouteRef.current = onDeleteRoute;
  selectedVertexRef.current = selectedVertex;
  wallsRef.current = walls;
  selectedWallIdRef.current = selectedWallId;
  roomsRef.current = rooms;
  selectedRoomIdRef.current = selectedRoomId;
  dimensionsRef.current = dimensions;
  selectedDimensionIdRef.current = selectedDimensionId;
  wallDraftRef.current = wallDraft;
  roomDraftRef.current = roomDraft;
  dimensionDraftRef.current = dimensionDraft;
  onSelectWallRef.current = onSelectWall;
  onCreateWallRef.current = onCreateWall;
  onMoveWallRef.current = onMoveWall;
  onDeleteWallRef.current = onDeleteWall;
  onSelectRoomRef.current = onSelectRoom;
  onCreateRoomRef.current = onCreateRoom;
  onMoveRoomRef.current = onMoveRoom;
  onDeleteRoomRef.current = onDeleteRoom;
  onSelectDimensionRef.current = onSelectDimension;
  onCreateDimensionRef.current = onCreateDimension;
  onMoveDimensionOffsetRef.current = onMoveDimensionOffset;
  onDeleteDimensionRef.current = onDeleteDimension;

  const worldBounds = useMemo(
    () => visibleWorldBounds(viewport, size),
    [viewport, size],
  );

  const loopById = useMemo(
    () => new Map(signalingLoops.map((loop) => [loop.id, loop])),
    [signalingLoops],
  );
  const loopForPoint = (point: PublicPoint) => {
    if (point.properties.loopId) {
      return loopById.get(point.properties.loopId) ?? null;
    }
    return null;
  };
  const renderRoutes = useMemo<RouteRenderItem[]>(() => {
    const draggedPoint = pointDrag
      ? points.find((point) => point.id === pointDrag.id)
      : undefined;
    // Route ends follow the point being dragged before the change is saved.
    const attached = new Map(
      (
        draggedPoint && pointDrag
          ? moveRouteEndsForPoint(
              routes,
              pointDrag.id,
              { x: draggedPoint.x, y: draggedPoint.y },
              pointDrag.at,
            )
          : []
      ).map((update) => [update.id, update.geometry]),
    );

    return routes
      .filter((route) => geometryIntersectsBounds(route.geometry, worldBounds))
      .map((route) => {
        const system = route.settings.system ?? 'power';
        const loop = route.settings.loopId
          ? (loopById.get(route.settings.loopId) ?? null)
          : system === 'power'
            ? null
            : (signalingLoops.find((item) => item.type === system) ?? null);

        return {
          id: route.id,
          circuitId: route.circuitId,
          mounting: route.settings.mounting ?? null,
          startPinned: Boolean(route.startPointId),
          endPinned: Boolean(route.endPointId),
          color: system === 'power' ? null : (loop?.color ?? null),
          label:
            system === 'power'
              ? null
              : (loop?.code ?? system.toUpperCase()),
        geometry:
          attached.get(route.id) ??
          (vertexDrag?.routeId === route.id
            ? route.geometry.map((vertex, index) =>
                index === vertexDrag.index ? vertexDrag.at : vertex,
              )
            : route.geometry),
        };
      });
  }, [
    routes,
    vertexDrag,
    pointDrag,
    points,
    worldBounds,
    loopById,
    signalingLoops,
  ]);

  const routeAttachHint = useMemo(() => {
    if (!vertexDrag) return null;
    const route = routes.find((item) => item.id === vertexDrag.routeId);
    if (!route) return null;
    const lastIndex = route.geometry.length - 1;
    if (vertexDrag.index !== 0 && vertexDrag.index !== lastIndex) return null;
    const point = points.find(
      (item) =>
        Math.abs(item.x - vertexDrag.at.x) <= 1e-6 &&
        Math.abs(item.y - vertexDrag.at.y) <= 1e-6,
    );

    return point ? { x: point.x, y: point.y } : null;
  }, [vertexDrag, routes, points]);

  const penetrationMarkers = useMemo(
    () =>
      findPenetrations(
        renderRoutes.map((route) => ({
          id: route.id,
          geometry: route.geometry,
        })),
        walls.map((wall) => ({ id: wall.id, geometry: wall.geometry })),
      ).map((entry) => entry.point),
    [renderRoutes, walls],
  );

  // Points as drawn: the one being dragged follows the pointer before it is saved.
  const renderPoints = useMemo<PointRenderItem[]>(
    () =>
      points
        .filter((point) => {
          const at =
            pointDrag?.id === point.id
              ? pointDrag.at
              : { x: point.x, y: point.y };
          return pointInBounds(at, worldBounds);
        })
        .map((point) => {
          const at =
            pointDrag?.id === point.id ? pointDrag.at : point;
          const loop = loopForPoint(point);

          return {
            ...point,
            x: at.x,
            y: at.y,
            color: loop?.color ?? null,
            subtype: point.properties.subtype ?? null,
            badge:
              typeof point.properties.address === 'number'
                ? `${loop?.code ?? 'L'}·${point.properties.address}`
                : (loop?.code ?? null),
          };
        }),
    // loopById is stable per signaling change; points are the drawing source.
    [points, pointDrag, worldBounds, loopById],
  );

  const signalingCoverage = useMemo<SignalingCoverageItem[]>(() => {
    const items: SignalingCoverageItem[] = [];

    for (const point of points) {
      const product = deviceProduct(point.properties.productId ?? null);
      const radius = product?.coverageRadiusM;
      if (!radius || radius <= 0) continue;
      const loop = loopForPoint(point);
      const subtype = point.properties.subtype ?? '';
      const kind: SignalingCoverageItem['kind'] = subtype.includes('camera')
        ? 'camera'
        : subtype.includes('siren') ||
            subtype === 'strobe' ||
            subtype === 'voice-alarm'
          ? 'siren'
          : subtype.includes('smoke') ||
              subtype.includes('heat') ||
              subtype === 'manual-call-point'
            ? 'fire'
            : 'security';
      const fallback =
        kind === 'camera'
          ? '#0284c7'
          : kind === 'siren'
            ? '#e11d48'
            : kind === 'fire'
              ? '#dc2626'
              : '#7c3aed';
      items.push({
        id: point.id,
        x: point.x,
        y: point.y,
        radiusM: radius,
        color: loop?.color ?? fallback,
        kind,
      });
    }

    return items;
  }, [points, loopById]);

  const renderWalls = useMemo<WallRenderItem[]>(
    () =>
      walls
        .filter((wall) =>
          geometryIntersectsBounds(
            wallDrag?.id === wall.id ? wallDrag.geometry : wall.geometry,
            worldBounds,
          ),
        )
        .map((wall) => ({
          id: wall.id,
          geometry:
            wallDrag?.id === wall.id ? wallDrag.geometry : wall.geometry,
          thickness: wall.thickness,
          label: wall.label,
        })),
    [walls, wallDrag, worldBounds],
  );

  const renderOpenings = useMemo<OpeningRenderItem[]>(
    () =>
      openings.map((opening) => ({
        id: opening.id,
        wallId: opening.wallId,
        type: opening.type,
        offset: opening.offset,
        width: opening.width,
        flipped: opening.flipped,
        label: opening.label,
      })),
    [openings],
  );

  const renderRooms = useMemo<RoomRenderItem[]>(
    () =>
      rooms
        .filter((room) =>
          geometryIntersectsBounds(
            roomDrag?.id === room.id ? roomDrag.boundary : room.boundary,
            worldBounds,
          ),
        )
        .map((room) => ({
          id: room.id,
          name: room.name,
          boundary:
            roomDrag?.id === room.id ? roomDrag.boundary : room.boundary,
        })),
    [rooms, roomDrag, worldBounds],
  );

  const renderDimensions = useMemo<DimensionRenderItem[]>(
    () =>
      dimensions
        .filter((dimension) =>
          geometryIntersectsBounds(
            [dimension.pointA, dimension.pointB],
            worldBounds,
          ),
        )
        .map((dimension) => ({
          id: dimension.id,
          pointA: dimension.pointA,
          pointB: dimension.pointB,
          offset:
            dimensionDrag?.id === dimension.id
              ? dimensionDrag.offset
              : dimension.offset,
          label: dimension.label,
        })),
    [dimensions, dimensionDrag, worldBounds],
  );

  const structureDraft: StructureDraft | null =
    tool === 'wall' && wallDraft.length > 0
      ? { kind: 'wall', points: wallDraft }
      : tool === 'room' && roomDraft.length > 0
        ? { kind: 'room', points: roomDraft }
        : tool === 'dimension' && dimensionDraft.length > 0
          ? { kind: 'dimension', points: dimensionDraft }
          : null;

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      setSize({
        width: Math.max(1, Math.round(entry.contentRect.width)),
        height: Math.max(1, Math.round(entry.contentRect.height)),
      });
    });

    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const fitToPlan = useCallback(() => {
    const currentSize = sizeRef.current;

    if (currentSize.width === 0 || currentSize.height === 0) {
      return;
    }

    const currentUnderlay = underlayRef.current;
    const currentImage = imageRef.current;
    let contentWidth = DEFAULT_BLANK_WIDTH;
    let contentHeight = DEFAULT_BLANK_HEIGHT;
    let centerX = 0;
    let centerY = 0;

    if (currentImage && currentImage.naturalWidth > 0) {
      const rotatedWidth =
        currentImage.naturalWidth * Math.abs(currentUnderlay.scale);
      const rotatedHeight =
        currentImage.naturalHeight * Math.abs(currentUnderlay.scale);
      const angle = (currentUnderlay.rotation * Math.PI) / 180;

      contentWidth =
        Math.abs(rotatedWidth * Math.cos(angle)) +
        Math.abs(rotatedHeight * Math.sin(angle));
      contentHeight =
        Math.abs(rotatedWidth * Math.sin(angle)) +
        Math.abs(rotatedHeight * Math.cos(angle));
      centerX = currentUnderlay.offsetX;
      centerY = currentUnderlay.offsetY;
    }

    const margin = 72;
    const zoom = clamp(
      Math.min(
        (currentSize.width - margin) / Math.max(1, contentWidth),
        (currentSize.height - margin) / Math.max(1, contentHeight),
      ),
      MIN_ZOOM,
      MAX_ZOOM,
    );

    onViewportChangeRef.current({ x: centerX, y: centerY, zoom });
  }, []);

  useEffect(() => {
    if (
      autoFitPendingRef.current &&
      image &&
      size.width > 0 &&
      size.height > 0
    ) {
      autoFitPendingRef.current = false;
      fitToPlan();
    }
  }, [autoFit, image, size, fitToPlan]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || size.width === 0 || size.height === 0) {
      return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * pixelRatio);
    canvas.height = Math.round(size.height * pixelRatio);

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.fillStyle = canvasLight ? '#f5f7fa' : '#020617';
    context.fillRect(0, 0, size.width, size.height);

    if (gridEnabled) {
      drawGrid(context, size.width, size.height, viewport, canvasLight);
    }
    drawUnderlay(
      context,
      size.width,
      size.height,
      viewport,
      underlay,
      image,
    );
    drawStructureOverlay(
      context,
      size,
      viewport,
      layers?.walls === false ? [] : renderWalls,
      layers?.rooms === false ? [] : renderRooms,
      layers?.dimensions === false ? [] : renderDimensions,
      readOnly ? null : selectedWallId,
      readOnly ? null : selectedRoomId,
      readOnly ? null : selectedDimensionId,
      structureDraft,
      hoverWorld,
      metersPerUnit,
      canvasLight,
    );
    drawOpeningsOverlay(
      context,
      size,
      viewport,
      layers?.openings === false ? [] : renderOpenings,
      layers?.walls === false ? [] : renderWalls,
      selectedOpeningId,
      canvasLight,
    );
    drawCalibrationOverlay(
      context,
      size,
      viewport,
      calibration,
      calibrationDraft,
      cursorWorld,
      canvasLight,
    );
    if (layers?.points !== false) {
      drawSignalingCoverage(
        context,
        size,
        viewport,
        signalingCoverage,
        metersPerUnit,
        canvasLight,
      );
    }
    drawRoutesOverlay(
      context,
      size,
      viewport,
      layers?.routes === false ? [] : renderRoutes,
      readOnly ? null : selectedRouteId,
      routeDraft,
      tool === 'route' ? hoverWorld : null,
      selectedVertex?.routeId === selectedRouteId
        ? selectedVertex.index
        : null,
      {
        circuits,
        showLabels: layers?.labels !== false,
        penetrations:
          layers?.routes === false || layers?.penetrations === false
            ? []
            : penetrationMarkers,
        attachHint: routeAttachHint,
        light: canvasLight,
      },
    );
    drawPointsOverlay(
      context,
      size,
      viewport,
      layers?.points === false ? [] : renderPoints,
      readOnly ? null : selectedPointId,
      !readOnly && tool === 'place' && hoverWorld && layers?.points !== false
        ? { type: placeType, at: hoverWorld }
        : null,
      layers?.labels !== false,
      canvasLight,
    );
  }, [
    size,
    viewport,
    underlay,
    image,
    canvasLight,
    calibration,
    calibrationDraft,
    cursorWorld,
    renderPoints,
    renderRoutes,
    renderWalls,
    renderOpenings,
    renderRooms,
    renderDimensions,
    circuits,
    signalingCoverage,
    layers,
    penetrationMarkers,
    routeAttachHint,
    readOnly,
    selectedOpeningId,
    selectedPointId,
    selectedRouteId,
    selectedWallId,
    selectedRoomId,
    selectedDimensionId,
    selectedVertex,
    routeDraft,
    structureDraft,
    tool,
    placeType,
    hoverWorld,
    metersPerUnit,
    gridEnabled,
  ]);

  useEffect(() => {
    if (tool !== 'calibrate') {
      setCalibrationDraft([]);
      setCursorWorld(null);
    }

    if (
      tool !== 'place' &&
      tool !== 'route' &&
      tool !== 'wall' &&
      tool !== 'room' &&
      tool !== 'dimension'
    ) {
      setHoverWorld(null);
    }

    if (tool !== 'route') {
      setRouteDraft([]);
    }

    if (tool !== 'wall') {
      setWallDraft([]);
    }

    if (tool !== 'room') {
      setRoomDraft([]);
    }

    if (tool !== 'dimension') {
      setDimensionDraft([]);
    }

    if (tool !== 'select') {
      setSelectedVertex(null);
    }
  }, [tool]);

  useEffect(() => {
    if (!placementRequest) {
      return;
    }

    setPlaceType(placementRequest.type);
    setPlaceSubtype(placementRequest.subtype);
    setPlaceProductId(placementRequest.productId ?? null);
    setTool('place');
  }, [placementRequest]);

  useEffect(() => {
    if (!toolRequest) {
      return;
    }

    if (toolRequest.pointType) {
      setPlaceType(toolRequest.pointType);
      setPlaceSubtype(null);
      setPlaceProductId(null);
    }

    setTool(toolRequest.tool);
  }, [toolRequest]);

  useEffect(() => {
    if (!fitRequest || fitRequest === lastFitRequestRef.current) {
      return;
    }

    lastFitRequestRef.current = fitRequest;
    fitToPlan();
  }, [fitRequest]);

  useEffect(() => {
    if (readOnly) {
      setTool('pan');
    }
  }, [readOnly]);

  useEffect(() => {
    setSelectedVertex(null);
  }, [selectedRouteId]);

  useEffect(() => {
    setSelectedVertex((current) => {
      if (!current) {
        return current;
      }

      const route = routes.find((item) => item.id === current.routeId);

      return route && current.index < route.geometry.length ? current : null;
    });
  }, [routes]);

  const zoomAt = useCallback(
    (screenX: number, screenY: number, factor: number) => {
      hideHoverTooltip(true);
      const current = viewportRef.current;
      const currentSize = sizeRef.current;
      const nextZoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM);

      if (nextZoom === current.zoom) {
        return;
      }

      const worldX =
        current.x + (screenX - currentSize.width / 2) / current.zoom;
      const worldY =
        current.y + (screenY - currentSize.height / 2) / current.zoom;

      onViewportChangeRef.current({
        x: worldX - (screenX - currentSize.width / 2) / nextZoom,
        y: worldY - (screenY - currentSize.height / 2) / nextZoom,
        zoom: nextZoom,
      });
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0015);

      zoomAt(
        event.clientX - rect.left,
        event.clientY - rect.top,
        factor,
      );
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [zoomAt]);

  const pointHitsUnderlay = useCallback(
    (screenX: number, screenY: number): boolean => {
      const currentImage = imageRef.current;
      const currentUnderlay = underlayRef.current;
      const currentViewport = viewportRef.current;
      const currentSize = sizeRef.current;

      if (
        !currentImage ||
        !currentImage.complete ||
        currentImage.naturalWidth === 0 ||
        !currentUnderlay.visible ||
        currentUnderlay.locked
      ) {
        return false;
      }

      const worldX =
        currentViewport.x +
        (screenX - currentSize.width / 2) / currentViewport.zoom;
      const worldY =
        currentViewport.y +
        (screenY - currentSize.height / 2) / currentViewport.zoom;
      const offsetX = worldX - currentUnderlay.offsetX;
      const offsetY = worldY - currentUnderlay.offsetY;
      const angle = (currentUnderlay.rotation * Math.PI) / 180;
      const localX =
        offsetX * Math.cos(angle) + offsetY * Math.sin(angle);
      const localY =
        -offsetX * Math.sin(angle) + offsetY * Math.cos(angle);
      const halfWidth =
        (currentImage.naturalWidth * Math.abs(currentUnderlay.scale)) / 2;
      const halfHeight =
        (currentImage.naturalHeight * Math.abs(currentUnderlay.scale)) / 2;

      return (
        Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfHeight
      );
    },
    [],
  );

  function localPoint(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ): { x: number; y: number } {
    const rect = event.currentTarget.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function toWorld(screen: Vec2): Vec2 {
    return screenToWorld(screen, viewportRef.current, sizeRef.current);
  }

  /** Applies grid snapping when it is enabled; the step follows the drawn grid. */
  function snapped(world: Vec2): Vec2 {
    return snapRef.current
      ? snapToStep(world, gridStep(viewportRef.current.zoom))
      : world;
  }

  /** New world position of a dragged point: grab offset is kept, then snapped. */
  function draggedPointPosition(drag: DragState, screen: Vec2): Vec2 | null {
    if (!drag.startPointWorld) {
      return null;
    }

    return snapped({
      x: clamp(
        drag.startPointWorld.x + (screen.x - drag.startX) / drag.zoom,
        -COORD_LIMIT,
        COORD_LIMIT,
      ),
      y: clamp(
        drag.startPointWorld.y + (screen.y - drag.startY) / drag.zoom,
        -COORD_LIMIT,
        COORD_LIMIT,
      ),
    });
  }

  /** Route bends snap to an electrical point first, then to the grid. */
  function routeSnap(screen: Vec2): Vec2 {
    const point = snapToPoint(
      pointsRef.current,
      screen,
      viewportRef.current,
      sizeRef.current,
    );

    if (point) return point;

    const world = snapped(toWorld(screen));

    if (!orthoRef.current) return world;

    const draft = routeDraftRef.current;
    const last = draft[draft.length - 1];

    if (!last) return world;

    return Math.abs(world.x - last.x) >= Math.abs(world.y - last.y)
      ? { x: world.x, y: last.y }
      : { x: last.x, y: world.y };
  }

  /** Position of a dragged route vertex; only route ends snap to points. */
  function draggedVertexPosition(drag: DragState, screen: Vec2): Vec2 | null {
    if (!drag.startPointWorld) {
      return null;
    }

    const raw = draggedPointPosition(drag, screen);

    if (!drag.vertexIsEnd) {
      return raw;
    }

    return (
      snapToPoint(
        pointsRef.current,
        screen,
        viewportRef.current,
        sizeRef.current,
      ) ?? raw
    );
  }

  function finishRoute() {
    const draft = routeDraftRef.current;

    if (draft.length >= 2) {
      onCreateRouteRef.current(draft);
      setRouteDraft([]);
    }
  }

  function addRouteVertex(screen: Vec2) {
    const click: ClickRecord = {
      x: screen.x,
      y: screen.y,
      time: performance.now(),
    };
    const previous = lastClickRef.current;

    lastClickRef.current = click;

    if (isDoubleClick(previous, click)) {
      finishRoute();
      return;
    }

    const world = routeSnap(screen);
    const draft = routeDraftRef.current;
    const last = draft[draft.length - 1];

    if (last && distanceBetween(last, world) * viewportRef.current.zoom < 4) {
      return;
    }

    setRouteDraft([...draft, world]);
  }

  function finishWall() {
    const draft = wallDraftRef.current;

    if (draft.length >= 2) {
      onCreateWallRef.current(draft);
      setWallDraft([]);
    }
  }

  function finishRoom() {
    const draft = roomDraftRef.current;

    if (draft.length >= 3) {
      onCreateRoomRef.current(draft);
      setRoomDraft([]);
    }
  }

  function isDraftDoubleClick(screen: Vec2): boolean {
    const click: ClickRecord = {
      x: screen.x,
      y: screen.y,
      time: performance.now(),
    };
    const previous = lastClickRef.current;

    lastClickRef.current = click;

    return isDoubleClick(previous, click);
  }

  function addWallVertex(screen: Vec2) {
    if (isDraftDoubleClick(screen)) {
      finishWall();
      return;
    }

    const world = snapped(toWorld(screen));
    const draft = wallDraftRef.current;
    const last = draft[draft.length - 1];

    if (last && distanceBetween(last, world) * viewportRef.current.zoom < 4) {
      return;
    }

    setWallDraft([...draft, world]);
  }

  function addRoomVertex(screen: Vec2) {
    if (isDraftDoubleClick(screen)) {
      finishRoom();
      return;
    }

    const world = snapped(toWorld(screen));
    const draft = roomDraftRef.current;
    const last = draft[draft.length - 1];

    if (last && distanceBetween(last, world) * viewportRef.current.zoom < 4) {
      return;
    }

    setRoomDraft([...draft, world]);
  }

  function pickDimensionPoint(screen: Vec2) {
    const world = routeSnap(screen);
    const first = dimensionDraftRef.current[0];

    if (!first) {
      setDimensionDraft([world]);
      setHoverWorld(world);
      return;
    }

    if (distanceBetween(first, world) * viewportRef.current.zoom < 4) {
      return;
    }

    setDimensionDraft([]);
    onCreateDimensionRef.current(first, world, 24 / viewportRef.current.zoom);
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    if (event.button !== 0 && event.button !== 1) {
      return;
    }

    event.preventDefault();

    const point = localPoint(event);
    hideHoverTooltip(true);

    if (
      event.pointerType === 'touch' &&
      toolRef.current === 'select' &&
      !spaceRef.current
    ) {
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        const target = findHoverTarget(point);
        if (target) showHoverTooltip(target, point, true);
      }, 500);
    }

    const plainLeft = event.button === 0 && !spaceRef.current;
    let mode: DragMode = 'pan';
    let pointId: string | null = null;
    let startPointWorld: Vec2 | null = null;
    let routeId: string | null = null;
    let vertexIndex: number | null = null;
    let vertexIsEnd = false;
    let selectsRouteId: string | null = null;
    let selectsWallId: string | null = null;
    let selectsRoomId: string | null = null;
    let selectsDimensionId: string | null = null;
    let midpoint: DragState['midpoint'] = null;
    let wallId: string | null = null;
    let wallVertexIndex: number | null = null;
    let wallStartGeometry: Vec2[] | null = null;
    let roomId: string | null = null;
    let roomVertexIndex: number | null = null;
    let roomStartBoundary: Vec2[] | null = null;
    let dimensionId: string | null = null;
    let dimensionStartOffset: number | null = null;

    const clearStructureSelection = () => {
      onSelectWallRef.current(null);
      onSelectRoomRef.current(null);
      onSelectDimensionRef.current(null);
    };

    if (plainLeft && toolRef.current === 'select') {
      const hitId =
        layersRef.current?.points === false
          ? null
          : findPointAt(
              pointsRef.current,
              point,
              viewportRef.current,
              sizeRef.current,
            );
      const hit = pointsRef.current.find((item) => item.id === hitId);

      if (hit) {
        mode = 'point';
        pointId = hit.id;
        startPointWorld = { x: hit.x, y: hit.y };
        setSelectedVertex(null);
        onSelectPointRef.current(hit.id);
        onSelectRouteRef.current(null);
        clearStructureSelection();
      } else {
        const selected =
          layersRef.current?.routes === false
            ? undefined
            : routesRef.current.find(
                (item) => item.id === selectedRouteIdRef.current,
              );
        const vertexId = selected
          ? findPointAt(
              selected.geometry.map((vertex, index) => ({
                id: String(index),
                x: vertex.x,
                y: vertex.y,
              })),
              point,
              viewportRef.current,
              sizeRef.current,
            )
          : null;
        const vertex =
          selected && vertexId !== null
            ? selected.geometry[Number(vertexId)]
            : undefined;

        if (selected && vertexId !== null && vertex) {
          mode = 'vertex';
          routeId = selected.id;
          vertexIndex = Number(vertexId);
          vertexIsEnd =
            vertexIndex === 0 || vertexIndex === selected.geometry.length - 1;
          startPointWorld = { x: vertex.x, y: vertex.y };
          setSelectedVertex({ routeId: selected.id, index: vertexIndex });
        } else {
          const handle = selected
            ? findRouteSegmentHandleAt(
                selected,
                point,
                viewportRef.current,
                sizeRef.current,
              )
            : null;

          if (selected && handle) {
            mode = 'insert';
            midpoint = {
              routeId: selected.id,
              insertIndex: handle.segmentIndex + 1,
              at: handle.at,
            };
            setSelectedVertex(null);
          } else {
            selectsRouteId =
              layersRef.current?.routes === false
                ? null
                : findRouteAt(
                    routesRef.current,
                    point,
                    viewportRef.current,
                    sizeRef.current,
                  );
            setSelectedVertex(null);

            if (selectsRouteId) {
              clearStructureSelection();
            } else {
              const selectedWall =
                layersRef.current?.walls === false
                  ? undefined
                  : wallsRef.current.find(
                      (item) => item.id === selectedWallIdRef.current,
                    );
              const wallVertex =
                selectedWall && selectedWall
                  ? findVertexAt(
                      selectedWall.geometry,
                      point,
                      viewportRef.current,
                      sizeRef.current,
                    )
                  : null;

              if (selectedWall && wallVertex !== null) {
                const at = selectedWall.geometry[wallVertex];

                if (at) {
                  mode = 'wall-vertex';
                  wallId = selectedWall.id;
                  wallVertexIndex = wallVertex;
                  wallStartGeometry = selectedWall.geometry.map((item) => ({
                    ...item,
                  }));
                  startPointWorld = { x: at.x, y: at.y };
                  selectsWallId = selectedWall.id;
                  onSelectPointRef.current(null);
                  onSelectRouteRef.current(null);
                  onSelectRoomRef.current(null);
                  onSelectDimensionRef.current(null);
                }
              } else {
                const selectedRoom =
                  layersRef.current?.rooms === false
                    ? undefined
                    : roomsRef.current.find(
                        (item) => item.id === selectedRoomIdRef.current,
                      );
                const roomVertex = selectedRoom
                  ? findVertexAt(
                      selectedRoom.boundary,
                      point,
                      viewportRef.current,
                      sizeRef.current,
                    )
                  : null;

                if (selectedRoom && roomVertex !== null) {
                  const at = selectedRoom.boundary[roomVertex];

                  if (at) {
                    mode = 'room-vertex';
                    roomId = selectedRoom.id;
                    roomVertexIndex = roomVertex;
                    roomStartBoundary = selectedRoom.boundary.map((item) => ({
                      ...item,
                    }));
                    startPointWorld = { x: at.x, y: at.y };
                    selectsRoomId = selectedRoom.id;
                    onSelectPointRef.current(null);
                    onSelectRouteRef.current(null);
                    onSelectWallRef.current(null);
                    onSelectDimensionRef.current(null);
                  }
                } else {
                  const dimensionHit =
                    layersRef.current?.dimensions === false
                      ? null
                      : findDimensionAt(
                          dimensionsRef.current,
                          point,
                          viewportRef.current,
                          sizeRef.current,
                        );
                  const dimension = dimensionsRef.current.find(
                    (item) => item.id === dimensionHit,
                  );

                  if (dimension) {
                    mode = 'dimension';
                    dimensionId = dimension.id;
                    dimensionStartOffset = dimension.offset;
                    selectsDimensionId = dimension.id;
                    onSelectPointRef.current(null);
                    onSelectRouteRef.current(null);
                    onSelectWallRef.current(null);
                    onSelectRoomRef.current(null);
                    onSelectDimensionRef.current(dimension.id);
                  } else {
                    const wallHit =
                      layersRef.current?.walls === false
                        ? null
                        : findPolylineAt(
                            wallsRef.current,
                            point,
                            viewportRef.current,
                            sizeRef.current,
                          );
                    const wall = wallsRef.current.find(
                      (item) => item.id === wallHit,
                    );

                    if (wall) {
                      mode = 'wall-body';
                      wallId = wall.id;
                      wallStartGeometry = wall.geometry.map((item) => ({
                        ...item,
                      }));
                      selectsWallId = wall.id;
                      onSelectPointRef.current(null);
                      onSelectRouteRef.current(null);
                      onSelectRoomRef.current(null);
                      onSelectDimensionRef.current(null);
                      onSelectWallRef.current(wall.id);
                    } else {
                      const roomHit =
                        layersRef.current?.rooms === false
                          ? null
                          : findRoomAt(
                              roomsRef.current,
                              point,
                              viewportRef.current,
                              sizeRef.current,
                            );
                      const room = roomsRef.current.find(
                        (item) => item.id === roomHit,
                      );

                      if (room) {
                        mode = 'room-body';
                        roomId = room.id;
                        roomStartBoundary = room.boundary.map((item) => ({
                          ...item,
                        }));
                        selectsRoomId = room.id;
                        onSelectPointRef.current(null);
                        onSelectRouteRef.current(null);
                        onSelectWallRef.current(null);
                        onSelectDimensionRef.current(null);
                        onSelectRoomRef.current(room.id);
                      } else if (pointHitsUnderlay(point.x, point.y)) {
                        mode = 'underlay';
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    dragRef.current = {
      mode,
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      startViewport: { ...viewportRef.current },
      startUnderlay: { ...underlayRef.current },
      zoom: viewportRef.current.zoom,
      picksPoint: plainLeft && toolRef.current === 'calibrate',
      placesPoint: plainLeft && toolRef.current === 'place',
      clearsSelection:
        plainLeft &&
        toolRef.current === 'select' &&
        mode !== 'point' &&
        mode !== 'vertex' &&
        mode !== 'insert' &&
        mode !== 'wall-vertex' &&
        mode !== 'wall-body' &&
        mode !== 'room-vertex' &&
        mode !== 'room-body' &&
        mode !== 'dimension' &&
        selectsRouteId === null &&
        selectsWallId === null &&
        selectsRoomId === null &&
        selectsDimensionId === null,
      pointId,
      startPointWorld,
      moved: false,
      addsRouteVertex: plainLeft && toolRef.current === 'route',
      addsWallVertex: plainLeft && toolRef.current === 'wall',
      addsRoomVertex: plainLeft && toolRef.current === 'room',
      picksDimensionPoint: plainLeft && toolRef.current === 'dimension',
      selectsRouteId,
      selectsWallId,
      selectsRoomId,
      selectsDimensionId,
      routeId,
      vertexIndex,
      vertexIsEnd,
      midpoint,
      wallId,
      wallVertexIndex,
      wallStartGeometry,
      roomId,
      roomVertexIndex,
      roomStartBoundary,
      dimensionId,
      dimensionStartOffset,
    };

    setDragging(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers (tests, some assistive tech) have no capture target.
    }
  }

  function handlePointerMove(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    const point = localPoint(event);
    const drag = dragRef.current;

    if (coordinateRef.current) {
      const world = toWorld(point);
      const metersPerUnit = calibration?.metersPerUnit ?? null;
      const format = (value: number) =>
        metersPerUnit === null
          ? value.toFixed(0)
          : (value * metersPerUnit).toFixed(2);
      coordinateRef.current.textContent = `${format(world.x)}, ${format(world.y)}`;
    }

    if (drag) {
      clearHoverTimers();
      hideHoverTooltip(true);
    }

    if (
      toolRef.current === 'calibrate' &&
      calibrationDraftRef.current.length === 1
    ) {
      setCursorWorld(toWorld(point));
    }

    if (!drag) {
      if (toolRef.current === 'place' && !spaceRef.current) {
        setHoverWorld(snapped(toWorld(point)));
      }

      if (toolRef.current === 'route' && !spaceRef.current) {
        setHoverWorld(routeSnap(point));
      }

      if (
        (toolRef.current === 'wall' || toolRef.current === 'room') &&
        !spaceRef.current
      ) {
        setHoverWorld(snapped(toWorld(point)));
      }

      if (toolRef.current === 'dimension' && !spaceRef.current) {
        setHoverWorld(routeSnap(point));
      }

      if (toolRef.current === 'select' && !spaceRef.current) {
        setHoveringUnderlay(pointHitsUnderlay(point.x, point.y));
        setHoveringPoint(
          (layersRef.current?.points !== false &&
            findPointAt(
              pointsRef.current,
              point,
              viewportRef.current,
              sizeRef.current,
            ) !== null) ||
            (layersRef.current?.routes !== false &&
              findRouteAt(
                routesRef.current,
                point,
                viewportRef.current,
                sizeRef.current,
              ) !== null) ||
            (layersRef.current?.walls !== false &&
              findPolylineAt(
                wallsRef.current,
                point,
                viewportRef.current,
                sizeRef.current,
              ) !== null) ||
            (layersRef.current?.rooms !== false &&
              findRoomAt(
                roomsRef.current,
                point,
                viewportRef.current,
                sizeRef.current,
              ) !== null) ||
            (layersRef.current?.dimensions !== false &&
              findDimensionAt(
                dimensionsRef.current,
                point,
                viewportRef.current,
                sizeRef.current,
              ) !== null),
        );
      } else {
        if (hoveringUnderlay) {
          setHoveringUnderlay(false);
        }

        if (hoveringPoint) {
          setHoveringPoint(false);
        }
      }

      if (
        !hoverHints ||
        toolRef.current !== 'select' ||
        spaceRef.current
      ) {
        hideHoverTooltip(true);
      } else {
        const previous = hoverPointerRef.current;
        hoverPointerRef.current = point;
        if (
          !previous ||
          Math.hypot(point.x - previous.x, point.y - previous.y) > 4
        ) {
          const target = findHoverTarget(point);
          if (target) showHoverTooltip(target, point);
          else hideHoverTooltip();
        }
      }

      return;
    }

    if (drag.mode === 'insert') {
      return;
    }

    if (drag.mode === 'vertex') {
      if (!drag.moved) {
        if (
          isClick(
            { x: drag.startX, y: drag.startY },
            point,
            DRAG_THRESHOLD_PX,
          )
        ) {
          return;
        }

        drag.moved = true;
      }

      const next = draggedVertexPosition(drag, point);

      if (drag.routeId && drag.vertexIndex !== null && next) {
        setVertexDrag({
          routeId: drag.routeId,
          index: drag.vertexIndex,
          at: next,
        });
      }

      return;
    }

    if (drag.mode === 'point') {
      if (!drag.moved) {
        if (
          isClick(
            { x: drag.startX, y: drag.startY },
            point,
            DRAG_THRESHOLD_PX,
          )
        ) {
          return;
        }

        drag.moved = true;
      }

      const next = draggedPointPosition(drag, point);

      if (drag.pointId && next) {
        setPointDrag({ id: drag.pointId, at: next });
      }

      return;
    }

    if (
      (drag.mode === 'wall-vertex' || drag.mode === 'room-vertex') &&
      drag.startPointWorld
    ) {
      if (!drag.moved) {
        if (
          isClick(
            { x: drag.startX, y: drag.startY },
            point,
            DRAG_THRESHOLD_PX,
          )
        ) {
          return;
        }

        drag.moved = true;
      }

      const next = draggedPointPosition(drag, point);

      if (!next) {
        return;
      }

      if (
        drag.mode === 'wall-vertex' &&
        drag.wallId &&
        drag.wallVertexIndex !== null &&
        drag.wallStartGeometry
      ) {
        setWallDrag({
          id: drag.wallId,
          geometry: drag.wallStartGeometry.map((vertex, index) =>
            index === drag.wallVertexIndex ? next : vertex,
          ),
        });
      }

      if (
        drag.mode === 'room-vertex' &&
        drag.roomId &&
        drag.roomVertexIndex !== null &&
        drag.roomStartBoundary
      ) {
        setRoomDrag({
          id: drag.roomId,
          boundary: drag.roomStartBoundary.map((vertex, index) =>
            index === drag.roomVertexIndex ? next : vertex,
          ),
        });
      }

      return;
    }

    if (drag.mode === 'wall-body' || drag.mode === 'room-body') {
      if (!drag.moved) {
        if (
          isClick(
            { x: drag.startX, y: drag.startY },
            point,
            DRAG_THRESHOLD_PX,
          )
        ) {
          return;
        }

        drag.moved = true;
      }

      const dx = (point.x - drag.startX) / drag.zoom;
      const dy = (point.y - drag.startY) / drag.zoom;

      if (drag.mode === 'wall-body' && drag.wallId && drag.wallStartGeometry) {
        setWallDrag({
          id: drag.wallId,
          geometry: translateGeometry(drag.wallStartGeometry, dx, dy),
        });
      }

      if (drag.mode === 'room-body' && drag.roomId && drag.roomStartBoundary) {
        setRoomDrag({
          id: drag.roomId,
          boundary: translateGeometry(drag.roomStartBoundary, dx, dy),
        });
      }

      return;
    }

    if (drag.mode === 'dimension') {
      if (!drag.moved) {
        if (
          isClick(
            { x: drag.startX, y: drag.startY },
            point,
            DRAG_THRESHOLD_PX,
          )
        ) {
          return;
        }

        drag.moved = true;
      }

      const dimension = dimensionsRef.current.find(
        (item) => item.id === drag.dimensionId,
      );

      if (dimension) {
        setDimensionDrag({
          id: dimension.id,
          offset: offsetFromPointer(
            dimension.pointA,
            dimension.pointB,
            toWorld(point),
          ),
        });
      }

      return;
    }

    const deltaX = point.x - drag.startX;
    const deltaY = point.y - drag.startY;

    if (drag.mode === 'pan') {
      onViewportChangeRef.current({
        x: drag.startViewport.x - deltaX / drag.zoom,
        y: drag.startViewport.y - deltaY / drag.zoom,
        zoom: drag.startViewport.zoom,
      });
    } else {
      onUnderlayChangeRef.current({
        ...drag.startUnderlay,
        offsetX: clamp(
          drag.startUnderlay.offsetX + deltaX / drag.zoom,
          -1_000_000,
          1_000_000,
        ),
        offsetY: clamp(
          drag.startUnderlay.offsetY + deltaY / drag.zoom,
          -1_000_000,
          1_000_000,
        ),
      });
    }
  }

  function pickCalibrationPoint(screen: Vec2) {
    const world = toWorld(screen);
    const first = calibrationDraftRef.current[0];

    if (!first) {
      setCalibrationDraft([world]);
      setCursorWorld(world);
      return;
    }

    // Ignore a second click on (almost) the same spot: the points must differ.
    if (distanceBetween(first, world) * viewportRef.current.zoom < 4) {
      return;
    }

    setCalibrationDraft([]);
    setCursorWorld(null);
    setTool('select');
    onCalibrationPointsRef.current(first, world);
  }

  function finishDragging(event: ReactPointerEvent<HTMLCanvasElement>) {
    clearHoverTimers();
    hideHoverTooltip(true);
    const drag = dragRef.current;

    if (drag?.pointerId === event.pointerId) {
      if (event.type === 'pointerup') {
        const end = localPoint(event);
        const clicked = isClick({ x: drag.startX, y: drag.startY }, end);

        if (drag.picksPoint && clicked) {
          pickCalibrationPoint(end);
        } else if (drag.placesPoint && clicked) {
          onCreatePointRef.current(
            placeTypeRef.current,
            snapped(toWorld(end)),
            placeSubtypeRef.current,
            placeProductIdRef.current,
          );
        } else if (drag.addsRouteVertex && clicked) {
          addRouteVertex(end);
        } else if (drag.addsWallVertex && clicked) {
          addWallVertex(end);
        } else if (drag.addsRoomVertex && clicked) {
          addRoomVertex(end);
        } else if (drag.picksDimensionPoint && clicked) {
          pickDimensionPoint(end);
        } else if (drag.midpoint && clicked) {
          onInsertRouteVertexRef.current(
            drag.midpoint.routeId,
            drag.midpoint.insertIndex,
            drag.midpoint.at,
          );
          setSelectedVertex({
            routeId: drag.midpoint.routeId,
            index: drag.midpoint.insertIndex,
          });
        } else if (drag.selectsRouteId && clicked) {
          onSelectRouteRef.current(drag.selectsRouteId);
          onSelectPointRef.current(null);
          onSelectWallRef.current(null);
          onSelectRoomRef.current(null);
          onSelectDimensionRef.current(null);
          setSelectedVertex(null);
        } else if (drag.clearsSelection && clicked) {
          onSelectPointRef.current(null);
          onSelectRouteRef.current(null);
          onSelectWallRef.current(null);
          onSelectRoomRef.current(null);
          onSelectDimensionRef.current(null);
          setSelectedVertex(null);
        } else if (
          drag.mode === 'vertex' &&
          drag.moved &&
          drag.routeId &&
          drag.vertexIndex !== null
        ) {
          const next = draggedVertexPosition(drag, end);

          if (next) {
            onMoveRouteVertexRef.current(drag.routeId, drag.vertexIndex, next);
          }
        } else if (drag.mode === 'point' && drag.moved && drag.pointId) {
          const next = draggedPointPosition(drag, end);

          if (next) {
            onMovePointRef.current(drag.pointId, next);
          }
        } else if (
          drag.mode === 'wall-vertex' &&
          drag.moved &&
          drag.wallId &&
          drag.wallVertexIndex !== null &&
          drag.wallStartGeometry
        ) {
          const next = draggedPointPosition(drag, end);

          if (next) {
            onMoveWallRef.current(
              drag.wallId,
              drag.wallStartGeometry.map((vertex, index) =>
                index === drag.wallVertexIndex ? next : vertex,
              ),
            );
          }
        } else if (
          drag.mode === 'room-vertex' &&
          drag.moved &&
          drag.roomId &&
          drag.roomVertexIndex !== null &&
          drag.roomStartBoundary
        ) {
          const next = draggedPointPosition(drag, end);

          if (next) {
            onMoveRoomRef.current(
              drag.roomId,
              drag.roomStartBoundary.map((vertex, index) =>
                index === drag.roomVertexIndex ? next : vertex,
              ),
            );
          }
        } else if (
          drag.mode === 'wall-body' &&
          drag.moved &&
          drag.wallId &&
          drag.wallStartGeometry
        ) {
          onMoveWallRef.current(
            drag.wallId,
            translateGeometry(
              drag.wallStartGeometry,
              (end.x - drag.startX) / drag.zoom,
              (end.y - drag.startY) / drag.zoom,
            ),
          );
        } else if (
          drag.mode === 'room-body' &&
          drag.moved &&
          drag.roomId &&
          drag.roomStartBoundary
        ) {
          onMoveRoomRef.current(
            drag.roomId,
            translateGeometry(
              drag.roomStartBoundary,
              (end.x - drag.startX) / drag.zoom,
              (end.y - drag.startY) / drag.zoom,
            ),
          );
        } else if (
          drag.mode === 'dimension' &&
          drag.moved &&
          drag.dimensionId
        ) {
          const dimension = dimensionsRef.current.find(
            (item) => item.id === drag.dimensionId,
          );

          if (dimension) {
            onMoveDimensionOffsetRef.current(
              dimension.id,
              offsetFromPointer(
                dimension.pointA,
                dimension.pointB,
                toWorld(end),
              ),
            );
          }
        }
      }

      dragRef.current = null;
      setDragging(false);
      setPointDrag(null);
      setVertexDrag(null);
      setWallDrag(null);
      setRoomDrag(null);
      setDimensionDrag(null);

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (readOnlyRef.current) {
        if (event.key === '0') {
          event.preventDefault();
          fitToPlan();
        } else if (event.key === '+' || event.key === '=') {
          event.preventDefault();
          zoomAt(sizeRef.current.width / 2, sizeRef.current.height / 2, 1.25);
        } else if (event.key === '-') {
          event.preventDefault();
          zoomAt(sizeRef.current.width / 2, sizeRef.current.height / 2, 0.8);
        }
        return;
      }

      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && !event.altKey) {
        const key = event.key.toLowerCase();

        if (key === 'z') {
          event.preventDefault();

          if (event.shiftKey) {
            onRedoRef.current();
          } else {
            onUndoRef.current();
          }

          return;
        }

        if (key === 'y') {
          event.preventDefault();
          onRedoRef.current();
          return;
        }
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        setSpaceDown(true);
        return;
      }

      const symbol = symbolForShortcut(event.key);

      if (symbol) {
        setPlaceType(symbol.type);
        setPlaceSubtype(null);
        setPlaceProductId(null);
        setTool('place');
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        const selected = selectedPointIdRef.current;
        const selectedRoute = selectedRouteIdRef.current;
        const selectedWall = selectedWallIdRef.current;
        const selectedRoom = selectedRoomIdRef.current;
        const selectedDimension = selectedDimensionIdRef.current;
        const vertex = selectedVertexRef.current;

        if (toolRef.current === 'route' && routeDraftRef.current.length > 0) {
          event.preventDefault();
          setRouteDraft((draft) => draft.slice(0, -1));
        } else if (
          toolRef.current === 'wall' &&
          wallDraftRef.current.length > 0
        ) {
          event.preventDefault();
          setWallDraft((draft) => draft.slice(0, -1));
        } else if (
          toolRef.current === 'room' &&
          roomDraftRef.current.length > 0
        ) {
          event.preventDefault();
          setRoomDraft((draft) => draft.slice(0, -1));
        } else if (
          toolRef.current === 'dimension' &&
          dimensionDraftRef.current.length > 0
        ) {
          event.preventDefault();
          setDimensionDraft([]);
        } else if (
          selectedRoute &&
          vertex &&
          vertex.routeId === selectedRoute
        ) {
          event.preventDefault();
          onRemoveRouteVertexRef.current(selectedRoute, vertex.index);
          const route = routesRef.current.find(
            (item) => item.id === selectedRoute,
          );

          if (route && route.geometry.length > 2) {
            setSelectedVertex({
              routeId: selectedRoute,
              index: Math.min(vertex.index, route.geometry.length - 2),
            });
          }
        } else if (selected) {
          event.preventDefault();
          onDeletePointRef.current(selected);
        } else if (selectedRoute) {
          event.preventDefault();
          onDeleteRouteRef.current(selectedRoute);
        } else if (selectedWall) {
          event.preventDefault();
          onDeleteWallRef.current(selectedWall);
        } else if (selectedRoom) {
          event.preventDefault();
          onDeleteRoomRef.current(selectedRoom);
        } else if (selectedDimension) {
          event.preventDefault();
          onDeleteDimensionRef.current(selectedDimension);
        }
      } else if (event.key === 'Enter') {
        if (toolRef.current === 'route') {
          event.preventDefault();
          finishRoute();
        } else if (toolRef.current === 'wall') {
          event.preventDefault();
          finishWall();
        } else if (toolRef.current === 'room') {
          event.preventDefault();
          finishRoom();
        }
      } else if (event.key === 'r' || event.key === 'R') {
        setTool('route');
      } else if (event.key === 'q' || event.key === 'Q') {
        setTool('wall');
      } else if (event.key === 'o' || event.key === 'O') {
        setTool('room');
      } else if (event.key === 'd' || event.key === 'D') {
        setTool('dimension');
      } else if (event.key === 'g' || event.key === 'G') {
        setSnapEnabled((value) => !value);
      } else if (event.key === 'v' || event.key === 'V') {
        setTool('select');
      } else if (event.key === 'h' || event.key === 'H') {
        setTool('pan');
      } else if (event.key === 'c' || event.key === 'C') {
        setTool('calibrate');
      } else if (event.key === 'Escape') {
        if (calibrationDraftRef.current.length > 0) {
          setCalibrationDraft([]);
          setCursorWorld(null);
        } else if (routeDraftRef.current.length > 0) {
          setRouteDraft([]);
        } else if (wallDraftRef.current.length > 0) {
          setWallDraft([]);
        } else if (roomDraftRef.current.length > 0) {
          setRoomDraft([]);
        } else if (dimensionDraftRef.current.length > 0) {
          setDimensionDraft([]);
        } else if (selectedVertexRef.current) {
          setSelectedVertex(null);
        } else if (
          toolRef.current === 'calibrate' ||
          toolRef.current === 'place' ||
          toolRef.current === 'route' ||
          toolRef.current === 'wall' ||
          toolRef.current === 'room' ||
          toolRef.current === 'dimension'
        ) {
          setTool('select');
        } else if (selectedPointIdRef.current) {
          onSelectPointRef.current(null);
        } else if (selectedRouteIdRef.current) {
          onSelectRouteRef.current(null);
        } else if (selectedWallIdRef.current) {
          onSelectWallRef.current(null);
        } else if (selectedRoomIdRef.current) {
          onSelectRoomRef.current(null);
        } else if (selectedDimensionIdRef.current) {
          onSelectDimensionRef.current(null);
        }
      } else if (event.key === '0') {
        fitToPlan();
      } else if (event.key === '1') {
        const current = viewportRef.current;
        const currentSize = sizeRef.current;
        zoomAt(
          currentSize.width / 2,
          currentSize.height / 2,
          1 / current.zoom,
        );
      } else if (event.key === '+' || event.key === '=') {
        zoomAt(sizeRef.current.width / 2, sizeRef.current.height / 2, 1.25);
      } else if (event.key === '-') {
        zoomAt(sizeRef.current.width / 2, sizeRef.current.height / 2, 0.8);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setSpaceDown(false);
      }
    };

    const handleBlur = () => setSpaceDown(false);

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [fitToPlan, zoomAt]);

  const cursor = dragging
    ? 'grabbing'
    : tool === 'pan' || spaceDown
      ? 'grab'
      : tool === 'select' && hoveringPoint
        ? 'pointer'
        : tool === 'select' && hoveringUnderlay
          ? 'move'
          : 'crosshair';

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none select-none"
        style={{ cursor }}
        aria-label={t('editor.floorPlanCanvas')}
        role="application"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDragging}
        onPointerCancel={finishDragging}
        onPointerLeave={() => {
          setHoveringUnderlay(false);
          setHoveringPoint(false);
          setHoverWorld(null);
          hoverPointerRef.current = null;
          hideHoverTooltip(true);
          if (coordinateRef.current) coordinateRef.current.textContent = '—';
        }}
        onAuxClick={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}
      />

      {readOnly ? null : (
      <div data-tour="editor-toolbar" className="editor-toolbar absolute top-3 left-3 flex flex-wrap items-center gap-1 rounded-xl p-1">
        <button
          type="button"
          title={t('editor.select')}
          aria-label={t('editor.selectTool')}
          data-tooltip-hint={t('tooltip.select')}
          aria-pressed={tool === 'select'}
          onClick={() => setTool('select')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            tool === 'select'
              ? 'bg-[var(--dmp-color-brand)] text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <MousePointer2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t('editor.pan')}
          aria-label={t('editor.panTool')}
          data-tooltip-hint={t('tooltip.pan')}
          aria-pressed={tool === 'pan'}
          onClick={() => setTool('pan')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            tool === 'pan'
              ? 'bg-[var(--dmp-color-brand)] text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <Hand className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t('editor.calibrate')}
          aria-label={t('editor.calibrateTool')}
          data-tooltip-hint={t('tooltip.calibrate')}
          aria-pressed={tool === 'calibrate'}
          onClick={() => setTool('calibrate')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            tool === 'calibrate'
              ? 'bg-[var(--dmp-color-brand)] text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <Ruler className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-white/10" />

        {POINT_SYMBOL_LIST.map((symbol) => {
          const Icon = POINT_ICONS[symbol.type];
          const active = tool === 'place' && placeType === symbol.type;
          const name = t(`editor.point.${symbol.type}`).toLowerCase();

          return (
            <button
              key={symbol.type}
              type="button"
              title={`${t('editor.placeTool', { symbol: name })}${
                symbol.shortcut ? ` (${symbol.shortcut})` : ''
              }`}
              aria-label={t('editor.placeTool', { symbol: name })}
              data-tooltip-hint={t('tooltip.place')}
              aria-pressed={active}
              onClick={() => {
                setPlaceType(symbol.type);
                setPlaceSubtype(null);
                setPlaceProductId(null);
                setTool('place');
              }}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                active
                  ? 'bg-[var(--dmp-color-brand)] text-white'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}

        <button
          type="button"
          title={t('editor.route')}
          aria-label={t('editor.routeTool')}
          data-tooltip-hint={t('tooltip.route')}
          aria-pressed={tool === 'route'}
          onClick={() => setTool('route')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            tool === 'route'
              ? 'bg-[var(--dmp-color-brand)] text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <Cable className="h-4 w-4" />
        </button>

        <button
          type="button"
          title={t('editor.wall')}
          aria-label={t('editor.wallTool')}
          data-tooltip-hint={t('tooltip.wall')}
          aria-pressed={tool === 'wall'}
          onClick={() => setTool('wall')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            tool === 'wall'
              ? 'bg-[var(--dmp-color-brand)] text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <BrickWall className="h-4 w-4" />
        </button>

        <button
          type="button"
          title={t('editor.room')}
          aria-label={t('editor.roomTool')}
          data-tooltip-hint={t('tooltip.room')}
          aria-pressed={tool === 'room'}
          onClick={() => setTool('room')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            tool === 'room'
              ? 'bg-[var(--dmp-color-brand)] text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <SquareDashed className="h-4 w-4" />
        </button>

        <button
          type="button"
          title={t('editor.dimension')}
          aria-label={t('editor.dimensionTool')}
          data-tooltip-hint={t('tooltip.dimension')}
          aria-pressed={tool === 'dimension'}
          onClick={() => setTool('dimension')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            tool === 'dimension'
              ? 'bg-[var(--dmp-color-brand)] text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <RulerDimensionLine className="h-4 w-4" />
        </button>

        <button
          type="button"
          title={t('editor.snapShortcut')}
          aria-label={t('editor.snap')}
          data-tooltip-hint={t('tooltip.snap')}
          aria-pressed={snapEnabled}
          onClick={() => setSnapEnabled((value) => !value)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            snapEnabled
              ? 'bg-[var(--dmp-color-brand)] text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <Magnet className="h-4 w-4" />
        </button>

        <button
          type="button"
          title={t('editor.orthoShortcut')}
          aria-label={t('editor.ortho')}
          data-tooltip-hint={t('tooltip.ortho')}
          aria-pressed={orthoEnabled}
          onClick={() => setOrthoEnabled((value) => !value)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            orthoEnabled
              ? 'bg-[var(--dmp-color-brand)] text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <CornerDownRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          title={t('editor.gridShortcut')}
          aria-label={t('editor.grid')}
          data-tooltip-hint={t('tooltip.grid')}
          aria-pressed={gridEnabled}
          onClick={() => setGridEnabled((value) => !value)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            gridEnabled
              ? 'bg-[var(--dmp-color-brand)] text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <Grid3x3 className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-white/10" />

        <button
          type="button"
          title={t('editor.undoShortcut')}
          aria-label={t('editor.undo')}
          data-tooltip-hint={t('tooltip.undo')}
          onClick={onUndo}
          disabled={!canUndo || historyBusy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-300"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t('editor.redoShortcut')}
          aria-label={t('editor.redo')}
          data-tooltip-hint={t('tooltip.redo')}
          onClick={onRedo}
          disabled={!canRedo || historyBusy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-300"
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-white/10" />

        <button
          type="button"
          title={t('editor.zoomOutShortcut')}
          aria-label={t('editor.zoomOut')}
          data-tooltip-hint={t('tooltip.zoomOut')}
          onClick={() =>
            zoomAt(size.width / 2, size.height / 2, 0.8)
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={t('editor.resetZoom')}
          onClick={() =>
            zoomAt(size.width / 2, size.height / 2, 1 / viewport.zoom)
          }
          className="min-w-14 rounded-lg px-2 py-1 text-xs font-medium text-slate-300 tabular-nums hover:bg-white/10 hover:text-white"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>
        <button
          type="button"
          title={t('editor.zoomInShortcut')}
          aria-label={t('editor.zoomIn')}
          data-tooltip-hint={t('tooltip.zoomIn')}
          onClick={() =>
            zoomAt(size.width / 2, size.height / 2, 1.25)
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-white/10" />

        <button
          type="button"
          title={t('editor.fitShortcut')}
          aria-label={t('editor.fit')}
          data-tooltip-hint={t('tooltip.fit')}
          onClick={fitToPlan}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-white/10" />

        <button
          type="button"
          title={t('editor.downloadPng')}
          aria-label={t('editor.downloadPng')}
          data-tooltip-hint={t('tooltip.download')}
          onClick={() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const link = document.createElement('a');
            link.download = 'drawing.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Download className="h-4 w-4" />
        </button>
      </div>
      )}

      <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[10px] text-slate-500 backdrop-blur">
          <Crosshair className="h-3 w-3 text-amber-300" />
          <span
            ref={coordinateRef}
            className="min-w-[4.5rem] font-mono tabular-nums text-slate-300"
          >
            —
          </span>
          <span className="text-slate-700">|</span>
          <span className={gridEnabled ? 'text-emerald-300' : 'text-slate-600'}>
            {t('editor.statusGrid')}
          </span>
          <span className={snapEnabled ? 'text-emerald-300' : 'text-slate-600'}>
            {t('editor.statusSnap')}
          </span>
          <span className={orthoEnabled ? 'text-emerald-300' : 'text-slate-600'}>
            {t('editor.statusOrtho')}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[10px] text-slate-500 backdrop-blur">
          {saveStatus ? (
            <span
              className={
                saveStatus.tone === 'ok'
                  ? 'text-emerald-300'
                  : saveStatus.tone === 'error'
                    ? 'text-rose-300'
                    : 'text-amber-200'
              }
            >
              {saveStatus.label}
            </span>
          ) : null}
          <span className="text-slate-700">|</span>
          <span className="font-mono tabular-nums text-slate-300">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <span>{calibration ? t('editor.statusMeters') : t('editor.statusUnits')}</span>
        </div>
      </div>

      <div className="pointer-events-none absolute right-3 bottom-14 rounded-lg border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-400 backdrop-blur">
        {tool === 'calibrate'
          ? calibrationDraft.length === 0
            ? t('editor.hint.calibrateFirst')
            : t('editor.hint.calibrateSecond')
          : tool === 'route'
            ? routeDraft.length === 0
              ? t('editor.hint.routeStart')
              : t('editor.hint.routeBends')
            : tool === 'wall'
              ? wallDraft.length === 0
                ? t('editor.hint.wallStart')
                : t('editor.hint.wallCorners')
              : tool === 'room'
                ? roomDraft.length === 0
                  ? t('editor.hint.roomStart')
                  : t('editor.hint.roomCorners')
                : tool === 'dimension'
                  ? dimensionDraft.length === 0
                    ? t('editor.hint.dimensionFirst')
                    : t('editor.hint.dimensionSecond')
                  : tool === 'place'
                    ? t('editor.hint.place', {
                        symbol: t(
                          `editor.point.${placeType}`,
                        ).toLowerCase(),
                      })
                    : selectedPointId
                      ? t('editor.hint.selectedPoint')
                      : selectedRouteId
                        ? selectedVertex
                          ? t('editor.hint.selectedBend')
                          : t('editor.hint.selectedRoute')
                        : selectedWallId
                          ? t('editor.hint.selectedWall')
                          : selectedRoomId
                            ? t('editor.hint.selectedRoom')
                            : selectedDimensionId
                              ? t('editor.hint.selectedDimension')
                              : t('editor.hint.idle')}
      </div>

      {!image ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-center backdrop-blur">
            <p className="text-sm font-medium text-slate-200">
              {t('editor.blankPlan')}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t('editor.blankPlanHint')}
            </p>
          </div>
        </div>
      ) : null}

      {hoverTooltip ? (
        <CanvasHoverTooltip
          target={hoverTooltip.target}
          x={hoverTooltip.x}
          y={hoverTooltip.y}
          longPress={hoverTooltip.longPress}
          points={points}
          routes={routes}
          walls={walls}
          openings={openings}
          rooms={rooms}
          dimensions={dimensions}
          circuits={circuits}
          materialNames={materialNames}
          routeDetails={routeDetails}
          metersPerUnit={metersPerUnit}
          wallHeightMeters={wallHeightMeters}
        />
      ) : null}
    </div>
  );
}
