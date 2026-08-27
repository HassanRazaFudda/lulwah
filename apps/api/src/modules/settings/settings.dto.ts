import { z } from 'zod';
import { CodSettings, Settings, ShippingSettings, StoreDetails } from '@lulwah/contracts';

/**
 * Request/response DTOs for `/admin/settings` — plan.md §9.7/§11.1.
 * `Settings` itself lives in `@lulwah/contracts` (reused, not redefined).
 *
 * `AdminUpdateSettingsInput` has no `paymentGateway` field at all (Zod
 * silently strips any unknown key a client sends, per this codebase's
 * usual convention — see `brand.dto.ts`/`pricing.dto.ts`) — there is no
 * way to reach this endpoint and have it accept, let alone persist, a raw
 * payment-gateway key (plan.md §19). Every nested object field
 * (`storeDetails`/`shipping`/`cod`) is replaced whole when provided, the
 * same "no deep-partial merge" convention `pricing.dto.ts`'s
 * `conditions`/`usage` already uses — a client editing just the store
 * phone number still sends the complete `storeDetails` object back.
 */
export const AdminUpdateSettingsInput = z.object({
  storeDetails: StoreDetails.optional(),
  shipping: ShippingSettings.optional(),
  cod: CodSettings.optional(),
  taxRate: z.number().min(0).max(1).optional(),
  featureFlags: z.record(z.string(), z.boolean()).optional(),
  maintenanceMode: z.boolean().optional(),
});
export type AdminUpdateSettingsInput = z.infer<typeof AdminUpdateSettingsInput>;

export const AdminSettingsResponse = z.object({ settings: Settings });
export type AdminSettingsResponse = z.infer<typeof AdminSettingsResponse>;
