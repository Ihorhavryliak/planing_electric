import type {
  ElectricalPointType,
  LengthUnitInput,
  PublicCalibration,
  PublicDimension,
  PublicOpening,
  PublicPoint,
  PublicRoom,
  PublicRoute,
  PublicWall,
  UnderlaySettings,
} from '@drawmyplace/contracts';
import {
  ArrowLeft,
  Download,
  Eye,
  EyeOff,
  HelpCircle,
  LoaderCircle,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalibrationDialog } from '@/features/editor/calibration-dialog';
import { CircuitsPanel } from '@/features/editor/circuits-panel';
import { ElectricalPanel } from '@/features/editor/electrical-panel';
import { PanelSchedulePanel } from '@/features/editor/panel-schedule-panel';
import { buildElectricalPlan } from '@/features/editor/electrical';
import { buildPanelSchedule } from '@drawmyplace/calculations';
import { LayersPanel } from '@/features/editor/layers-panel';
import { TakeoffPanel } from '@/features/editor/takeoff-panel';
import { ValidationPanel } from '@/features/editor/validation-panel';
import {
  validatePlan,
  type ValidationTarget,
} from '@/features/editor/validation';
import { useTakeoffSettings } from '@/features/editor/takeoff-settings';
import { downloadSvg } from '@/features/editor/export-files';
import { buildPlanSvg, buildSchematicSvg } from '@/features/editor/svg-export';
import { useEditorLayers } from '@/features/editor/editor-layers';
import { DevicePalette } from '@/features/editor/device-palette';
import { CommandPalette, type CommandPaletteItem } from '@/features/editor/command-palette';
import { HotkeysOverlay } from '@/features/editor/hotkeys-overlay';
import { RoomNavigator } from '@/features/editor/room-navigator';
import {
  EditorGuide,
  EditorGuideOverlay,
} from '@/features/editor/editor-guide';
import { EditorTooltipLayer } from '@/features/editor/editor-tooltip';
import {
  attachRouteEnd,
  detachRouteEnd,
  moveRouteEndsForPoint,
  type RouteEnd,
} from '@/features/editor/route-geometry';
import { useEditorFullscreen } from '@/features/editor/use-editor-fullscreen';
import { useHoverHints } from '@/features/editor/use-hover-hints';
import {
  UI_SCALES,
  useEditorPreferences,
} from '@/features/editor/editor-preferences';
import { cn } from '@/lib/utils';
import {
  EditorCanvas,
  type EditorTool,
  type PlacementRequest,
  type ToolRequest,
} from '@/features/editor/editor-canvas';
import { previewMetersPerUnit, type Vec2 } from '@/features/editor/editor-geometry';
import {
  LocalConflictError,
  getLocalProject,
  saveLocalProject,
  type LocalDrawing,
  type LocalProject,
} from '@/features/local/local-db';
import {
  buildTakeoff,
  calculateRoute,
  countRoutePenetrations,
  resolveRouteDrops,
} from '@drawmyplace/calculations';
import { useI18n } from '@/features/i18n/i18n-context';
import { DEVICE_SUBTYPES, type DeviceSubtype } from '@drawmyplace/contracts';

const HIDDEN_UNDERLAY: UnderlaySettings = {
  visible: false,
  locked: false,
  opacity: 1,
  rotation: 0,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();

export function LocalEditorPage() {
  const { t, formatMeters } = useI18n();
  const { localId = '' } = useParams<{ localId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<LocalProject | null>(null);
  const [drawing, setDrawing] = useState<LocalDrawing | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [underlay, setUnderlay] = useState<UnderlaySettings>(HIDDEN_UNDERLAY);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [placementRequest, setPlacementRequest] =
    useState<PlacementRequest | null>(null);
  const { layers, toggleLayer, showAllLayers } = useEditorLayers();
  const [toolRequest, setToolRequest] = useState<ToolRequest | null>(null);
  const [fitRequest, setFitRequest] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [hotkeysOpen, setHotkeysOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const {
    preferences,
    setUiScale,
    toggleSidebar,
  } = useEditorPreferences();
  const {
    settings: takeoffSettings,
    setWallHeight,
    setDefaultThickness,
  } = useTakeoffSettings();
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedDimensionId, setSelectedDimensionId] = useState<string | null>(
    null,
  );
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(
    null,
  );
  const [pendingCalibration, setPendingCalibration] = useState<{
    pointA: Vec2;
    pointB: Vec2;
  } | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'conflict'>(
    'saved',
  );
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const loadedRef = useRef(false);
  const revisionRef = useRef<string | null>(null);
  const fullscreen = useEditorFullscreen({
    onEntered: () => setFitRequest(Date.now()),
  });
  const { hoverHints, toggleHoverHints } = useHoverHints();

  useEffect(() => {
    void (async () => {
      const loaded = await getLocalProject(localId);
      if (!loaded) {
        setError(t('local.notFound'));
        return;
      }
      setProject(loaded);
      setDrawing(loaded.drawing);
      setViewport(loaded.viewport);
      setName(loaded.name);
      revisionRef.current = loaded.updatedAt;
      loadedRef.current = true;
    })();
  }, [localId, t]);

  useEffect(() => {
    if (!project || !drawing || !loadedRef.current) return;
    setSaveState('saving');
    const timer = window.setTimeout(() => {
      const next: LocalProject = {
        ...project,
        name,
        drawing,
        viewport,
        updatedAt: now(),
      };
      void saveLocalProject(next, {
        expectedUpdatedAt: revisionRef.current,
      })
        .then(() => {
          revisionRef.current = next.updatedAt;
          setSaveState('saved');
        })
        .catch((err: unknown) => {
          if (err instanceof LocalConflictError) {
            setSaveState('conflict');
            setError(t('local.conflict'));
            return;
          }
          setError(err instanceof Error ? err.message : t('local.saveFailed'));
        });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [project, drawing, viewport, name, t]);

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

  const metersPerUnit = drawing?.calibration?.metersPerUnit ?? null;

  const localCable = useMemo(() => {
    if (!drawing || metersPerUnit === null) return null;

    return drawing.routes.map((route) => {
      const drops = resolveRouteDrops({
        geometry: route.geometry,
        points: drawing.points.map((point) => ({
          id: point.id,
          type: point.type,
          x: point.x,
          y: point.y,
          label: point.label,
          verticalDropMeters: point.properties.verticalDropMeters ?? null,
        })),
      });
      const result = calculateRoute({
        points: route.geometry,
        metersPerUnit,
        drops,
        wastePercent: route.settings.wastePercent,
      });

      return {
        circuitId: route.circuitId,
        materialId: route.materialId,
        requiredLength:
          result.status === 'ok' ? result.breakdown.requiredLength : null,
      };
    });
  }, [drawing, metersPerUnit]);

  const total = useMemo(
    () =>
      localCable === null
        ? null
        : localCable.reduce(
            (sum, route) => sum + (route.requiredLength ?? 0),
            0,
          ),
    [localCable],
  );

  const takeoff = useMemo(
    () =>
      buildTakeoff({
        metersPerUnit,
        walls: drawing?.walls ?? [],
        openings: drawing?.openings ?? [],
        rooms: drawing?.rooms ?? [],
        points: drawing?.points ?? [],
        routes: localCable ?? [],
        wallHeightMeters: takeoffSettings.wallHeightMeters,
        defaultWallThicknessMeters: takeoffSettings.defaultThicknessMeters,
      }),
    [drawing, metersPerUnit, localCable, takeoffSettings],
  );

  const routeLengths = useMemo(() => {
    const lengths = new Map<string, number | null>();

    drawing?.routes.forEach((route, index) => {
      lengths.set(route.id, localCable?.[index]?.requiredLength ?? null);
    });

    return lengths;
  }, [drawing, localCable]);

  const electrical = useMemo(
    () =>
      buildElectricalPlan({
        circuits: drawing?.circuits ?? [],
        points: drawing?.points ?? [],
        routes: drawing?.routes ?? [],
        routeLengths,
        settings: drawing?.electrical ?? null,
        calibrated: metersPerUnit !== null,
      }),
    [drawing, routeLengths, metersPerUnit],
  );

  const panelSchedule = useMemo(
    () => buildPanelSchedule(electrical),
    [electrical],
  );

  const validationIssues = useMemo(
    () =>
      validatePlan({
        calibration: drawing?.calibration ?? null,
        circuits: drawing?.circuits ?? [],
        points: drawing?.points ?? [],
        routes: drawing?.routes ?? [],
        walls: drawing?.walls ?? [],
        openings: drawing?.openings ?? [],
        electrical,
        panelSchedule,
      }),
    [drawing, electrical, panelSchedule],
  );

  function focusValidationTarget(target: ValidationTarget) {
    const clearSelections = () => {
      setSelectedPointId(null);
      setSelectedRouteId(null);
      setSelectedWallId(null);
      setSelectedOpeningId(null);
      setSelectedRoomId(null);
      setSelectedDimensionId(null);
    };

    switch (target.kind) {
      case 'point':
        clearSelections();
        setSelectedPointId(target.id);
        break;
      case 'route':
        clearSelections();
        setSelectedRouteId(target.id);
        break;
      case 'wall':
        clearSelections();
        setSelectedWallId(target.id);
        break;
      case 'opening':
        clearSelections();
        setSelectedOpeningId(target.id);
        break;
      case 'room':
        clearSelections();
        setSelectedRoomId(target.id);
        break;
      case 'circuit': {
        const route = drawing?.routes.find(
          (item) => item.circuitId === target.id,
        );
        const point = drawing?.points.find(
          (item) => item.properties.circuitId === target.id,
        );

        clearSelections();
        if (route) setSelectedRouteId(route.id);
        else if (point) setSelectedPointId(point.id);
        break;
      }
      case 'panel':
        document
          .querySelector('[data-testid="panel-schedule"]')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      case 'calibration':
        break;
    }
  }

  function update(mutator: (current: LocalDrawing) => LocalDrawing) {
    setDrawing((current) => (current ? mutator(current) : current));
  }

  function pointIdAt(at: { x: number; y: number } | undefined): string | null {
    if (!drawing || !at) return null;
    const point = drawing.points.find(
      (item) =>
        Math.abs(item.x - at.x) <= 1e-6 &&
        Math.abs(item.y - at.y) <= 1e-6,
    );

    return point?.id ?? null;
  }

  function attachLocalRouteEnd(routeId: string, end: RouteEnd) {
    if (!drawing) return;
    const route = drawing.routes.find((item) => item.id === routeId);
    if (!route) return;

    const at =
      end === 'start'
        ? route.geometry[0]
        : route.geometry[route.geometry.length - 1];
    if (!at) return;

    const nearest = [...drawing.points].sort(
      (a, b) =>
        Math.hypot(a.x - at.x, a.y - at.y) -
        Math.hypot(b.x - at.x, b.y - at.y),
    )[0];
    if (!nearest) {
      setError(t('routePins.noPointNearby'));
      return;
    }

    const patch = attachRouteEnd(route, end, nearest);
    if (!patch) return;

    update((current) => ({
      ...current,
      routes: current.routes.map((item) =>
        item.id === routeId
          ? { ...item, ...patch, updatedAt: now() }
          : item,
      ),
    }));
  }

  function detachLocalRouteEnd(routeId: string, end: RouteEnd) {
    if (!drawing) return;
    const route = drawing.routes.find((item) => item.id === routeId);
    if (!route) return;
    const patch = detachRouteEnd(route, end);

    update((current) => ({
      ...current,
      routes: current.routes.map((item) =>
        item.id === routeId
          ? { ...item, ...patch, updatedAt: now() }
          : item,
      ),
    }));
  }

  if (error && !drawing) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <p className="text-sm text-rose-300">{error}</p>
        <Link to="/local" className="mt-4 inline-flex text-amber-300">
          Back to local projects
        </Link>
      </div>
    );
  }

  if (!project || !drawing) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin text-amber-300" />
        Loading local project…
      </div>
    );
  }

  function exportPlanSvg() {
    if (!drawing || !project) return;
    downloadSvg(
      `${name || 'local-project'}.svg`,
      buildPlanSvg(
        { planId: project.id, ...drawing },
        drawing.circuits,
        { title: name },
      ),
    );
  }

  function exportSchematicSvg() {
    if (!drawing || !project) return;
    const lengths: Record<string, number> = {};

    for (const route of localCable ?? []) {
      const key = route.circuitId ?? '';
      lengths[key] = (lengths[key] ?? 0) + (route.requiredLength ?? 0);
    }

    downloadSvg(
      `${name || 'local-project'}-schematic.svg`,
      buildSchematicSvg({ planId: project.id, ...drawing }, lengths, {
        title: t('export.schematicTitle'),
        subtitle: name,
      }),
    );
  }

  function requestTool(tool: EditorTool, pointType?: ElectricalPointType) {
    setToolRequest({ tool, pointType, nonce: Date.now() });
  }

  function focusRoom(roomId: string) {
    if (!drawing) return;
    const room = drawing.rooms.find((item) => item.id === roomId);

    if (!room) return;

    setSelectedRoomId(roomId);
    setSelectedPointId(null);
    setSelectedRouteId(null);
    setSelectedWallId(null);
    setSelectedOpeningId(null);
    setSelectedDimensionId(null);

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

  function openGuide() {
    setGuideOpen(true);
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
      id: 'guide',
      label: t('guide.title'),
      hint: t('guide.subtitle'),
      run: openGuide,
    },
    ...(selectedRouteId
      ? [
          {
            id: 'pin-start',
            label: t('routePins.attachStart'),
            run: () => attachLocalRouteEnd(selectedRouteId, 'start'),
          },
          {
            id: 'pin-end',
            label: t('routePins.attachEnd'),
            run: () => attachLocalRouteEnd(selectedRouteId, 'end'),
          },
          {
            id: 'unpin-start',
            label: t('routePins.detachStart'),
            run: () => detachLocalRouteEnd(selectedRouteId, 'start'),
          },
          {
            id: 'unpin-end',
            label: t('routePins.detachEndShort'),
            run: () => detachLocalRouteEnd(selectedRouteId, 'end'),
          },
        ]
      : []),
    {
      id: 'fullscreen',
      label: fullscreen.isFullscreen
        ? t('editor.fullscreen.exit')
        : t('editor.fullscreen.enter'),
      shortcut: 'F11',
      hint: t('editor.fullscreen.hint'),
      run: () => void fullscreen.toggle(),
    },
    {
      id: 'hover-hints',
      label: hoverHints
        ? t('editor.hoverHints.disable')
        : t('editor.hoverHints.enable'),
      run: toggleHoverHints,
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

  const selectedPoint =
    drawing.points.find((point) => point.id === selectedPointId) ?? null;
  const selectedRoute =
    drawing.routes.find((route) => route.id === selectedRouteId) ?? null;
  const selectedOpening =
    drawing.openings.find((opening) => opening.id === selectedOpeningId) ?? null;
  const selectedWall =
    drawing.walls.find((wall) => wall.id === selectedWallId) ?? null;
  const openingWall =
    selectedOpening &&
    drawing.walls.find((wall) => wall.id === selectedOpening.wallId);
  const activeOpeningWall = selectedWall ?? openingWall ?? null;

  function exportJson() {
    const payload = { ...project, drawing, viewport, name, updatedAt: now() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name.replace(/[^\w-]+/g, '-') || 'local-project'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function wallLength(geometry: readonly Vec2[]): number {
    let length = 0;
    for (let index = 0; index < geometry.length - 1; index += 1) {
      const a = geometry[index];
      const b = geometry[index + 1];
      if (a && b) length += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return length;
  }

  async function handleExportPng() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${name || 'drawing'}.png`;
    link.click();
  }

  return (
    <div className="relative min-h-screen">
      <header className="border-b border-white/10 bg-slate-950/70 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <Link to="/local" className="text-slate-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-9 max-w-xs"
            aria-label={t('local.projectName')}
          />
          <span className="text-xs text-slate-500">
            {saveState === 'saving'
              ? t('local.savingLocally')
              : saveState === 'conflict'
                ? t('local.conflict')
                : t('local.savedLocally')}
          </span>
          {saveState === 'conflict' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              {t('local.reload')}
            </Button>
          ) : null}
          <span className="text-xs text-slate-400">
            {total === null
              ? t('local.notCalibrated')
              : t('local.cable', { length: formatMeters(total) })}
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/local')}>
              {t('local.projects')}
            </Button>
            <Button variant="outline" size="sm" onClick={exportJson}>
              <Download className="h-4 w-4" />
              JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => void handleExportPng()}>
              PNG
            </Button>
            <Button variant="outline" size="sm" onClick={exportPlanSvg}>
              {t('export.planSvgShort')}
            </Button>
            <Button variant="outline" size="sm" onClick={exportSchematicSvg}>
              {t('export.schematicShort')}
            </Button>
          </div>
        </div>
      </header>

      {fullscreen.fallback ? (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-[90] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-amber-400/25 bg-slate-950/95 p-3 text-slate-100 shadow-2xl shadow-black/50 backdrop-blur"
        >
          <p className="text-xs leading-relaxed text-amber-100">
            {t('editor.fullscreen.unsupported')}
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                fullscreen.dismissFallback();
                setPreviewMode(true);
              }}
            >
              {t('editor.fullscreen.usePreview')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={fullscreen.dismissFallback}
            >
              {t('editor.fullscreen.dismiss')}
            </Button>
          </div>
        </div>
      ) : null}

      <main
        ref={fullscreen.containerRef}
        data-editor-tooltips
        style={{ zoom: preferences.uiScale }}
        className={`${
          fullscreen.isFullscreen
            ? 'h-[100dvh] bg-slate-950 p-2'
            : 'mx-auto max-w-7xl px-4 py-4'
        } ${
          previewMode || preferences.sidebarCollapsed
            ? 'relative'
            : 'grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]'
        }`}
      >
        <div
          className={`relative min-h-[440px] ${
            fullscreen.isFullscreen
              ? 'h-[calc(100dvh-1rem)]'
              : previewMode
                ? 'h-[calc(100vh-8rem)]'
                : 'h-[70vh]'
          }`}
        >
          <EditorCanvas
            image={null}
            placementRequest={placementRequest}
            toolRequest={toolRequest}
            fitRequest={fitRequest}
            readOnly={previewMode}
            underlay={underlay}
            viewport={viewport}
            autoFit={false}
            calibration={drawing.calibration}
            walls={drawing.walls}
            selectedWallId={selectedWallId}
            openings={drawing.openings}
            selectedOpeningId={selectedOpeningId}
            rooms={drawing.rooms}
            selectedRoomId={selectedRoomId}
            dimensions={drawing.dimensions}
            selectedDimensionId={selectedDimensionId}
            points={drawing.points}
            selectedPointId={selectedPointId}
            routes={drawing.routes}
            selectedRouteId={selectedRouteId}
            circuits={drawing.circuits}
            layers={layers}
            metersPerUnit={metersPerUnit}
            hoverHints={hoverHints}
            routeDetails={Object.fromEntries(
              (localCable ?? []).flatMap((route, index) => {
                const id = drawing?.routes[index]?.id;
                return id
                  ? [[id, { requiredLength: route.requiredLength }]]
                  : [];
              }),
            )}
            wallHeightMeters={takeoffSettings.wallHeightMeters}
            onCalibrationPoints={(pointA, pointB) =>
              setPendingCalibration({ pointA, pointB })
            }
            onSelectPoint={(next) => {
              setSelectedPointId(next);
              if (next) {
                setSelectedWallId(null);
                setSelectedOpeningId(null);
                setSelectedRoomId(null);
                setSelectedDimensionId(null);
                setSelectedRouteId(null);
              }
            }}
            onCreatePoint={(
              type: ElectricalPointType,
              at: Vec2,
              subtype: DeviceSubtype | null,
            ) =>
              update((current) => ({
                ...current,
                points: [
                  ...current.points,
                  {
                    id: id(),
                    floorId: project.id,
                    type,
                    x: at.x,
                    y: at.y,
                    rotation: 0,
                    label: null,
                    mountingHeight: null,
                    properties: subtype ? { subtype } : {},
                    updatedAt: now(),
                  } satisfies PublicPoint,
                ],
              }))
            }
            onMovePoint={(pointId, at) => {
              update((current) => {
                const previous = current.points.find(
                  (point) => point.id === pointId,
                );

                if (!previous) return current;

                const updates = moveRouteEndsForPoint(
                  current.routes,
                  pointId,
                  { x: previous.x, y: previous.y },
                  at,
                );
                const geometryById = new Map(
                  updates.map((updateItem) => [
                    updateItem.id,
                    updateItem.geometry,
                  ]),
                );

                return {
                  ...current,
                  points: current.points.map((point) =>
                    point.id === pointId
                      ? { ...point, x: at.x, y: at.y, updatedAt: now() }
                      : point,
                  ),
                  routes: current.routes.map((route) =>
                    geometryById.has(route.id)
                      ? {
                          ...route,
                          geometry: geometryById.get(route.id) ?? route.geometry,
                          updatedAt: now(),
                        }
                      : route,
                  ),
                };
              });
            }}
            onDeletePoint={(pointId) => {
              const attached = drawing.routes.filter(
                (route) =>
                  route.startPointId === pointId ||
                  route.endPointId === pointId,
              );

              if (
                attached.length > 0 &&
                !window.confirm(
                  t('routePins.deletePointWarning', {
                    count: attached.length,
                  }),
                )
              ) {
                return;
              }

              update((current) => ({
                ...current,
                points: current.points.filter((point) => point.id !== pointId),
                routes: current.routes.map((route) => ({
                  ...route,
                  startPointId:
                    route.startPointId === pointId ? null : route.startPointId,
                  endPointId:
                    route.endPointId === pointId ? null : route.endPointId,
                })),
              }));
            }}
            onSelectRoute={(next) => {
              setSelectedRouteId(next);
              if (next) {
                setSelectedPointId(null);
                setSelectedWallId(null);
                setSelectedOpeningId(null);
                setSelectedRoomId(null);
                setSelectedDimensionId(null);
              }
            }}
            onCreateRoute={(geometry) =>
              update((current) => ({
                ...current,
                routes: [
                  ...current.routes,
                  {
                    id: id(),
                    floorId: project.id,
                    circuitId: null,
                    materialId: null,
                    startPointId: pointIdAt(geometry[0]),
                    endPointId: pointIdAt(geometry[geometry.length - 1]),
                    geometry,
                    settings: {},
                    updatedAt: now(),
                  } satisfies PublicRoute,
                ],
              }))
            }
            onMoveRouteVertex={(routeId, index, at) =>
              update((current) => ({
                ...current,
                routes: current.routes.map((route) => {
                  if (route.id !== routeId) return route;
                  const lastIndex = route.geometry.length - 1;
                  const pointId = pointIdAt(at);

                  return {
                    ...route,
                    geometry: route.geometry.map((vertex, i) =>
                      i === index ? at : vertex,
                    ),
                    ...(index === 0 ? { startPointId: pointId } : {}),
                    ...(index === lastIndex && lastIndex !== 0
                      ? { endPointId: pointId }
                      : {}),
                    updatedAt: now(),
                  };
                }),
              }))
            }
            onInsertRouteVertex={(routeId, index, at) =>
              update((current) => ({
                ...current,
                routes: current.routes.map((route) => {
                  if (route.id !== routeId) return route;
                  const geometry = [...route.geometry];
                  geometry.splice(index + 1, 0, at);
                  return { ...route, geometry, updatedAt: now() };
                }),
              }))
            }
            onRemoveRouteVertex={(routeId, index) =>
              update((current) => ({
                ...current,
                routes: current.routes.map((route) =>
                  route.id === routeId && route.geometry.length > 2
                    ? {
                        ...route,
                        geometry: route.geometry.filter((_, i) => i !== index),
                        updatedAt: now(),
                      }
                    : route,
                ),
              }))
            }
            onDeleteRoute={(routeId) =>
              update((current) => ({
                ...current,
                routes: current.routes.filter((route) => route.id !== routeId),
              }))
            }
            onSelectWall={(next) => {
              setSelectedWallId(next);
              if (next) {
                setSelectedPointId(null);
                setSelectedRouteId(null);
                setSelectedOpeningId(null);
                setSelectedRoomId(null);
                setSelectedDimensionId(null);
              }
            }}
            onCreateWall={(geometry) =>
              update((current) => ({
                ...current,
                walls: [
                  ...current.walls,
                  {
                    id: id(),
                    floorId: project.id,
                    geometry,
                    thickness: null,
                    label: null,
                    updatedAt: now(),
                  } satisfies PublicWall,
                ],
              }))
            }
            onMoveWall={(wallId, geometry) =>
              update((current) => ({
                ...current,
                walls: current.walls.map((wall) =>
                  wall.id === wallId
                    ? { ...wall, geometry, updatedAt: now() }
                    : wall,
                ),
              }))
            }
            onDeleteWall={(wallId) =>
              update((current) => ({
                ...current,
                walls: current.walls.filter((wall) => wall.id !== wallId),
                openings: current.openings.filter(
                  (opening) => opening.wallId !== wallId,
                ),
              }))
            }
            onSelectRoom={(next) => {
              setSelectedRoomId(next);
              if (next) {
                setSelectedPointId(null);
                setSelectedRouteId(null);
                setSelectedWallId(null);
                setSelectedOpeningId(null);
                setSelectedDimensionId(null);
              }
            }}
            onCreateRoom={(boundary) =>
              update((current) => ({
                ...current,
                rooms: [
                  ...current.rooms,
                  {
                    id: id(),
                    floorId: project.id,
                    name: 'Room',
                    boundary,
                    updatedAt: now(),
                  } satisfies PublicRoom,
                ],
              }))
            }
            onMoveRoom={(roomId, boundary) =>
              update((current) => ({
                ...current,
                rooms: current.rooms.map((room) =>
                  room.id === roomId
                    ? { ...room, boundary, updatedAt: now() }
                    : room,
                ),
              }))
            }
            onDeleteRoom={(roomId) =>
              update((current) => ({
                ...current,
                rooms: current.rooms.filter((room) => room.id !== roomId),
              }))
            }
            onSelectDimension={(next) => {
              setSelectedDimensionId(next);
              if (next) {
                setSelectedPointId(null);
                setSelectedRouteId(null);
                setSelectedWallId(null);
                setSelectedOpeningId(null);
                setSelectedRoomId(null);
              }
            }}
            onCreateDimension={(pointA, pointB, offset) =>
              update((current) => ({
                ...current,
                dimensions: [
                  ...current.dimensions,
                  {
                    id: id(),
                    floorId: project.id,
                    pointA,
                    pointB,
                    offset,
                    label: null,
                    updatedAt: now(),
                  } satisfies PublicDimension,
                ],
              }))
            }
            onMoveDimensionOffset={(dimensionId, offset) =>
              update((current) => ({
                ...current,
                dimensions: current.dimensions.map((dimension) =>
                  dimension.id === dimensionId
                    ? { ...dimension, offset, updatedAt: now() }
                    : dimension,
                ),
              }))
            }
            onDeleteDimension={(dimensionId) =>
              update((current) => ({
                ...current,
                dimensions: current.dimensions.filter(
                  (dimension) => dimension.id !== dimensionId,
                ),
              }))
            }
            onUnderlayChange={setUnderlay}
            onViewportChange={setViewport}
            canUndo={false}
            canRedo={false}
            historyBusy={false}
            onUndo={() => undefined}
            onRedo={() => undefined}
          />
        </div>

        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/90 p-1 shadow-xl shadow-black/30 backdrop-blur">
          <button
            type="button"
            title={
              fullscreen.isFullscreen
                ? t('editor.fullscreen.exit')
                : t('editor.fullscreen.enter')
            }
            aria-label={
              fullscreen.isFullscreen
                ? t('editor.fullscreen.exit')
                : t('editor.fullscreen.enter')
            }
            data-tooltip-hint={t('tooltip.fullscreen')}
            data-testid="editor-fullscreen"
            aria-pressed={fullscreen.isFullscreen}
            onClick={() => void fullscreen.toggle()}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
              fullscreen.isFullscreen
                ? 'bg-amber-400 text-slate-950'
                : 'text-slate-300 hover:bg-white/10 hover:text-white',
            )}
          >
            {fullscreen.isFullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            title={previewMode ? t('editor.exitPreview') : t('editor.preview')}
            aria-label={previewMode ? t('editor.exitPreview') : t('editor.preview')}
            data-tooltip-hint={t('tooltip.preview')}
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
              data-tooltip-hint={t('tooltip.panels')}
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
          <button
            type="button"
            title={t('guide.title')}
            aria-label={t('guide.title')}
            data-tooltip-hint={t('tooltip.help')}
            onClick={openGuide}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>

        {previewMode || preferences.sidebarCollapsed ? null : (
        <aside className="space-y-4">
          <RoomNavigator
            rooms={drawing.rooms}
            selectedRoomId={selectedRoomId}
            onSelect={focusRoom}
          />

          <EditorGuide
            onOpenShortcuts={() => setHotkeysOpen(true)}
            onOpenGuide={openGuide}
          />

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-white">
              {t('editor.view')}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
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
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              aria-pressed={hoverHints}
              onClick={toggleHoverHints}
            >
              {hoverHints
                ? t('editor.hoverHints.disable')
                : t('editor.hoverHints.enable')}
            </Button>
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
            <h2 className="text-sm font-semibold text-white">
              {t('local.defaultName')}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t('local.storedHint')}
            </p>
            <dl className="mt-3 space-y-1 text-xs text-slate-400">
              <div className="flex justify-between">
                <dt>{t('local.points')}</dt>
                <dd>{drawing.points.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t('local.routes')}</dt>
                <dd>{drawing.routes.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t('local.walls')}</dt>
                <dd>{drawing.walls.length}</dd>
              </div>
            </dl>
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

          <TakeoffPanel
            summary={takeoff}
            wallHeightMeters={takeoffSettings.wallHeightMeters}
            defaultThicknessMeters={takeoffSettings.defaultThicknessMeters}
            onWallHeightChange={setWallHeight}
            onDefaultThicknessChange={setDefaultThickness}
            electrical={{
              installedKw: electrical.totalConnectedPowerW / 1_000,
              demandKw: electrical.totalDemandPowerW / 1_000,
              currentA: electrical.maxPhaseCurrentA,
              calibrated: electrical.calibrated,
            }}
            onSelectCircuit={(circuitId) => {
              const route = drawing?.routes.find(
                (item) => item.circuitId === circuitId,
              );
              if (!route) return;
              setSelectedRouteId(route.id);
              setSelectedPointId(null);
              setSelectedWallId(null);
              setSelectedOpeningId(null);
              setSelectedRoomId(null);
              setSelectedDimensionId(null);
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

          <CircuitsPanel
            circuits={drawing.circuits}
            points={drawing.points}
            routes={drawing.routes}
            onAdd={(circuit) =>
              update((current) => ({
                ...current,
                circuits: [...current.circuits, circuit],
              }))
            }
            onUpdate={(id, patch) =>
              update((current) => ({
                ...current,
                circuits: current.circuits.map((circuit) =>
                  circuit.id === id ? { ...circuit, ...patch } : circuit,
                ),
              }))
            }
            onDelete={(id) =>
              update((current) => ({
                ...current,
                circuits: current.circuits.filter(
                  (circuit) => circuit.id !== id,
                ),
              }))
            }
          />

          <PanelSchedulePanel
            schedule={panelSchedule}
            fileName={`${name || 'local-project'}-panel`}
            onBoardChange={(board) =>
              update((current) => ({
                ...current,
                electrical: {
                  ...(current.electrical ?? {}),
                  board,
                },
              }))
            }
            onSelectCircuit={(circuitId) => {
              const route = drawing?.routes.find(
                (item) => item.circuitId === circuitId,
              );
              if (!route) return;
              setSelectedRouteId(route.id);
              setSelectedPointId(null);
              setSelectedWallId(null);
              setSelectedOpeningId(null);
              setSelectedRoomId(null);
              setSelectedDimensionId(null);
            }}
          />

          <ElectricalPanel
            result={electrical}
            onSettingsChange={(next) =>
              update((current) => ({ ...current, electrical: next }))
            }
            onSelectCircuit={(circuitId) => {
              const route = drawing?.routes.find(
                (item) => item.circuitId === circuitId,
              );
              if (!route) return;
              setSelectedRouteId(route.id);
              setSelectedPointId(null);
              setSelectedWallId(null);
              setSelectedOpeningId(null);
              setSelectedRoomId(null);
              setSelectedDimensionId(null);
            }}
          />

          {selectedPoint ? (
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-400">
              <h2 className="text-sm font-semibold text-white">
                {t('local.selectedPoint')}
              </h2>
              <p className="mt-2">{t(`editor.point.${selectedPoint.type}`)}</p>
              <label className="mt-3 block">
                <span className="text-slate-500">
                  {t('devices.subtype')}
                </span>
                <select
                  value={selectedPoint.properties.subtype ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    update((current) => ({
                      ...current,
                      points: current.points.map((point) => {
                        if (point.id !== selectedPoint.id) return point;
                        const { subtype: _previous, ...rest } = point.properties;
                        return {
                          ...point,
                          properties: value
                            ? {
                                ...rest,
                                subtype: value as DeviceSubtype,
                              }
                            : rest,
                        };
                      }),
                    }));
                  }}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
                >
                  <option value="">{t('devices.generic')}</option>
                  {DEVICE_SUBTYPES.filter(
                    (definition) => definition.type === selectedPoint.type,
                  ).map((definition) => (
                    <option key={definition.id} value={definition.id}>
                      {t(`devices.subtype.${definition.id}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-slate-500">
                  {t('circuits.circuit')}
                </span>
                <select
                  value={selectedPoint.properties.circuitId ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    update((current) => ({
                      ...current,
                      points: current.points.map((point) =>
                        point.id === selectedPoint.id
                          ? {
                              ...point,
                              properties: value
                                ? { ...point.properties, circuitId: value }
                                : (() => {
                                    const { circuitId: _previous, ...rest } =
                                      point.properties;
                                    return rest;
                                  })(),
                            }
                          : point,
                      ),
                    }));
                  }}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
                >
                  <option value="">{t('circuits.none')}</option>
                  {drawing.circuits.map((circuit) => (
                    <option key={circuit.id} value={circuit.id}>
                      {circuit.id} · {circuit.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  update((current) => ({
                    ...current,
                    points: current.points.filter(
                      (point) => point.id !== selectedPoint.id,
                    ),
                  }))
                }
              >
                {t('local.deletePoint')}
              </Button>
            </section>
          ) : null}

          {selectedRoute ? (
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-400">
              <h2 className="text-sm font-semibold text-white">
                {t('editor.cableRoute')}
              </h2>
              <label className="mt-3 block">
                <span className="text-slate-500">{t('mounting.label')}</span>
                <select
                  value={selectedRoute.settings.mounting ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    update((current) => ({
                      ...current,
                      routes: current.routes.map((route) =>
                        route.id === selectedRoute.id
                          ? {
                              ...route,
                              settings: {
                                ...route.settings,
                                ...(value === ''
                                  ? { mounting: undefined }
                                  : {
                                      mounting:
                                        value as typeof route.settings.mounting,
                                    }),
                                ...(value === 'chase'
                                  ? {
                                      chaseWidthMm:
                                        route.settings.chaseWidthMm ?? 60,
                                      chaseDepthMm:
                                        route.settings.chaseDepthMm ?? 25,
                                    }
                                  : {}),
                              },
                            }
                          : route,
                      ),
                    }));
                  }}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
                >
                  <option value="">{t('mounting.none')}</option>
                  <option value="ceiling">{t('mounting.ceiling')}</option>
                  <option value="floor">{t('mounting.floor')}</option>
                  <option value="wall">{t('mounting.wall')}</option>
                  <option value="chase">{t('mounting.chase')}</option>
                </select>
              </label>
              {selectedRoute.settings.mounting === 'chase' ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-slate-500">
                      {t('editor.chaseWidth')}
                    </span>
                    <input
                      type="number"
                      min={10}
                      max={400}
                      value={selectedRoute.settings.chaseWidthMm ?? 60}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (!Number.isFinite(value) || value < 10 || value > 400) {
                          return;
                        }
                        update((current) => ({
                          ...current,
                          routes: current.routes.map((route) =>
                            route.id === selectedRoute.id
                              ? {
                                  ...route,
                                  settings: {
                                    ...route.settings,
                                    chaseWidthMm: value,
                                  },
                                }
                              : route,
                          ),
                        }));
                      }}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
                    />
                  </label>
                  <label className="block">
                    <span className="text-slate-500">
                      {t('editor.chaseDepth')}
                    </span>
                    <input
                      type="number"
                      min={5}
                      max={150}
                      value={selectedRoute.settings.chaseDepthMm ?? 25}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (!Number.isFinite(value) || value < 5 || value > 150) {
                          return;
                        }
                        update((current) => ({
                          ...current,
                          routes: current.routes.map((route) =>
                            route.id === selectedRoute.id
                              ? {
                                  ...route,
                                  settings: {
                                    ...route.settings,
                                    chaseDepthMm: value,
                                  },
                                }
                              : route,
                          ),
                        }));
                      }}
                      className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
                    />
                  </label>
                </div>
              ) : null}
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {t('routePins.title')}
                </h3>
                <div className="mt-2 space-y-1.5">
                  {(['start', 'end'] as const).map((end) => {
                    const pointId =
                      end === 'start'
                        ? selectedRoute.startPointId
                        : selectedRoute.endPointId;
                    const point = drawing.points.find(
                      (item) => item.id === pointId,
                    );
                    const pinned = Boolean(pointId);
                    const at =
                      end === 'start'
                        ? selectedRoute.geometry[0]
                        : selectedRoute.geometry[
                            selectedRoute.geometry.length - 1
                          ];
                    const mismatch =
                      Boolean(point && at) &&
                      (Math.abs((at?.x ?? 0) - (point?.x ?? 0)) > 1e-6 ||
                        Math.abs((at?.y ?? 0) - (point?.y ?? 0)) > 1e-6);

                    return (
                      <div
                        key={end}
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-slate-950/40 px-2 py-1.5"
                      >
                        <span className="flex min-w-0 items-center gap-1.5 text-[11px]">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              pinned ? 'bg-amber-300' : 'bg-slate-600'
                            }`}
                          />
                          <span className="shrink-0 text-slate-500">
                            {t(`routePins.${end}`)}
                          </span>
                          <span className="truncate text-slate-200">
                            {pinned
                              ? point?.label?.trim() ||
                                t(`editor.point.${point?.type ?? 'custom'}`)
                              : t('routePins.free')}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {mismatch && point ? (
                            <button
                              type="button"
                              className="rounded-md px-1.5 py-0.5 text-[10px] text-amber-200 hover:bg-amber-400/10"
                              onClick={() =>
                                update((current) => ({
                                  ...current,
                                  routes: current.routes.map((route) =>
                                    route.id === selectedRoute.id
                                      ? {
                                          ...route,
                                          geometry: route.geometry.map(
                                            (vertex, index) =>
                                              (end === 'start' &&
                                                index === 0) ||
                                              (end === 'end' &&
                                                index ===
                                                  route.geometry.length - 1)
                                                ? { x: point.x, y: point.y }
                                                : vertex,
                                          ),
                                          updatedAt: now(),
                                        }
                                      : route,
                                  ),
                                }))
                              }
                            >
                              {t('routePins.sync')}
                            </button>
                          ) : null}
                          {pinned ? (
                            <button
                              type="button"
                              className="rounded-md px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-white/10 hover:text-white"
                              onClick={() =>
                                detachLocalRouteEnd(selectedRoute.id, end)
                              }
                            >
                              {t('routePins.detach')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="rounded-md px-1.5 py-0.5 text-[10px] text-amber-200 hover:bg-amber-400/10"
                              onClick={() =>
                                attachLocalRouteEnd(selectedRoute.id, end)
                              }
                            >
                              {t('routePins.attachNearest')}
                            </button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="mt-2 text-[11px] text-slate-500">
                {t('editor.penetrations')}:{' '}
                <span className="font-medium text-slate-200">
                  {countRoutePenetrations([selectedRoute], drawing.walls).get(
                    selectedRoute.id,
                  ) ?? 0}
                </span>
              </p>
              <label className="mt-3 block">
                <span className="text-slate-500">
                  {t('circuits.circuit')}
                </span>
                <select
                  value={selectedRoute.circuitId ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    update((current) => ({
                      ...current,
                      routes: current.routes.map((route) =>
                        route.id === selectedRoute.id
                          ? { ...route, circuitId: value || null }
                          : route,
                      ),
                    }));
                  }}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 py-1.5 text-xs text-slate-100"
                >
                  <option value="">{t('circuits.none')}</option>
                  {drawing.circuits.map((circuit) => (
                    <option key={circuit.id} value={circuit.id}>
                      {circuit.id} · {circuit.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  update((current) => ({
                    ...current,
                    routes: current.routes.filter(
                      (route) => route.id !== selectedRoute.id,
                    ),
                  }))
                }
              >
                {t('editor.deleteRoute')}
              </Button>
            </section>
          ) : null}

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-white">
              {t('editor.openings')}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t('editor.openingHint')}
            </p>
            {activeOpeningWall ? (
              <div className="mt-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      openings: [
                        ...current.openings,
                        {
                          id: id(),
                          floorId: project.id,
                          wallId: activeOpeningWall.id,
                          type: 'door',
                          offset: Math.max(
                            0,
                            wallLength(activeOpeningWall.geometry) * 0.4,
                          ),
                          width: Math.max(
                            1,
                            wallLength(activeOpeningWall.geometry) * 0.2,
                          ),
                          height: 210,
                          sillHeight: 0,
                          flipped: false,
                          label: null,
                          updatedAt: now(),
                        } satisfies PublicOpening,
                      ],
                    }))
                  }
                >
                  {t('editor.addDoor')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    update((current) => ({
                      ...current,
                      openings: [
                        ...current.openings,
                        {
                          id: id(),
                          floorId: project.id,
                          wallId: activeOpeningWall.id,
                          type: 'window',
                          offset: Math.max(
                            0,
                            wallLength(activeOpeningWall.geometry) * 0.4,
                          ),
                          width: Math.max(
                            1,
                            wallLength(activeOpeningWall.geometry) * 0.2,
                          ),
                          height: 130,
                          sillHeight: 90,
                          flipped: false,
                          label: null,
                          updatedAt: now(),
                        } satisfies PublicOpening,
                      ],
                    }))
                  }
                >
                  {t('editor.addWindow')}
                </Button>
              </div>
            ) : null}
            {selectedOpening ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() =>
                  update((current) => ({
                    ...current,
                    openings: current.openings.filter(
                      (opening) => opening.id !== selectedOpening.id,
                    ),
                  }))
                }
              >
                {t('editor.deleteOpening')}
              </Button>
            ) : null}
          </section>

          {error ? (
            <p role="alert" className="text-xs text-rose-300">
              {error}
            </p>
          ) : null}
        </aside>
        )}
      </main>

      {pendingCalibration ? (
        <CalibrationDialog
          pointA={pendingCalibration.pointA}
          pointB={pendingCalibration.pointB}
          existing={drawing.calibration}
          busy={false}
          error={null}
          onCancel={() => setPendingCalibration(null)}
          onConfirm={(realDistance: number, unit: LengthUnitInput) => {
            const scale = previewMetersPerUnit(
              pendingCalibration.pointA,
              pendingCalibration.pointB,
              realDistance,
              unit,
            );
            if (scale === null) return;
            const calibration: PublicCalibration = {
              planId: project.id,
              pointA: pendingCalibration.pointA,
              pointB: pendingCalibration.pointB,
              realDistance,
              unit,
              metersPerUnit: scale,
              updatedAt: now(),
            };
            update((current) => ({ ...current, calibration }));
            setPendingCalibration(null);
          }}
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
      <EditorTooltipLayer />
      <EditorGuideOverlay
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onOpenShortcuts={() => {
          setGuideOpen(false);
          setHotkeysOpen(true);
        }}
      />
    </div>
  );
}