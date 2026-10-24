import { rm } from 'node:fs/promises';
import type { PublicFloor, PublicPlan, PublicProject, PublicUser } from '@drawmyplace/contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './create-test-app';

const API = '/api/v1';
const PASSWORD = 'correct-horse-battery';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const PDF = Buffer.from('%PDF-1.7\n% test plan\n');

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

describe('Editor API', () => {
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
        email: `editor-${emailCounter}@example.com`,
        password: PASSWORD,
        name: `Editor User ${emailCounter}`,
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
      .send({ name: `Editor project ${emailCounter}` })
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

  it('requires authentication for floor, plan, and file endpoints', async () => {
    const projectId = '7d03f7d0-8ca7-4f53-9851-c8d3f2bd5f86';
    const floorId = 'e4e42d6a-5a3f-4f6f-9f7d-2b2b5a0d6b1a';
    const planId = 'b3f2d0d4-4d5a-4b8e-9f37-2a7f4c6d8e91';

    await server().get(`${API}/projects/${projectId}/floors`).expect(401);
    await server()
      .post(`${API}/projects/${projectId}/floors`)
      .send({ name: 'Floor 1' })
      .expect(401);
    await server().get(`${API}/plans/${planId}`).expect(401);
    await server()
      .patch(`${API}/plans/${planId}`)
      .send({ viewport: { x: 0, y: 0, zoom: 1 } })
      .expect(401);
    await server().get(`${API}/plans/${planId}/file`).expect(401);
    await server().get(`${API}/plans/${planId}/preview`).expect(401);
    await server()
      .post(`${API}/floors/${floorId}/plans`)
      .expect(401);
  });

  it('creates and lists floors in stable order', async () => {
    const { cookie } = await registerUser();
    const project = await createProject(cookie);

    const empty = await server()
      .get(`${API}/projects/${project.id}/floors`)
      .set('Cookie', cookie)
      .expect(200);

    expect(empty.body).toEqual([]);

    const first = await createFloor(cookie, project.id, '  Floor 1  ');
    const second = await createFloor(cookie, project.id, 'Floor 2');

    expect(first).toMatchObject({
      projectId: project.id,
      name: 'Floor 1',
      sortOrder: 0,
      plan: null,
    });
    expect(second.sortOrder).toBe(1);

    const list = await server()
      .get(`${API}/projects/${project.id}/floors`)
      .set('Cookie', cookie)
      .expect(200);

    expect(
      (list.body as PublicFloor[]).map((floor) => floor.name),
    ).toEqual(['Floor 1', 'Floor 2']);

    await server()
      .post(`${API}/projects/${project.id}/floors`)
      .set('Cookie', cookie)
      .send({ name: '   ' })
      .expect(400);

    await server()
      .get(`${API}/projects/${project.id}/floors`)
      .set('Cookie', cookie)
      .expect(200);

    const other = await registerUser();

    await server()
      .get(`${API}/projects/${project.id}/floors`)
      .set('Cookie', other.cookie)
      .expect(404);

    await server()
      .post(`${API}/projects/${project.id}/floors`)
      .set('Cookie', other.cookie)
      .send({ name: 'Attacker floor' })
      .expect(404);

    await server()
      .get(`${API}/projects/not-a-uuid/floors`)
      .set('Cookie', cookie)
      .expect(400);
  });

  it('creates, persists, and protects a blank plan', async () => {
    const { cookie } = await registerUser();
    const project = await createProject(cookie);
    const floor = await createFloor(cookie, project.id);

    const plan = await createBlankPlan(cookie, floor.id);

    expect(plan).toMatchObject({
      floorId: floor.id,
      sourceType: 'blank',
      mimeType: null,
      page: null,
      hasFile: false,
      hasPreview: false,
      version: 1,
      underlay: {
        visible: true,
        locked: false,
        opacity: 1,
        rotation: 0,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      },
      viewport: { x: 0, y: 0, zoom: 1 },
    });

    await server()
      .post(`${API}/floors/${floor.id}/plans`)
      .set('Cookie', cookie)
      .expect(409);

    const updated = await server()
      .patch(`${API}/plans/${plan.id}`)
      .set('Cookie', cookie)
      .send({
        underlay: {
          visible: false,
          locked: true,
          opacity: 0.45,
          rotation: 15,
          scale: 1.5,
          offsetX: 120,
          offsetY: -80,
        },
        viewport: { x: 300, y: 200, zoom: 2.5 },
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      version: 2,
      underlay: {
        visible: false,
        locked: true,
        opacity: 0.45,
        rotation: 15,
        scale: 1.5,
        offsetX: 120,
        offsetY: -80,
      },
      viewport: { x: 300, y: 200, zoom: 2.5 },
    });

    const reopened = await server()
      .get(`${API}/plans/${plan.id}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(reopened.body).toMatchObject({
      viewport: { x: 300, y: 200, zoom: 2.5 },
      underlay: { opacity: 0.45, locked: true },
    });

    const floors = await server()
      .get(`${API}/projects/${project.id}/floors`)
      .set('Cookie', cookie)
      .expect(200);

    expect((floors.body as PublicFloor[])[0]?.plan?.id).toBe(plan.id);

    await server()
      .get(`${API}/plans/${plan.id}/file`)
      .set('Cookie', cookie)
      .expect(404);

    await server()
      .patch(`${API}/plans/${plan.id}`)
      .set('Cookie', cookie)
      .send({ page: 2 })
      .expect(400);

    await server()
      .patch(`${API}/plans/${plan.id}`)
      .set('Cookie', cookie)
      .send({ underlay: { opacity: 0 } })
      .expect(400);

    await server()
      .patch(`${API}/plans/${plan.id}`)
      .set('Cookie', cookie)
      .send({})
      .expect(400);

    const other = await registerUser();

    await server()
      .get(`${API}/plans/${plan.id}`)
      .set('Cookie', other.cookie)
      .expect(404);

    await server()
      .patch(`${API}/plans/${plan.id}`)
      .set('Cookie', other.cookie)
      .send({ viewport: { x: 1, y: 1, zoom: 1 } })
      .expect(404);

    await server()
      .get(`${API}/plans/${plan.id}/file`)
      .set('Cookie', other.cookie)
      .expect(404);
  });

  it('uploads a raster plan and serves the original file', async () => {
    const { cookie } = await registerUser();
    const project = await createProject(cookie);
    const floor = await createFloor(cookie, project.id);

    const uploaded = await server()
      .post(`${API}/floors/${floor.id}/plans/upload`)
      .set('Cookie', cookie)
      .attach('file', PNG, {
        filename: 'plan.png',
        contentType: 'image/png',
      })
      .expect(201);

    const plan = uploaded.body as PublicPlan;

    expect(plan).toMatchObject({
      floorId: floor.id,
      sourceType: 'upload',
      mimeType: 'image/png',
      page: null,
      hasFile: true,
      hasPreview: false,
    });

    const file = await server()
      .get(`${API}/plans/${plan.id}/file`)
      .set('Cookie', cookie)
      .expect(200);

    expect(file.headers['content-type']).toBe('image/png');
    expect(file.body).toEqual(PNG);

    const other = await registerUser();

    await server()
      .get(`${API}/plans/${plan.id}/file`)
      .set('Cookie', other.cookie)
      .expect(404);

    await server()
      .post(`${API}/floors/${floor.id}/plans/upload`)
      .set('Cookie', cookie)
      .attach('file', PNG, {
        filename: 'second.png',
        contentType: 'image/png',
      })
      .expect(409);

    const secondFloor = await createFloor(cookie, project.id, 'Floor 2');

    await server()
      .post(`${API}/floors/${secondFloor.id}/plans/upload`)
      .set('Cookie', cookie)
      .attach('file', Buffer.from('not an image'), {
        filename: 'plan.txt',
        contentType: 'text/plain',
      })
      .expect(400);

    const secondFloorState = await server()
      .get(`${API}/projects/${project.id}/floors`)
      .set('Cookie', cookie)
      .expect(200);

    expect(
      (secondFloorState.body as PublicFloor[]).find(
        (item) => item.id === secondFloor.id,
      )?.plan,
    ).toBeNull();
  });

  it('handles PDF page selection, previews, and file replacement', async () => {
    const { cookie } = await registerUser();
    const project = await createProject(cookie);
    const floor = await createFloor(cookie, project.id);

    const uploaded = await server()
      .post(`${API}/floors/${floor.id}/plans/upload`)
      .set('Cookie', cookie)
      .field('page', '2')
      .attach('file', PDF, {
        filename: 'plan.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    const plan = uploaded.body as PublicPlan;

    expect(plan).toMatchObject({
      sourceType: 'upload',
      mimeType: 'application/pdf',
      page: 2,
      hasFile: true,
      hasPreview: false,
    });

    const updated = await server()
      .patch(`${API}/plans/${plan.id}`)
      .set('Cookie', cookie)
      .send({ page: 3 })
      .expect(200);

    expect(updated.body.page).toBe(3);
    expect(updated.body.hasPreview).toBe(false);

    const preview = await server()
      .post(`${API}/plans/${plan.id}/preview`)
      .set('Cookie', cookie)
      .attach('file', PNG, {
        filename: 'page-3.png',
        contentType: 'image/png',
      })
      .expect(200);

    expect(preview.body).toMatchObject({
      page: 3,
      hasPreview: true,
    });

    const servedPreview = await server()
      .get(`${API}/plans/${plan.id}/preview`)
      .set('Cookie', cookie)
      .expect(200);

    expect(servedPreview.headers['content-type']).toBe('image/png');
    expect(servedPreview.body).toEqual(PNG);

    await server()
      .post(`${API}/plans/${plan.id}/preview`)
      .set('Cookie', cookie)
      .attach('file', JPG, {
        filename: 'page.jpg',
        contentType: 'image/jpeg',
      })
      .expect(400);

    const replaced = await server()
      .post(`${API}/plans/${plan.id}/file`)
      .set('Cookie', cookie)
      .field('page', '5')
      .attach('file', PDF, {
        filename: 'new-plan.pdf',
        contentType: 'application/pdf',
      })
      .expect(200);

    expect(replaced.body).toMatchObject({
      mimeType: 'application/pdf',
      page: 5,
      hasFile: true,
      hasPreview: false,
    });

    await server()
      .get(`${API}/plans/${plan.id}/preview`)
      .set('Cookie', cookie)
      .expect(404);

    await server()
      .patch(`${API}/plans/${plan.id}`)
      .set('Cookie', cookie)
      .send({ page: 0 })
      .expect(400);

    await server()
      .post(`${API}/floors/${floor.id}/plans/upload`)
      .set('Cookie', cookie)
      .attach('file', PDF, {
        filename: 'another.pdf',
        contentType: 'application/pdf',
      })
      .expect(409);
  });

  it('replaces a raster file with a new image and rejects invalid PDF pages', async () => {
    const { cookie } = await registerUser();
    const project = await createProject(cookie);
    const floor = await createFloor(cookie, project.id);

    const uploaded = await server()
      .post(`${API}/floors/${floor.id}/plans/upload`)
      .set('Cookie', cookie)
      .attach('file', PNG, {
        filename: 'plan.png',
        contentType: 'image/png',
      })
      .expect(201);

    const plan = uploaded.body as PublicPlan;

    const replaced = await server()
      .post(`${API}/plans/${plan.id}/file`)
      .set('Cookie', cookie)
      .attach('file', JPG, {
        filename: 'plan.jpg',
        contentType: 'image/jpeg',
      })
      .expect(200);

    expect(replaced.body).toMatchObject({
      mimeType: 'image/jpeg',
      page: null,
      hasFile: true,
    });

    await server()
      .post(`${API}/plans/${plan.id}/file`)
      .set('Cookie', cookie)
      .field('page', 'not-a-number')
      .attach('file', PDF, {
        filename: 'plan.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    await server()
      .post(`${API}/plans/${plan.id}/file`)
      .set('Cookie', cookie)
      .attach('file', PNG, {
        filename: 'plan.png',
        contentType: 'image/png',
      })
      .expect(200);

    await server()
      .post(`${API}/plans/${plan.id}/file`)
      .set('Cookie', cookie)
      .expect(400);
  });
});
