import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as schema from '@drawmyplace/database';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { MailService } from '../src/common/mail/mail.service';
import { DatabaseService } from '../src/database/database.service';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/session.service';
import { createTestDatabase, type TestDatabase } from './test-database';

const PASSWORD = 'correct-horse-battery';
const API = '/api/v1';

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

describe('Authentication API', () => {
  let app: INestApplication;
  let database: TestDatabase;
  let emailCounter = 0;
  const sentMails: Array<{ to: string; subject: string; text: string }> = [];

  beforeAll(async () => {
    database = await createTestDatabase();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({
        db: database.db,
        ping: async () => {
          await database.client.query('select 1');
        },
        onApplicationShutdown: async () => {},
      })
      .overrideProvider(MailService)
      .useValue({
        send: async (to: string, subject: string, text: string) => {
          sentMails.push({ to, subject, text });
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  function nextEmail(): string {
    emailCounter += 1;
    return `user-${emailCounter}@example.com`;
  }

  function register(
    email: string,
    password = PASSWORD,
    name = 'Test User',
  ): request.Test {
    return request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({ email, password, name });
  }

  function server(): request.SuperTest<request.Test> {
    return request(app.getHttpServer());
  }

  it('registers a user, sets a session cookie, and stores only the token hash', async () => {
    const email = nextEmail();
    const response = await register(email).expect(201);

    expect(response.body).toMatchObject({
      email,
      name: 'Test User',
      status: 'active',
    });
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const setCookie = firstSetCookie(response);
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');

    const token = cookiePair(response).split('=')[1];
    expect(token).toBeTruthy();

    const sessions = await database.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, response.body.id));

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tokenHash).not.toBe(token);
    expect(sessions[0]?.tokenHash).toHaveLength(64);
  });

  it('returns the current user only with a valid session', async () => {
    const email = nextEmail();
    const registered = await register(email).expect(201);

    await server().get(`${API}/users/me`).expect(401);

    const me = await server()
      .get(`${API}/users/me`)
      .set('Cookie', cookiePair(registered))
      .expect(200);

    expect(me.body).toMatchObject({
      id: registered.body.id,
      email,
      name: 'Test User',
      status: 'active',
    });
  });

  it('rejects duplicate emails with 409', async () => {
    const email = nextEmail();

    await register(email).expect(201);

    const duplicate = await register(email, PASSWORD, 'Another User').expect(
      409,
    );

    expect(duplicate.body).toMatchObject({
      statusCode: 409,
      message: 'An account with this email already exists',
    });
  });

  it('logs in with valid credentials and rejects invalid ones', async () => {
    const email = nextEmail();
    await register(email).expect(201);

    const login = await server()
      .post(`${API}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(200);

    expect(login.body).toMatchObject({ email });
    expect(login.body).not.toHaveProperty('passwordHash');

    const me = await server()
      .get(`${API}/users/me`)
      .set('Cookie', cookiePair(login))
      .expect(200);

    expect(me.body.email).toBe(email);

    const wrongPassword = await server()
      .post(`${API}/auth/login`)
      .send({ email, password: 'wrong-password' })
      .expect(401);

    expect(wrongPassword.body.message).toBe('Invalid email or password');

    const unknownEmail = await server()
      .post(`${API}/auth/login`)
      .send({ email: nextEmail(), password: PASSWORD })
      .expect(401);

    expect(unknownEmail.body.message).toBe('Invalid email or password');
  });

  it('validates registration and login payloads', async () => {
    const shortPassword = await register(nextEmail(), 'short').expect(400);
    expect(JSON.stringify(shortPassword.body.message)).toContain(
      'at least 10 characters',
    );

    const invalidEmail = await register('not-an-email').expect(400);
    expect(JSON.stringify(invalidEmail.body.message)).toContain(
      'valid email address',
    );

    const missingName = await server()
      .post(`${API}/auth/register`)
      .send({ email: nextEmail(), password: PASSWORD })
      .expect(400);
    expect(JSON.stringify(missingName.body.message)).toContain('name');

    const emptyLogin = await server()
      .post(`${API}/auth/login`)
      .send({})
      .expect(400);
    expect(emptyLogin.body.message).toBeInstanceOf(Array);
  });

  it('logs out, clears the cookie, and revokes the session', async () => {
    const registered = await register(nextEmail()).expect(201);
    const cookie = cookiePair(registered);

    const logout = await server()
      .post(`${API}/auth/logout`)
      .set('Cookie', cookie)
      .expect(204);

    expect(firstSetCookie(logout)).toContain(`${SESSION_COOKIE_NAME}=;`);

    await server().get(`${API}/users/me`).set('Cookie', cookie).expect(401);

    await server().post(`${API}/auth/logout`).set('Cookie', cookie).expect(204);
  });

  it('rejects disabled accounts for both existing sessions and new logins', async () => {
    const email = nextEmail();
    const registered = await register(email).expect(201);
    const cookie = cookiePair(registered);

    await database.db
      .update(schema.users)
      .set({ status: 'disabled' })
      .where(eq(schema.users.id, registered.body.id));

    await server().get(`${API}/users/me`).set('Cookie', cookie).expect(401);

    const login = await server()
      .post(`${API}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(401);

    expect(login.body.message).toBe('Invalid email or password');
  });

  it('resets a password with a single-use token and revokes old sessions', async () => {
    const email = nextEmail();
    const registration = await register(email).expect(201);
    const oldCookie = firstSetCookie(registration);

    const forgot = await server()
      .post(`${API}/auth/forgot-password`)
      .send({ email })
      .expect(200);
    const token = (forgot.body as { token?: string }).token;
    expect(typeof token).toBe('string');

    await server()
      .post(`${API}/auth/reset-password`)
      .send({ token, password: 'brand-new-password' })
      .expect(204);

    // Existing sessions are revoked.
    await server().get(`${API}/users/me`).set('Cookie', oldCookie).expect(401);

    await server()
      .post(`${API}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(401);

    await server()
      .post(`${API}/auth/login`)
      .send({ email, password: 'brand-new-password' })
      .expect(200);

    // The token cannot be used twice.
    await server()
      .post(`${API}/auth/reset-password`)
      .send({ token, password: 'another-password' })
      .expect(400);
  });

  it('verifies an email with a single-use token', async () => {
    const email = nextEmail();
    const registration = await register(email).expect(201);
    expect((registration.body as { emailVerified: boolean }).emailVerified).toBe(
      false,
    );
    const cookie = firstSetCookie(registration);

    const mail = sentMails.find((item) => item.to === email);
    expect(mail).toBeTruthy();
    const match = mail!.text.match(/verify-email\/([a-f0-9]+)/);
    expect(match).toBeTruthy();
    const token = match![1];

    await server()
      .post(`${API}/auth/verify-email`)
      .send({ token })
      .expect(204);

    const me = await server()
      .get(`${API}/users/me`)
      .set('Cookie', cookie)
      .expect(200);
    expect((me.body as { emailVerified: boolean }).emailVerified).toBe(true);

    await server()
      .post(`${API}/auth/verify-email`)
      .send({ token })
      .expect(400);
  });

  it('changes a password only with the current password', async () => {
    const email = nextEmail();
    const registration = await register(email).expect(201);
    const cookie = firstSetCookie(registration);

    await server()
      .post(`${API}/auth/change-password`)
      .set('Cookie', cookie)
      .send({ currentPassword: 'wrong-password', newPassword: 'new-password-1' })
      .expect(401);

    await server()
      .post(`${API}/auth/change-password`)
      .set('Cookie', cookie)
      .send({ currentPassword: PASSWORD, newPassword: 'new-password-1' })
      .expect(204);

    await server()
      .post(`${API}/auth/login`)
      .send({ email, password: 'new-password-1' })
      .expect(200);
  });

  it('does not reveal whether an email exists when resetting a password', async () => {
    const response = await server()
      .post(`${API}/auth/forgot-password`)
      .send({ email: 'missing-user@example.com' })
      .expect(200);

    expect(response.body).toEqual({});
  });
});
