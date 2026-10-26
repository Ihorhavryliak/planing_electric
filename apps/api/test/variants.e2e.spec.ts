import type {
  PublicFloor,
  PublicPlan,
  PublicProject,
  PublicUser,
  PublicVariant,
} from '@drawmyplace/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

describe('Project variants API', () => {
  let testApp: TestApp;
  let counter = 0;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  function server(): request.SuperTest<request.Test> {
    return request(testApp.app.getHttpServer());
  }

  async function registerUser() {
    counter += 1;
    const response = await server()
      .post(`${API}/auth/register`)
      .send({
        email: `variant-${counter}@example.com`,
        password: PASSWORD,
        name: `Variant User ${counter}`,
      })
      .expect(201);
    return {
      cookie: cookiePair(response),
      user: response.body as PublicUser,
    };
  }

  async function setupProject(cookie: string) {
    const project = (
      await server()
        .post(`${API}/projects`)
        .set('Cookie', cookie)
        .send({ name: 'Variant project' })
        .expect(201)
    ).body as PublicProject;
    const floor = (
      await server()
        .post(`${API}/projects/${project.id}/floors`)
        .set('Cookie', cookie)
        .send({ name: 'Floor 1' })
        .expect(201)
    ).body as PublicFloor;
    const plan = (
      await server()
        .post(`${API}/floors/${floor.id}/plans`)
        .set('Cookie', cookie)
        .expect(201)
    ).body as PublicPlan;

    await server()
      .put(`${API}/plans/${plan.id}/calibration`)
      .set('Cookie', cookie)
      .send({
        pointA: { x: 0, y: 0 },
        pointB: { x: 100, y: 0 },
        realDistance: 1,
        unit: 'm',
      })
      .expect(200);
    await server()
      .post(`${API}/plans/${plan.id}/routes`)
      .set('Cookie', cookie)
      .send({
        geometry: [
          { x: 0, y: 0 },
          { x: 500, y: 0 },
        ],
      })
      .expect(201);

    return { project, floor, plan };
  }

  it('creates, lists, renames, archives and duplicates variants', async () => {
    const owner = await registerUser();
    const { project } = await setupProject(owner.cookie);

    const created = await server()
      .post(`${API}/projects/${project.id}/variants`)
      .set('Cookie', owner.cookie)
      .send({ name: 'Base' })
      .expect(201);
    const base = created.body as PublicVariant;
    expect(base.name).toBe('Base');
    expect(base.metrics.routeCount).toBe(1);
    expect(base.metrics.totalRequiredLength).toBeCloseTo(5.5, 3);

    const list = (
      await server()
        .get(`${API}/projects/${project.id}/variants`)
        .set('Cookie', owner.cookie)
        .expect(200)
    ).body as PublicVariant[];
    expect(list.map((item) => item.name)).toEqual(['Base']);

    const renamed = await server()
      .patch(`${API}/variants/${base.id}`)
      .set('Cookie', owner.cookie)
      .send({ name: 'Main', status: 'archived' })
      .expect(200);
    expect(renamed.body).toMatchObject({ name: 'Main', status: 'archived' });

    const copy = await server()
      .post(`${API}/variants/${base.id}/duplicate`)
      .set('Cookie', owner.cookie)
      .expect(201);
    expect((copy.body as PublicVariant).name).toBe('Main copy');
  });

  it('denies variant management to electricians and outsiders', async () => {
    const owner = await registerUser();
    const electrician = await registerUser();
    const outsider = await registerUser();
    const { project } = await setupProject(owner.cookie);

    await server()
      .post(`${API}/projects/${project.id}/members`)
      .set('Cookie', owner.cookie)
      .send({ userId: electrician.user.id, role: 'electrician' })
      .expect(201);

    await server()
      .get(`${API}/projects/${project.id}/variants`)
      .set('Cookie', electrician.cookie)
      .expect(403);
    await server()
      .post(`${API}/projects/${project.id}/variants`)
      .set('Cookie', electrician.cookie)
      .send({ name: 'Nope' })
      .expect(403);
    await server()
      .get(`${API}/projects/${project.id}/variants`)
      .set('Cookie', outsider.cookie)
      .expect(403);
  });
});