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
import { ArrowLeft, Download, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalibrationDialog } from '@/features/editor/calibration-dialog';
import { CircuitsPanel } from '@/features/editor/circuits-panel';
import { LayersPanel } from '@/features/editor/layers-panel';
import { TakeoffPanel } from '@/features/editor/takeoff-panel';
import { useTakeoffSettings } from '@/features/editor/takeoff-settings';
import { useEditorLayers } from '@/features/editor/editor-layers';
import { DevicePalette } from '@/features/editor/device-palette';
import {
  EditorCanvas,
  type PlacementRequest,
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

  function update(mutator: (current: LocalDrawing) => LocalDrawing) {
    setDrawing((current) => (current ? mutator(current) : current));
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
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="relative h-[70vh] min-h-[440px]">
          <EditorCanvas
            image={null}
            placementRequest={placementRequest}
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
            onMovePoint={(pointId, at) =>
              update((current) => ({
                ...current,
                points: current.points.map((point) =>
                  point.id === pointId
                    ? { ...point, x: at.x, y: at.y, updatedAt: now() }
                    : point,
                ),
              }))
            }
            onDeletePoint={(pointId) =>
              update((current) => ({
                ...current,
                points: current.points.filter((point) => point.id !== pointId),
              }))
            }
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
                routes: current.routes.map((route) =>
                  route.id === routeId
                    ? {
                        ...route,
                        geometry: route.geometry.map((vertex, i) =>
                          i === index ? at : vertex,
                        ),
                        updatedAt: now(),
                      }
                    : route,
                ),
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

        <aside className="space-y-4">
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
    </div>
  );
}