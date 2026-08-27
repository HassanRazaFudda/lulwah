import type { Settings } from '@lulwah/contracts';
import { env } from '../../shared/env.js';
import type { SettingsDoc, SettingsHydratedDoc } from './settings.model.js';

/**
 * Payment-gateway key presence — plan.md §19: the Settings screen may
 * only ever show a masked, read-only indicator, never a raw key. Computed
 * fresh from `env.ts` on every read, never stored on `SettingsDoc` and
 * never accepted on `PATCH` (`settings.dto.ts`'s `AdminUpdateSettingsInput`
 * has no field for it) — there is no code path anywhere in this module
 * that could persist a real key.
 *
 * The project is mid-migration from Stripe to Ziina as its card gateway
 * (a parallel P3 workstream owns the `env.ts` rename — see this module's
 * own report for why this worktree still sees the old var names). Swap
 * the two `env.STRIPE_*` reads below for `env.ZIINA_API_KEY`/
 * `env.ZIINA_WEBHOOK_SECRET` once that rename merges — `provider` already
 * reads `'ziina'` on the wire today.
 */
function paymentGatewayStatus(): Settings['paymentGateway'] {
  return {
    provider: 'ziina',
    apiKeyConfigured: Boolean(env.STRIPE_SECRET_KEY),
    webhookSecretConfigured: Boolean(env.STRIPE_WEBHOOK_SECRET),
  };
}

export function toSettingsDto(doc: SettingsDoc | SettingsHydratedDoc): Settings {
  return {
    storeDetails: doc.storeDetails,
    shipping: doc.shipping,
    cod: doc.cod,
    taxRate: doc.taxRate,
    featureFlags: doc.featureFlags,
    maintenanceMode: doc.maintenanceMode,
    paymentGateway: paymentGatewayStatus(),
    updatedAt: doc.updatedAt,
    updatedByUserId: doc.updatedByUserId ? doc.updatedByUserId.toString() : null,
  };
}
