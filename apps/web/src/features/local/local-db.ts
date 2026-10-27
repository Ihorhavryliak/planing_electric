import type {
  Circuit,
  ElectricalSettings,
  PublicCalibration,
  PublicDimension,
  PublicOpening,
  PublicPoint,
  PublicRoom,
  PublicRoute,
  PublicWall,
  SignalingSettings,
} from '@drawmyplace/contracts';

const DB_NAME = 'drawmyplace-local';
export const LOCAL_DB_NAME = DB_NAME;
const DB_VERSION = 1;
const STORE = 'projects';

/** A browser-local project; everything is kept in IndexedDB. */
export const MAX_LOCAL_PROJECTS = 100;
export const MAX_LOCAL_PROJECT_BYTES = 5 * 1024 * 1024;

export interface LocalDrawing {
  calibration: PublicCalibration | null;
  circuits: Circuit[];
  electrical: ElectricalSettings;
  /** Signaling loops and zones (Phase 20). */
  signaling?: SignalingSettings;
  walls: PublicWall[];
  rooms: PublicRoom[];
  openings: PublicOpening[];
  dimensions: PublicDimension[];
  points: PublicPoint[];
  routes: PublicRoute[];
}

export interface LocalProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  drawing: LocalDrawing;
  viewport: { x: number; y: number; zoom: number };
}

export interface SaveLocalProjectOptions {
  /**
   * Last `updatedAt` the caller loaded. When set, a save is rejected if
   * another tab already wrote a newer revision.
   */
  expectedUpdatedAt?: string | null;
}

export class LocalStorageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalStorageLimitError';
  }
}

export class LocalConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalConflictError';
  }
}

export function emptyDrawing(): LocalDrawing {
  return {
    calibration: null,
    circuits: [],
    electrical: {},
    signaling: { loops: [] },
    walls: [],
    rooms: [],
    openings: [],
    dimensions: [],
    points: [],
    routes: [],
  };
}

/** Bytes needed to persist a project as JSON in IndexedDB. */
export function localProjectSize(project: LocalProject): number {
  return new TextEncoder().encode(JSON.stringify(project)).length;
}

/** Throws when a project cannot be stored safely in this browser. */
export function assertLocalProjectWithinLimits(project: LocalProject): void {
  if (localProjectSize(project) > MAX_LOCAL_PROJECT_BYTES) {
    throw new LocalStorageLimitError(
      `Local project exceeds ${MAX_LOCAL_PROJECT_BYTES} bytes.`,
    );
  }
}

function normalizeDrawing(drawing: Partial<LocalDrawing>): LocalDrawing {
  const array = <T>(value: T[] | undefined): T[] =>
    Array.isArray(value) ? value : [];

  return {
    calibration: drawing.calibration ?? null,
    circuits: array(drawing.circuits),
    electrical:
      drawing.electrical && typeof drawing.electrical === 'object'
        ? drawing.electrical
        : {},
    signaling: {
      loops: Array.isArray(drawing.signaling?.loops)
        ? drawing.signaling.loops
        : [],
    },
    walls: array(drawing.walls),
    rooms: array(drawing.rooms),
    openings: array(drawing.openings),
    dimensions: array(drawing.dimensions),
    points: array(drawing.points),
    routes: array(drawing.routes).map((route) => ({
      ...route,
      startPointId: route.startPointId ?? null,
      endPointId: route.endPointId ?? null,
    })),
  };
}

/**
 * Accepts older or partially valid snapshots and fills missing collections.
 * Returns null when the payload is not a local project at all.
 */
export function normalizeLocalProject(value: unknown): LocalProject | null {
  if (!isLocalProject(value)) {
    return null;
  }

  const candidate = value as LocalProject;
  const viewport =
    candidate.viewport &&
    Number.isFinite(candidate.viewport.x) &&
    Number.isFinite(candidate.viewport.y) &&
    Number.isFinite(candidate.viewport.zoom) &&
    candidate.viewport.zoom > 0
      ? candidate.viewport
      : { x: 0, y: 0, zoom: 1 };

  return {
    id: candidate.id,
    name: candidate.name,
    createdAt:
      typeof candidate.createdAt === 'string'
        ? candidate.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof candidate.updatedAt === 'string'
        ? candidate.updatedAt
        : new Date().toISOString(),
    drawing: normalizeDrawing(candidate.drawing ?? {}),
    viewport,
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
        tx.onabort = () => db.close();
      }),
  );
}

export async function listLocalProjects(): Promise<LocalProject[]> {
  const projects = await run<unknown[]>('readonly', (store) => store.getAll());

  return projects
    .map(normalizeLocalProject)
    .filter((project): project is LocalProject => project !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getLocalProject(
  id: string,
): Promise<LocalProject | undefined> {
  const project = await run<unknown>('readonly', (store) => store.get(id));
  return normalizeLocalProject(project) ?? undefined;
}

/**
 * Persists a project, enforcing size/count limits and an optional optimistic
 * concurrency check against a previously loaded revision.
 */
export async function saveLocalProject(
  project: LocalProject,
  options: SaveLocalProjectOptions = {},
): Promise<void> {
  assertLocalProjectWithinLimits(project);

  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const existingRequest = store.getAll();
        let putQueued = false;

        existingRequest.onsuccess = () => {
          const all = (existingRequest.result as unknown[])
            .map(normalizeLocalProject)
            .filter((item): item is LocalProject => item !== null);
          const existing = all.find((item) => item.id === project.id);

          try {
            if (
              existing &&
              options.expectedUpdatedAt !== undefined &&
              options.expectedUpdatedAt !== null &&
              existing.updatedAt !== options.expectedUpdatedAt
            ) {
              throw new LocalConflictError(
                'Local project was changed in another tab.',
              );
            }

            if (!existing && all.length >= MAX_LOCAL_PROJECTS) {
              throw new LocalStorageLimitError(
                `At most ${MAX_LOCAL_PROJECTS} local projects are supported.`,
              );
            }

            store.put(project);
            putQueued = true;
          } catch (error) {
            reject(error);
            tx.abort();
          }
        };
        existingRequest.onerror = () => reject(existingRequest.error);
        tx.oncomplete = () => {
          db.close();
          if (putQueued) resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
        tx.onabort = () => {
          db.close();
          if (!putQueued) reject(new Error('Local save was aborted.'));
        };
      }),
  );
}

export function deleteLocalProject(id: string): Promise<undefined> {
  return run('readwrite', (store) => store.delete(id));
}

export function createLocalProject(name: string): LocalProject {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    drawing: emptyDrawing(),
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function isLocalProject(value: unknown): value is LocalProject {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LocalProject>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    !!candidate.drawing &&
    !!candidate.viewport
  );
}
