import { describe, expect, it } from 'vitest';
import {
  createProjectBodySchema,
  projectTemplateCodeSchema,
  publicProjectTemplateSchema,
} from './project-templates';

describe('project template contracts', () => {
  it('accepts a template code without a name', () => {
    expect(
      createProjectBodySchema.parse({ templateCode: 'apartment_2br' }),
    ).toEqual({ templateCode: 'apartment_2br' });
  });

  it('still accepts a plain project name', () => {
    expect(createProjectBodySchema.parse({ name: '  House  ' })).toEqual({
      name: 'House',
    });
  });

  it('requires a name or a template code', () => {
    expect(createProjectBodySchema.safeParse({}).success).toBe(false);
  });

  it('rejects unsafe template codes', () => {
    expect(projectTemplateCodeSchema.safeParse('Flat 1').success).toBe(false);
    expect(projectTemplateCodeSchema.safeParse('APARTMENT').success).toBe(
      false,
    );
    expect(projectTemplateCodeSchema.safeParse('office_open').success).toBe(
      true,
    );
  });

  it('validates the public template shape', () => {
    const template = publicProjectTemplateSchema.parse({
      id: '7d03f7d0-8ca7-4f53-9851-c8d3f2bd5f86',
      code: 'apartment_1br',
      name: { ua: 'Квартира', en: 'Apartment' },
      description: { ua: '35 м²', en: '35 m²' },
      previewSvg: '<svg/>',
      roomsCount: 1,
      devicesCount: 5,
      circuitsCount: 2,
    });

    expect(template.code).toBe('apartment_1br');
  });
});
