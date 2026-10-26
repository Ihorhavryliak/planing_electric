import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LOCAL_DB_NAME,
  LocalConflictError,
  LocalStorageLimitError,
  MAX_LOCAL_PROJECTS,
  MAX_LOCAL_PROJECT_BYTES,
  createLocalProject,
  deleteLocalProject,
  emptyDrawing,
  getLocalProject,
  isLocalProject,
  listLocalProjects,
  localProjectSize,
  normalizeLocalProject,
  saveLocalProject,
} from './local-db';

async function resetDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LOCAL_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe('local projects', () => {
  it('creates an empty project with a stable shape', () => {
    const project = createLocalProject('Test local');
    expect(project.name).toBe('Test local');
    expect(project.drawing).toEqual(emptyDrawing());
    expect(project.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(isLocalProject(project)).toBe(true);
  });

  it('rejects unrelated JSON payloads', () => {
    expect(isLocalProject(null)).toBe(false);
    expect(isLocalProject({ name: 'x' })).toBe(false);
    expect(isLocalProject({ id: '1', name: 'x', drawing: {}, viewport: {} })).toBe(
      true,
    );
    expect(normalizeLocalProject({ name: 'x' })).toBeNull();
  });

  it('migrates partial snapshots by filling missing collections', () => {
    const normalized = normalizeLocalProject({
      id: 'legacy',
      name: 'Legacy',
      drawing: {
        walls: [],
        points: [{ id: 'p1' }],
      },
      viewport: { x: 1, y: 2, zoom: 0 },
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.drawing.calibration).toBeNull();
    expect(normalized?.drawing.rooms).toEqual([]);
    expect(normalized?.drawing.routes).toEqual([]);
    expect(normalized?.drawing.points).toHaveLength(1);
    expect(normalized?.viewport).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('round-trips projects through IndexedDB and sorts by update time', async () => {
    const first = createLocalProject('First');
    const second = {
      ...createLocalProject('Second'),
      updatedAt: new Date(Date.now() + 1000).toISOString(),
    };

    await saveLocalProject(first);
    await saveLocalProject(second);

    const list = await listLocalProjects();
    expect(list.map((project) => project.name)).toEqual(['Second', 'First']);
    expect(await getLocalProject(first.id)).toMatchObject({ name: 'First' });

    await deleteLocalProject(first.id);
    expect(await getLocalProject(first.id)).toBeUndefined();
  });

  it('rejects a project larger than the per-project limit', async () => {
    const project = createLocalProject('Huge');
    project.name = 'x'.repeat(MAX_LOCAL_PROJECT_BYTES + 1);
    expect(localProjectSize(project)).toBeGreaterThan(MAX_LOCAL_PROJECT_BYTES);

    await expect(saveLocalProject(project)).rejects.toBeInstanceOf(
      LocalStorageLimitError,
    );
  });

  it('rejects new projects once the project-count limit is reached', async () => {
    for (let index = 0; index < MAX_LOCAL_PROJECTS; index += 1) {
      await saveLocalProject(createLocalProject(`Project ${index}`));
    }

    await expect(
      saveLocalProject(createLocalProject('One too many')),
    ).rejects.toBeInstanceOf(LocalStorageLimitError);
  });

  it('detects concurrent edits through the expected revision', async () => {
    const project = createLocalProject('Concurrent');
    await saveLocalProject(project);

    const stale = { ...project, name: 'Stale edit', updatedAt: project.updatedAt };
    const newer = {
      ...project,
      name: 'Newer edit',
      updatedAt: new Date(Date.now() + 5000).toISOString(),
    };
    await saveLocalProject(newer);

    await expect(
      saveLocalProject(stale, { expectedUpdatedAt: project.updatedAt }),
    ).rejects.toBeInstanceOf(LocalConflictError);
  });
});
