import type { PublicProject, PublicUser } from '@drawmyplace/contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@drawmyplace/database';
import { createTestApp, type TestApp } from './create-test-app';

const API = '/api/v1';
const PASSWORD = 'correct-horse-battery';

interface HeaderCarrier {
  headers: Record<string, string | string[] | undefined>;
}

function firstSetCookie(response: HeaderCarrier): string {
  const header = response.headers['set-cookie'];
  const values = Array.isArray(header)
    ? header
    : typeof header === 'string'
      ? [header]
      : [];
  const cookie = values[0];

  if (!cookie) {
    throw new Error('Expected a Set-Cookie header');
  }

  return cookie;
}

function cookiePair(response: HeaderCarrier): string {
  const pair = firstSetCookie(response).split(';')[0];

  if (!pair) {
    throw new Error('Expected a session cookie');
  }

  return pair;
}

describe('Projects API', () => {
  let testApp: TestApp;
  let emailCounter = 0;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
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
        email: `projects-${emailCounter}@example.com`,
        password: PASSWORD,
        name: `Project User ${emailCounter}`,
      })
      .expect(201);

    return {
      cookie: cookiePair(response),
      user: response.body as PublicUser,
    };
  }

  async function createProject(
    cookie: string,
    name: string,
    description?: string,
  ): Promise<PublicProject> {
    const response = await server()
      .post(`${API}/projects`)
      .set('Cookie', cookie)
      .send({ name, description })
      .expect(201);

    return response.body as PublicProject;
  }

  it('requires authentication for project endpoints', async () => {
    await server().get(`${API}/projects`).expect(401);
    await server().post(`${API}/projects`).send({ name: 'House' }).expect(401);

    await server()
      .get(`${API}/projects/7d03f7d0-8ca7-4f53-9851-c8d3f2bd5f86`)
      .expect(401);
  });

  it('creates a project owned by the current user', async () => {
    const { cookie, user } = await registerUser();
    const otherOwnerId = '7d03f7d0-8ca7-4f53-9851-c8d3f2bd5f86';

    const response = await server()
      .post(`${API}/projects`)
      .set('Cookie', cookie)
      .send({
        name: '  Apartment  ',
        description: '  Ground floor  ',
        createdBy: otherOwnerId,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'Apartment',
      description: 'Ground floor',
      status: 'active',
      revision: 1,
    });
    expect(response.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const [stored] = await testApp.database.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, response.body.id));

    expect(stored?.createdBy).toBe(user.id);
    expect(stored?.createdBy).not.toBe(otherOwnerId);
  });

  it('lists only projects owned by the current user', async () => {
    const first = await registerUser();
    const second = await registerUser();

    await createProject(first.cookie, 'First apartment');
    await createProject(first.cookie, 'First house');
    await createProject(second.cookie, 'Second office');

    const firstList = await server()
      .get(`${API}/projects`)
      .set('Cookie', first.cookie)
      .expect(200);

    expect(firstList.body).toHaveLength(2);
    expect(
      (firstList.body as PublicProject[]).map((project) => project.name),
    ).toEqual(expect.arrayContaining(['First apartment', 'First house']));

    const secondList = await server()
      .get(`${API}/projects`)
      .set('Cookie', second.cookie)
      .expect(200);

    expect(secondList.body).toHaveLength(1);
    expect((secondList.body as PublicProject[])[0]?.name).toBe('Second office');
  });

  it('returns 404 instead of leaking another user project through ID substitution', async () => {
    const owner = await registerUser();
    const attacker = await registerUser();
    const project = await createProject(owner.cookie, 'Private project');

    await server()
      .get(`${API}/projects/${project.id}`)
      .set('Cookie', attacker.cookie)
      .expect(404);

    await server()
      .patch(`${API}/projects/${project.id}`)
      .set('Cookie', attacker.cookie)
      .send({ name: 'Stolen' })
      .expect(404);

    await server()
      .post(`${API}/projects/${project.id}/archive`)
      .set('Cookie', attacker.cookie)
      .expect(404);

    const stored = await server()
      .get(`${API}/projects/${project.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    expect(stored.body).toMatchObject({
      name: 'Private project',
      status: 'active',
    });

    await server()
      .get(`${API}/projects/not-a-uuid`)
      .set('Cookie', owner.cookie)
      .expect(400);
  });

  it('updates, archives, filters, restores, and reopens a project', async () => {
    const { cookie } = await registerUser();
    const project = await createProject(cookie, 'Draft project');

    const updated = await server()
      .patch(`${API}/projects/${project.id}`)
      .set('Cookie', cookie)
      .send({ name: 'Renamed project', description: 'Updated description' })
      .expect(200);

    expect(updated.body).toMatchObject({
      name: 'Renamed project',
      description: 'Updated description',
    });
    expect(new Date(updated.body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(project.updatedAt).getTime(),
    );

    const archived = await server()
      .post(`${API}/projects/${project.id}/archive`)
      .set('Cookie', cookie)
      .expect(200);

    expect(archived.body.status).toBe('archived');

    const activeList = await server()
      .get(`${API}/projects`)
      .set('Cookie', cookie)
      .expect(200);

    expect(activeList.body).toHaveLength(0);

    const archivedList = await server()
      .get(`${API}/projects?status=archived`)
      .set('Cookie', cookie)
      .expect(200);

    expect(archivedList.body).toHaveLength(1);
    expect((archivedList.body as PublicProject[])[0]?.id).toBe(project.id);

    const allList = await server()
      .get(`${API}/projects?status=all`)
      .set('Cookie', cookie)
      .expect(200);

    expect(allList.body).toHaveLength(1);

    const restored = await server()
      .post(`${API}/projects/${project.id}/restore`)
      .set('Cookie', cookie)
      .expect(200);

    expect(restored.body.status).toBe('active');

    const reopened = await server()
      .get(`${API}/projects/${project.id}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(reopened.body).toMatchObject({
      id: project.id,
      name: 'Renamed project',
      status: 'active',
    });
  });

  it('validates project payloads and query filters', async () => {
    const { cookie } = await registerUser();

    await server()
      .post(`${API}/projects`)
      .set('Cookie', cookie)
      .send({ name: '   ' })
      .expect(400);

    await server()
      .post(`${API}/projects`)
      .set('Cookie', cookie)
      .send({ name: 'x'.repeat(121) })
      .expect(400);

    const project = await createProject(cookie, 'Valid project');

    await server()
      .patch(`${API}/projects/${project.id}`)
      .set('Cookie', cookie)
      .send({})
      .expect(400);

    await server()
      .get(`${API}/projects?status=deleted`)
      .set('Cookie', cookie)
      .expect(400);
  });
});
