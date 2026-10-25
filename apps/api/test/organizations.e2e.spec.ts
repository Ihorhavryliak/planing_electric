import type {
  PublicOrganization,
  PublicOrganizationMember,
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

describe('Organizations API', () => {
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

  async function registerUser(): Promise<{ cookie: string; user: PublicUser }> {
    counter += 1;
    const response = await server()
      .post(`${API}/auth/register`)
      .send({
        email: `org-${counter}@example.com`,
        password: PASSWORD,
        name: `Org User ${counter}`,
      })
      .expect(201);

    return {
      cookie: cookiePair(response),
      user: response.body as PublicUser,
    };
  }

  async function createOrg(cookie: string, name: string): Promise<PublicOrganization> {
    const response = await server()
      .post(`${API}/organizations`)
      .set('Cookie', cookie)
      .send({ name })
      .expect(201);
    return response.body as PublicOrganization;
  }

  it('creates an organization with the creator as owner', async () => {
    const owner = await registerUser();
    const org = await createOrg(owner.cookie, 'Owner org');

    expect(org).toMatchObject({ name: 'Owner org', ownerId: owner.user.id });

    const members = (
      await server()
        .get(`${API}/organizations/${org.id}/members`)
        .set('Cookie', owner.cookie)
        .expect(200)
    ).body as PublicOrganizationMember[];

    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      userId: owner.user.id,
      role: 'owner',
      status: 'active',
    });
  });

  it('lists organizations for members only', async () => {
    const owner = await registerUser();
    const outsider = await registerUser();
    const org = await createOrg(owner.cookie, 'Private org');

    const ownerList = (
      await server()
        .get(`${API}/organizations`)
        .set('Cookie', owner.cookie)
        .expect(200)
    ).body as PublicOrganization[];
    expect(ownerList.map((item) => item.id)).toContain(org.id);

    const outsiderList = (
      await server()
        .get(`${API}/organizations`)
        .set('Cookie', outsider.cookie)
        .expect(200)
    ).body as PublicOrganization[];
    expect(outsiderList.map((item) => item.id)).not.toContain(org.id);

    await server()
      .get(`${API}/organizations/${org.id}`)
      .set('Cookie', outsider.cookie)
      .expect(404);
  });

  it('adds members and prevents outsiders from managing them', async () => {
    const owner = await registerUser();
    const member = await registerUser();
    const outsider = await registerUser();
    const org = await createOrg(owner.cookie, 'Team org');

    await server()
      .post(`${API}/organizations/${org.id}/members`)
      .set('Cookie', owner.cookie)
      .send({ userId: member.user.id, role: 'electrician' })
      .expect(201);

    const members = (
      await server()
        .get(`${API}/organizations/${org.id}/members`)
        .set('Cookie', owner.cookie)
        .expect(200)
    ).body as PublicOrganizationMember[];

    expect(members).toHaveLength(2);

    await server()
      .post(`${API}/organizations/${org.id}/members`)
      .set('Cookie', outsider.cookie)
      .send({ userId: outsider.user.id, role: 'owner' })
      .expect(403);

    await server()
      .get(`${API}/organizations/${org.id}/members`)
      .set('Cookie', outsider.cookie)
      .expect(403);
  });

  it('invites a user by email and accepts the invitation once', async () => {
    const owner = await registerUser();
    const invited = await registerUser();
    const org = await createOrg(owner.cookie, 'Invite org');

    const created = await server()
      .post(`${API}/organizations/${org.id}/invitations`)
      .set('Cookie', owner.cookie)
      .send({ email: invited.user.email, role: 'electrician', expiresInDays: 7 })
      .expect(201);

    const { token, invitation } = created.body as {
      token: string;
      invitation: { id: string; email: string; revokedAt: string | null };
    };
    expect(token).toHaveLength(64);
    expect(invitation).toMatchObject({
      email: invited.user.email,
      revokedAt: null,
    });

    const accepted = await server()
      .post(`${API}/invitations/accept`)
      .set('Cookie', invited.cookie)
      .send({ token })
      .expect(201);
    expect(accepted.body).toMatchObject({ id: invitation.id });

    const orgs = (
      await server()
        .get(`${API}/organizations`)
        .set('Cookie', invited.cookie)
        .expect(200)
    ).body as PublicOrganization[];
    expect(orgs.map((item) => item.id)).toContain(org.id);

    // A token is single-use.
    const replay = await server()
      .post(`${API}/invitations/accept`)
      .set('Cookie', invited.cookie)
      .send({ token })
      .expect(201);
    expect(replay.body).toEqual({});
  });

  it('revokes an invitation before it is accepted', async () => {
    const owner = await registerUser();
    const invited = await registerUser();
    const org = await createOrg(owner.cookie, 'Revoke org');

    const created = await server()
      .post(`${API}/organizations/${org.id}/invitations`)
      .set('Cookie', owner.cookie)
      .send({ email: invited.user.email, role: 'viewer' })
      .expect(201);
    const { token, invitation } = created.body as {
      token: string;
      invitation: { id: string };
    };

    await server()
      .delete(`${API}/invitations/${invitation.id}`)
      .set('Cookie', owner.cookie)
      .expect(204);

    const accepted = await server()
      .post(`${API}/invitations/accept`)
      .set('Cookie', invited.cookie)
      .send({ token })
      .expect(201);
    expect(accepted.body).toEqual({});
  });

  it('requires authentication for all organization endpoints', async () => {
    const org = '7d03f7d0-8ca7-4f53-9851-c8d3f2bd5f86';
    await server().get(`${API}/organizations`).expect(401);
    await server().post(`${API}/organizations`).send({ name: 'X' }).expect(401);
    await server().get(`${API}/organizations/${org}`).expect(401);
    await server().get(`${API}/organizations/${org}/members`).expect(401);
  });
});