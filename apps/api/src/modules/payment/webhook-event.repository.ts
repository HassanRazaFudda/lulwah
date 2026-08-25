import { WebhookEventModel } from './webhook-event.model.js';

/** The ONLY file allowed to touch `WebhookEventModel` (plan.md §5.4). */

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 11000;
}

/**
 * Insert-or-see-duplicate-key-error, not a read-then-check race — the
 * unique index on `{provider, eventId}` is what actually makes this
 * atomic. Returns `true` if this call is the one that newly claimed the
 * event (the caller should process it), `false` if it was already seen
 * (the caller should just 200 immediately, per plan.md §9.6).
 */
export async function tryClaimWebhookEvent(provider: 'stripe', eventId: string, type: string): Promise<boolean> {
  try {
    await WebhookEventModel.create({ provider, eventId, type });
    return true;
  } catch (err) {
    if (isDuplicateKeyError(err)) return false;
    throw err;
  }
}
