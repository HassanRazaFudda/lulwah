import { logger } from './logger.js';

/**
 * plan.md §22: order/payment notifications (email + SMS) are a **logged
 * stub**, not a real network call — no Resend/Unifonic keys exist for this
 * project (see `env.ts`'s own doc comment: those vars are declared and
 * validated, but kept optional, for exactly this reason). This is the one
 * function every module that would otherwise call a real provider calls
 * instead — `order` (status-change emails/SMS), `payment`'s `CodGateway`
 * (the OTP "SMS"). Logging at `info` (not `debug`) is deliberate: the hook
 * point needs to be real and testable/visible in a live smoke test even
 * though delivery isn't wired to a real provider, per the brief.
 *
 * Shared here (`shared/`, not owned by any one module) because more than
 * one module needs it and none of them owns "notifications" as a concept —
 * matches plan.md §5.3's own future `engagement` module boundary; this is
 * a placeholder standing in for it, not a redesign of it.
 */
export interface NotifyStubParams {
  channel: 'email' | 'sms';
  to: string;
  template: string;
  data: Record<string, unknown>;
}

export function notifyStub(params: NotifyStubParams): void {
  logger.info({ msg: 'notification stub — no real provider configured', channel: params.channel, to: params.to, template: params.template, data: params.data });
}
