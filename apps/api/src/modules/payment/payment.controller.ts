import type { Request, Response } from 'express';
import { sendSuccess } from '../../shared/response.js';
import * as service from './payment.service.js';

/** Parse+validate → call service → shape response. No business logic
 *  (plan.md §5.4). `req.body` here is a raw `Buffer`, not parsed JSON — see
 *  `app.ts`'s doc comment on why `/webhooks/ziina` is routed around the
 *  global `express.json()` middleware. */
export async function ziinaWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.header('x-hmac-signature');
  const rawBody = req.body as Buffer;
  const result = await service.handleZiinaWebhook(rawBody, signature);
  // plan.md §9.6: "200 within 5s" — always 200 once signature verification
  // passed, whether this event was newly processed or already seen
  // (`result.processed` distinguishes the two for logging only). Ziina
  // retries a non-2xx response 3x (docs §6), which would just re-process
  // an event this handler already deliberately no-ops on.
  sendSuccess(res, { received: true, processed: result.processed });
}
