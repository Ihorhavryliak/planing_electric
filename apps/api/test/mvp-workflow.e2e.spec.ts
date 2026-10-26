import type {
  PlanCalculation,
  PlanDrawing,
  PublicEstimate,
  PublicFloor,
  PublicMaterial,
  PublicPlan,
  PublicPoint,
  PublicProject,
  PublicRoute,
  PublicUser,
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

describe('MVP workflow', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  function server(): request.SuperTest<request.Test> {
    return request(testApp.app.getHttpServer());
  }

  it('runs the complete project-to-estimate workflow and persists it', async () => {
    const register = await server()
      .post(`${API}/auth/register`)
      .send({
        email: 'mvp-flow@example.com',
        password: PASSWORD,
        name: 'MVP User',
      })
      .expect(201);
    const cookie = cookiePair(register);
    const user = register.body as PublicUser;

    const projectResponse = await server()
      .post(`${API}/projects`)
      .set('Cookie', cookie)
      .send({ name: 'Test apartment' })
      .expect(201);
    const project = projectResponse.body as PublicProject;

    const floorResponse = await server()
      .post(`${API}/projects/${project.id}/floors`)
      .set('Cookie', cookie)
      .send({ name: 'Floor 1' })
      .expect(201);
    const floor = floorResponse.body as PublicFloor;

    const planResponse = await server()
      .post(`${API}/floors/${floor.id}/plans`)
      .set('Cookie', cookie)
      .expect(201);
    const plan = planResponse.body as PublicPlan;

    // Calibrate: 100 drawing units = 10 m, so 10 units = 1 m.
    await server()
      .put(`${API}/plans/${plan.id}/calibration`)
      .set('Cookie', cookie)
      .send({
        pointA: { x: 0, y: 0 },
        pointB: { x: 100, y: 0 },
        realDistance: 10,
        unit: 'm',
      })
      .expect(200);

    const startPoint = (
      await server()
        .post(`${API}/plans/${plan.id}/points`)
        .set('Cookie', cookie)
        .send({ type: 'socket', x: 0, y: 0 })
        .expect(201)
    ).body as PublicPoint;

    const endPoint = (
      await server()
        .post(`${API}/plans/${plan.id}/points`)
        .set('Cookie', cookie)
        .send({ type: 'socket', x: 240, y: 0 })
        .expect(201)
    ).body as PublicPoint;

    const materials = (
      await server().get(`${API}/materials`).set('Cookie', cookie).expect(200)
    ).body as PublicMaterial[];
    const cable = materials.find((item) => item.category === 'cable');

    const routeResponse = await server()
      .post(`${API}/plans/${plan.id}/routes`)
      .set('Cookie', cookie)
      .send({
        geometry: [
          { x: 0, y: 0 },
          { x: 240, y: 0 },
        ],
        materialId: cable?.id ?? null,
        circuitId: 'L1',
        startPointId: startPoint.id,
        endPointId: endPoint.id,
      })
      .expect(201);
    const route = routeResponse.body as PublicRoute;
    expect(route.startPointId).toBe(startPoint.id);
    expect(route.endPointId).toBe(endPoint.id);

    const calculation = (
      await server()
        .get(`${API}/plans/${plan.id}/calculation`)
        .set('Cookie', cookie)
        .expect(200)
    ).body as PlanCalculation;
    expect(calculation.totalRequiredLength).toBeGreaterThan(0);

    // A stricter circuit limit produces validation warnings on the estimate.
    await server()
      .patch(`${API}/plans/${plan.id}`)
      .set('Cookie', cookie)
      .send({
        calculationSettings: { validation: { maxCircuitLengthMeters: 1 } },
      })
      .expect(200);

    const estimateResponse = await server()
      .post(`${API}/plans/${plan.id}/estimate`)
      .set('Cookie', cookie)
      .expect(201);
    const estimate = estimateResponse.body as PublicEstimate;
    expect(estimate.items.length).toBeGreaterThan(0);
    expect(Array.isArray(estimate.warnings)).toBe(true);
    expect(estimate.warnings.length).toBeGreaterThan(0);

    const listEstimates = (
      await server()
        .get(`${API}/projects/${project.id}/estimates`)
        .set('Cookie', cookie)
        .expect(200)
    ).body as PublicEstimate[];
    expect(listEstimates.map((item) => item.id)).toContain(estimate.id);

    const allEstimates = (
      await server().get(`${API}/estimates`).set('Cookie', cookie).expect(200)
    ).body as PublicEstimate[];
    expect(allEstimates.map((item) => item.id)).toContain(estimate.id);

    const finalized = await server()
      .patch(`${API}/estimates/${estimate.id}`)
      .set('Cookie', cookie)
      .send({ status: 'final' })
      .expect(200);
    expect((finalized.body as PublicEstimate).status).toBe('final');

    const item = estimate.items[0]!;
    const overridden = await server()
      .patch(`${API}/estimate-items/${item.id}`)
      .set('Cookie', cookie)
      .send({
        quantity: 42,
        purchaseQuantity: 42,
        unitPrice: 10,
        isOverridden: true,
      })
      .expect(200);
    const overriddenItem = (overridden.body as PublicEstimate).items[0]!;
    expect(overriddenItem).toMatchObject({
      quantity: 42,
      unitPrice: 10,
      subtotal: 420,
      isOverridden: true,
    });

    const csv = await server()
      .get(`${API}/estimates/${estimate.id}/csv`)
      .set('Cookie', cookie)
      .expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');

    const pdf = await server()
      .get(`${API}/estimates/${estimate.id}/pdf`)
      .set('Cookie', cookie)
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');

    const links = await server()
      .post(`${API}/estimates/${estimate.id}/export-links`)
      .set('Cookie', cookie)
      .expect(201);
    const { csvUrl, pdfUrl } = links.body as {
      csvUrl: string;
      pdfUrl: string;
    };

    // Signed links work without a session cookie.
    const signedCsv = await server().get(`${API}${csvUrl}`).expect(200);
    expect(signedCsv.headers['content-type']).toContain('text/csv');
    const signedPdf = await server().get(`${API}${pdfUrl}`).expect(200);
    expect(signedPdf.headers['content-type']).toContain('application/pdf');

    await server()
      .get(`${API}${csvUrl.replace('sig=', 'sig=bad')}`)
      .expect(404);

    // Reload everything and confirm persistence.
    const drawing = (
      await server()
        .get(`${API}/plans/${plan.id}/drawing`)
        .set('Cookie', cookie)
        .expect(200)
    ).body as PlanDrawing;

    expect(drawing.calibration?.metersPerUnit).toBeCloseTo(0.1);
    expect(drawing.points.map((point) => point.id)).toEqual([
      startPoint.id,
      endPoint.id,
    ]);
    expect(drawing.routes).toHaveLength(1);
    expect(drawing.routes[0]).toMatchObject({ id: route.id, circuitId: 'L1' });

    const activity = await server()
      .get(`${API}/projects/${project.id}/activity`)
      .set('Cookie', cookie)
      .expect(200);
    expect(
      (activity.body as Array<{ action: string }>).some(
        (entry) => entry.action === 'project.created',
      ),
    ).toBe(true);

    const me = await server()
      .get(`${API}/users/me`)
      .set('Cookie', cookie)
      .expect(200);
    expect((me.body as PublicUser).id).toBe(user.id);
  });
});