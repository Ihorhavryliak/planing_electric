import type {
  PublicOpening,
  PublicPoint,
  PublicRoom,
  PublicRoute,
  PublicWall,
} from '@drawmyplace/contracts';
import { Box, Download, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { useI18n } from '@/features/i18n/i18n-context';
import { computeWallBoxes } from './three-geometry';

interface ThreeViewProps {
  walls: readonly PublicWall[];
  openings: readonly PublicOpening[];
  rooms: readonly PublicRoom[];
  points: readonly PublicPoint[];
  routes: readonly PublicRoute[];
  metersPerUnit: number | null;
  viewport: { x: number; y: number; zoom: number };
  selectedWallId: string | null;
  selectedRoomId: string | null;
  selectedPointId: string | null;
  selectedRouteId: string | null;
  onSelect?: (target: {
    kind: 'wall' | 'room' | 'point' | 'route';
    id: string;
  }) => void;
}

const WALL_COLOR = 0xe2e8f0;
const FLOOR_COLOR = 0x0f172a;
const POINT_COLOR = 0xfbbf24;
const ROUTE_COLOR = 0xfb923c;

function disposeGroup(group: THREE.Group): void {
  for (const child of [...group.children]) {
    group.remove(child);
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material.dispose();
      }
    }
  }
}

export function ThreeView({
  walls,
  openings,
  rooms,
  points,
  routes,
  metersPerUnit,
  viewport,
  selectedWallId,
  selectedRoomId,
  selectedPointId,
  selectedRouteId,
  onSelect,
}: ThreeViewProps) {
  const { t } = useI18n();
  const [showPoints, setShowPoints] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showWalls, setShowWalls] = useState(true);
  const [showRooms, setShowRooms] = useState(true);
  const [showCeiling, setShowCeiling] = useState(false);
  const [isolate, setIsolate] = useState(false);
  const [mode, setMode] = useState<'orbit' | 'walk' | 'third'>('orbit');
  const [xray, setXray] = useState(false);
  const [daylight, setDaylight] = useState(false);
  const [sectionEnabled, setSectionEnabled] = useState(false);
  const [sectionHeight, setSectionHeight] = useState(1.6);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef(new THREE.Group());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const metersPerUnitRef = useRef(metersPerUnit);
  metersPerUnitRef.current = metersPerUnit;
  const walkRef = useRef({
    yaw: 0,
    pitch: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    keys: new Set<string>(),
  });
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const fillRef = useRef<THREE.DirectionalLight | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const fitSignatureRef = useRef<string | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100_000);
    camera.position.set(400, 500, 700);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(400, 0, 300);
    controlsRef.current = controls;

    const ambient = new THREE.AmbientLight(0xffffff, 1.4);
    ambientRef.current = ambient;
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(600, 1200, 400);
    sunRef.current = sun;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x93c5fd, 0.7);
    fill.position.set(-800, 600, -600);
    fillRef.current = fill;
    scene.add(fill);
    scene.add(contentRef.current);

    const pick = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const hits = raycaster.intersectObjects(contentRef.current.children, true);
      const hit = hits.find((entry) => entry.object.userData?.id);

      if (!hit) return;

      const { kind, id } = hit.object.userData as {
        kind?: 'wall' | 'room' | 'point' | 'route';
        id?: string;
      };

      if (kind && id) onSelectRef.current?.({ kind, id });
    };
    const handlePointerDown = (event: PointerEvent) => {
      pointerStartRef.current = { x: event.clientX, y: event.clientY };
    };
    const handlePointerUp = (event: PointerEvent) => {
      const start = pointerStartRef.current;
      pointerStartRef.current = null;

      if (
        start &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) < 5
      ) {
        pick(event);
      }
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let frame = 0;
    let lastTime = performance.now();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (modeRef.current === 'walk') {
        const walk = walkRef.current;
        camera.rotation.set(walk.pitch, walk.yaw, 0, 'YXZ');
        const scale = metersPerUnitRef.current;
        const speed = scale ? 2.4 / scale : 240;
        const forward = Number(walk.keys.has('w')) - Number(walk.keys.has('s'));
        const strafe = Number(walk.keys.has('d')) - Number(walk.keys.has('a'));

        if (forward !== 0 || strafe !== 0) {
          const length = Math.hypot(forward, strafe) || 1;
          const yaw = walk.yaw;
          camera.position.x +=
            ((-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) / length) *
            speed *
            delta;
          camera.position.z +=
            ((-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) / length) *
            speed *
            delta;
        }

        if (scale) camera.position.y = 1.6 / scale;
      } else {
        controls.update();
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      controls.dispose();
      disposeGroup(contentRef.current);
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      ambientRef.current = null;
      sunRef.current = null;
      fillRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.background = new THREE.Color(daylight ? 0xf1f5f9 : 0x020617);
    if (ambientRef.current) ambientRef.current.intensity = daylight ? 2.2 : 1.4;
    if (sunRef.current) sunRef.current.intensity = daylight ? 3.2 : 2;
    if (fillRef.current) fillRef.current.intensity = daylight ? 1.1 : 0.7;
  }, [daylight]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.localClippingEnabled = true;
    const heightUnits = metersPerUnit
      ? sectionHeight / metersPerUnit
      : sectionHeight * 60;
    renderer.clippingPlanes = sectionEnabled
      ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), heightUnits)]
      : [];
  }, [sectionEnabled, sectionHeight, metersPerUnit]);

  useEffect(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;

    if (mode === 'walk') {
      controls.enabled = false;
      camera.rotation.order = 'YXZ';
      const eye = metersPerUnit ? 1.6 / metersPerUnit : 160;
      const target = controls.target;
      camera.position.set(target.x, eye, target.z);
      walkRef.current.yaw = Math.PI;
      walkRef.current.pitch = -0.05;
      return;
    }

    controls.enabled = true;

    if (mode === 'third') {
      const distance = metersPerUnit ? 8 / metersPerUnit : 800;
      const target = controls.target;
      camera.position.set(
        target.x + distance * 0.28,
        distance * 0.35,
        target.z + distance * 0.4,
      );
      camera.lookAt(target);
      controls.update();
    }
  }, [mode, metersPerUnit]);

  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas) return;

    const walk = walkRef.current;
    const handleDown = (event: PointerEvent) => {
      if (modeRef.current !== 'walk') return;
      walk.dragging = true;
      walk.lastX = event.clientX;
      walk.lastY = event.clientY;
    };
    const handleMove = (event: PointerEvent) => {
      if (modeRef.current !== 'walk' || !walk.dragging) return;
      walk.yaw -= (event.clientX - walk.lastX) * 0.005;
      walk.pitch = Math.max(
        -1.2,
        Math.min(1.2, walk.pitch - (event.clientY - walk.lastY) * 0.005),
      );
      walk.lastX = event.clientX;
      walk.lastY = event.clientY;
    };
    const handleUp = () => {
      walk.dragging = false;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (modeRef.current !== 'walk') return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
        walk.keys.add(key);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      walk.keys.delete(event.key.toLowerCase());
    };
    const handleBlur = () => walk.keys.clear();

    canvas.addEventListener('pointerdown', handleDown);
    canvas.addEventListener('pointermove', handleMove);
    canvas.addEventListener('pointerup', handleUp);
    canvas.addEventListener('pointerleave', handleUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      canvas.removeEventListener('pointerdown', handleDown);
      canvas.removeEventListener('pointermove', handleMove);
      canvas.removeEventListener('pointerup', handleUp);
      canvas.removeEventListener('pointerleave', handleUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    const group = contentRef.current;
    disposeGroup(group);

    const wallHeight = metersPerUnit ? 2.7 / metersPerUnit : 100;
    const thickness = Math.max(
      1,
      walls.reduce((sum, wall) => sum + (wall.thickness ?? 0), 0) /
        Math.max(1, walls.length) || 8,
    );

    const wallMaterial = new THREE.MeshStandardMaterial({
      color: WALL_COLOR,
      roughness: 0.85,
      transparent: xray,
      opacity: xray ? 0.22 : 1,
    });
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: FLOOR_COLOR,
      roughness: 0.95,
      side: THREE.DoubleSide,
      transparent: xray,
      opacity: xray ? 0.35 : 1,
    });
    const visibleRooms =
      isolate && selectedRoomId
        ? rooms.filter((room) => room.id === selectedRoomId)
        : rooms;
    const visibleWalls =
      isolate && selectedWallId
        ? walls.filter((wall) => wall.id === selectedWallId)
        : walls;
    const visiblePoints =
      isolate && selectedPointId
        ? points.filter((point) => point.id === selectedPointId)
        : points;
    const visibleRoutes =
      isolate && selectedRouteId
        ? routes.filter((route) => route.id === selectedRouteId)
        : routes;

    if (showRooms) for (const room of visibleRooms) {
      const shape = new THREE.Shape(
        room.boundary.map(
          (point) => new THREE.Vector2(point.x, -point.y),
        ),
      );
      const floorGeometry = new THREE.ShapeGeometry(shape);
      const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial.clone());
      floorMesh.userData = { kind: 'room', id: room.id };
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.y = 0.5;
      if (room.id === selectedRoomId) {
        (floorMesh.material as THREE.MeshStandardMaterial).color.set(0xfbbf24);
      }
      group.add(floorMesh);

      if (showCeiling) {
        const ceilingMesh = new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 1,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
          }),
        );
        ceilingMesh.rotation.x = -Math.PI / 2;
        ceilingMesh.position.y = wallHeight;
        group.add(ceilingMesh);
      }
    }

    if (showWalls) for (const wall of visibleWalls) {
      const boxes = computeWallBoxes(
        wall.geometry,
        openings
          .filter((opening) => opening.wallId === wall.id)
          .map((opening) => ({
            offset: opening.offset,
            width: opening.width,
            type: opening.type,
            sillHeight: opening.sillHeight,
            height: opening.height,
          })),
        wallHeight,
      );

      for (const box of boxes) {
        const length = Math.hypot(box.b.x - box.a.x, box.b.y - box.a.y);
        if (length <= 0) continue;
        const height = box.z1 - box.z0;
        const geometry = new THREE.BoxGeometry(length, height, thickness);
        const material =
          wall.id === selectedWallId
            ? new THREE.MeshStandardMaterial({
                color: 0xfbbf24,
                roughness: 0.7,
                transparent: xray,
                opacity: xray ? 0.35 : 1,
              })
            : wallMaterial;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { kind: 'wall', id: wall.id };
        mesh.position.set(
          (box.a.x + box.b.x) / 2,
          (box.z0 + box.z1) / 2,
          (box.a.y + box.b.y) / 2,
        );
        mesh.rotation.y = -Math.atan2(box.b.y - box.a.y, box.b.x - box.a.x);
        group.add(mesh);
      }
    }

    if (showPoints) {
      for (const point of visiblePoints) {
        const selected = point.id === selectedPointId;
        const geometry = new THREE.CylinderGeometry(
          selected ? 16 : 10,
          selected ? 16 : 10,
          selected ? 26 : 18,
          16,
        );
        const material = new THREE.MeshStandardMaterial({
          color: selected ? 0xf472b6 : POINT_COLOR,
          emissive: selected ? 0xf472b6 : POINT_COLOR,
          emissiveIntensity: 0.3,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData = { kind: 'point', id: point.id };
        mesh.position.set(point.x, 10, point.y);
        group.add(mesh);
      }
    }

    if (showRoutes) {
      for (const route of visibleRoutes) {
        const geometry = new THREE.BufferGeometry().setFromPoints(
          route.geometry.map(
            (point) => new THREE.Vector3(point.x, 4, point.y),
          ),
        );
        const material = new THREE.LineBasicMaterial({
          color: route.id === selectedRouteId ? 0xf472b6 : ROUTE_COLOR,
        });
        const line = new THREE.Line(geometry, material);
        line.userData = { kind: 'route', id: route.id };
        group.add(line);

        for (const [end, pinned] of [
          ['start', route.startPointId],
          ['end', route.endPointId],
        ] as const) {
          if (!pinned) continue;
          const at =
            end === 'start'
              ? route.geometry[0]
              : route.geometry[route.geometry.length - 1];
          if (!at) continue;

          const marker = new THREE.Mesh(
            new THREE.SphereGeometry(10, 12, 8),
            new THREE.MeshStandardMaterial({
              color: end === 'start' ? 0x38bdf8 : 0x34d399,
              emissive: end === 'start' ? 0x38bdf8 : 0x34d399,
              emissiveIntensity: 0.45,
            }),
          );
          marker.userData = { kind: 'route', id: route.id };
          marker.position.set(at.x, 4, at.y);
          group.add(marker);
        }
      }
    }

    const bounds = new THREE.Box3();
    for (const wall of walls) {
      for (const point of wall.geometry) {
        bounds.expandByPoint(new THREE.Vector3(point.x, 0, point.y));
      }
    }
    if (!bounds.isEmpty()) {
      const signature = `${bounds.min.x.toFixed(2)}:${bounds.min.z.toFixed(2)}:${bounds.max.x.toFixed(2)}:${bounds.max.z.toFixed(2)}`;

      // Refit only when the plan geometry changes, not when selection changes,
      // so clicking in the split view does not move the camera.
      if (fitSignatureRef.current !== signature) {
        fitSignatureRef.current = signature;
        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        bounds.getCenter(center);
        bounds.getSize(size);
        const distance = Math.max(size.x, size.z, 100) * 1.4;
        if (cameraRef.current) {
          cameraRef.current.position.set(
            center.x + distance * 0.8,
            distance * 0.9,
            center.z + distance * 0.8,
          );
          cameraRef.current.lookAt(center);
        }
        if (controlsRef.current) {
          controlsRef.current.target.copy(center);
          controlsRef.current.update();
        }
      }
    }
  }, [
    walls,
    openings,
    rooms,
    points,
    routes,
    metersPerUnit,
    showPoints,
    showRoutes,
    showWalls,
    showRooms,
    showCeiling,
    isolate,
    xray,
    selectedWallId,
    selectedRoomId,
    selectedPointId,
    selectedRouteId,
  ]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.target.set(viewport.x, 0, viewport.y);
    controls.update();
  }, [viewport.x, viewport.y]);

  async function exportGlb() {
    setExporting(true);
    setError(null);
    try {
      const exporter = new GLTFExporter();
      const result = await exporter.parseAsync(contentRef.current, {
        binary: true,
      });
      const blob = new Blob([result as ArrayBuffer], {
        type: 'model/gltf-binary',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'drawing-3d.glb';
      link.click();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : t('editor.exportFailed'),
      );
    } finally {
      setExporting(false);
    }
  }

  const hasSelection = Boolean(
    selectedWallId || selectedRoomId || selectedPointId || selectedRouteId,
  );

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute top-3 left-3 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        <Box className="h-4 w-4 text-amber-300" />
        {t('editor.threeViewHint')}
      </div>
      <div className="absolute top-16 left-3 flex flex-col gap-1 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showWalls}
            onChange={(event) => setShowWalls(event.target.checked)}
          />
          {t('editor.walls')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showRooms}
            onChange={(event) => setShowRooms(event.target.checked)}
          />
          {t('editor.rooms')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showPoints}
            onChange={(event) => setShowPoints(event.target.checked)}
          />
          {t('editor.points')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showRoutes}
            onChange={(event) => setShowRoutes(event.target.checked)}
          />
          {t('editor.routes')}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showCeiling}
            onChange={(event) => setShowCeiling(event.target.checked)}
          />
          {t('editor.ceiling')}
        </label>
      </div>
      <button
        type="button"
        onClick={() => void exportGlb()}
        disabled={exporting}
        className="absolute top-3 right-3 inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-slate-950/90 px-3 text-xs text-slate-200 backdrop-blur hover:bg-white/10"
      >
        {exporting ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        GLB
      </button>
      <div className="absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-slate-950/90 p-1.5 text-[11px] text-slate-300 backdrop-blur">
        {(
          [
            ['orbit', t('editor.viewOrbit')],
            ['walk', t('editor.viewWalk')],
            ['third', t('editor.viewThird')],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-lg px-2 py-1 transition ${
              mode === value
                ? 'bg-amber-400 text-slate-950'
                : 'hover:bg-white/10 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-white/10" />
        <button
          type="button"
          aria-pressed={xray}
          onClick={() => setXray((value) => !value)}
          className={`rounded-lg px-2 py-1 transition ${
            xray ? 'bg-sky-400/20 text-sky-200' : 'hover:bg-white/10'
          }`}
        >
          {t('editor.xray')}
        </button>
        <button
          type="button"
          aria-pressed={daylight}
          onClick={() => setDaylight((value) => !value)}
          className={`rounded-lg px-2 py-1 transition ${
            daylight ? 'bg-amber-300 text-slate-950' : 'hover:bg-white/10'
          }`}
        >
          {t('editor.daylight')}
        </button>
        <button
          type="button"
          aria-pressed={isolate}
          disabled={!hasSelection}
          onClick={() => setIsolate((value) => !value)}
          className={`rounded-lg px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-40 ${
            isolate ? 'bg-emerald-400/20 text-emerald-200' : 'hover:bg-white/10'
          }`}
          title={t('editor.isolateHint')}
        >
          {t('editor.isolate')}
        </button>
        <label className="flex items-center gap-1.5 rounded-lg px-1.5 py-1">
          <input
            type="checkbox"
            checked={sectionEnabled}
            onChange={(event) => setSectionEnabled(event.target.checked)}
          />
          {t('editor.section')}
        </label>
        {sectionEnabled ? (
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">{t('editor.sectionHeight')}</span>
            <input
              type="range"
              min={0.3}
              max={3}
              step={0.1}
              value={sectionHeight}
              onChange={(event) => setSectionHeight(Number(event.target.value))}
              className="w-20 accent-amber-400"
            />
            <span className="w-9 tabular-nums text-slate-400">
              {sectionHeight.toFixed(1)}m
            </span>
          </label>
        ) : null}
      </div>

      {mode === 'walk' ? (
        <p className="pointer-events-none absolute right-3 bottom-20 rounded-lg border border-white/10 bg-slate-950/90 px-2.5 py-1 text-[11px] text-slate-300 backdrop-blur">
          {t('editor.walkHint')}
        </p>
      ) : null}

      {error ? (
        <p className="absolute bottom-3 right-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </p>
      ) : null}
    </div>
  );
}
