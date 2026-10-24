import type { EditorViewport, UnderlaySettings } from '@drawmyplace/contracts';
import {
  Hand,
  Maximize2,
  MousePointer2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { cn } from '@/lib/utils';

type EditorTool = 'select' | 'pan';
type DragMode = 'pan' | 'underlay';

const MIN_ZOOM = 0.02;
const MAX_ZOOM = 8;
const DEFAULT_BLANK_WIDTH = 1200;
const DEFAULT_BLANK_HEIGHT = 800;

interface DragState {
  mode: DragMode;
  pointerId: number;
  startX: number;
  startY: number;
  startViewport: EditorViewport;
  startUnderlay: UnderlaySettings;
  zoom: number;
}

interface EditorCanvasProps {
  image: HTMLImageElement | null;
  underlay: UnderlaySettings;
  viewport: EditorViewport;
  autoFit: boolean;
  onUnderlayChange: (underlay: UnderlaySettings) => void;
  onViewportChange: (viewport: EditorViewport) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function niceStep(target: number): number {
  const power = 10 ** Math.floor(Math.log10(target));
  const normalized = target / power;

  if (normalized <= 1) {
    return power;
  }

  if (normalized <= 2) {
    return 2 * power;
  }

  if (normalized <= 5) {
    return 5 * power;
  }

  return 10 * power;
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
  onUnderlayChange,
  onViewportChange,
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

  const imageRef = useRef(image);
  const underlayRef = useRef(underlay);
  const viewportRef = useRef(viewport);
  const toolRef = useRef(tool);
  const spaceRef = useRef(spaceDown);
  const sizeRef = useRef(size);
  const onUnderlayChangeRef = useRef(onUnderlayChange);
  const onViewportChangeRef = useRef(onViewportChange);

  imageRef.current = image;
  underlayRef.current = underlay;
  viewportRef.current = viewport;
  toolRef.current = tool;
  spaceRef.current = spaceDown;
  sizeRef.current = size;
  onUnderlayChangeRef.current = onUnderlayChange;
  onViewportChangeRef.current = onViewportChange;

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
  }, [size, viewport, underlay, image]);

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

  function handlePointerDown(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    if (event.button !== 0 && event.button !== 1) {
      return;
    }

    event.preventDefault();

    const point = localPoint(event);
    const hitsUnderlay =
      event.button === 0 &&
      toolRef.current === 'select' &&
      !spaceRef.current &&
      pointHitsUnderlay(point.x, point.y);
    const mode: DragMode = hitsUnderlay ? 'underlay' : 'pan';

    dragRef.current = {
      mode,
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      startViewport: { ...viewportRef.current },
      startUnderlay: { ...underlayRef.current },
      zoom: viewportRef.current.zoom,
    };

    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(
    event: ReactPointerEvent<HTMLCanvasElement>,
  ) {
    const point = localPoint(event);
    const drag = dragRef.current;

    if (!drag) {
      if (toolRef.current === 'select' && !spaceRef.current) {
        setHoveringUnderlay(pointHitsUnderlay(point.x, point.y));
      } else if (hoveringUnderlay) {
        setHoveringUnderlay(false);
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

  function finishDragging(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setDragging(false);

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

      if (event.code === 'Space') {
        event.preventDefault();
        setSpaceDown(true);
        return;
      }

      if (event.key === 'v' || event.key === 'V') {
        setTool('select');
      } else if (event.key === 'h' || event.key === 'H') {
        setTool('pan');
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
      : hoveringUnderlay
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
        onPointerLeave={() => setHoveringUnderlay(false)}
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
        Drag to pan · Scroll to zoom · Space to pan
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
