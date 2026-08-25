import type { Request, Response } from 'express';
import { sendSuccess } from '../../shared/response.js';
import * as service from './payment.service.js';

/** Parse+validate → call service → shape response. No business logic
 *  (plan.md §5.4). `req.body` here is a raw `Buffer`, not parsed JSON — see
 *  `app.ts`'s doc comment on why `/webhooks/stripe` is routed around the
 *  global `express.json()` middleware. */
export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.header('stripe-signature');
  const rawBody = req.body as Buffer;
  const result = await service.handleStripeWebhook(rawBody, signature);
  // plan.md §9.6: "200 within 5s" — always 200 once signature verification
  // passed, whether this event was newly processed or already seen
  // (`result.processed` distinguishes the two for logging only). Stripe
  // retries on anything else, which would just re-process an event this
  // handler already deliberately no-ops on.
  sendSuccess(res, { received: true, processed: result.processed });
}
