import { rm } from 'node:fs/promises';
import type {
  PlanCalculation,
  PlanDrawing,
  PublicCalibration,
  PublicDimension,
  PublicFloor,
  PublicOpening,
  PublicPlan,
  PublicPoint,
  PublicProject,
  PublicRoom,
  PublicRoute,
  PublicUser,
  PublicWall,
} from '@drawmyplace/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './create-test-app';

const API = '/api/v1';
const PASSWORD = 'correct-horse-battery';
const MISSING = '7d03f7d0-8ca7-4f53-9851-c8d3f2bd5f86';

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

  if (!pair) {
    throw new Error('Expected a session cookie');
  }

  return pair;
}

describe('Drawing API', () => {
  let testApp: TestApp;
  let emailCounter = 0;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();

    if (process.env.STORAGE_DIR) {
      await rm(process.env.STORAGE_DIR, { recursive: true, force: true });
    }
  });

  function server(): request.SuperTest<request.Test> {
    return request(testApp.app.getHttpServer());
  }

  async function registerUser(): Promise<{
    cookie: string;
    user: PublicUser;
  }> {
    emailCounter += 1;
    const response = await server()
      .post(`${API}/auth/register`)
      .send({
        email: `drawing-${emailCounter}@example.com`,
        password: PASSWORD,
        name: `Drawing User ${emailCounter}`,
      })
      .expect(201);

    return {
      cookie: cookiePair(response),
      user: response.body as PublicUser,
    };
  }

  async function createProject(cookie: string): Promise<PublicProject> {
    const response = await server()
      .post(`${API}/projects`)
      .set('Cookie', cookie)
      .send({ name: `Drawing project ${emailCounter}` })
      .expect(201);

    return response.body as PublicProject;
  }

  async function createFloor(
    cookie: string,
    projectId: string,
    name = 'Floor 1',
  ): Promise<PublicFloor> {
    const response = await server()
      .post(`${API}/projects/${projectId}/floors`)
      .set('Cookie', cookie)
      .send({ name })
      .expect(201);

    return response.body as PublicFloor;
  }

  async function createBlankPlan(
    cookie: string,
    floorId: string,
  ): Promise<PublicPlan> {
    const response = await server()
      .post(`${API}/floors/${floorId}/plans`)
      .set('Cookie', cookie)
      .expect(201);

    return response.body as PublicPlan;
  }

  interface Fixture {
    cookie: string;
    plan: PublicPlan;
  }

  async function createFixture(): Promise<Fixture> {
    const { cookie } = await registerUser();
    const project = await createProject(cookie);
    const floor = await createFloor(cookie, project.id);
    const plan = await createBlankPlan(cookie, floor.id);

    return { cookie, plan };
  }

  async function addPoint(
    { cookie, plan }: Fixture,
    body: Record<string, unknown>,
  ): Promise<PublicPoint> {
    const response = await server()
      .post(`${API}/plans/${plan.id}/points`)
      .set('Cookie', cookie)
      .send(body)
      .expect(201);

    return response.body as PublicPoint;
  }

  async function addRoute(
    { cookie, plan }: Fixture,
    body: Record<string, unknown>,
  ): Promise<PublicRoute> {
    const response = await server()
      .post(`${API}/plans/${plan.id}/routes`)
      .set('Cookie', cookie)
      .send(body)
      .expect(201);

    return response.body as PublicRoute;
  }

  async function addWall(
    { cookie, plan }: Fixture,
    body: Record<string, unknown>,
  ): Promise<PublicWall> {
    const response = await server()
      .post(`${API}/plans/${plan.id}/walls`)
      .set('Cookie', cookie)
      .send(body)
      .expect(201);

    return response.body as PublicWall;
  }

  async function addRoom(
    { cookie, plan }: Fixture,
    body: Record<string, unknown>,
  ): Promise<PublicRoom> {
    const response = await server()
      .post(`${API}/plans/${plan.id}/rooms`)
      .set('Cookie', cookie)
      .send(body)
      .expect(201);

    return response.body as PublicRoom;
  }

  async function addDimension(
    { cookie, plan }: Fixture,
    body: Record<string, unknown>,
  ): Promise<PublicDimension> {
    const response = await server()
      .post(`${API}/plans/${plan.id}/dimensions`)
      .set('Cookie', cookie)
      .send(body)
      .expect(201);

    return response.body as PublicDimension;
  }

  function calibrate(fixture: Fixture): request.Test {
    return server()
      .put(`${API}/plans/${fixture.plan.id}/calibration`)
      .set('Cookie', fixture.cookie)
      .send({
        pointA: { x: 0, y: 0 },
        pointB: { x: 100, y: 0 },
        realDistance: 1,
        unit: 'm',
      });
  }

  it('requires authentication on every drawing endpoint', async () => {
    await server().get(`${API}/plans/${MISSING}/drawing`).expect(401);
    await server().get(`${API}/plans/${MISSING}/calculation`).expect(401);
    await server().put(`${API}/plans/${MISSING}/calibration`).send({}).expect(401);
    await server().delete(`${API}/plans/${MISSING}/calibration`).expect(401);
    await server().post(`${API}/plans/${MISSING}/walls`).send({}).expect(401);
    await server().patch(`${API}/walls/${MISSING}`).send({}).expect(401);
    await server().delete(`${API}/walls/${MISSING}`).expect(401);
    await server().post(`${API}/plans/${MISSING}/rooms`).send({}).expect(401);
    await server().patch(`${API}/rooms/${MISSING}`).send({}).expect(401);
    await server().delete(`${API}/rooms/${MISSING}`).expect(401);
    await server().post(`${API}/plans/${MISSING}/dimensions`).send({}).expect(401);
    await server().patch(`${API}/dimensions/${MISSING}`).send({}).expect(401);
    await server().delete(`${API}/dimensions/${MISSING}`).expect(401);
    await server().post(`${API}/plans/${MISSING}/points`).send({}).expect(401);
    await server().patch(`${API}/points/${MISSING}`).send({}).expect(401);
    await server().delete(`${API}/points/${MISSING}`).expect(401);
    await server().post(`${API}/plans/${MISSING}/routes`).send({}).expect(401);
    await server().patch(`${API}/routes/${MISSING}`).send({}).expect(401);
    await server().delete(`${API}/routes/${MISSING}`).expect(401);
  });

  it('returns an empty drawing for a new plan', async () => {
    const fixture = await createFixture();
    const response = await server()
      .get(`${API}/plans/${fixture.plan.id}/drawing`)
      .set('Cookie', fixture.cookie)
      .expect(200);

    expect(response.body).toEqual({
      planId: fixture.plan.id,
      calibration: null,
      walls: [],
      openings: [],
      rooms: [],
      dimensions: [],
      points: [],
      routes: [],
    });
  });

  it('saves, replaces and removes the scale calibration', async () => {
    const fixture = await createFixture();

    const first = (await calibrate(fixture).expect(200)).body as PublicCalibration;
    expect(first.metersPerUnit).toBeCloseTo(0.01, 12);

    const second = await server()
      .put(`${API}/plans/${fixture.plan.id}/calibration`)
      .set('Cookie', fixture.cookie)
      .send({ pointA: { x: 0, y: 0 }, pointB: { x: 300, y: 400 }, realDistance: 250, unit: 'cm' })
      .expect(200);
    expect((second.body as PublicCalibration).metersPerUnit).toBeCloseTo(0.005, 12);

    const drawing = await server()
      .get(`${API}/plans/${fixture.plan.id}/drawing`)
      .set('Cookie', fixture.cookie)
      .expect(200);
    expect((drawing.body as PlanDrawing).calibration?.unit).toBe('cm');

    await server()
      .delete(`${API}/plans/${fixture.plan.id}/calibration`)
      .set('Cookie', fixture.cookie)
      .expect(204);
    const after = await server()
      .get(`${API}/plans/${fixture.plan.id}/drawing`)
      .set('Cookie', fixture.cookie)
      .expect(200);
    expect((after.body as PlanDrawing).calibration).toBeNull();
  });

  it('rejects invalid calibration input', async () => {
    const fixture = await createFixture();
    const put = (body: unknown) =>
      server()
        .put(`${API}/plans/${fixture.plan.id}/calibration`)
        .set('Cookie', fixture.cookie)
        .send(body as object);

    await put({ pointA: { x: 0, y: 0 }, pointB: { x: 0, y: 0 }, realDistance: 1 }).expect(400);
    await put({ pointA: { x: 0, y: 0 }, pointB: { x: 5, y: 0 }, realDistance: 0 }).expect(400);
    await put({ pointA: { x: 0, y: 0 }, pointB: { x: 5, y: 0 }, realDistance: -2 }).expect(400);
    await put({ pointA: { x: 0, y: 0 }, pointB: { x: 5, y: 0 }, realDistance: 1, unit: 'ft' }).expect(400);
    await put({}).expect(400);
  });

  it('creates, updates and deletes walls, rooms and dimensions', async () => {
    const fixture = await createFixture();
    const wall = await addWall(fixture, {
      geometry: [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
        { x: 500, y: 300 },
      ],
      thickness: 12,
      label: 'North wall',
    });

    expect(wall).toMatchObject({
      floorId: expect.any(String),
      thickness: 12,
      label: 'North wall',
    });
    expect(wall.geometry).toHaveLength(3);

    const updatedWall = await server()
      .patch(`${API}/walls/${wall.id}`)
      .set('Cookie', fixture.cookie)
      .send({
        geometry: [
          { x: 0, y: 0 },
          { x: 600, y: 0 },
        ],
        thickness: null,
      })
      .expect(200);
    expect(updatedWall.body).toMatchObject({
      thickness: null,
      label: 'North wall',
    });
    expect((updatedWall.body as PublicWall).geometry).toHaveLength(2);

    const room = await addRoom(fixture, {
      name: 'Living room',
      boundary: [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
        { x: 500, y: 300 },
        { x: 0, y: 300 },
      ],
    });
    expect(room).toMatchObject({ name: 'Living room' });
    expect(room.boundary).toHaveLength(4);

    const updatedRoom = await server()
      .patch(`${API}/rooms/${room.id}`)
      .set('Cookie', fixture.cookie)
      .send({ name: 'Bedroom' })
      .expect(200);
    expect((updatedRoom.body as PublicRoom).name).toBe('Bedroom');

    const dimension = await addDimension(fixture, {
      pointA: { x: 0, y: 0 },
      pointB: { x: 500, y: 0 },
      offset: 40,
      label: 'Width',
    });
    expect(dimension).toMatchObject({ offset: 40, label: 'Width' });

    const updatedDimension = await server()
      .patch(`${API}/dimensions/${dimension.id}`)
      .set('Cookie', fixture.cookie)
      .send({ offset: -20, label: null })
      .expect(200);
    expect(updatedDimension.body).toMatchObject({ offset: -20, label: null });

    const drawing = (
      await server()
        .get(`${API}/plans/${fixture.plan.id}/drawing`)
        .set('Cookie', fixture.cookie)
        .expect(200)
    ).body as PlanDrawing;

    expect(drawing.walls).toHaveLength(1);
    expect(drawing.rooms).toHaveLength(1);
    expect(drawing.dimensions).toHaveLength(1);

    await server().delete(`${API}/walls/${wall.id}`).set('Cookie', fixture.cookie).expect(204);
    await server().delete(`${API}/rooms/${room.id}`).set('Cookie', fixture.cookie).expect(204);
    await server()
      .delete(`${API}/dimensions/${dimension.id}`)
      .set('Cookie', fixture.cookie)
      .expect(204);

    const empty = (
      await server()
        .get(`${API}/plans/${fixture.plan.id}/drawing`)
        .set('Cookie', fixture.cookie)
        .expect(200)
    ).body as PlanDrawing;
    expect(empty.walls).toEqual([]);
    expect(empty.rooms).toEqual([]);
    expect(empty.dimensions).toEqual([]);
  });

  it('validates wall, room and dimension geometry', async () => {
    const fixture = await createFixture();

    await server()
      .post(`${API}/plans/${fixture.plan.id}/walls`)
      .set('Cookie', fixture.cookie)
      .send({ geometry: [{ x: 0, y: 0 }] })
      .expect(400);
    await server()
      .post(`${API}/plans/${fixture.plan.id}/rooms`)
      .set('Cookie', fixture.cookie)
      .send({ name: 'Bad', boundary: [{ x: 0, y: 0 }, { x: 1, y: 0 }] })
      .expect(400);
    await server()
      .post(`${API}/plans/${fixture.plan.id}/dimensions`)
      .set('Cookie', fixture.cookie)
      .send({ pointA: { x: 5, y: 5 }, pointB: { x: 5, y: 5 } })
      .expect(400);

    const dimension = await addDimension(fixture, {
      pointA: { x: 0, y: 0 },
      pointB: { x: 100, y: 0 },
    });
    await server()
      .patch(`${API}/dimensions/${dimension.id}`)
      .set('Cookie', fixture.cookie)
      .send({ pointB: { x: 0, y: 0 } })
      .expect(400);
    await server()
      .patch(`${API}/walls/${MISSING}`)
      .set('Cookie', fixture.cookie)
      .send({ label: 'x' })
      .expect(404);
  });

  it('creates, updates and deletes doors and windows on walls', async () => {
    const fixture = await createFixture();
    const wall = await addWall(fixture, {
      geometry: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
      ],
    });

    const door = (
      await server()
        .post(`${API}/plans/${fixture.plan.id}/openings`)
        .set('Cookie', fixture.cookie)
        .send({ wallId: wall.id, type: 'door', offset: 100, width: 900 })
        .expect(201)
    ).body as PublicOpening;
    expect(door).toMatchObject({
      wallId: wall.id,
      type: 'door',
      offset: 100,
      width: 900,
    });

    const window = (
      await server()
        .post(`${API}/plans/${fixture.plan.id}/openings`)
        .set('Cookie', fixture.cookie)
        .send({
          wallId: wall.id,
          type: 'window',
          offset: 100,
          width: 600,
          sillHeight: 90,
          height: 130,
        })
        .expect(201)
    ).body as PublicOpening;
    expect(window).toMatchObject({ type: 'window', sillHeight: 90 });

    const drawing = (
      await server()
        .get(`${API}/plans/${fixture.plan.id}/drawing`)
        .set('Cookie', fixture.cookie)
        .expect(200)
    ).body as PlanDrawing;
    expect(drawing.openings).toHaveLength(2);

    const updated = await server()
      .patch(`${API}/openings/${door.id}`)
      .set('Cookie', fixture.cookie)
      .send({ offset: 100, flipped: true })
      .expect(200);
    expect(updated.body).toMatchObject({ offset: 100, flipped: true });

    await server()
      .post(`${API}/plans/${fixture.plan.id}/openings`)
      .set('Cookie', fixture.cookie)
      .send({ wallId: wall.id, type: 'door', offset: 900, width: 200 })
      .expect(400);

    await server()
      .delete(`${API}/openings/${door.id}`)
      .set('Cookie', fixture.cookie)
      .expect(204);

    const after = (
      await server()
        .get(`${API}/plans/${fixture.plan.id}/drawing`)
        .set('Cookie', fixture.cookie)
        .expect(200)
    ).body as PlanDrawing;
    expect(after.openings.map((opening) => opening.id)).toEqual([window.id]);
  });

  it('creates, updates and deletes electrical points', async () => {
    const fixture = await createFixture();
    const point = await addPoint(fixture, { type: 'socket', x: 10, y: 20, label: 'S1' });

    expect(point).toMatchObject({ type: 'socket', x: 10, y: 20, rotation: 0, label: 'S1' });

    const updated = await server()
      .patch(`${API}/points/${point.id}`)
      .set('Cookie', fixture.cookie)
      .send({ x: 30, rotation: 90, properties: { verticalDropMeters: 2 } })
      .expect(200);
    expect(updated.body).toMatchObject({
      x: 30,
      y: 20,
      rotation: 90,
      properties: { verticalDropMeters: 2 },
    });

    await server()
      .patch(`${API}/points/${point.id}`)
      .set('Cookie', fixture.cookie)
      .send({})
      .expect(400);
    await server()
      .post(`${API}/plans/${fixture.plan.id}/points`)
      .set('Cookie', fixture.cookie)
      .send({ type: 'toaster', x: 0, y: 0 })
      .expect(400);

    await server().delete(`${API}/points/${point.id}`).set('Cookie', fixture.cookie).expect(204);
    await server().delete(`${API}/points/${point.id}`).set('Cookie', fixture.cookie).expect(404);
  });

  it('creates, updates and deletes cable routes', async () => {
    const fixture = await createFixture();
    const route = await addRoute(fixture, {
      geometry: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      circuitId: 'L1',
      settings: { mounting: 'chase', chaseWidthMm: 60, chaseDepthMm: 25 },
    });
    expect(route.settings).toEqual({
      mounting: 'chase',
      chaseWidthMm: 60,
      chaseDepthMm: 25,
    });

    const updated = await server()
      .patch(`${API}/routes/${route.id}`)
      .set('Cookie', fixture.cookie)
      .send({
        geometry: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }],
        settings: { mounting: 'ceiling', wastePercent: 15 },
      })
      .expect(200);
    expect((updated.body as PublicRoute).geometry).toHaveLength(3);
    expect((updated.body as PublicRoute).settings).toEqual({
      mounting: 'ceiling',
      wastePercent: 15,
    });

    await server()
      .post(`${API}/plans/${fixture.plan.id}/routes`)
      .set('Cookie', fixture.cookie)
      .send({ geometry: [{ x: 0, y: 0 }] })
      .expect(400);
    await server()
      .post(`${API}/plans/${fixture.plan.id}/routes`)
      .set('Cookie', fixture.cookie)
      .send({ geometry: [{ x: 0, y: 0 }, { x: 1, y: 1 }], settings: { wastePercent: 500 } })
      .expect(400);

    await server().delete(`${API}/routes/${route.id}`).set('Cookie', fixture.cookie).expect(204);
    const drawing = await server()
      .get(`${API}/plans/${fixture.plan.id}/drawing`)
      .set('Cookie', fixture.cookie)
      .expect(200);
    expect((drawing.body as PlanDrawing).routes).toEqual([]);
  });

  it('keeps route ends attached when an electrical point moves', async () => {
    const fixture = await createFixture();
    await calibrate(fixture).expect(200);

    const panel = await addPoint(fixture, {
      type: 'panel',
      x: 0,
      y: 0,
      properties: { verticalDropMeters: 1.5 },
    });
    const light = await addPoint(fixture, {
      type: 'light',
      x: 1000,
      y: 0,
      properties: { verticalDropMeters: 1.5 },
    });
    await addPoint(fixture, { type: 'socket', x: 500, y: 0 });

    await addRoute(fixture, {
      geometry: [{ x: 0, y: 0 }, { x: 1000, y: 0 }],
      circuitId: 'L1',
    });

    await server()
      .patch(`${API}/points/${panel.id}`)
      .set('Cookie', fixture.cookie)
      .send({ x: 100, y: 50 })
      .expect(200);

    let drawing = (
      await server()
        .get(`${API}/plans/${fixture.plan.id}/drawing`)
        .set('Cookie', fixture.cookie)
        .expect(200)
    ).body as PlanDrawing;

    expect(drawing.routes[0]?.geometry).toEqual([
      { x: 100, y: 50 },
      { x: 1000, y: 0 },
    ]);

    await server()
      .patch(`${API}/points/${light.id}`)
      .set('Cookie', fixture.cookie)
      .send({ x: 900, y: 100 })
      .expect(200);

    drawing = (
      await server()
        .get(`${API}/plans/${fixture.plan.id}/drawing`)
        .set('Cookie', fixture.cookie)
        .expect(200)
    ).body as PlanDrawing;

    expect(drawing.routes[0]?.geometry).toEqual([
      { x: 100, y: 50 },
      { x: 900, y: 100 },
    ]);

    const calculation = (
      await server()
        .get(`${API}/plans/${fixture.plan.id}/calculation`)
        .set('Cookie', fixture.cookie)
        .expect(200)
    ).body as PlanCalculation;

    expect(calculation.routes[0]?.drops.map((drop) => drop.pointId).sort()).toEqual(
      [panel.id, light.id].sort(),
    );
    expect(calculation.routes[0]?.verticalLength).toBeCloseTo(3, 6);
  });

  it('calculates 24 m + drops + 10% waste = 33 m on the server', async () => {
    const fixture = await createFixture();
    await calibrate(fixture).expect(200); // 0.01 m per drawing unit

    const panel = await addPoint(fixture, { type: 'panel', x: 0, y: 0, label: 'Panel' });
    // Lies on the route but is not an end, so it must add no drop.
    await addPoint(fixture, { type: 'socket', x: 1200, y: 0, label: 'S1' });
    const light = await addPoint(fixture, {
      type: 'light',
      x: 2400,
      y: 0,
      properties: { verticalDropMeters: 4.5 }, // override: 4.5 m
    });
    await addRoute(fixture, {
      geometry: [{ x: 0, y: 0 }, { x: 2400, y: 0 }],
      circuitId: 'L1',
    });

    const response = await server()
      .get(`${API}/plans/${fixture.plan.id}/calculation`)
      .set('Cookie', fixture.cookie)
      .expect(200);
    const result = response.body as PlanCalculation;

    // Ends: panel at x=0 (0 m) and light at x=2400 (4.5 m override).
    expect(result.metersPerUnit).toBeCloseTo(0.01, 12);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]).toMatchObject({
      status: 'ok',
      circuitId: 'L1',
      planLength: 24,
      verticalLength: 4.5,
      wastePercent: 10,
    });
    expect(result.routes[0]?.drops.map((d) => d.pointId).sort()).toEqual([panel.id, light.id].sort());
    expect(result.routes[0]?.requiredLength).toBeCloseTo((24 + 4.5) * 1.1, 6);
    expect(result.totalRequiredLength).toBeCloseTo(31.35, 6);
    expect(result.warnings).toEqual([]);
  });

  it('matches the specification example of exactly 33 m', async () => {
    const fixture = await createFixture();
    await calibrate(fixture).expect(200);
    await addPoint(fixture, { type: 'socket', x: 0, y: 0 }); // 1.5 m
    await addPoint(fixture, { type: 'light', x: 2400, y: 0, properties: { verticalDropMeters: 4.5 } });
    await addRoute(fixture, { geometry: [{ x: 0, y: 0 }, { x: 2400, y: 0 }] });

    const result = (
      await server()
        .get(`${API}/plans/${fixture.plan.id}/calculation`)
        .set('Cookie', fixture.cookie)
        .expect(200)
    ).body as PlanCalculation;

    expect(result.routes[0]).toMatchObject({
      planLength: 24,
      verticalLength: 6,
      wasteLength: 3,
      requiredLength: 33,
    });
    expect(result.totalRequiredLength).toBe(33);
  });

  it('applies plan-level vertical drop defaults', async () => {
    const fixture = await createFixture();
    await calibrate(fixture).expect(200);
    await addPoint(fixture, { type: 'socket', x: 0, y: 0 });
    await addPoint(fixture, { type: 'socket', x: 0, y: 1000 });
    await addRoute(fixture, {
      geometry: [
        { x: 0, y: 0 },
        { x: 0, y: 1000 },
      ],
    });

    const first = (
      await server()
        .get(`${API}/plans/${fixture.plan.id}/calculation`)
        .set('Cookie', fixture.cookie)
        .expect(200)
    ).body as PlanCalculation;
    // 10 m plan + two 1.5 m socket drops + 10% = 14.3 m.
    expect(first.routes[0]).toMatchObject({
      planLength: 10,
      verticalLength: 3,
      requiredLength: 14.3,
    });

    await server()
      .patch(`${API}/plans/${fixture.plan.id}`)
      .set('Cookie', fixture.cookie)
      .send({ calculationSettings: { verticalDropDefaults: { socket: 2 } } })
      .expect(200);

    const second = (
      await server()
        .get(`${API}/plans/${fixture.plan.id}/calculation`)
        .set('Cookie', fixture.cookie)
        .expect(200)
    ).body as PlanCalculation;
    expect(second.routes[0]).toMatchObject({
      planLength: 10,
      verticalLength: 4,
      requiredLength: 15.4,
    });
  });

  it('stores circuits and point circuit assignments', async () => {
    const fixture = await createFixture();

    const updated = await server()
      .patch(`${API}/plans/${fixture.plan.id}`)
      .set('Cookie', fixture.cookie)
      .send({
        calculationSettings: {
          circuits: [
            { id: 'L1', name: 'Lighting', color: '#facc15' },
            { id: 'G1', name: 'Sockets' },
          ],
        },
      })
      .expect(200);

    expect(updated.body.calculationSettings.circuits).toEqual([
      { id: 'L1', name: 'Lighting', color: '#facc15' },
      { id: 'G1', name: 'Sockets', color: '#f59e0b' },
    ]);

    await server()
      .post(`${API}/plans/${fixture.plan.id}/points`)
      .set('Cookie', fixture.cookie)
      .send({
        type: 'socket',
        x: 10,
        y: 20,
        properties: {
          circuitId: 'G1',
          verticalDropMeters: 1.2,
          subtype: 'socket-double',
        },
      })
      .expect(201);

    const drawing = (
      await server()
        .get(`${API}/plans/${fixture.plan.id}/drawing`)
        .set('Cookie', fixture.cookie)
        .expect(200)
    ).body as { points: Array<{ properties: Record<string, unknown> }> };

    expect(drawing.points[0]?.properties).toMatchObject({
      circuitId: 'G1',
      verticalDropMeters: 1.2,
      subtype: 'socket-double',
    });

    await addRoute(fixture, {
      geometry: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      circuitId: 'G9',
    });
    await server()
      .post(`${API}/plans/${fixture.plan.id}/points`)
      .set('Cookie', fixture.cookie)
      .send({
        type: 'light',
        x: 30,
        y: 40,
        properties: { circuitId: 'G9' },
      })
      .expect(201);

    const calculation = (
      await server()
        .get(`${API}/plans/${fixture.plan.id}/calculation`)
        .set('Cookie', fixture.cookie)
        .expect(200)
    ).body as PlanCalculation;
    expect(calculation.warnings).toContain('Unknown circuit code: G9.');
  });

  it('reports validation warnings for cable type and circuit length', async () => {
    const fixture = await createFixture();
    await calibrate(fixture).expect(200);
    await addRoute(fixture, {
      geometry: [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
      ],
    });

    await server()
      .patch(`${API}/plans/${fixture.plan.id}`)
      .set('Cookie', fixture.cookie)
      .send({
        calculationSettings: {
          validation: {
            requireCableType: true,
            maxCircuitLengthMeters: 5,
          },
        },
      })
      .expect(200);

    const calculation = (
      await server()
        .get(`${API}/plans/${fixture.plan.id}/calculation`)
        .set('Cookie', fixture.cookie)
        .expect(200)
    ).body as PlanCalculation;

    expect(calculation.warnings.join(' ')).toContain('no cable type');
    expect(calculation.warnings.join(' ')).toContain('above the 5 m circuit limit');
  });

  it('honours a per-route waste percentage and re-scales after recalibration', async () => {
    const fixture = await createFixture();
    await calibrate(fixture).expect(200);
    await addRoute(fixture, {
      geometry: [{ x: 0, y: 0 }, { x: 1000, y: 0 }],
      settings: { wastePercent: 0 },
    });

    const read = async () =>
      (
        await server()
          .get(`${API}/plans/${fixture.plan.id}/calculation`)
          .set('Cookie', fixture.cookie)
          .expect(200)
      ).body as PlanCalculation;

    expect((await read()).routes[0]?.requiredLength).toBe(10);

    await server()
      .put(`${API}/plans/${fixture.plan.id}/calibration`)
      .set('Cookie', fixture.cookie)
      .send({ pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, realDistance: 2 })
      .expect(200);
    expect((await read()).routes[0]?.requiredLength).toBe(20);
  });

  it('does not invent lengths for an uncalibrated plan and warns about open route ends', async () => {
    const fixture = await createFixture();
    await addRoute(fixture, {
      geometry: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
      circuitId: 'L2',
    });

    const result = (
      await server()
        .get(`${API}/plans/${fixture.plan.id}/calculation`)
        .set('Cookie', fixture.cookie)
        .expect(200)
    ).body as PlanCalculation;

    expect(result.metersPerUnit).toBeNull();
    expect(result.totalRequiredLength).toBeNull();
    expect(result.routes[0]).toMatchObject({ status: 'uncalibrated', requiredLength: null });
    expect(result.warnings.some((w) => w.includes('not calibrated'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('L2'))).toBe(true);
  });

  it('isolates drawings between users (IDOR)', async () => {
    const owner = await createFixture();
    const intruder = await registerUser();
    const point = await addPoint(owner, { type: 'socket', x: 1, y: 1 });
    const route = await addRoute(owner, { geometry: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
    const wall = await addWall(owner, {
      geometry: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    });
    const room = await addRoom(owner, {
      name: 'Room',
      boundary: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
    });
    const dimension = await addDimension(owner, {
      pointA: { x: 0, y: 0 },
      pointB: { x: 10, y: 0 },
    });
    const as = (r: request.Test) => r.set('Cookie', intruder.cookie);

    await as(server().get(`${API}/plans/${owner.plan.id}/drawing`)).expect(404);
    await as(server().get(`${API}/plans/${owner.plan.id}/calculation`)).expect(404);
    await as(server().put(`${API}/plans/${owner.plan.id}/calibration`))
      .send({ pointA: { x: 0, y: 0 }, pointB: { x: 1, y: 0 }, realDistance: 1 })
      .expect(404);
    await as(server().delete(`${API}/plans/${owner.plan.id}/calibration`)).expect(404);
    await as(server().post(`${API}/plans/${owner.plan.id}/walls`))
      .send({ geometry: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })
      .expect(404);
    await as(server().patch(`${API}/walls/${wall.id}`)).send({ label: 'X' }).expect(404);
    await as(server().delete(`${API}/walls/${wall.id}`)).expect(404);
    await as(server().post(`${API}/plans/${owner.plan.id}/rooms`))
      .send({
        name: 'X',
        boundary: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
      })
      .expect(404);
    await as(server().patch(`${API}/rooms/${room.id}`)).send({ name: 'X' }).expect(404);
    await as(server().delete(`${API}/rooms/${room.id}`)).expect(404);
    await as(server().post(`${API}/plans/${owner.plan.id}/dimensions`))
      .send({ pointA: { x: 0, y: 0 }, pointB: { x: 1, y: 0 } })
      .expect(404);
    await as(server().patch(`${API}/dimensions/${dimension.id}`))
      .send({ offset: 5 })
      .expect(404);
    await as(server().delete(`${API}/dimensions/${dimension.id}`)).expect(404);
    await as(server().post(`${API}/plans/${owner.plan.id}/points`))
      .send({ type: 'socket', x: 0, y: 0 })
      .expect(404);
    await as(server().patch(`${API}/points/${point.id}`)).send({ x: 99 }).expect(404);
    await as(server().delete(`${API}/points/${point.id}`)).expect(404);
    await as(server().post(`${API}/plans/${owner.plan.id}/routes`))
      .send({ geometry: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })
      .expect(404);
    await as(server().patch(`${API}/routes/${route.id}`)).send({ circuitId: 'X' }).expect(404);
    await as(server().delete(`${API}/routes/${route.id}`)).expect(404);

    // The owner's data is untouched.
    const drawing = (
      await server()
        .get(`${API}/plans/${owner.plan.id}/drawing`)
        .set('Cookie', owner.cookie)
        .expect(200)
    ).body as PlanDrawing;
    expect(drawing.points[0]).toMatchObject({ id: point.id, x: 1 });
    expect(drawing.routes).toHaveLength(1);
    expect(drawing.walls).toHaveLength(1);
    expect(drawing.rooms).toHaveLength(1);
    expect(drawing.dimensions).toHaveLength(1);
  });

  it('lets managers manage members but not electricians', async () => {
    const owner = await registerUser();
    const manager = await registerUser();
    const electrician = await registerUser();
    const project = await createProject(owner.cookie);

    await server()
      .post(`${API}/projects/${project.id}/members`)
      .set('Cookie', owner.cookie)
      .send({ userId: manager.user.id, role: 'manager' })
      .expect(201);
    await server()
      .post(`${API}/projects/${project.id}/members`)
      .set('Cookie', owner.cookie)
      .send({ userId: electrician.user.id, role: 'electrician' })
      .expect(201);

    await server()
      .get(`${API}/projects/${project.id}/members`)
      .set('Cookie', manager.cookie)
      .expect(200);
    await server()
      .get(`${API}/projects/${project.id}/members`)
      .set('Cookie', electrician.cookie)
      .expect(403);

    const extra = await registerUser();
    await server()
      .post(`${API}/projects/${project.id}/members`)
      .set('Cookie', manager.cookie)
      .send({ userId: extra.user.id, role: 'viewer' })
      .expect(201);
    await server()
      .post(`${API}/projects/${project.id}/members`)
      .set('Cookie', electrician.cookie)
      .send({ userId: owner.user.id, role: 'viewer' })
      .expect(403);
  });

  it('lets a viewer member read the drawing but not mutate it', async () => {
    const owner = await registerUser();
    const project = await createProject(owner.cookie);
    const floor = await createFloor(owner.cookie, project.id);
    const plan = await createBlankPlan(owner.cookie, floor.id);
    const viewer = await registerUser();

    await server()
      .post(`${API}/projects/${project.id}/members`)
      .set('Cookie', owner.cookie)
      .send({ userId: viewer.user.id, role: 'viewer' })
      .expect(201);

    await server()
      .get(`${API}/plans/${plan.id}/drawing`)
      .set('Cookie', viewer.cookie)
      .expect(200);

    const viewerProjects = (
      await server()
        .get(`${API}/projects`)
        .set('Cookie', viewer.cookie)
        .expect(200)
    ).body as PublicProject[];
    expect(viewerProjects.map((item) => item.id)).toContain(project.id);

    await server()
      .post(`${API}/plans/${plan.id}/points`)
      .set('Cookie', viewer.cookie)
      .send({ type: 'socket', x: 1, y: 1 })
      .expect(403);

    await server()
      .post(`${API}/projects/${project.id}/floors`)
      .set('Cookie', viewer.cookie)
      .send({ name: 'Viewer floor' })
      .expect(403);

    const members = (
      await server()
        .get(`${API}/projects/${project.id}/members`)
        .set('Cookie', owner.cookie)
        .expect(200)
    ).body as Array<{ id: string; userId: string }>;
    const viewerMember = members.find((m) => m.userId === viewer.user.id);
    expect(viewerMember).toBeTruthy();

    await server()
      .delete(`${API}/projects/${project.id}/members/${viewerMember!.id}`)
      .set('Cookie', owner.cookie)
      .expect(204);

    // Access is revoked immediately.
    await server()
      .get(`${API}/plans/${plan.id}/drawing`)
      .set('Cookie', viewer.cookie)
      .expect(404);
  });
});
