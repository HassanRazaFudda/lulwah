import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Response as SupertestResponse } from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Express } from 'express';
import { createApp } from '../../../app.js';
import { connect, disconnect } from '../../../shared/mongo.js';
import { InMemoryRateLimitStore } from '../../../shared/rate-limit.js';
import { SessionModel, UserModel } from '../identity.model.js';

/**
 * Integration coverage for the identity module — plan.md's own priority
 * order: register → login → refresh → rotation-reuse-detection is "the
 * one mechanism in the whole auth flow worth being precise about."
 *
 * No real Mongo/Redis required: `mongodb-memory-server` stands in for
 * Mongo, and `InMemoryRateLimitStore` stands in for Redis so the 10/min
 * auth rate limit still runs (proving the middleware works) without a
 * live Redis connection.
 */

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connect(mongo.getUri());
  // mongo.ts sets autoIndex: false to match production (plan.md §36.6) —
  // create indexes explicitly so the unique-email constraint this test
  // suite relies on actually behaves like production does.
  await UserModel.syncIndexes();
  await SessionModel.syncIndexes();
}, 60_000);

afterAll(async () => {
  await disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await UserModel.deleteMany({});
  await SessionModel.deleteMany({});
});

function buildApp(): Express {
  return createApp({ rateLimitStore: new InMemoryRateLimitStore() });
}

const REGISTER_PAYLOAD = {
  email: 'amina@example.com',
  password: 'correct-horse-battery-staple',
  firstName: 'Amina',
  lastName: 'Khan',
  phone: { countryCode: '+971', number: '501234567' },
};

const CREDENTIALS = { email: REGISTER_PAYLOAD.email, password: REGISTER_PAYLOAD.password };

/** Supertest's `set-cookie` header includes attributes (`Path=...;
 *  HttpOnly; ...`) — strip down to `name=value` for replaying on a
 *  later request via a manually-set `Cookie` header. */
function extractCookie(res: SupertestResponse): string {
  const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!raw) throw new Error('expected a Set-Cookie header on the response');
  return raw.split(';')[0] ?? raw;
}

async function registerAndLogin(app: Express): Promise<{ cookie: string; accessToken: string }> {
  await request(app).post('/api/v1/auth/register').send(REGISTER_PAYLOAD);
  const loginRes = await request(app).post('/api/v1/auth/login').send(CREDENTIALS);
  return { cookie: extractCookie(loginRes), accessToken: loginRes.body.data.accessToken as string };
}

describe('POST /api/v1/auth/register', () => {
  it('creates a user and never returns the password hash', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/v1/auth/register').send(REGISTER_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(REGISTER_PAYLOAD.email);
    expect(res.body.data.user.role).toBe('customer');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('rejects a duplicate email with AUTH_EMAIL_EXISTS (409)', async () => {
    const app = buildApp();
    await request(app).post('/api/v1/auth/register').send(REGISTER_PAYLOAD);
    const res = await request(app).post('/api/v1/auth/register').send(REGISTER_PAYLOAD);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AUTH_EMAIL_EXISTS');
    expect(res.body.requestId).toMatch(/^req_/);
  });

  it('rejects a malformed payload with VALIDATION_FAILED (400)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...REGISTER_PAYLOAD, email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('POST /api/v1/auth/login', () => {
  it('issues an access token and an httpOnly, Secure-flagged-when-configured refresh cookie', async () => {
    const app = buildApp();
    await request(app).post('/api/v1/auth/register').send(REGISTER_PAYLOAD);
    const res = await request(app).post('/api/v1/auth/login').send(CREDENTIALS);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    const cookie = res.headers['set-cookie']?.[0] as string;
    expect(cookie).toContain('lulwah_refresh=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('rejects the wrong password with AUTH_INVALID_CREDENTIALS (401)', async () => {
    const app = buildApp();
    await request(app).post('/api/v1/auth/register').send(REGISTER_PAYLOAD);
    const res = await request(app).post('/api/v1/auth/login').send({ email: REGISTER_PAYLOAD.email, password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('locks the account after 5 failed attempts (plan.md §10.1)', async () => {
    const app = buildApp();
    await request(app).post('/api/v1/auth/register').send(REGISTER_PAYLOAD);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app).post('/api/v1/auth/login').send({ email: REGISTER_PAYLOAD.email, password: 'wrong' });
    }

    const res = await request(app).post('/api/v1/auth/login').send(CREDENTIALS);
    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('AUTH_ACCOUNT_LOCKED');
  });
});

describe('POST /api/v1/auth/refresh — rotation and reuse detection', () => {
  it('rotates the refresh token and access token on every use', async () => {
    const app = buildApp();
    const { cookie, accessToken } = await registerAndLogin(app);

    const refreshRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).not.toBe(accessToken);
    expect(extractCookie(refreshRes)).not.toBe(cookie);
  });

  it(
    'revokes the entire token family when a used (rotated) refresh token is replayed, ' +
      'so a subsequent refresh with the newer, legitimately-rotated token also fails',
    async () => {
      const app = buildApp();
      const { cookie: tokenA } = await registerAndLogin(app);

      // Legitimate rotation: A -> B.
      const rotateRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', tokenA);
      expect(rotateRes.status).toBe(200);
      const tokenB = extractCookie(rotateRes);

      // Replay the old token A — it was already rotated away from.
      const replayRes = await request(app).post('/api/v1/auth/refresh').set('Cookie', tokenA);
      expect(replayRes.status).toBe(401);
      expect(replayRes.body.error.code).toBe('AUTH_TOKEN_REUSED');

      // The legitimate successor token B must ALSO now fail — proof the
      // whole family was revoked, not just the replayed token A.
      const secondAttemptWithB = await request(app).post('/api/v1/auth/refresh').set('Cookie', tokenB);
      expect(secondAttemptWithB.status).toBe(401);

      // Every session in the family is revoked at the data layer too.
      const sessions = await SessionModel.find({}).lean();
      expect(sessions.length).toBeGreaterThanOrEqual(2);
      expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);
    },
  );

  it('rejects a refresh with no cookie at all (AUTH_TOKEN_EXPIRED)', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_EXPIRED');
  });

  it('rejects a well-formed but unknown session id without revoking anything (not a reuse signal)', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'lulwah_refresh=64b7f7f7f7f7f7f7f7f7f7f7.not-a-real-secret');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_EXPIRED');
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the current session so a later refresh fails', async () => {
    const app = buildApp();
    const { cookie } = await registerAndLogin(app);

    const logoutRes = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(logoutRes.status).toBe(200);

    const refreshAfterLogout = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refreshAfterLogout.status).toBe(401);
  });
});

describe('POST /api/v1/auth/logout-all', () => {
  it('revokes every session for the user, across families', async () => {
    const app = buildApp();
    const { cookie: sessionOne, accessToken } = await registerAndLogin(app);
    const loginTwo = await request(app).post('/api/v1/auth/login').send(CREDENTIALS);
    const sessionTwo = extractCookie(loginTwo);

    const logoutAllRes = await request(app).post('/api/v1/auth/logout-all').set('Authorization', `Bearer ${accessToken}`);
    expect(logoutAllRes.status).toBe(200);

    const refreshOne = await request(app).post('/api/v1/auth/refresh').set('Cookie', sessionOne);
    const refreshTwo = await request(app).post('/api/v1/auth/refresh').set('Cookie', sessionTwo);
    expect(refreshOne.status).toBe(401);
    expect(refreshTwo.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the authenticated user', async () => {
    const app = buildApp();
    const { accessToken } = await registerAndLogin(app);

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(REGISTER_PAYLOAD.email);
  });

  it('rejects a missing token with 401', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('stub routes (plan.md: OTP/Google return 501 in this skeleton)', () => {
  it.each(['/api/v1/auth/otp/request', '/api/v1/auth/otp/verify', '/api/v1/auth/google'])(
    '%s returns 501 SERVICE_UNAVAILABLE',
    async (path) => {
      const app = buildApp();
      const res = await request(app).post(path).send({});
      expect(res.status).toBe(501);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    },
  );
});

describe('admin RBAC (plan.md §10.2)', () => {
  it('forbids a plain customer from listing admin users (403)', async () => {
    const app = buildApp();
    const { accessToken } = await registerAndLogin(app);

    const res = await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTH_FORBIDDEN');
  });

  it('allows a super_admin to list users and change another user\'s role', async () => {
    const app = buildApp();
    await request(app).post('/api/v1/auth/register').send(REGISTER_PAYLOAD);
    // Promote directly at the data layer — there is no signup flow for
    // staff roles in this skeleton, only the customer self-register path.
    await UserModel.updateOne({ email: REGISTER_PAYLOAD.email }, { role: 'super_admin' });
    const loginRes = await request(app).post('/api/v1/auth/login').send(CREDENTIALS);
    const accessToken = loginRes.body.data.accessToken as string;

    const listRes = await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${accessToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.users.length).toBeGreaterThan(0);

    const targetId = listRes.body.data.users[0].id as string;
    const roleRes = await request(app)
      .patch(`/api/v1/admin/users/${targetId}/role`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ role: 'catalog' });

    expect(roleRes.status).toBe(200);
    expect(roleRes.body.data.user.role).toBe('catalog');
  });
});
