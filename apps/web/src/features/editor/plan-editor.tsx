import type {
  Circuit,
  CreateDimensionInput,
  CreateOpeningInput,
  CreatePointInput,
  CreateRoomInput,
  CreateRouteInput,
  CreateWallInput,
  EditorViewport,
  ElectricalPointType,
  LengthUnitInput,
  PublicCalibration,
  PublicDimension,
  PublicOpening,
  PublicPlan,
  PlanCalculation,
  PublicPoint,
  PublicRoom,
  PublicRoute,
  PublicWall,
  SetCalibrationInput,
  UnderlaySettings,
  UpdateDimensionInput,
  UpdateOpeningInput,
  UpdatePointInput,
  UpdateRoomInput,
  UpdateRouteInput,
  UpdateWallInput,
} from '@drawmyplace/contracts';
import {
  Check,
  Clock3,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  ImagePlus,
  LoaderCircle,
  Lock,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Ruler,
  Save,
  TriangleAlert,
  Unlock,
  Upload,
} from 'lucide-react';
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalibrationDialog } from './calibration-dialog';
import { CalculationPanel } from './calculation-panel';
import { CircuitsPanel } from './circuits-panel';
import { LayersPanel } from './layers-panel';
import { TakeoffPanel } from './takeoff-panel';
import { ValidationPanel } from './validation-panel';
import {
  validatePlan,
  type ValidationTarget,
} from './validation';
import { useTakeoffSettings } from './takeoff-settings';
import {
  buildTakeoff,
  countRoutePenetrations,
} from '@drawmyplace/calculations';
import { useEditorLayers } from './editor-layers';
import { DevicePalette } from './device-palette';
import {
  createDimension,
  createOpening,
  createPoint,
  createRoom,
  createRoute,
  createWall,
  deleteDimension,
  deleteOpening,
  deletePoint,
  deleteRoom,
  deleteRoute,
  deleteWall,
  getPlanCalculation,
  getPlanDrawing,
  removeCalibration,
  saveCalibration,
  updateDimension,
  updateOpening,
  updatePoint,
  updateRoom,
  updateRoute,
  updateWall,
} from './drawing-api';
import type { Vec2 } from './editor-geometry';
import {
  loadPlanFile,
  planFileUrl,
  planPreviewUrl,
  replacePlanFile,
  updatePlan,
  uploadPlanPreview,
} from './editor-api';
import {
  EditorCanvas,
  type EditorTool,
  type PlacementRequest,
  type ToolRequest,
} from './editor-canvas';
import { CommandPalette, type CommandPaletteItem } from './command-palette';
import { HotkeysOverlay } from './hotkeys-overlay';
import { RoomNavigator } from './room-navigator';
import {
  UI_SCALES,
  useEditorPreferences,
} from './editor-preferences';

const ThreeView = lazy(() =>
  import('./three-view').then((module) => ({ default: module.ThreeView })),
);
import {
  EMPTY_HISTORY,
  addHistoryEntry,
  getRedoCommand,
  getUndoCommand,
  markRedone,
  markUndone,
  type HistoryCommand,
  type HistoryState,
} from './editor-history';
import {
  describeError,
  planUploadKind,
  type PlanUploadKind,
} from './editor-utils';
import { PdfPageDialog } from './pdf-page-dialog';
import { PointPropertiesPanel } from './point-properties-panel';
import { POINT_SYMBOL_LIST, countByType } from './point-symbols';
import {
  insertVertexAt,
  moveAttachedRouteEnds,
  removeVertexAt,
} from './route-geometry';
import { RoutePropertiesPanel } from './route-properties-panel';
import { listMaterials, generateEstimate } from './materials-api';
import type { PublicEstimate } from '@drawmyplace/contracts';
import type { PublicMaterial } from '@drawmyplace/contracts';
import {
  DimensionPropertiesPanel,
  RoomPropertiesPanel,
  WallPropertiesPanel,
} from './structure-properties-panel';
import { translateGeometry } from './structure-geometry';
import { countPdfPages, renderPdfPageToPng } from './pdf-preview';
import {
  usePlanAutosave,
  type AutosaveStatus,
} from './use-plan-autosave';
import { getErrorMessage } from '@/lib/api';
import { useI18n } from '@/features/i18n/i18n-context';
import { cn } from '@/lib/utils';

interface PlanEditorProps {
  plan: PublicPlan;
  floorName: string;
  onPlanChange: (plan: PublicPlan) => void;
}

interface PendingCalibration {
  pointA: Vec2;
  pointB: Vec2;
}

interface PendingPdf {
  file: File;
  pages: number;
}

function createPointInput(point: PublicPoint): CreatePointInput {
  return {
    type: point.type,
    x: point.x,
    y: point.y,
    rotation: point.rotation,
    label: point.label,
    mountingHeight: point.mountingHeight,
    properties: point.properties,
  };
}

function updatePointInput(point: PublicPoint): UpdatePointInput {
  return createPointInput(point);
}

function createRouteInput(route: PublicRoute): CreateRouteInput {
  return {
    geometry: route.geometry,
    circuitId: route.circuitId,
    settings: route.settings,
  };
}

function updateRouteInput(route: PublicRoute): UpdateRouteInput {
  return createRouteInput(route);
}

function createWallInput(wall: PublicWall): CreateWallInput {
  return {
    geometry: wall.geometry,
    thickness: wall.thickness,
    label: wall.label,
  };
}

function updateWallInput(wall: PublicWall): UpdateWallInput {
  return createWallInput(wall);
}

function createOpeningInput(opening: PublicOpening): CreateOpeningInput {
  return {
    wallId: opening.wallId,
    type: opening.type,
    offset: opening.offset,
    width: opening.width,
    height: opening.height,
    sillHeight: opening.sillHeight,
    flipped: opening.flipped,
    label: opening.label,
  };
}

function updateOpeningInput(opening: PublicOpening): UpdateOpeningInput {
  return createOpeningInput(opening);
}

function wallLength(geometry: readonly Vec2[]): number {
  let total = 0;
  for (let index = 0; index < geometry.length - 1; index += 1) {
    const start = geometry[index];
    const end = geometry[index + 1];
    if (start && end) {
      total += Math.hypot(end.x - start.x, end.y - start.y);
    }
  }
  return total;
}

function createRoomInput(room: PublicRoom): CreateRoomInput {
  return {
    name: room.name,
    boundary: room.boundary,
  };
}

function updateRoomInput(room: PublicRoom): UpdateRoomInput {
  return createRoomInput(room);
}

function createDimensionInput(
  dimension: PublicDimension,
): CreateDimensionInput {
  return {
    pointA: dimension.pointA,
    pointB: dimension.pointB,
    offset: dimension.offset,
    label: dimension.label,
  };
}

function updateDimensionInput(
  dimension: PublicDimension,
): UpdateDimensionInput {
  return createDimensionInput(dimension);
}

function calibrationInput(
  calibration: PublicCalibration,
): SetCalibrationInput {
  return {
    pointA: calibration.pointA,
    pointB: calibration.pointB,
    realDistance: calibration.realDistance,
    unit: calibration.unit,
  };
}

const saveLabelKeys: Record<AutosaveStatus, string> = {
  saved: 'editor.allSaved',
  pending: 'editor.unsavedChanges',
  saving: 'editor.saving',
  error: 'editor.saveFailed',
};

function SaveStatus({
  status,
  error,
  onRetry,
}: {
  status: AutosaveStatus;
  error: string | null;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-2 text-xs font-medium',
            status === 'saved' && 'text-emerald-300',
            status === 'pending' && 'text-amber-200',
            status === 'saving' && 'text-slate-300',
            status === 'error' && 'text-rose-300',
          )}
          role="status"
          aria-live="polite"
        >
          {status === 'saved' ? (
            <Check className="h-3.5 w-3.5" />
          ) : status === 'saving' ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : status === 'pending' ? (
            <Clock3 className="h-3.5 w-3.5" />
          ) : (
            <TriangleAlert className="h-3.5 w-3.5" />
          )}
          {t(saveLabelKeys[status])}
        </span>

        {status === 'error' ? (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" />
            {t('editor.retry')}
          </Button>
        ) : (
          <Save className="h-3.5 w-3.5 text-slate-600" />
        )}
      </div>

      {error ? (
        <p className="mt-2 text-xs leading-relaxed text-rose-200">{error}</p>
      ) : null}
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs text-slate-400">
        {label}
        <span className="font-medium text-slate-200 tabular-nums">
          {displayValue}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

function OverlayCard({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div className="pointer-events-auto max-w-sm rounded-2xl border border-white/10 bg-slate-950/95 p-5 text-center shadow-2xl shadow-black/40 backdrop-blur">
        {children}
      </div>
    </div>
  );
}

export function PlanEditor({
  plan,
  floorName,
  onPlanChange,
}: PlanEditorProps) {
  const { t, formatNumber, formatScale, formatUnit } = useI18n();
  const [underlay, setUnderlay] = useState<UnderlaySettings>(plan.underlay);
  const [viewport, setViewport] = useState<EditorViewport>(plan.viewport);
  const [assetNonce, setAssetNonce] = useState(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const [preparingFile, setPreparingFile] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pendingPdf, setPendingPdf] = useState<PendingPdf | null>(null);

  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pageBusy, setPageBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState(String(plan.page ?? 1));

  const [calibration, setCalibration] = useState<PublicCalibration | null>(
    null,
  );
  const [pendingCalibration, setPendingCalibration] =
    useState<PendingCalibration | null>(null);
  const [calibrationBusy, setCalibrationBusy] = useState(false);
  const [calibrationError, setCalibrationError] = useState<string | null>(
    null,
  );
  const [drawingError, setDrawingError] = useState<string | null>(null);

  const [points, setPoints] = useState<PublicPoint[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const pointsRef = useRef(points);
  /** Latest request number per point; stale responses must not overwrite newer edits. */
  const pointRequestRef = useRef(new Map<string, number>());

  pointsRef.current = points;

  const [routes, setRoutes] = useState<PublicRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const routesRef = useRef(routes);
  const routeRequestRef = useRef(new Map<string, number>());

  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'split'>('2d');
  const [placementRequest, setPlacementRequest] =
    useState<PlacementRequest | null>(null);
  const [toolRequest, setToolRequest] = useState<ToolRequest | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [hotkeysOpen, setHotkeysOpen] = useState(false);
  const { layers, toggleLayer, showAllLayers } = useEditorLayers();
  const { preferences, setUiScale, toggleSidebar } = useEditorPreferences();
  const {
    settings: takeoffSettings,
    setWallHeight,
    setDefaultThickness,
  } = useTakeoffSettings();
  const [remoteUpdate, setRemoteUpdate] = useState(false);
  const [collaborators, setCollaborators] = useState(0);
  const [dropDrafts, setDropDrafts] = useState<Record<string, string>>({});
  const [dropError, setDropError] = useState<string | null>(null);
  const [maxCircuit, setMaxCircuit] = useState('');
  const [requireCableType, setRequireCableType] = useState(false);
  const [walls, setWalls] = useState<PublicWall[]>([]);
  const [materials, setMaterials] = useState<PublicMaterial[]>([]);
  const [estimate, setEstimate] = useState<PublicEstimate | null>(null);
  const [estimateBusy, setEstimateBusy] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [openings, setOpenings] = useState<PublicOpening[]>([]);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(
    null,
  );
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<PublicDimension[]>([]);
  const [selectedDimensionId, setSelectedDimensionId] = useState<
    string | null
  >(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const wallsRef = useRef(walls);
  const openingsRef = useRef(openings);
  const roomsRef = useRef(rooms);
  const dimensionsRef = useRef(dimensions);
  const wallRequestRef = useRef(new Map<string, number>());
  const openingRequestRef = useRef(new Map<string, number>());
  const roomRequestRef = useRef(new Map<string, number>());
  const dimensionRequestRef = useRef(new Map<string, number>());

  wallsRef.current = walls;
  openingsRef.current = openings;
  roomsRef.current = rooms;
  dimensionsRef.current = dimensions;
  const [calculation, setCalculation] = useState<PlanCalculation | null>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  /** Bumped after every saved change that can alter cable lengths. */
  const [calcNonce, setCalcNonce] = useState(0);

  const [history, setHistory] = useState<HistoryState>(EMPTY_HISTORY);
  const historyRef = useRef<HistoryState>(EMPTY_HISTORY);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyBusyRef = useRef(false);
  const pendingHistoryRef = useRef<'undo' | 'redo' | null>(null);

  routesRef.current = routes;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { status, error: saveError, retry } = usePlanAutosave({
    plan,
    underlay,
    viewport,
    onPlanChange,
  });

  const isPdf = plan.mimeType === 'application/pdf';
  const hasUploadedFile = plan.sourceType === 'upload' && plan.mimeType !== null;
  const imageUrl =
    plan.sourceType === 'upload'
      ? plan.mimeType === 'application/pdf'
        ? plan.hasPreview
          ? planPreviewUrl(plan.id, assetNonce)
          : null
        : planFileUrl(plan.id, assetNonce)
      : null;
  const needsPreview = hasUploadedFile && isPdf && !plan.hasPreview;

  useEffect(() => {
    setPageInput(String(plan.page ?? 1));
  }, [plan.page]);

  useEffect(() => {
    const defaults =
      plan.calculationSettings?.verticalDropDefaults ?? {};
    setDropDrafts({
      socket: defaults.socket !== undefined ? String(defaults.socket) : '',
      switch: defaults.switch !== undefined ? String(defaults.switch) : '',
      light: defaults.light !== undefined ? String(defaults.light) : '',
      panel: defaults.panel !== undefined ? String(defaults.panel) : '',
      junction: defaults.junction !== undefined ? String(defaults.junction) : '',
      custom: defaults.custom !== undefined ? String(defaults.custom) : '',
    });
    const validation = plan.calculationSettings?.validation ?? {};
    setMaxCircuit(
      validation.maxCircuitLengthMeters !== undefined
        ? String(validation.maxCircuitLengthMeters)
        : '',
    );
    setRequireCableType(Boolean(validation.requireCableType));
  }, [plan.id, plan.calculationSettings]);

  useEffect(() => {
    let cancelled = false;

    listMaterials()
      .then((result) => {
        if (!cancelled) {
          setMaterials(result);
        }
      })
      .catch(() => {
        // Materials are optional for editing; keep the editor usable.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    setDrawingError(null);
    setPoints([]);
    setSelectedPointId(null);
    setPointsError(null);
    pointRequestRef.current.clear();
    setRoutes([]);
    setSelectedRouteId(null);
    setRoutesError(null);
    routeRequestRef.current.clear();
    setWalls([]);
    setSelectedWallId(null);
    setOpenings([]);
    setSelectedOpeningId(null);
    openingRequestRef.current.clear();
    setRooms([]);
    setSelectedRoomId(null);
    setDimensions([]);
    setSelectedDimensionId(null);
    setLayoutError(null);
    wallRequestRef.current.clear();
    roomRequestRef.current.clear();
    dimensionRequestRef.current.clear();
    setCalculation(null);

    getPlanDrawing(plan.id, controller.signal)
      .then((drawing) => {
        if (!controller.signal.aborted) {
          setCalibration(drawing.calibration);
          setPoints(drawing.points);
          setRoutes(drawing.routes);
          setWalls(drawing.walls);
          setOpenings(drawing.openings);
          setRooms(drawing.rooms);
          setDimensions(drawing.dimensions);
        }
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setDrawingError(getErrorMessage(loadError));
        }
      });

    return () => controller.abort();
  }, [plan.id]);

  useEffect(() => {
    setRemoteUpdate(false);
    setCollaborators(0);
    const source = new EventSource(`/api/v1/plans/${plan.id}/events`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          channel?: string;
          count?: number;
        };
        if (payload.channel === 'presence') {
          setCollaborators(payload.count ?? 0);
        } else {
          setRemoteUpdate(true);
        }
      } catch {
        // Ignore malformed events.
      }
    };
    source.onerror = () => {
      // EventSource reconnects automatically; no UI action needed.
    };
    return () => source.close();
  }, [plan.id]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setCalcLoading(true);

      getPlanCalculation(plan.id, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) {
            setCalculation(result);
            setCalcError(null);
          }
        })
        .catch((loadError: unknown) => {
          if (!controller.signal.aborted) {
            setCalcError(getErrorMessage(loadError));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setCalcLoading(false);
          }
        });
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [plan.id, calcNonce]);

  function bumpCalculation() {
    setCalcNonce((value) => value + 1);
  }

  function commitHistory(next: HistoryState) {
    historyRef.current = next;
    setHistory(next);
  }

  function pushHistory(command: HistoryCommand) {
    setHistoryError(null);
    commitHistory(addHistoryEntry(historyRef.current, command));
  }

  /** Re-reads the drawing after undo/redo so route ends moved by the server match. */
  async function reloadDrawing() {
    const drawing = await getPlanDrawing(plan.id);

    setCalibration(drawing.calibration);
    setPoints(drawing.points);
    setRoutes(drawing.routes);
    setWalls(drawing.walls);
    setOpenings(drawing.openings);
    setRooms(drawing.rooms);
    setDimensions(drawing.dimensions);
    setSelectedPointId((current) =>
      current && drawing.points.some((point) => point.id === current)
        ? current
        : null,
    );
    setSelectedRouteId((current) =>
      current && drawing.routes.some((route) => route.id === current)
        ? current
        : null,
    );
    setSelectedWallId((current) =>
      current && drawing.walls.some((wall) => wall.id === current)
        ? current
        : null,
    );
    setSelectedOpeningId((current) =>
      current && drawing.openings.some((opening) => opening.id === current)
        ? current
        : null,
    );
    setSelectedRoomId((current) =>
      current && drawing.rooms.some((room) => room.id === current)
        ? current
        : null,
    );
    setSelectedDimensionId((current) =>
      current && drawing.dimensions.some((item) => item.id === current)
        ? current
        : null,
    );
    setPointsError(null);
    setRoutesError(null);
    setLayoutError(null);
    bumpCalculation();
  }

  async function commitDropDefaults() {
    setDropError(null);
    const verticalDropDefaults: Record<string, number> = {};
    for (const [type, value] of Object.entries(dropDrafts)) {
      if (value.trim() === '') continue;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        setDropError('Vertical drops must be between 0 and 100 m.');
        return;
      }
      verticalDropDefaults[type] = parsed;
    }

    try {
      const updated = await updatePlan(plan.id, {
        calculationSettings: {
          ...plan.calculationSettings,
          verticalDropDefaults,
        },
        expectedVersion: plan.version,
      });
      onPlanChange(updated);
      bumpCalculation();
    } catch (error) {
      setDropError(getErrorMessage(error));
    }
  }

  async function commitValidation(nextRequireCableType = requireCableType) {
    setDropError(null);
    const parsed =
      maxCircuit.trim() === '' ? undefined : Number(maxCircuit);
    if (parsed !== undefined && (!Number.isFinite(parsed) || parsed <= 0)) {
      setDropError('Circuit limit must be a positive number of meters.');
      return;
    }
    try {
      const updated = await updatePlan(plan.id, {
        calculationSettings: {
          ...plan.calculationSettings,
          validation: {
            ...(parsed !== undefined
              ? { maxCircuitLengthMeters: parsed }
              : {}),
            requireCableType: nextRequireCableType,
          },
        },
        expectedVersion: plan.version,
      });
      onPlanChange(updated);
      bumpCalculation();
    } catch (error) {
      setDropError(getErrorMessage(error));
    }
  }

  async function applyHistory(direction: 'undo' | 'redo') {
    if (historyBusyRef.current) {
      pendingHistoryRef.current = direction;
      return;
    }

    const command =
      direction === 'undo'
        ? getUndoCommand(historyRef.current)
        : getRedoCommand(historyRef.current);

    if (!command) {
      return;
    }

    historyBusyRef.current = true;
    setHistoryBusy(true);
    setHistoryError(null);

    let succeeded = false;

    try {
      if (direction === 'undo') {
        await command.undo();
      } else {
        await command.redo();
      }

      await reloadDrawing();
      commitHistory(
        direction === 'undo'
          ? markUndone(historyRef.current, command)
          : markRedone(historyRef.current, command),
      );
      succeeded = true;
    } catch (error) {
      setHistoryError(getErrorMessage(error));
    } finally {
      historyBusyRef.current = false;
      setHistoryBusy(false);

      const pending = pendingHistoryRef.current;
      pendingHistoryRef.current = null;

      // A quick second shortcut should run after the current command, not be lost.
      if (succeeded && pending) {
        void applyHistory(pending);
      }
    }
  }

  function selectPoint(id: string | null) {
    setSelectedPointId(id);

    if (id) {
      setSelectedRouteId(null);
      setSelectedWallId(null);
      setSelectedOpeningId(null);
      setSelectedRoomId(null);
      setSelectedDimensionId(null);
    }
  }

  function selectRoute(id: string | null) {
    setSelectedRouteId(id);

    if (id) {
      setSelectedPointId(null);
      setSelectedWallId(null);
      setSelectedOpeningId(null);
      setSelectedRoomId(null);
      setSelectedDimensionId(null);
    }
  }

  function selectWall(id: string | null) {
    setSelectedWallId(id);

    if (id) {
      setSelectedPointId(null);
      setSelectedRouteId(null);
      setSelectedOpeningId(null);
      setSelectedRoomId(null);
      setSelectedDimensionId(null);
    }
  }

  function selectOpening(id: string | null) {
    setSelectedOpeningId(id);

    if (id) {
      setSelectedPointId(null);
      setSelectedRouteId(null);
      setSelectedWallId(null);
      setSelectedRoomId(null);
      setSelectedDimensionId(null);
    }
  }

  function selectRoom(id: string | null) {
    setSelectedRoomId(id);

    if (id) {
      setSelectedPointId(null);
      setSelectedRouteId(null);
      setSelectedWallId(null);
      setSelectedOpeningId(null);
      setSelectedDimensionId(null);
    }
  }

  function selectDimension(id: string | null) {
    setSelectedDimensionId(id);

    if (id) {
      setSelectedPointId(null);
      setSelectedRouteId(null);
      setSelectedWallId(null);
      setSelectedOpeningId(null);
      setSelectedRoomId(null);
    }
  }

  async function handleCreateRoute(geometry: Vec2[]) {
    setRoutesError(null);

    try {
      const created = await createRoute(plan.id, {
        geometry,
        settings: {},
      });

      setRoutes((current) => [...current, created]);
      selectRoute(created.id);
      bumpCalculation();

      const input = createRouteInput(created);
      let activeId = created.id;

      pushHistory({
        label: t('editor.history.drawRoute'),
        undo: async () => {
          await deleteRoute(activeId);
        },
        redo: async () => {
          const next = await createRoute(plan.id, input);
          activeId = next.id;
        },
      });
    } catch (createError) {
      setRoutesError(getErrorMessage(createError));
    }
  }

  /** Same optimistic-update pattern as points: roll back unless a newer edit exists. */
  async function handlePatchRoute(id: string, patch: UpdateRouteInput) {
    const previous = routesRef.current.find((route) => route.id === id);

    if (!previous) {
      return;
    }

    const requestId = (routeRequestRef.current.get(id) ?? 0) + 1;
    routeRequestRef.current.set(id, requestId);
    setRoutesError(null);
    setRoutes((current) =>
      current.map((route) =>
        route.id === id ? { ...route, ...patch } : route,
      ),
    );

    try {
      const saved = await updateRoute(id, patch);

      if (routeRequestRef.current.get(id) === requestId) {
        setRoutes((current) =>
          current.map((route) => (route.id === id ? saved : route)),
        );
        bumpCalculation();
        pushHistory({
          label: t('editor.history.editRoute'),
          undo: async () => {
            await updateRoute(id, updateRouteInput(previous));
          },
          redo: async () => {
            await updateRoute(id, updateRouteInput(saved));
          },
        });
      }
    } catch (patchError) {
      if (routeRequestRef.current.get(id) === requestId) {
        setRoutes((current) =>
          current.map((route) => (route.id === id ? previous : route)),
        );
      }

      setRoutesError(getErrorMessage(patchError));
    }
  }

  function handleMoveRouteVertex(id: string, index: number, at: Vec2) {
    const route = routesRef.current.find((item) => item.id === id);

    if (!route) {
      return;
    }

    void handlePatchRoute(id, {
      geometry: route.geometry.map((vertex, i) =>
        i === index ? { x: at.x, y: at.y } : vertex,
      ),
    });
  }

  /** Inserts a bend at a segment midpoint handle of the selected route. */
  function handleInsertRouteVertex(id: string, index: number, at: Vec2) {
    const route = routesRef.current.find((item) => item.id === id);
    const geometry = route ? insertVertexAt(route.geometry, index, at) : null;

    if (!geometry) {
      setRoutesError('A bend cannot be added at that position.');
      return;
    }

    selectRoute(id);
    void handlePatchRoute(id, { geometry });
  }

  function handleRemoveRouteVertex(id: string, index: number) {
    const route = routesRef.current.find((item) => item.id === id);
    const geometry = route ? removeVertexAt(route.geometry, index) : null;

    if (!geometry) {
      setRoutesError(
        'A cable route needs at least two bends; add another bend before removing this one.',
      );
      return;
    }

    void handlePatchRoute(id, { geometry });
  }

  async function handleDeleteRoute(id: string) {
    setRoutesError(null);

    const deleted = routesRef.current.find((route) => route.id === id);

    try {
      await deleteRoute(id);
      routeRequestRef.current.delete(id);
      setRoutes((current) => current.filter((route) => route.id !== id));
      setSelectedRouteId((current) => (current === id ? null : current));
      bumpCalculation();

      if (deleted) {
        const input = createRouteInput(deleted);
        let activeId: string | null = null;

        pushHistory({
          label: t('editor.history.deleteRoute'),
          undo: async () => {
            const next = await createRoute(plan.id, input);
            activeId = next.id;
          },
          redo: async () => {
            if (activeId) {
              await deleteRoute(activeId);
            }
          },
        });
      }
    } catch (deleteError) {
      setRoutesError(getErrorMessage(deleteError));
    }
  }

  async function handleCreateWall(
    geometry: Vec2[],
    extra: Partial<Pick<PublicWall, 'thickness' | 'label'>> = {},
  ) {
    setLayoutError(null);

    try {
      const created = await createWall(plan.id, {
        geometry,
        thickness: extra.thickness ?? null,
        label: extra.label ?? null,
      });

      setWalls((current) => [...current, created]);
      selectWall(created.id);

      const input = createWallInput(created);
      let activeId = created.id;

      pushHistory({
        label: t('editor.history.drawWall'),
        undo: async () => {
          await deleteWall(activeId);
        },
        redo: async () => {
          const next = await createWall(plan.id, input);
          activeId = next.id;
        },
      });
    } catch (createError) {
      setLayoutError(getErrorMessage(createError));
    }
  }

  async function handlePatchWall(id: string, patch: UpdateWallInput) {
    const previous = wallsRef.current.find((wall) => wall.id === id);

    if (!previous) {
      return;
    }

    const requestId = (wallRequestRef.current.get(id) ?? 0) + 1;
    wallRequestRef.current.set(id, requestId);
    setLayoutError(null);
    setWalls((current) =>
      current.map((wall) => (wall.id === id ? { ...wall, ...patch } : wall)),
    );

    try {
      const saved = await updateWall(id, patch);

      if (wallRequestRef.current.get(id) === requestId) {
        setWalls((current) =>
          current.map((wall) => (wall.id === id ? saved : wall)),
        );
        pushHistory({
          label:
          patch.geometry !== undefined
            ? t('editor.history.moveWall')
            : t('editor.history.editWall'),
          undo: async () => {
            await updateWall(id, updateWallInput(previous));
          },
          redo: async () => {
            await updateWall(id, updateWallInput(saved));
          },
        });
      }
    } catch (patchError) {
      if (wallRequestRef.current.get(id) === requestId) {
        setWalls((current) =>
          current.map((wall) => (wall.id === id ? previous : wall)),
        );
      }

      setLayoutError(getErrorMessage(patchError));
    }
  }

  async function handleDeleteWall(id: string) {
    setLayoutError(null);

    const deleted = wallsRef.current.find((wall) => wall.id === id);

    try {
      await deleteWall(id);
      wallRequestRef.current.delete(id);
      setWalls((current) => current.filter((wall) => wall.id !== id));
      setOpenings((current) =>
        current.filter((opening) => opening.wallId !== id),
      );
      setSelectedWallId((current) => (current === id ? null : current));
      setSelectedOpeningId((current) =>
        current &&
        openingsRef.current.find((opening) => opening.id === current)
          ?.wallId === id
          ? null
          : current,
      );

      if (deleted) {
        const input = createWallInput(deleted);
        let activeId: string | null = null;

        pushHistory({
          label: t('editor.history.deleteWall'),
          undo: async () => {
            const next = await createWall(plan.id, input);
            activeId = next.id;
          },
          redo: async () => {
            if (activeId) {
              await deleteWall(activeId);
            }
          },
        });
      }
    } catch (deleteError) {
      setLayoutError(getErrorMessage(deleteError));
    }
  }

  async function handleAddOpening(wall: PublicWall, type: 'door' | 'window') {
    setLayoutError(null);
    const length = wallLength(wall.geometry);
    const width = Math.max(1, Math.min(length * 0.25, 1000));
    const offset = Math.max(0, (length - width) / 2);

    try {
      const created = await createOpening(plan.id, {
        wallId: wall.id,
        type,
        offset,
        width,
        height: type === 'door' ? 210 : 130,
        sillHeight: type === 'window' ? 90 : 0,
      });
      setOpenings((current) => [...current, created]);
      selectOpening(created.id);

      const input = createOpeningInput(created);
      let activeId = created.id;
      pushHistory({
        label:
          type === 'door'
            ? t('editor.history.addDoor')
            : t('editor.history.addWindow'),
        undo: async () => {
          await deleteOpening(activeId);
        },
        redo: async () => {
          const next = await createOpening(plan.id, input);
          activeId = next.id;
        },
      });
    } catch (createError) {
      setLayoutError(getErrorMessage(createError));
    }
  }

  async function handlePatchOpening(id: string, patch: UpdateOpeningInput) {
    const previous = openingsRef.current.find((opening) => opening.id === id);
    if (!previous) return;

    const requestId = (openingRequestRef.current.get(id) ?? 0) + 1;
    openingRequestRef.current.set(id, requestId);
    setLayoutError(null);
    setOpenings((current) =>
      current.map((opening) =>
        opening.id === id ? { ...opening, ...patch } : opening,
      ),
    );

    try {
      const saved = await updateOpening(id, patch);
      if (openingRequestRef.current.get(id) === requestId) {
        setOpenings((current) =>
          current.map((opening) => (opening.id === id ? saved : opening)),
        );
        pushHistory({
          label: t('editor.history.editOpening'),
          undo: async () => {
            await updateOpening(id, updateOpeningInput(previous));
          },
          redo: async () => {
            await updateOpening(id, updateOpeningInput(saved));
          },
        });
      }
    } catch (patchError) {
      if (openingRequestRef.current.get(id) === requestId) {
        setOpenings((current) =>
          current.map((opening) =>
            opening.id === id ? previous : opening,
          ),
        );
      }
      setLayoutError(getErrorMessage(patchError));
    }
  }

  async function handleDeleteOpening(id: string) {
    setLayoutError(null);
    const deleted = openingsRef.current.find((opening) => opening.id === id);
    try {
      await deleteOpening(id);
      openingRequestRef.current.delete(id);
      setOpenings((current) => current.filter((opening) => opening.id !== id));
      setSelectedOpeningId((current) => (current === id ? null : current));

      if (deleted) {
        const input = createOpeningInput(deleted);
        let activeId: string | null = null;
        pushHistory({
          label: t('editor.history.deleteOpening'),
          undo: async () => {
            const next = await createOpening(plan.id, input);
            activeId = next.id;
          },
          redo: async () => {
            if (activeId) await deleteOpening(activeId);
          },
        });
      }
    } catch (deleteError) {
      setLayoutError(getErrorMessage(deleteError));
    }
  }

  function handleDuplicateWall(wall: PublicWall) {
    const offset = 24 / viewport.zoom;

    void handleCreateWall(
      translateGeometry(wall.geometry, offset, offset),
      { thickness: wall.thickness, label: wall.label },
    );
  }

  async function handleCreateRoom(
    boundary: Vec2[],
    extra: Partial<Pick<PublicRoom, 'name'>> = {},
  ) {
    setLayoutError(null);

    try {
      const created = await createRoom(plan.id, {
        name: extra.name ?? `Room ${roomsRef.current.length + 1}`,
        boundary,
      });

      setRooms((current) => [...current, created]);
      selectRoom(created.id);

      const input = createRoomInput(created);
      let activeId = created.id;

      pushHistory({
        label: t('editor.history.drawRoom'),
        undo: async () => {
          await deleteRoom(activeId);
        },
        redo: async () => {
          const next = await createRoom(plan.id, input);
          activeId = next.id;
        },
      });
    } catch (createError) {
      setLayoutError(getErrorMessage(createError));
    }
  }

  async function handlePatchRoom(id: string, patch: UpdateRoomInput) {
    const previous = roomsRef.current.find((room) => room.id === id);

    if (!previous) {
      return;
    }

    const requestId = (roomRequestRef.current.get(id) ?? 0) + 1;
    roomRequestRef.current.set(id, requestId);
    setLayoutError(null);
    setRooms((current) =>
      current.map((room) => (room.id === id ? { ...room, ...patch } : room)),
    );

    try {
      const saved = await updateRoom(id, patch);

      if (roomRequestRef.current.get(id) === requestId) {
        setRooms((current) =>
          current.map((room) => (room.id === id ? saved : room)),
        );
        pushHistory({
          label:
          patch.boundary !== undefined
            ? t('editor.history.moveRoom')
            : t('editor.history.editRoom'),
          undo: async () => {
            await updateRoom(id, updateRoomInput(previous));
          },
          redo: async () => {
            await updateRoom(id, updateRoomInput(saved));
          },
        });
      }
    } catch (patchError) {
      if (roomRequestRef.current.get(id) === requestId) {
        setRooms((current) =>
          current.map((room) => (room.id === id ? previous : room)),
        );
      }

      setLayoutError(getErrorMessage(patchError));
    }
  }

  async function handleDeleteRoom(id: string) {
    setLayoutError(null);

    const deleted = roomsRef.current.find((room) => room.id === id);

    try {
      await deleteRoom(id);
      roomRequestRef.current.delete(id);
      setRooms((current) => current.filter((room) => room.id !== id));
      setSelectedRoomId((current) => (current === id ? null : current));

      if (deleted) {
        const input = createRoomInput(deleted);
        let activeId: string | null = null;

        pushHistory({
          label: t('editor.history.deleteRoom'),
          undo: async () => {
            const next = await createRoom(plan.id, input);
            activeId = next.id;
          },
          redo: async () => {
            if (activeId) {
              await deleteRoom(activeId);
            }
          },
        });
      }
    } catch (deleteError) {
      setLayoutError(getErrorMessage(deleteError));
    }
  }

  function handleDuplicateRoom(room: PublicRoom) {
    const offset = 24 / viewport.zoom;

    void handleCreateRoom(
      translateGeometry(room.boundary, offset, offset),
      { name: `${room.name} copy` },
    );
  }

  function handleMoveWall(id: string, geometry: Vec2[]) {
    void handlePatchWall(id, { geometry });
  }

  function handleMoveRoom(id: string, boundary: Vec2[]) {
    void handlePatchRoom(id, { boundary });
  }

  function handleMoveDimensionOffset(id: string, offset: number) {
    void handlePatchDimension(id, { offset });
  }

  async function handleCreateDimension(
    pointA: Vec2,
    pointB: Vec2,
    offset: number,
  ) {
    setLayoutError(null);

    try {
      const created = await createDimension(plan.id, {
        pointA,
        pointB,
        offset,
      });

      setDimensions((current) => [...current, created]);
      selectDimension(created.id);

      const input = createDimensionInput(created);
      let activeId = created.id;

      pushHistory({
        label: t('editor.history.addDimension'),
        undo: async () => {
          await deleteDimension(activeId);
        },
        redo: async () => {
          const next = await createDimension(plan.id, input);
          activeId = next.id;
        },
      });
    } catch (createError) {
      setLayoutError(getErrorMessage(createError));
    }
  }

  async function handlePatchDimension(
    id: string,
    patch: UpdateDimensionInput,
  ) {
    const previous = dimensionsRef.current.find(
      (dimension) => dimension.id === id,
    );

    if (!previous) {
      return;
    }

    const requestId = (dimensionRequestRef.current.get(id) ?? 0) + 1;
    dimensionRequestRef.current.set(id, requestId);
    setLayoutError(null);
    setDimensions((current) =>
      current.map((dimension) =>
        dimension.id === id ? { ...dimension, ...patch } : dimension,
      ),
    );

    try {
      const saved = await updateDimension(id, patch);

      if (dimensionRequestRef.current.get(id) === requestId) {
        setDimensions((current) =>
          current.map((dimension) =>
            dimension.id === id ? saved : dimension,
          ),
        );
        pushHistory({
          label: t('editor.history.editDimension'),
          undo: async () => {
            await updateDimension(id, updateDimensionInput(previous));
          },
          redo: async () => {
            await updateDimension(id, updateDimensionInput(saved));
          },
        });
      }
    } catch (patchError) {
      if (dimensionRequestRef.current.get(id) === requestId) {
        setDimensions((current) =>
          current.map((dimension) =>
            dimension.id === id ? previous : dimension,
          ),
        );
      }

      setLayoutError(getErrorMessage(patchError));
    }
  }

  async function handleDeleteDimension(id: string) {
    setLayoutError(null);

    const deleted = dimensionsRef.current.find(
      (dimension) => dimension.id === id,
    );

    try {
      await deleteDimension(id);
      dimensionRequestRef.current.delete(id);
      setDimensions((current) =>
        current.filter((dimension) => dimension.id !== id),
      );
      setSelectedDimensionId((current) => (current === id ? null : current));

      if (deleted) {
        const input = createDimensionInput(deleted);
        let activeId: string | null = null;

        pushHistory({
          label: t('editor.history.deleteDimension'),
          undo: async () => {
            const next = await createDimension(plan.id, input);
            activeId = next.id;
          },
          redo: async () => {
            if (activeId) {
              await deleteDimension(activeId);
            }
          },
        });
      }
    } catch (deleteError) {
      setLayoutError(getErrorMessage(deleteError));
    }
  }

  async function handleConfirmCalibration(
    realDistance: number,
    unit: LengthUnitInput,
  ) {
    if (!pendingCalibration) {
      return;
    }

    setCalibrationBusy(true);
    setCalibrationError(null);

    const previousCalibration = calibration
      ? calibrationInput(calibration)
      : null;

    try {
      const saved = await saveCalibration(plan.id, {
        pointA: pendingCalibration.pointA,
        pointB: pendingCalibration.pointB,
        realDistance,
        unit,
      });

      setCalibration(saved);
      setPendingCalibration(null);
      bumpCalculation();

      pushHistory({
        label: t('editor.history.setScale'),
        undo: async () => {
          if (previousCalibration) {
            await saveCalibration(plan.id, previousCalibration);
          } else {
            await removeCalibration(plan.id);
          }
        },
        redo: async () => {
          await saveCalibration(plan.id, calibrationInput(saved));
        },
      });
    } catch (saveError) {
      setCalibrationError(getErrorMessage(saveError));
    } finally {
      setCalibrationBusy(false);
    }
  }

  async function handleCreatePoint(
    type: ElectricalPointType,
    at: Vec2,
    extra: Partial<Pick<PublicPoint, 'rotation' | 'label' | 'mountingHeight' | 'properties'>> = {},
  ) {
    setPointsError(null);

    try {
      const created = await createPoint(plan.id, {
        type,
        x: at.x,
        y: at.y,
        rotation: extra.rotation ?? 0,
        label: extra.label ?? null,
        mountingHeight: extra.mountingHeight ?? null,
        properties: extra.properties ?? {},
      });

      setPoints((current) => [...current, created]);
      selectPoint(created.id);
      bumpCalculation();

      const input = createPointInput(created);
      let activeId = created.id;

      pushHistory({
        label: t('editor.history.placePoint'),
        undo: async () => {
          await deletePoint(activeId);
        },
        redo: async () => {
          const next = await createPoint(plan.id, input);
          activeId = next.id;
        },
      });
    } catch (createError) {
      setPointsError(getErrorMessage(createError));
    }
  }

  /**
   * Applies a point change at once and saves it. Route ends sitting on the
   * point move with it, both in the UI and on the server (one transaction).
   * If the save fails, the point and those route ends are rolled back unless a
   * newer edit of the same point has been made meanwhile.
   */
  async function handlePatchPoint(id: string, patch: UpdatePointInput) {
    const previous = pointsRef.current.find((point) => point.id === id);

    if (!previous) {
      return;
    }

    const next = {
      x: patch.x ?? previous.x,
      y: patch.y ?? previous.y,
    };
    const routeUpdates =
      patch.x === undefined && patch.y === undefined
        ? []
        : moveAttachedRouteEnds(
            routesRef.current,
            { x: previous.x, y: previous.y },
            next,
          );
    const routeSnapshots = routeUpdates.flatMap((update) => {
      const route = routesRef.current.find((item) => item.id === update.id);

      if (!route) {
        return [];
      }

      const revision = (routeRequestRef.current.get(update.id) ?? 0) + 1;
      routeRequestRef.current.set(update.id, revision);

      return [{ id: update.id, route, revision }];
    });
    const requestId = (pointRequestRef.current.get(id) ?? 0) + 1;
    pointRequestRef.current.set(id, requestId);
    setPointsError(null);
    setPoints((current) =>
      current.map((point) =>
        point.id === id ? { ...point, ...patch } : point,
      ),
    );

    if (routeUpdates.length > 0) {
      const geometryById = new Map(
        routeUpdates.map((update) => [update.id, update.geometry]),
      );

      setRoutes((current) =>
        current.map((route) => {
          const geometry = geometryById.get(route.id);

          return geometry ? { ...route, geometry } : route;
        }),
      );
    }

    try {
      const saved = await updatePoint(id, patch);

      if (pointRequestRef.current.get(id) === requestId) {
        setPoints((current) =>
          current.map((point) => (point.id === id ? saved : point)),
        );
        bumpCalculation();
        pushHistory({
          label:
            patch.x !== undefined || patch.y !== undefined
              ? t('editor.history.movePoint')
              : t('editor.history.editPoint'),
          undo: async () => {
            await updatePoint(id, updatePointInput(previous));
          },
          redo: async () => {
            await updatePoint(id, updatePointInput(saved));
          },
        });
      }
    } catch (patchError) {
      if (pointRequestRef.current.get(id) === requestId) {
        setPoints((current) =>
          current.map((point) => (point.id === id ? previous : point)),
        );

        if (routeSnapshots.length > 0) {
          const snapshots = new Map(
            routeSnapshots.map((snapshot) => [snapshot.id, snapshot]),
          );

          setRoutes((current) =>
            current.map((route) => {
              const snapshot = snapshots.get(route.id);

              // A newer user edit of the route wins over this rollback.
              if (
                !snapshot ||
                (routeRequestRef.current.get(route.id) ?? 0) !==
                  snapshot.revision
              ) {
                return route;
              }

              return snapshot.route;
            }),
          );
        }
      }

      setPointsError(getErrorMessage(patchError));
    }
  }

  async function handleDeletePoint(id: string) {
    setPointsError(null);

    const deleted = pointsRef.current.find((point) => point.id === id);

    try {
      await deletePoint(id);
      pointRequestRef.current.delete(id);
      setPoints((current) => current.filter((point) => point.id !== id));
      setSelectedPointId((current) => (current === id ? null : current));
      bumpCalculation();

      if (deleted) {
        const input = createPointInput(deleted);
        let activeId: string | null = null;

        pushHistory({
          label: t('editor.history.deletePoint'),
          undo: async () => {
            const next = await createPoint(plan.id, input);
            activeId = next.id;
          },
          redo: async () => {
            if (activeId) {
              await deletePoint(activeId);
            }
          },
        });
      }
    } catch (deleteError) {
      setPointsError(getErrorMessage(deleteError));
    }
  }

  function handleDuplicatePoint(point: PublicPoint) {
    // Offset by a fixed number of screen pixels so the copy is visible at any zoom.
    const offset = 24 / viewport.zoom;

    void handleCreatePoint(
      point.type,
      { x: point.x + offset, y: point.y + offset },
      {
        rotation: point.rotation,
        label: point.label,
        mountingHeight: point.mountingHeight,
        properties: point.properties,
      },
    );
  }

  async function handleRemoveCalibration() {
    if (
      !window.confirm(
        'Remove the plan scale? Real cable lengths will be unavailable until you calibrate again.',
      )
    ) {
      return;
    }

    setCalibrationBusy(true);
    setCalibrationError(null);

    const previousCalibration = calibration
      ? calibrationInput(calibration)
      : null;

    try {
      await removeCalibration(plan.id);
      setCalibration(null);
      bumpCalculation();

      if (previousCalibration) {
        pushHistory({
          label: t('editor.history.removeScale'),
          undo: async () => {
            await saveCalibration(plan.id, previousCalibration);
          },
          redo: async () => {
            await removeCalibration(plan.id);
          },
        });
      }
    } catch (removeError) {
      setCalibrationError(getErrorMessage(removeError));
    } finally {
      setCalibrationBusy(false);
    }
  }

  useEffect(() => {
    if (!imageUrl) {
      setImage(null);
      setImageLoading(false);
      setImageError(null);
      return;
    }

    let cancelled = false;
    const nextImage = new Image();

    setImage(null);
    setImageLoading(true);
    setImageError(null);

    nextImage.decoding = 'async';
    nextImage.onload = () => {
      if (!cancelled) {
        setImage(nextImage);
        setImageLoading(false);
      }
    };
    nextImage.onerror = () => {
      if (!cancelled) {
        setImage(null);
        setImageLoading(false);
        setImageError('Unable to load the plan image. Try loading it again.');
      }
    };
    nextImage.src = imageUrl;

    return () => {
      cancelled = true;
      nextImage.onload = null;
      nextImage.onerror = null;
    };
  }, [imageUrl]);

  function updateUnderlay(patch: Partial<UnderlaySettings>) {
    setUnderlay((current) => ({ ...current, ...patch }));
  }

  function resetUnderlayTransform() {
    updateUnderlay({
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
    });
  }

  async function preparePreview(page: number, source?: Blob) {
    setPreviewBusy(true);
    setPreviewError(null);

    try {
      const fileBlob = source ?? (await loadPlanFile(plan.id));
      const preview = await renderPdfPageToPng(fileBlob, page);
      const updated = await uploadPlanPreview(plan.id, preview);

      onPlanChange(updated);
      setAssetNonce((value) => value + 1);
    } catch (renderError) {
      setPreviewError(describeError(renderError));
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handleApplyPage() {
    const page = Number(pageInput);
    setPageError(null);

    if (!Number.isInteger(page) || page < 1 || page > 1000) {
      setPageError('Enter a whole page number between 1 and 1000.');
      return;
    }

    if (page === plan.page && plan.hasPreview) {
      return;
    }

    if (page === plan.page) {
      await preparePreview(page);
      return;
    }

    setPageBusy(true);

    try {
      const updated = await updatePlan(plan.id, { page });
      onPlanChange(updated);
      await preparePreview(page);
    } catch (updateError) {
      setPageError(getErrorMessage(updateError));
    } finally {
      setPageBusy(false);
    }
  }

  async function performReplace(file: File, page?: number) {
    setPendingPdf(null);
    setReplacing(true);
    setFileError(null);
    setPreviewError(null);

    try {
      const updated = await replacePlanFile(plan.id, file, page);

      setUnderlay((current) => ({
        ...current,
        visible: true,
        locked: false,
        opacity: 1,
        rotation: 0,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      }));
      onPlanChange(updated);
      setAssetNonce((value) => value + 1);

      if (updated.mimeType === 'application/pdf') {
        await preparePreview(updated.page ?? 1, file);
      }
    } catch (replaceError) {
      setFileError(describeError(replaceError));
    } finally {
      setReplacing(false);
    }
  }

  async function handleFileSelected(file: File) {
    setFileError(null);
    setPreviewError(null);

    const kind: PlanUploadKind | null = planUploadKind(file);

    if (!kind) {
      setFileError('Choose a JPG, PNG, or PDF file.');
      return;
    }

    if (kind === 'pdf') {
      setPreparingFile(true);

      try {
        const pages = await countPdfPages(file);
        setPendingPdf({ file, pages });
      } catch (countError) {
        setFileError(
          `Unable to read the PDF: ${describeError(countError)}`,
        );
      } finally {
        setPreparingFile(false);
      }

      return;
    }

    await performReplace(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      void handleFileSelected(file);
    }
  }

  async function retryImage() {
    setAssetNonce((value) => value + 1);
  }

  async function retryPreview() {
    if (previewBusy) {
      return;
    }

    await preparePreview(plan.page ?? 1);
  }

  const pointCounts = countByType(points);
  const selectedPoint =
    points.find((point) => point.id === selectedPointId) ?? null;
  const selectedRoute =
    routes.find((route) => route.id === selectedRouteId) ?? null;
  const selectedWall =
    walls.find((wall) => wall.id === selectedWallId) ?? null;
  const selectedOpening =
    openings.find((opening) => opening.id === selectedOpeningId) ?? null;
  const openingWall =
    selectedOpening &&
    walls.find((wall) => wall.id === selectedOpening.wallId);
  const activeOpeningWall = selectedWall ?? openingWall ?? null;
  const selectedRoom =
    rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedDimension =
    dimensions.find((dimension) => dimension.id === selectedDimensionId) ??
    null;
  const metersPerUnit = calibration?.metersPerUnit ?? null;
  const overlayBusy = previewBusy || imageLoading;
  const overlayError = previewError ?? imageError;
  const undoCommand = getUndoCommand(history);
  const redoCommand = getRedoCommand(history);
  const circuits = plan.calculationSettings?.circuits ?? [];
  const penetrationCounts = useMemo(
    () => countRoutePenetrations(routes, walls),
    [routes, walls],
  );
  const takeoff = useMemo(() => {
    const requiredByRoute = new Map(
      (calculation?.routes ?? []).map((route) => [
        route.routeId,
        route.requiredLength,
      ]),
    );
    const defaultCable =
      materials.find((material) => material.category === 'cable') ?? null;

    return buildTakeoff({
      metersPerUnit,
      walls,
      openings,
      rooms,
      points,
      routes: routes.map((route) => ({
        circuitId: route.circuitId,
        materialId: route.materialId,
        requiredLength: requiredByRoute.get(route.id) ?? null,
      })),
      materials: materials.map((material) => ({
        id: material.id,
        unitPrice: material.unitPrice,
        unit: material.unit,
      })),
      defaultCableMaterialId: defaultCable?.id ?? null,
      wallHeightMeters: takeoffSettings.wallHeightMeters,
      defaultWallThicknessMeters: takeoffSettings.defaultThicknessMeters,
    });
  }, [
    metersPerUnit,
    walls,
    openings,
    rooms,
    points,
    routes,
    calculation,
    materials,
    takeoffSettings,
  ]);
  const validationIssues = useMemo(
    () =>
      validatePlan({
        calibration,
        circuits,
        points,
        routes,
        walls,
        openings,
        materialIds:
          materials.length > 0
            ? materials.map((material) => material.id)
            : undefined,
      }),
    [calibration, circuits, points, routes, walls, openings, materials],
  );

  async function saveCircuits(next: Circuit[]) {
    try {
      const updated = await updatePlan(plan.id, {
        calculationSettings: {
          ...plan.calculationSettings,
          circuits: next,
        },
        expectedVersion: plan.version,
      });
      onPlanChange(updated);
    } catch (error) {
      setLayoutError(getErrorMessage(error));
    }
  }

  function handleAddCircuit(circuit: Circuit) {
    void saveCircuits([...circuits, circuit]);
  }

  function handleUpdateCircuit(
    id: string,
    patch: Partial<Pick<Circuit, 'name' | 'color'>>,
  ) {
    void saveCircuits(
      circuits.map((circuit) =>
        circuit.id === id ? { ...circuit, ...patch } : circuit,
      ),
    );
  }

  function handleDeleteCircuit(id: string) {
    void saveCircuits(circuits.filter((circuit) => circuit.id !== id));
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (typing) return;

      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }

      if (event.key === '?') {
        event.preventDefault();
        setHotkeysOpen(true);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function requestTool(tool: EditorTool, pointType?: ElectricalPointType) {
    setToolRequest({ tool, pointType, nonce: Date.now() });
  }

  function focusRoom(roomId: string) {
    const room = rooms.find((item) => item.id === roomId);

    if (!room) return;

    selectRoom(roomId);
    const xs = room.boundary.map((point) => point.x);
    const ys = room.boundary.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const width = Math.max(maxX - minX, 1);
    const height = Math.max(maxY - minY, 1);
    const zoom = Math.min(4, Math.max(0.2, 600 / Math.max(width, height)));

    setViewport((current) => ({
      ...current,
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      zoom,
    }));
  }

  const paletteCommands: CommandPaletteItem[] = [
    {
      id: 'tool-select',
      label: t('hotkeys.select'),
      shortcut: 'V',
      run: () => requestTool('select'),
    },
    {
      id: 'tool-pan',
      label: t('hotkeys.pan'),
      shortcut: 'H',
      run: () => requestTool('pan'),
    },
    {
      id: 'tool-route',
      label: t('hotkeys.route'),
      shortcut: 'R',
      run: () => requestTool('route'),
    },
    {
      id: 'tool-wall',
      label: t('hotkeys.wall'),
      shortcut: 'Q',
      run: () => requestTool('wall'),
    },
    {
      id: 'tool-room',
      label: t('hotkeys.room'),
      shortcut: 'O',
      run: () => requestTool('room'),
    },
    {
      id: 'tool-dimension',
      label: t('hotkeys.dimension'),
      shortcut: 'D',
      run: () => requestTool('dimension'),
    },
    {
      id: 'tool-calibrate',
      label: t('hotkeys.calibrate'),
      shortcut: 'C',
      run: () => requestTool('calibrate'),
    },
    ...(
      [
        ['socket', 'S'],
        ['switch', 'W'],
        ['light', 'L'],
        ['panel', 'B'],
        ['junction', 'J'],
      ] as const
    ).map(([type, shortcut]) => ({
      id: `place-${type}`,
      label: t('editor.placeTool', {
        symbol: t(`editor.point.${type}`).toLowerCase(),
      }),
      shortcut,
      run: () => requestTool('place', type),
    })),
    {
      id: 'fit',
      label: t('editor.fit'),
      shortcut: '0',
      run: () => setFitRequest(Date.now()),
    },
    {
      id: 'undo',
      label: t('editor.undo'),
      shortcut: 'Ctrl+Z',
      run: () => void applyHistory('undo'),
    },
    {
      id: 'redo',
      label: t('editor.redo'),
      shortcut: 'Ctrl+Shift+Z',
      run: () => void applyHistory('redo'),
    },
    {
      id: 'view-3d',
      label: viewMode === '2d' ? t('editor.view3d') : t('editor.view2d'),
      hint: t('editor.viewMode'),
      run: () => setViewMode((mode) => (mode === '2d' ? '3d' : '2d')),
    },
    {
      id: 'view-split',
      label: t('editor.splitView'),
      hint: t('editor.viewMode'),
      run: () => setViewMode('split'),
    },
    {
      id: 'preview',
      label: previewMode ? t('editor.exitPreview') : t('editor.preview'),
      run: () => setPreviewMode((value) => !value),
    },
    {
      id: 'panels',
      label: preferences.sidebarCollapsed
        ? t('editor.showPanels')
        : t('editor.hidePanels'),
      run: toggleSidebar,
    },
    {
      id: 'hotkeys',
      label: t('hotkeys.title'),
      shortcut: '?',
      run: () => setHotkeysOpen(true),
    },
  ];

  function focusValidationTarget(target: ValidationTarget) {
    switch (target.kind) {
      case 'point':
        selectPoint(target.id);
        break;
      case 'route':
        selectRoute(target.id);
        break;
      case 'wall':
        selectWall(target.id);
        break;
      case 'opening':
        selectOpening(target.id);
        break;
      case 'room':
        selectRoom(target.id);
        break;
      case 'circuit': {
        const route = routes.find((item) => item.circuitId === target.id);
        const point = points.find(
          (item) => item.properties.circuitId === target.id,
        );

        if (route) selectRoute(route.id);
        else if (point) selectPoint(point.id);
        break;
      }
      case 'calibration':
        document
          .getElementById('scale-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
    }
  }

  function handleThreeSelect(target: {
    kind: 'wall' | 'room' | 'point' | 'route';
    id: string;
  }) {
    if (target.kind === 'point') selectPoint(target.id);
    else if (target.kind === 'route') selectRoute(target.id);
    else if (target.kind === 'wall') selectWall(target.id);
    else selectRoom(target.id);
  }

  const threeViewNode = (
    <Suspense
      fallback={
        <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-white/10 bg-slate-950 text-sm text-slate-400">
          <LoaderCircle className="mr-2 h-5 w-5 animate-spin text-amber-300" />
          {t('editor.loading3d')}
        </div>
      }
    >
      <ThreeView
        walls={walls}
        openings={openings}
        rooms={rooms}
        points={points}
        routes={routes}
        metersPerUnit={metersPerUnit}
        viewport={viewport}
        selectedWallId={selectedWallId}
        selectedRoomId={selectedRoomId}
        selectedPointId={selectedPointId}
        selectedRouteId={selectedRouteId}
        onSelect={handleThreeSelect}
      />
    </Suspense>
  );

  return (
    <>
      <div
        style={{ zoom: preferences.uiScale }}
        className={
          previewMode || preferences.sidebarCollapsed
            ? 'relative'
            : 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]'
        }
      >
        <div
          className={`relative min-h-[440px] ${
            previewMode
              ? 'h-[calc(100vh-6rem)]'
              : 'h-[65vh] lg:h-[calc(100vh-12rem)]'
          }`}
        >
          {viewMode === '2d' || viewMode === 'split' ? (
            <div
              className={
                viewMode === 'split'
                  ? 'absolute inset-y-0 left-0 right-1/2 pr-1'
                  : 'h-full'
              }
            >
          <EditorCanvas
            image={image}
            placementRequest={placementRequest}
            toolRequest={toolRequest}
            fitRequest={fitRequest}
            readOnly={previewMode}
            underlay={underlay}
            viewport={viewport}
            autoFit={plan.version === 1}
            calibration={calibration}
            points={points}
            selectedPointId={selectedPointId}
            routes={routes}
            selectedRouteId={selectedRouteId}
            circuits={circuits}
            layers={layers}
            walls={walls}
            selectedWallId={selectedWallId}
            openings={openings}
            selectedOpeningId={selectedOpeningId}
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            dimensions={dimensions}
            selectedDimensionId={selectedDimensionId}
            metersPerUnit={metersPerUnit}
            onCalibrationPoints={(pointA, pointB) => {
              setCalibrationError(null);
              setPendingCalibration({ pointA, pointB });
            }}
            onSelectPoint={selectPoint}
            onSelectRoute={selectRoute}
            onCreateRoute={(geometry) => void handleCreateRoute(geometry)}
            onMoveRouteVertex={handleMoveRouteVertex}
            onInsertRouteVertex={handleInsertRouteVertex}
            onRemoveRouteVertex={handleRemoveRouteVertex}
            onDeleteRoute={(id) => void handleDeleteRoute(id)}
            onCreatePoint={(type, at, subtype) =>
              void handleCreatePoint(
                type,
                at,
                subtype ? { properties: { subtype } } : {},
              )
            }
            onMovePoint={(id, at) =>
              void handlePatchPoint(id, { x: at.x, y: at.y })
            }
            onDeletePoint={(id) => void handleDeletePoint(id)}
            onSelectWall={selectWall}
            onCreateWall={(geometry) => void handleCreateWall(geometry)}
            onMoveWall={handleMoveWall}
            onDeleteWall={(id) => void handleDeleteWall(id)}
            onSelectRoom={selectRoom}
            onCreateRoom={(boundary) => void handleCreateRoom(boundary)}
            onMoveRoom={handleMoveRoom}
            onDeleteRoom={(id) => void handleDeleteRoom(id)}
            onSelectDimension={selectDimension}
            onCreateDimension={(pointA, pointB, offset) =>
              void handleCreateDimension(pointA, pointB, offset)
            }
            onMoveDimensionOffset={handleMoveDimensionOffset}
            onDeleteDimension={(id) => void handleDeleteDimension(id)}
            onUnderlayChange={setUnderlay}
            onViewportChange={setViewport}
            canUndo={undoCommand !== null}
            canRedo={redoCommand !== null}
            historyBusy={historyBusy}
            onUndo={() => void applyHistory('undo')}
            onRedo={() => void applyHistory('redo')}
          />
            </div>
          ) : null}

          {viewMode === '3d' ? threeViewNode : null}
          {viewMode === 'split' ? (
            <div className="absolute inset-y-0 right-0 left-1/2 pl-1">
              {threeViewNode}
            </div>
          ) : null}

          {overlayBusy ? (
            <OverlayCard>
              <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-amber-300" />
              <p className="mt-3 text-sm font-medium text-white">
                {previewBusy
                  ? t('editor.renderingPdf')
                  : t('editor.loadingUnderlay')}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {t('editor.largeDrawing')}
              </p>
            </OverlayCard>
          ) : null}

          {!overlayBusy && overlayError ? (
            <OverlayCard>
              <TriangleAlert className="mx-auto h-6 w-6 text-rose-300" />
              <p className="mt-3 text-sm font-medium text-white">
                {t('editor.underlayUnavailable')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {overlayError}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={needsPreview ? retryPreview : retryImage}
              >
                <RotateCcw className="h-4 w-4" />
                {t('editor.tryAgain')}
              </Button>
            </OverlayCard>
          ) : null}

          {!overlayBusy && !overlayError && needsPreview ? (
            <OverlayCard>
              <FileText className="mx-auto h-6 w-6 text-amber-300" />
              <p className="mt-3 text-sm font-medium text-white">
                {t('editor.pdfNotReady')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {t('editor.renderPageToUse', { page: plan.page ?? 1 })}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={retryPreview}
              >
                <FileText className="h-4 w-4" />
                {t('editor.renderPreview')}
              </Button>
            </OverlayCard>
          ) : null}
        </div>

        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/90 p-1 shadow-xl shadow-black/30 backdrop-blur">
          <button
            type="button"
            title={previewMode ? t('editor.exitPreview') : t('editor.preview')}
            aria-label={previewMode ? t('editor.exitPreview') : t('editor.preview')}
            aria-pressed={previewMode}
            onClick={() => setPreviewMode((value) => !value)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
              previewMode
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-300 hover:bg-white/10 hover:text-white',
            )}
          >
            {previewMode ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
          {previewMode ? null : (
            <button
              type="button"
              title={
                preferences.sidebarCollapsed
                  ? t('editor.showPanels')
                  : t('editor.hidePanels')
              }
              aria-label={
                preferences.sidebarCollapsed
                  ? t('editor.showPanels')
                  : t('editor.hidePanels')
              }
              aria-pressed={preferences.sidebarCollapsed}
              onClick={toggleSidebar}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              {preferences.sidebarCollapsed ? (
                <PanelRightOpen className="h-4 w-4" />
              ) : (
                <PanelRightClose className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {previewMode || preferences.sidebarCollapsed ? null : (
        <aside className="space-y-4 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-1">
          <RoomNavigator
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            onSelect={focusRoom}
          />

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-white">
              {t('editor.dropDefaults')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {t('editor.dropHint')}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(['socket', 'switch', 'light', 'panel', 'junction', 'custom'] as const).map(
                (type) => (
                  <label key={type} className="text-xs text-slate-400">
                    {t(`editor.point.${type}`)}
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={dropDrafts[type] ?? ''}
                      onChange={(event) =>
                        setDropDrafts((current) => ({
                          ...current,
                          [type]: event.target.value,
                        }))
                      }
                      onBlur={() => void commitDropDefaults()}
                      className="mt-1 h-8"
                    />
                  </label>
                ),
              )}
            </div>
            {dropError ? (
              <p role="alert" className="mt-2 text-xs text-rose-300">
                {dropError}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-white">
              {t('editor.validationRules')}
            </h2>
            <label className="mt-3 block text-xs text-slate-400">
              {t('editor.maxCircuit')}
              <Input
                type="number"
                min="1"
                step="1"
                value={maxCircuit}
                onChange={(event) => setMaxCircuit(event.target.value)}
                onBlur={() => void commitValidation()}
                placeholder={t('editor.noLimit')}
                className="mt-1 h-8"
              />
            </label>
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={requireCableType}
                onChange={(event) => {
                  const next = event.target.checked;
                  setRequireCableType(next);
                  void commitValidation(next);
                }}
              />
              {t('editor.requireCableType')}
            </label>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-white">
              {t('editor.saveState')}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t('editor.floorRevision', {
                floor: floorName,
                version: plan.version,
              })}
              {collaborators > 0
                ? ` · ${t('editor.onlineCount', { count: collaborators })}`
                : ''}
            </p>
            <div className="mt-3">
              <SaveStatus status={status} error={saveError} onRetry={retry} />
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                variant={viewMode === '2d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('2d')}
              >
                {t('editor.view2d')}
              </Button>
              <Button
                variant={viewMode === '3d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('3d')}
              >
                {t('editor.view3d')}
              </Button>
              <Button
                variant={viewMode === 'split' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('split')}
              >
                {t('editor.splitView')}
              </Button>
            </div>

            {remoteUpdate ? (
              <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                <p>{t('editor.collaboratorChanged')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setRemoteUpdate(false);
                    void reloadDrawing();
                  }}
                >
                  {t('editor.reloadDrawing')}
                </Button>
              </div>
            ) : null}

            {historyError ? (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-100"
              >
                {historyError}
              </p>
            ) : null}

            {undoCommand || redoCommand ? (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                {undoCommand
                  ? t('editor.undoLabel', { label: undoCommand.label })
                  : null}
                {undoCommand && redoCommand ? ' · ' : null}
                {redoCommand
                  ? t('editor.redoLabel', { label: redoCommand.label })
                  : null}
              </p>
            ) : null}
          </section>

          <section
            id="scale-section"
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">
                {t('editor.scale')}
              </h2>
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px]',
                  calibration
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                    : 'border-amber-400/30 bg-amber-400/10 text-amber-200',
                )}
              >
                {calibration ? t('editor.calibrated') : t('editor.notCalibrated')}
              </span>
            </div>

            {calibration ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-300">
                {formatScale(calibration.metersPerUnit)}
                <span className="block text-slate-500">
                  {t('editor.knownDistance', {
                    distance: calibration.realDistance,
                    unit: calibration.unit,
                  })}
                </span>
              </p>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                {t('editor.scaleMissing')}
              </p>
            )}

            {calibration ? (
              <>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  {t('editor.scaleNote')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  disabled={calibrationBusy}
                  onClick={handleRemoveCalibration}
                >
                  <Ruler className="h-4 w-4" />
                  {t('editor.removeScale')}
                </Button>
              </>
            ) : null}

            {calibrationError && !pendingCalibration ? (
              <p className="mt-2 text-xs text-rose-300" role="alert">
                {calibrationError}
              </p>
            ) : null}
            {drawingError ? (
              <p className="mt-2 text-xs text-rose-300" role="alert">
                {t('editor.scaleLoadFailed', { error: drawingError })}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">
                {t('editor.points')}
              </h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400 tabular-nums">
                {points.length}
              </span>
            </div>

            {points.length === 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                {t('editor.pointsEmpty')}
              </p>
            ) : (
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                {POINT_SYMBOL_LIST.filter(
                  (symbol) => pointCounts[symbol.type] > 0,
                ).map((symbol) => (
                  <li
                    key={symbol.type}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: symbol.color }}
                      />
                      {t(`editor.point.${symbol.type}`)}
                    </span>
                    <span className="tabular-nums">
                      {pointCounts[symbol.type]}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {pointsError ? (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-100"
              >
                {pointsError}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">
                {t('editor.layout')}
              </h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400 tabular-nums">
                {walls.length + rooms.length + dimensions.length}
              </span>
            </div>

            {walls.length + rooms.length + dimensions.length === 0 ? (
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                {t('editor.layoutEmpty')}
              </p>
            ) : (
              <ul className="mt-3 space-y-1 text-xs text-slate-300">
                <li className="flex items-center justify-between gap-2">
                  <span>{t('editor.walls')}</span>
                  <span className="tabular-nums">{walls.length}</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span>{t('editor.rooms')}</span>
                  <span className="tabular-nums">{rooms.length}</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span>{t('editor.dimensions')}</span>
                  <span className="tabular-nums">{dimensions.length}</span>
                </li>
              </ul>
            )}

            {layoutError ? (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-100"
              >
                {layoutError}
              </p>
            ) : null}
          </section>

          <DevicePalette
            onSelect={(type, subtype) =>
              setPlacementRequest({
                type,
                subtype,
                nonce: Date.now(),
              })
            }
          />

          <CircuitsPanel
            circuits={circuits}
            points={points}
            routes={routes}
            onAdd={handleAddCircuit}
            onUpdate={handleUpdateCircuit}
            onDelete={handleDeleteCircuit}
          />

          <TakeoffPanel
            summary={takeoff}
            wallHeightMeters={takeoffSettings.wallHeightMeters}
            defaultThicknessMeters={takeoffSettings.defaultThicknessMeters}
            onWallHeightChange={setWallHeight}
            onDefaultThicknessChange={setDefaultThickness}
            onSelectCircuit={(circuitId) => {
              const route = routes.find(
                (item) => item.circuitId === circuitId,
              );
              if (route) selectRoute(route.id);
            }}
          />

          <ValidationPanel
            issues={validationIssues}
            onSelectTarget={focusValidationTarget}
          />

          <LayersPanel
            layers={layers}
            onToggle={toggleLayer}
            onShowAll={showAllLayers}
          />

          {selectedWall ? (
            <WallPropertiesPanel
              key={selectedWall.id}
              wall={selectedWall}
              metersPerUnit={metersPerUnit}
              onChange={(patch) => void handlePatchWall(selectedWall.id, patch)}
              onDuplicate={() => handleDuplicateWall(selectedWall)}
              onDelete={() => void handleDeleteWall(selectedWall.id)}
            />
          ) : null}

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">
                {t('editor.openings')}
              </h2>
              <span className="text-xs text-slate-500">{openings.length}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {t('editor.openingHint')}
            </p>
            {activeOpeningWall ? (
              <div className="mt-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void handleAddOpening(activeOpeningWall, 'door')
                  }
                >
                  {t('editor.addDoor')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void handleAddOpening(activeOpeningWall, 'window')
                  }
                >
                  {t('editor.addWindow')}
                </Button>
              </div>
            ) : null}

            {openings.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {openings.map((opening) => (
                  <li key={opening.id}>
                    <button
                      type="button"
                      onClick={() => selectOpening(opening.id)}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs ${
                        opening.id === selectedOpeningId
                          ? 'bg-amber-400/15 text-amber-100'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <span className="capitalize">
                        {t(`editor.opening.${opening.type}`)}
                      </span>
                      <span className="text-slate-500">
                        {opening.width.toFixed(0)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {selectedOpening ? (
              <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-slate-400">
                    {t('editor.offset')}
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={selectedOpening.offset}
                      className="mt-1 h-8"
                      onBlur={(event) =>
                        void handlePatchOpening(selectedOpening.id, {
                          offset: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t('editor.width')}
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={selectedOpening.width}
                      className="mt-1 h-8"
                      onBlur={(event) =>
                        void handlePatchOpening(selectedOpening.id, {
                          width: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t('editor.height')}
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={selectedOpening.height}
                      className="mt-1 h-8"
                      onBlur={(event) =>
                        void handlePatchOpening(selectedOpening.id, {
                          height: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    {t('editor.sill')}
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={selectedOpening.sillHeight}
                      className="mt-1 h-8"
                      onBlur={(event) =>
                        void handlePatchOpening(selectedOpening.id, {
                          sillHeight: Math.max(
                            0,
                            Number(event.target.value) || 0,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={selectedOpening.flipped}
                    onChange={(event) =>
                      void handlePatchOpening(selectedOpening.id, {
                        flipped: event.target.checked,
                      })
                    }
                  />
                  {t('editor.flipDoor')}
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleDeleteOpening(selectedOpening.id)}
                >
                  {t('editor.deleteOpening')}
                </Button>
              </div>
            ) : null}
          </section>

          {selectedRoom ? (
            <RoomPropertiesPanel
              key={selectedRoom.id}
              room={selectedRoom}
              metersPerUnit={metersPerUnit}
              onChange={(patch) => void handlePatchRoom(selectedRoom.id, patch)}
              onDuplicate={() => handleDuplicateRoom(selectedRoom)}
              onDelete={() => void handleDeleteRoom(selectedRoom.id)}
            />
          ) : null}

          {selectedDimension ? (
            <DimensionPropertiesPanel
              key={selectedDimension.id}
              dimension={selectedDimension}
              metersPerUnit={metersPerUnit}
              onChange={(patch) =>
                void handlePatchDimension(selectedDimension.id, patch)
              }
              onDelete={() => void handleDeleteDimension(selectedDimension.id)}
            />
          ) : null}

          {selectedPoint ? (
            <PointPropertiesPanel
              key={selectedPoint.id}
              point={selectedPoint}
              circuits={circuits}
              onChange={(patch) => void handlePatchPoint(selectedPoint.id, patch)}
              onDuplicate={() => handleDuplicatePoint(selectedPoint)}
              onDelete={() => void handleDeletePoint(selectedPoint.id)}
            />
          ) : null}

          <CalculationPanel
            routes={routes}
            calculation={calculation}
            loading={calcLoading}
            error={calcError}
            actionError={routesError}
            selectedRouteId={selectedRouteId}
            onSelectRoute={selectRoute}
          />

          {selectedRoute ? (
            <RoutePropertiesPanel
              key={selectedRoute.id}
              route={selectedRoute}
              materials={materials}
              circuits={circuits}
              calculation={calculation?.routes.find(
                (item) => item.routeId === selectedRoute.id,
              )}
              penetrationCount={penetrationCounts.get(selectedRoute.id) ?? 0}
              onChange={(patch) => void handlePatchRoute(selectedRoute.id, patch)}
              onDelete={() => void handleDeleteRoute(selectedRoute.id)}
            />
          ) : null}

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-white">
              {t('editor.view')}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {t('editor.uiScale')}
            </p>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {UI_SCALES.map((scale) => (
                <button
                  key={scale}
                  type="button"
                  aria-pressed={preferences.uiScale === scale}
                  onClick={() => setUiScale(scale)}
                  className={cn(
                    'rounded-lg border px-1 py-1 text-[11px] tabular-nums transition',
                    preferences.uiScale === scale
                      ? 'border-amber-400/40 bg-amber-400/15 text-amber-100'
                      : 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200',
                  )}
                >
                  {Math.round(scale * 100)}%
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setPreviewMode(true)}
              >
                <Eye className="h-4 w-4" />
                {t('editor.preview')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHotkeysOpen(true)}
              >
                {t('hotkeys.title')}
              </Button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              {t('editor.paletteHint')}{' '}
              <kbd className="rounded border border-white/10 bg-white/5 px-1 py-0.5 text-[10px] text-slate-400">
                Ctrl K
              </kbd>
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">
                {t('editor.underlay')}
              </h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
                {plan.sourceType === 'blank'
                  ? t('editor.blank')
                  : isPdf
                    ? t('editor.pdfPageBadge', { page: plan.page ?? 1 })
                    : plan.mimeType === 'image/png'
                      ? 'PNG'
                      : 'JPG'}
              </span>
            </div>

            {plan.sourceType === 'blank' ? (
              <div className="mt-3 rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
                {t('editor.underlayBlank')}
              </div>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateUnderlay({ visible: !underlay.visible })
                    }
                  >
                    {underlay.visible ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                    {underlay.visible
                      ? t('editor.visible')
                      : t('editor.hidden')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateUnderlay({ locked: !underlay.locked })
                    }
                  >
                    {underlay.locked ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <Unlock className="h-4 w-4" />
                    )}
                    {underlay.locked
                      ? t('editor.locked')
                      : t('editor.unlocked')}
                  </Button>
                </div>

                <div className="mt-4 space-y-4">
                  <RangeControl
                    label={t('editor.opacity')}
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={underlay.opacity}
                    displayValue={`${Math.round(underlay.opacity * 100)}%`}
                    onChange={(opacity) => updateUnderlay({ opacity })}
                  />
                  <RangeControl
                    label={t('editor.scale')}
                    min={0.1}
                    max={10}
                    step={0.05}
                    value={underlay.scale}
                    displayValue={`${underlay.scale.toFixed(2)}×`}
                    onChange={(scale) => updateUnderlay({ scale })}
                  />
                  <RangeControl
                    label={t('editor.rotation')}
                    min={-180}
                    max={180}
                    step={1}
                    value={underlay.rotation}
                    displayValue={`${Math.round(underlay.rotation)}°`}
                    onChange={(rotation) => updateUnderlay({ rotation })}
                  />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={resetUnderlayTransform}
                >
                  <RotateCcw className="h-4 w-4" />
                  {t('editor.resetTransform')}
                </Button>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              className="sr-only"
              onChange={handleFileChange}
              disabled={replacing || preparingFile}
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={replacing || preparingFile}
            >
              {replacing || preparingFile ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : plan.sourceType === 'blank' ? (
                <ImagePlus className="h-4 w-4" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {plan.sourceType === 'blank'
                ? t('editor.addUnderlay')
                : t('editor.replacePlanFile')}
            </Button>

            {fileError ? (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-100"
              >
                {fileError}
              </p>
            ) : null}
          </section>

          {isPdf ? (
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-300" />
                <h2 className="text-sm font-semibold text-white">
                  {t('editor.pdfPage')}
                </h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {t('editor.pdfPageHint')}
              </p>

              <div className="mt-3 flex items-end gap-2">
                <label className="flex-1">
                  <span className="block text-xs text-slate-400">
                    {t('editor.page')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    value={pageInput}
                    onChange={(event) => setPageInput(event.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-sm text-slate-100 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
                    disabled={pageBusy || previewBusy}
                  />
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleApplyPage()}
                  disabled={
                    pageBusy ||
                    previewBusy ||
                    pageInput === String(plan.page ?? 1) && plan.hasPreview
                  }
                >
                  {pageBusy || previewBusy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileImage className="h-4 w-4" />
                  )}
                  {t('editor.apply')}
                </Button>
              </div>

              {pageError ? (
                <p
                  role="alert"
                  className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100"
                >
                  {pageError}
                </p>
              ) : null}

              {previewError ? (
                <div className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-xs leading-relaxed text-rose-100">
                  <p>{previewError}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => void retryPreview()}
                    disabled={previewBusy}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t('editor.retryRender')}
                  </Button>
                </div>
              ) : null}

              {!plan.hasPreview && !previewBusy ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => void retryPreview()}
                >
                  <FileText className="h-4 w-4" />
                  {t('editor.renderPage', { page: plan.page ?? 1 })}
                </Button>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-white">
              {t('editor.estimate')}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t('editor.estimateHint')}
            </p>
            <Button
              className="mt-3 w-full"
              size="sm"
              disabled={estimateBusy}
              onClick={() => {
                setEstimateBusy(true);
                setEstimateError(null);
                void generateEstimate(plan.id)
                  .then((result) => setEstimate(result))
                  .catch((error: unknown) =>
                    setEstimateError(
                      error instanceof Error
                        ? error.message
                        : t('editor.estimateFailed'),
                    ),
                  )
                  .finally(() => setEstimateBusy(false));
              }}
            >
              {estimateBusy
                ? t('editor.generating')
                : t('editor.generateEstimate')}
            </Button>
            {estimateError ? (
              <p className="mt-2 text-xs text-rose-200">{estimateError}</p>
            ) : null}
            {estimate ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-slate-300">
                  {t('editor.versionLines', {
                    version: estimate.version,
                    count: estimate.items.length,
                  })}
                </p>
                <div className="flex gap-2">
                  <a
                    href={`/api/v1/estimates/${estimate.id}/csv`}
                    className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-medium text-slate-100 hover:bg-white/10"
                  >
                    {t('editor.downloadCsv')}
                  </a>
                  <a
                    href={`/api/v1/estimates/${estimate.id}/pdf`}
                    className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-medium text-slate-100 hover:bg-white/10"
                  >
                    {t('editor.downloadPdf')}
                  </a>
                </div>
                <ul className="space-y-1 text-[11px] text-slate-400">
                  {estimate.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span className="truncate">{item.description}</span>
                      <span className="tabular-nums">
                        {formatNumber(item.quantity, {
                          maximumFractionDigits: 2,
                        })}{' '}
                        {formatUnit(item.unit)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </aside>
        )}
      </div>

      {pendingCalibration ? (
        <CalibrationDialog
          pointA={pendingCalibration.pointA}
          pointB={pendingCalibration.pointB}
          existing={calibration}
          busy={calibrationBusy}
          error={calibrationError}
          onCancel={() => setPendingCalibration(null)}
          onConfirm={(distance, unit) =>
            void handleConfirmCalibration(distance, unit)
          }
        />
      ) : null}

      {pendingPdf ? (
        <PdfPageDialog
          fileName={pendingPdf.file.name}
          pageCount={pendingPdf.pages}
          initialPage={plan.page ?? 1}
          busy={replacing}
          onCancel={() => setPendingPdf(null)}
          onConfirm={(page) => void performReplace(pendingPdf.file, page)}
        />
      ) : null}

      <CommandPalette
        open={paletteOpen}
        commands={paletteCommands}
        onClose={() => setPaletteOpen(false)}
      />
      <HotkeysOverlay
        open={hotkeysOpen}
        onClose={() => setHotkeysOpen(false)}
      />
    </>
  );
}
