import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { randomInt } from 'node:crypto';
import { connect, disconnect } from '../../../shared/mongo.js';
import { CodOtpModel } from '../cod-otp.model.js';
import { CodGateway } from '../cod.gateway.js';

/**
 * Unit coverage for `CodGateway` — plan.md §20. This is the one payment
 * path the brief says should be fully live-verifiable end to end (no
 * external API), so it gets the most thorough test treatment: 3-attempt
 * cap, 10-minute expiry, and "the code is only good once" — same
 * boundaries `identity`'s login lockout tests apply to its own tunables.
 *
 * `node:crypto` is mocked via `vi.mock` (not `vi.spyOn` on a live import —
 * Node's built-in ESM module namespace objects are non-configurable, so
 * `vi.spyOn` throws "Cannot redefine property" here) so `randomInt` can be
 * pinned to a known value per test, making the otherwise-random OTP code
 * deterministic and verifiable without ever reading the gateway's own
 * private hashing.
 */
vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return { ...actual, randomInt: vi.fn(actual.randomInt) };
});

const mockedRandomInt = vi.mocked(randomInt);

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await connect(mongo.getUri());
}, 60_000);

afterAll(async () => {
  await disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await CodOtpModel.deleteMany({});
});

/** Pins the next generated OTP code to a known 6-digit value — every test
 *  below primes exactly one value per `requestOtp` call it makes, so no
 *  "restore the real implementation" fallback is needed between tests. */
function pinNextCode(code: number): void {
  mockedRandomInt.mockReturnValueOnce(code);
}

describe('CodGateway', () => {
  it('requestOtp creates a hashed OTP record, never storing the code in cleartext', async () => {
    const gateway = new CodGateway();
    const { intentId } = await gateway.requestOtp('session-1', '+971501234567');

    const doc = await CodOtpModel.findById(intentId).lean();
    expect(doc).not.toBeNull();
    expect(doc?.checkoutSessionId).toBe('session-1'); // the uuid, not a re-cast ObjectId
    expect(doc?.codeHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex, not a raw 6-digit code
    expect(doc?.attempts).toBe(0);
    expect(doc?.verifiedAt).toBeNull();
  });

  it('createIntent (the PaymentGateway-interface entry point) requires a phone number', async () => {
    const gateway = new CodGateway();
    await expect(gateway.createIntent({ reference: 'session-1', amountFils: 10_000, currency: 'AED', method: 'cod', customerEmail: null, customerPhone: null, successUrl: null, cancelUrl: null, failureUrl: null })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('createIntent succeeds with a phone and reports otp-required status', async () => {
    const gateway = new CodGateway();
    const result = await gateway.createIntent({ reference: 'session-2', amountFils: 10_000, currency: 'AED', method: 'cod', customerEmail: null, customerPhone: '+971501234567', successUrl: null, cancelUrl: null, failureUrl: null });
    expect(result.redirectUrl).toBeNull();
    expect(result.status).toBe('requires_action');
  });

  it('verifyOtp rejects a wrong code and accepts the real one', async () => {
    pinNextCode(123123);
    const gateway = new CodGateway();
    await gateway.requestOtp('session-3', '+971501234567');

    const wrong = await gateway.verifyOtp('session-3', '999999');
    expect(wrong).toEqual({ verified: false, reason: 'invalid' });
    const right = await gateway.verifyOtp('session-3', '123123');
    expect(right.verified).toBe(true);
  });

  it('a second verify of an already-verified OTP short-circuits to verified (does not re-check the code)', async () => {
    pinNextCode(123456);
    const gateway = new CodGateway();
    await gateway.requestOtp('session-4', '+971501234567');

    const first = await gateway.verifyOtp('session-4', '123456');
    expect(first.verified).toBe(true);
    const second = await gateway.verifyOtp('session-4', '123456');
    expect(second.verified).toBe(true);
  });

  it('rejects an unknown session with not_requested', async () => {
    const gateway = new CodGateway();
    const result = await gateway.verifyOtp('never-requested', '123456');
    expect(result).toEqual({ verified: false, reason: 'not_requested' });
  });

  it('caps at 3 attempts, then rejects even the correct code', async () => {
    pinNextCode(654321);
    const gateway = new CodGateway();
    await gateway.requestOtp('session-5', '+971501234567');

    await gateway.verifyOtp('session-5', '111111');
    await gateway.verifyOtp('session-5', '222222');
    await gateway.verifyOtp('session-5', '333333');
    const fourth = await gateway.verifyOtp('session-5', '654321'); // the actually-correct code, too late
    expect(fourth).toEqual({ verified: false, reason: 'too_many_attempts' });
  });

  it('rejects an expired OTP even with the correct code', async () => {
    pinNextCode(999999);
    const gateway = new CodGateway();
    await gateway.requestOtp('session-6', '+971501234567');

    await CodOtpModel.updateOne({ checkoutSessionId: 'session-6' }, { expiresAt: new Date(Date.now() - 1000) });
    const result = await gateway.verifyOtp('session-6', '999999');
    expect(result).toEqual({ verified: false, reason: 'expired' });
  });

  it('verifyOtp always checks the most recently requested OTP for a session', async () => {
    const gateway = new CodGateway();
    pinNextCode(111111);
    await gateway.requestOtp('session-7', '+971501234567');
    pinNextCode(222222);
    await gateway.requestOtp('session-7', '+971501234567'); // supersedes the first

    const stale = await gateway.verifyOtp('session-7', '111111');
    expect(stale.verified).toBe(false);
    const fresh = await gateway.verifyOtp('session-7', '222222');
    expect(fresh.verified).toBe(true);
  });
});
