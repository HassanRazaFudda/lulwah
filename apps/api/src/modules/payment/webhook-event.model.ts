import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * Mongoose schema for `webhook_events` — plan.md §9.6: "verify signature →
 * check an idempotency store... if seen, 200 immediately → else persist +
 * process." A Mongo collection of processed Ziina event ids (the brief's
 * own "a Mongo collection or Redis set... is fine" — Mongo chosen since
 * this process already has a Mongo connection and the durability matters
 * more than the lookup speed here: a missed dedupe means double-processing
 * a payment event, not a UX hiccup).
 *
 * `provider` is just a label distinguishing which gateway an `eventId`
 * belongs to (no Stripe/Ziina-specific meaning baked into this schema) —
 * `'stripe'` → `'ziina'` when the card gateway was swapped was a one-line
 * change here.
 *
 * `eventId` unique-indexed is the actual dedupe mechanism — insert-or-see-
 * duplicate-key-error, not a read-then-write race (`payment.service.ts`
 * relies on this, not on checking existence first).
 */
export interface WebhookEventDoc {
  _id: Types.ObjectId;
  provider: 'ziina';
  eventId: string;
  type: string;
  processedAt: Date;
  createdAt: Date;
}

const webhookEventSchema = new Schema<WebhookEventDoc>(
  {
    provider: { type: String, enum: ['ziina'], required: true },
    eventId: { type: String, required: true },
    type: { type: String, required: true },
    processedAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'webhook_events' },
);

webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export type WebhookEventHydratedDoc = HydratedDocument<WebhookEventDoc>;
export const WebhookEventModel = model<WebhookEventDoc>('WebhookEvent', webhookEventSchema);
