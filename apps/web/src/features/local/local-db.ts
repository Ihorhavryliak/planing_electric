import type {
  PublicCalibration,
  PublicDimension,
  PublicOpening,
  PublicPoint,
  PublicRoom,
  PublicRoute,
  PublicWall,
} from '@drawmyplace/contracts';

const DB_NAME = 'drawmyplace-local';
const DB_VERSION = 1;
const STORE = 'projects';

export interface LocalDrawing {
  calibration: PublicCalibration | null;
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

export function emptyDrawing(): LocalDrawing {
  return {
    calibration: null,
    walls: [],
    rooms: [],
    openings: [],
    dimensions: [],
    points: [],
    routes: [],
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
      }),
  );
}

export function listLocalProjects(): Promise<LocalProject[]> {
  return run<LocalProject[]>('readonly', (store) => store.getAll()).then(
    (projects) =>
      projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  );
}

export function getLocalProject(id: string): Promise<LocalProject | undefined> {
  return run<LocalProject | undefined>('readonly', (store) => store.get(id));
}

export function saveLocalProject(project: LocalProject): Promise<IDBValidKey> {
  return run('readwrite', (store) => store.put(project));
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