import { describe, expect, it } from 'vitest';
import {
  createLocalProject,
  emptyDrawing,
  isLocalProject,
} from './local-db';

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
  });
});
