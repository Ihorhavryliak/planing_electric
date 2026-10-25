import type {
  EditorViewport,
  ElectricalPointType,
  PublicCalibration,
  PublicDimension,
  PublicPoint,
  PublicRoom,
  PublicRoute,
  PublicWall,
  UnderlaySettings,
} from '@drawmyplace/contracts';
import {
  Box,
  BrickWall,
  Cable,
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
import { drawCalibrationOverlay } from './calibration-overlay';
import {
  distanceBetween,
  findPointAt,
  gridStep,
  isClick,
  niceStep,
  screenToWorld,
  snapToStep,
  type Vec2,
} from './editor-geometry';
import { drawPointsOverlay, type PointRenderItem } from './point-overlay';
import { drawRoutesOverlay, type RouteRenderItem } from './route-overlay';
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
  moveAttachedRouteEnds,
  snapToPoint,
  type ClickRecord,
} from './route-geometry';
import {
  POINT_SYMBOLS,
  POINT_SYMBOL_LIST,
  symbolForShortcut,
} from './point-symbols';

type EditorTool =
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

interface EditorCanvasProps {
  image: HTMLImageElement | null;
  underlay: UnderlaySettings;
  viewport: EditorViewport;
  autoFit: boolean;
  calibration: PublicCalibration | null;
  walls: readonly PublicWall[];
  selectedWallId: string | null;
  rooms: readonly PublicRoom[];
  selectedRoomId: string | null;
  dimensions: readonly PublicDimension[];
  selectedDimensionId: string | null;
  points: readonly PublicPoint[];
  selectedPointId: string | null;
  routes: readonly PublicRoute[];
  selectedRouteId: string | null;
  onCalibrationPoints: (pointA: Vec2, pointB: Vec2) => void;
  onSelectPoint: (id: string | null) => void;
  onCreatePoint: (type: ElectricalPointType, at: Vec2) => void;
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

  drawLines(minorStep, 'rgba(148, 163, 184, 0.055)');
  drawLines(majorStep, 'rgba(148, 163, 184, 0.12)');

  context.strokeStyle = 'rgba(251, 191, 36, 0.22)';
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
  underlay,
  viewport,
  autoFit,
  calibration,
  walls,
  selectedWallId,
  rooms,
  selectedRoomId,
  dimensions,
  selectedDimensionId,
  points,
  selectedPointId,
  routes,
  selectedRouteId,
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
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tool, setTool] = useState<EditorTool>('select');
  const [spaceDown, setSpaceDown] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hoveringUnderlay, setHoveringUnderlay] = useState(false);
  const [calibrationDraft, setCalibrationDraft] = useState<Vec2[]>([]);
  const [cursorWorld, setCursorWorld] = useState<Vec2 | null>(null);
  const [placeType, setPlaceType] = useState<ElectricalPointType>('socket');
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [hoverWorld, setHoverWorld] = useState<Vec2 | null>(null);
  const [hoveringPoint, setHoveringPoint] = useState(false);
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
  const snapRef = useRef(snapEnabled);
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
  snapRef.current = snapEnabled;
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

  const renderRoutes = useMemo<RouteRenderItem[]>(() => {
    const draggedPoint = pointDrag
      ? points.find((point) => point.id === pointDrag.id)
      : undefined;
    // Route ends follow the point being dragged before the change is saved.
    const attached = new Map(
      (
        draggedPoint && pointDrag
          ? moveAttachedRouteEnds(
              routes,
              { x: draggedPoint.x, y: draggedPoint.y },
              pointDrag.at,
            )
          : []
      ).map((update) => [update.id, update.geometry]),
    );

    return routes.map((route) => ({
      id: route.id,
      geometry:
        attached.get(route.id) ??
        (vertexDrag?.routeId === route.id
          ? route.geometry.map((vertex, index) =>
              index === vertexDrag.index ? vertexDrag.at : vertex,
            )
          : route.geometry),
    }));
  }, [routes, vertexDrag, pointDrag, points]);

  // Points as drawn: the one being dragged follows the pointer before it is saved.
  const renderPoints = useMemo<PointRenderItem[]>(
    () =>
      points.map((point) =>
        pointDrag?.id === point.id
          ? { ...point, x: pointDrag.at.x, y: pointDrag.at.y }
          : point,
      ),
    [points, pointDrag],
  );

  const renderWalls = useMemo<WallRenderItem[]>(
    () =>
      walls.map((wall) => ({
        id: wall.id,
        geometry:
          wallDrag?.id === wall.id ? wallDrag.geometry : wall.geometry,
        thickness: wall.thickness,
        label: wall.label,
      })),
    [walls, wallDrag],
  );

  const renderRooms = useMemo<RoomRenderItem[]>(
    () =>
      rooms.map((room) => ({
        id: room.id,
        name: room.name,
        boundary:
          roomDrag?.id === room.id ? roomDrag.boundary : room.boundary,
      })),
    [rooms, roomDrag],
  );

  const renderDimensions = useMemo<DimensionRenderItem[]>(
    () =>
      dimensions.map((dimension) => ({
        id: dimension.id,
        pointA: dimension.pointA,
        pointB: dimension.pointB,
        offset:
          dimensionDrag?.id === dimension.id
            ? dimensionDrag.offset
            : dimension.offset,
        label: dimension.label,
      })),
    [dimensions, dimensionDrag],
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
    context.fillStyle = '#020617';
    context.fillRect(0, 0, size.width, size.height);

    drawGrid(context, size.width, size.height, viewport);
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
      renderWalls,
      renderRooms,
      renderDimensions,
      selectedWallId,
      selectedRoomId,
      selectedDimensionId,
      structureDraft,
      hoverWorld,
      metersPerUnit,
    );
    drawCalibrationOverlay(
      context,
      size,
      viewport,
      calibration,
      calibrationDraft,
      cursorWorld,
    );
    drawRoutesOverlay(
      context,
      size,
      viewport,
      renderRoutes,
      selectedRouteId,
      routeDraft,
      tool === 'route' ? hoverWorld : null,
      selectedVertex?.routeId === selectedRouteId
        ? selectedVertex.index
        : null,
    );
    drawPointsOverlay(
      context,
      size,
      viewport,
      renderPoints,
      selectedPointId,
      tool === 'place' && hoverWorld
        ? { type: placeType, at: hoverWorld }
        : null,
    );
  }, [
    size,
    viewport,
    underlay,
    image,
    calibration,
    calibrationDraft,
    cursorWorld,
    renderPoints,
    renderRoutes,
    renderWalls,
    renderRooms,
    renderDimensions,
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
    return (
      snapToPoint(
        pointsRef.current,
        screen,
        viewportRef.current,
        sizeRef.current,
      ) ?? snapped(toWorld(screen))
    );
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
      const hitId = findPointAt(
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
        const selected = routesRef.current.find(
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
            selectsRouteId = findRouteAt(
              routesRef.current,
              point,
              viewportRef.current,
              sizeRef.current,
            );
            setSelectedVertex(null);

            if (selectsRouteId) {
              clearStructureSelection();
            } else {
              const selectedWall = wallsRef.current.find(
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
                const selectedRoom = roomsRef.current.find(
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
                  const dimensionHit = findDimensionAt(
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
                    const wallHit = findPolylineAt(
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
                      const roomHit = findRoomAt(
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
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    const point = localPoint(event);
    const drag = dragRef.current;

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
          findPointAt(
            pointsRef.current,
            point,
            viewportRef.current,
            sizeRef.current,
          ) !== null ||
            findRouteAt(
              routesRef.current,
              point,
              viewportRef.current,
              sizeRef.current,
            ) !== null ||
            findPolylineAt(
              wallsRef.current,
              point,
              viewportRef.current,
              sizeRef.current,
            ) !== null ||
            findRoomAt(
              roomsRef.current,
              point,
              viewportRef.current,
              sizeRef.current,
            ) !== null ||
            findDimensionAt(
              dimensionsRef.current,
              point,
              viewportRef.current,
              sizeRef.current,
            ) !== null,
        );
      } else {
        if (hoveringUnderlay) {
          setHoveringUnderlay(false);
        }

        if (hoveringPoint) {
          setHoveringPoint(false);
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
        aria-label="Floor plan canvas"
        role="application"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDragging}
        onPointerCancel={finishDragging}
        onPointerLeave={() => {
          setHoveringUnderlay(false);
          setHoveringPoint(false);
          setHoverWorld(null);
        }}
        onAuxClick={(event) => event.preventDefault()}
        onContextMenu={(event) => event.preventDefault()}
      />

      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-slate-950/90 p-1 shadow-xl shadow-black/30 backdrop-blur">
        <button
          type="button"
          title="Select and move (V)"
          aria-label="Select tool"
          aria-pressed={tool === 'select'}
          onClick={() => setTool('select')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            tool === 'select'
              ? 'bg-amber-400 text-slate-950'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <MousePointer2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Pan (H)"
          aria-label="Pan tool"
          aria-pressed={tool === 'pan'}
          onClick={() => setTool('pan')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            tool === 'pan'
              ? 'bg-amber-400 text-slate-950'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <Hand className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Calibrate scale (C)"
          aria-label="Calibrate scale tool"
          aria-pressed={tool === 'calibrate'}
          onClick={() => setTool('calibrate')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            tool === 'calibrate'
              ? 'bg-amber-400 text-slate-950'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <Ruler className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-white/10" />

        {POINT_SYMBOL_LIST.map((symbol) => {
          const Icon = POINT_ICONS[symbol.type];
          const active = tool === 'place' && placeType === symbol.type;

          return (
            <button
              key={symbol.type}
              type="button"
              title={`Place ${symbol.label.toLowerCase()}${
                symbol.shortcut ? ` (${symbol.shortcut})` : ''
              }`}
              aria-label={`Place ${symbol.label.toLowerCase()}`}
              aria-pressed={active}
              onClick={() => {
                setPlaceType(symbol.type);
                setTool('place');
              }}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                active
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}

        <button
          type="button"
          title="Draw cable route (R)"
          aria-label="Draw cable route tool"
          aria-pressed={tool === 'route'}
          onClick={() => setTool('route')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            tool === 'route'
              ? 'bg-amber-400 text-slate-950'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <Cable className="h-4 w-4" />
        </button>

        <button
          type="button"
          title="Draw wall (Q)"
          aria-label="Draw wall tool"
          aria-pressed={tool === 'wall'}
          onClick={() => setTool('wall')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            tool === 'wall'
              ? 'bg-amber-400 text-slate-950'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <BrickWall className="h-4 w-4" />
        </button>

        <button
          type="button"
          title="Draw room outline (O)"
          aria-label="Draw room outline tool"
          aria-pressed={tool === 'room'}
          onClick={() => setTool('room')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            tool === 'room'
              ? 'bg-amber-400 text-slate-950'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <SquareDashed className="h-4 w-4" />
        </button>

        <button
          type="button"
          title="Add dimension (D)"
          aria-label="Add dimension tool"
          aria-pressed={tool === 'dimension'}
          onClick={() => setTool('dimension')}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            tool === 'dimension'
              ? 'bg-amber-400 text-slate-950'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <RulerDimensionLine className="h-4 w-4" />
        </button>

        <button
          type="button"
          title="Snap to grid (G)"
          aria-label="Snap to grid"
          aria-pressed={snapEnabled}
          onClick={() => setSnapEnabled((value) => !value)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
            snapEnabled
              ? 'bg-amber-400 text-slate-950'
              : 'text-slate-300 hover:bg-white/10 hover:text-white',
          )}
        >
          <Magnet className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-white/10" />

        <button
          type="button"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          onClick={onUndo}
          disabled={!canUndo || historyBusy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-300"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
          onClick={onRedo}
          disabled={!canRedo || historyBusy}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-300"
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <span className="mx-1 h-5 w-px bg-white/10" />

        <button
          type="button"
          title="Zoom out (−)"
          aria-label="Zoom out"
          onClick={() =>
            zoomAt(size.width / 2, size.height / 2, 0.8)
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Reset to 100% (1)"
          onClick={() =>
            zoomAt(size.width / 2, size.height / 2, 1 / viewport.zoom)
          }
          className="min-w-14 rounded-lg px-2 py-1 text-xs font-medium text-slate-300 tabular-nums hover:bg-white/10 hover:text-white"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>
        <button
          type="button"
          title="Zoom in (+)"
          aria-label="Zoom in"
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
          title="Fit plan (0)"
          aria-label="Fit plan to view"
          onClick={fitToPlan}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <div className="pointer-events-none absolute right-3 bottom-3 rounded-lg border border-white/10 bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-400 backdrop-blur">
        {tool === 'calibrate'
          ? calibrationDraft.length === 0
            ? 'Click the first end of a known distance · Esc to cancel'
            : 'Click the second end · Esc to restart'
          : tool === 'route'
            ? routeDraft.length === 0
              ? 'Click to start a route (ends snap to points) · Esc to exit'
              : 'Click to add bends · Double-click or Enter to finish · Backspace removes the last'
            : tool === 'wall'
              ? wallDraft.length === 0
                ? 'Click to start a wall · Esc to exit'
                : 'Click to add corners · Double-click or Enter to finish · Backspace removes the last'
              : tool === 'room'
                ? roomDraft.length === 0
                  ? 'Click to start a room outline · Esc to exit'
                  : 'Click to add corners · Double-click or Enter to close the room · Backspace removes the last'
                : tool === 'dimension'
                  ? dimensionDraft.length === 0
                    ? 'Click the first measured point · Esc to exit'
                    : 'Click the second measured point · Esc to cancel'
                  : tool === 'place'
                    ? `Click to place: ${POINT_SYMBOLS[placeType].label.toLowerCase()} · Esc to finish`
                    : selectedPointId
                      ? 'Drag to move · Delete to remove · Esc to deselect'
                      : selectedRouteId
                        ? selectedVertex
                          ? 'Selected bend · Delete removes it · Esc deselects'
                          : 'Drag a square to move a bend · Click a circle to add one · Click a square then Delete to remove it'
                        : selectedWallId
                          ? 'Drag a square to move a corner · Drag the wall to move it · Delete removes the wall'
                          : selectedRoomId
                            ? 'Drag a square to move a corner · Drag the room to move it · Delete removes the room'
                            : selectedDimensionId
                              ? 'Drag the dimension line to change its offset · Delete removes it'
                              : 'Drag to pan · Scroll to zoom · Space to pan'}
      </div>

      {!image ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-center backdrop-blur">
            <p className="text-sm font-medium text-slate-200">Blank plan</p>
            <p className="mt-1 text-xs text-slate-500">
              Grid units are independent of zoom and pan.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
