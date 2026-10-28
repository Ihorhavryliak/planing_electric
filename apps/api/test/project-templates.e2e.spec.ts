import type {
  PlanDrawing,
  PublicFloor,
  PublicPlan,
  PublicProject,
  PublicProjectTemplate,
  PublicUser,
} from '@drawmyplace/contracts';
import { projectTemplates } from '@drawmyplace/database';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { templateRows } from '../../../packages/database/src/seed/templates';
import { createTestApp, type TestApp } from './create-test-app';

const API = '/api/v1';
const PASSWORD = 'correct-horse-battery';

interface HeaderCarrier {
  headers: Record<string, string | string[] | undefined>;
}

function cookiePair(response: HeaderCarrier): string {
  const header = response.headers['set-cookie'];
  const values = Array.isArray(header)
    ? header
    : typeof header === 'string'
      ? [header]
      : [];
  const pair = values[0]?.split(';')[0];

  if (!pair) throw new Error('Expected a session cookie');

  return pair;
}

describe('project templates', () => {
  let testApp: TestApp;
  let cookie = '';

  beforeAll(async () => {
    testApp = await createTestApp();

    await testApp.database.db
      .insert(projectTemplates)
      .values(templateRows());

    const register = await request(testApp.app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({
        email: 'templates@example.com',
        password: PASSWORD,
        name: 'Templates User',
      })
      .expect(201);

    cookie = cookiePair(register);
    const user = register.body as PublicUser;

    expect(user.email).toBe('templates@example.com');
  });

  afterAll(async () => {
    await testApp.close();
  });

  function server(): request.SuperTest<request.Test> {
    return request(testApp.app.getHttpServer());
  }

  it('lists the public catalog without the drawing payload', async () => {
    const response = await server()
      .get(`${API}/project-templates`)
      .expect(200);
    const templates = response.body as PublicProjectTemplate[];

    expect(templates).toHaveLength(4);
    expect(templates.map((template) => template.code)).toEqual([
      'apartment_1br',
      'apartment_2br',
      'house_2fl',
      'office_open',
    ]);
    expect(templates.every((template) => template.previewSvg.length > 0)).toBe(
      true,
    );
    expect(
      templates.every(
        (template) =>
          !('planPayload' in (template as unknown as Record<string, unknown>)),
      ),
    ).toBe(true);
    expect(templates[1]?.roomsCount).toBe(3);
    expect(templates[1]?.devicesCount).toBe(10);
    expect(templates[1]?.circuitsCount).toBe(3);
  });

  it('returns one template by code and 404 for unknown codes', async () => {
    const response = await server()
      .get(`${API}/project-templates/apartment_1br`)
      .expect(200);
    const template = response.body as PublicProjectTemplate;

    expect(template.name.ua).toContain('квартира');
    expect(template.roomsCount).toBe(1);

    await server().get(`${API}/project-templates/nope`).expect(404);
  });

  it('creates a complete project from a template in one transaction', async () => {
    const created = await server()
      .post(`${API}/projects`)
      .set('Cookie', cookie)
      .send({ templateCode: 'apartment_2br' })
      .expect(201);
    const project = created.body as PublicProject;

    expect(project.name).toBe('2-bedroom apartment · 55 m²');

    const floorsResponse = await server()
      .get(`${API}/projects/${project.id}/floors`)
      .set('Cookie', cookie)
      .expect(200);
    const floors = floorsResponse.body as PublicFloor[];

    expect(floors).toHaveLength(1);
    expect(floors[0]?.name).toBe('Floor 1');

    const plan = floors[0]?.plan;

    expect(plan).not.toBeNull();

    if (!plan) return;

    const drawingResponse = await server()
      .get(`${API}/plans/${plan.id}/drawing`)
      .set('Cookie', cookie)
      .expect(200);
    const drawing = drawingResponse.body as PlanDrawing;

    expect(drawing.walls.length).toBeGreaterThanOrEqual(8);
    expect(drawing.rooms.length).toBeGreaterThanOrEqual(3);
    expect(drawing.points.length).toBeGreaterThanOrEqual(10);
    expect(drawing.routes.length).toBeGreaterThanOrEqual(8);
    expect(drawing.calibration).not.toBeNull();
    expect(drawing.calibration?.metersPerUnit).toBeCloseTo(0.01);

    const planResponse = await server()
      .get(`${API}/plans/${plan.id}`)
      .set('Cookie', cookie)
      .expect(200);
    const planBody = planResponse.body as PublicPlan;

    expect(planBody.calculationSettings.circuits?.length).toBe(3);

    // Every route keeps the circuit code from the template.
    expect(
      drawing.routes.every((route) =>
        ['L1', 'L2', 'S1'].includes(route.circuitId ?? ''),
      ),
    ).toBe(true);
  });

  it('creates a blank project when no template code is sent', async () => {
    const response = await server()
      .post(`${API}/projects`)
      .set('Cookie', cookie)
      .send({ name: 'Blank project' })
      .expect(201);

    expect((response.body as PublicProject).name).toBe('Blank project');
  });

  it('rejects an unknown template code with a field error', async () => {
    const response = await server()
      .post(`${API}/projects`)
      .set('Cookie', cookie)
      .send({ templateCode: 'unknown_template' })
      .expect(400);

    expect(JSON.stringify(response.body)).toContain('template');
  });

  it('requires a session to create projects from templates', async () => {
    await server()
      .post(`${API}/projects`)
      .send({ templateCode: 'apartment_1br' })
      .expect(401);
  });
});
