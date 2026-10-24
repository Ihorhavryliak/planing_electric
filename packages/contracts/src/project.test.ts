import { describe, expect, it } from 'vitest';
import {
  createProjectSchema,
  projectListQuerySchema,
  publicProjectSchema,
  updateProjectSchema,
} from './project';

describe('project contracts', () => {
  it('trims project input and accepts an optional description', () => {
    expect(
      createProjectSchema.parse({
        name: '  Apartment  ',
        description: '  Ground floor  ',
      }),
    ).toEqual({
      name: 'Apartment',
      description: 'Ground floor',
    });

    expect(createProjectSchema.parse({ name: 'House' })).toEqual({
      name: 'House',
    });
  });

  it('rejects an empty project name', () => {
    expect(createProjectSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('requires at least one field for an update', () => {
    const result = updateProjectSchema.safeParse({});

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Provide at least one field to update',
      );
    }
  });

  it('defaults the list filter to active projects', () => {
    expect(projectListQuerySchema.parse({})).toEqual({ status: 'active' });
    expect(projectListQuerySchema.parse({ status: 'all' })).toEqual({
      status: 'all',
    });
    expect(projectListQuerySchema.safeParse({ status: 'deleted' }).success).toBe(
      false,
    );
  });

  it('validates the public project shape', () => {
    const project = publicProjectSchema.parse({
      id: '7d03f7d0-8ca7-4f53-9851-c8d3f2bd5f86',
      name: 'House',
      description: null,
      status: 'active',
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(project.status).toBe('active');
  });
});
