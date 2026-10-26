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
import { computeWallBoxes } from './three-geometry';

interface ThreeViewProps {
  walls: readonly PublicWall[];
  openings: readonly PublicOpening[];
  rooms: readonly PublicRoom[];
  points: readonly PublicPoint[];
  routes: readonly PublicRoute[];
  metersPerUnit: number | null;
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
}: ThreeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef(new THREE.Group());
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(600, 1200, 400);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x93c5fd, 0.7);
    fill.position.set(-800, 600, -600);
    scene.add(fill);
    scene.add(contentRef.current);

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
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      disposeGroup(contentRef.current);
      renderer.dispose();
      renderer.domElement.remove();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
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
    });
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: FLOOR_COLOR,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });

    for (const room of rooms) {
      const shape = new THREE.Shape(
        room.boundary.map(
          (point) => new THREE.Vector2(point.x, -point.y),
        ),
      );
      const geometry = new THREE.ShapeGeometry(shape);
      const mesh = new THREE.Mesh(geometry, floorMaterial.clone());
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.5;
      group.add(mesh);
    }

    for (const wall of walls) {
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
        const mesh = new THREE.Mesh(geometry, wallMaterial);
        mesh.position.set(
          (box.a.x + box.b.x) / 2,
          (box.z0 + box.z1) / 2,
          (box.a.y + box.b.y) / 2,
        );
        mesh.rotation.y = -Math.atan2(box.b.y - box.a.y, box.b.x - box.a.x);
        group.add(mesh);
      }
    }

    for (const point of points) {
      const geometry = new THREE.CylinderGeometry(10, 10, 18, 16);
      const material = new THREE.MeshStandardMaterial({
        color: POINT_COLOR,
        emissive: POINT_COLOR,
        emissiveIntensity: 0.3,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(point.x, 10, point.y);
      group.add(mesh);
    }

    for (const route of routes) {
      const geometry = new THREE.BufferGeometry().setFromPoints(
        route.geometry.map(
          (point) => new THREE.Vector3(point.x, 4, point.y),
        ),
      );
      const material = new THREE.LineBasicMaterial({ color: ROUTE_COLOR });
      group.add(new THREE.Line(geometry, material));
    }

    const bounds = new THREE.Box3();
    for (const wall of walls) {
      for (const point of wall.geometry) {
        bounds.expandByPoint(new THREE.Vector3(point.x, 0, point.y));
      }
    }
    if (!bounds.isEmpty()) {
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
  }, [walls, openings, rooms, points, routes, metersPerUnit]);

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
        exportError instanceof Error ? exportError.message : 'Export failed',
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute top-3 left-3 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs text-slate-300 backdrop-blur">
        <Box className="h-4 w-4 text-amber-300" />
        3D view · drag to orbit, scroll to zoom
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
      {error ? (
        <p className="absolute bottom-3 left-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
          {error}
        </p>
      ) : null}
    </div>
  );
}
