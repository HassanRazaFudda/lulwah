'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Emirate, Settings, ShippingRate } from '@lulwah/contracts';
import { Button, Input, cx } from '@lulwah/ui';
import { MoneyInput } from '../../../components/product-editor/MoneyInput';
import { labelClassName, selectClassName } from '../../../components/product-editor/field-styles';
import { Panel } from '../../../components/Panel';
import { PageHeader } from '../../../components/PageHeader';
import { Skeleton } from '../../../components/Skeleton';
import { EMIRATES, EMIRATE_LABELS } from '../../../lib/emirates';
import { useAdminSettingsQuery, useUpdateSettingsMutation } from '../../../lib/queries/settings';

/**
 * plan.md §11.1 Settings, real `GET/PATCH /admin/settings`
 * (`apps/api/src/modules/settings/`). Scope matches what that module
 * actually built (see its own report, restated here so this screen's
 * absences are legible without cross-referencing another workstream):
 *
 * - **Built and DB-backed, genuinely affecting live checkout math**: store
 *   details + TRN, the per-emirate shipping-rate table + free-shipping
 *   threshold, COD fee/cap, VAT rate, feature flags, maintenance mode.
 * - **Payment gateway**: read-only status card only — `PaymentGatewayStatus`
 *   is computed from `env.ts` at read time and is never accepted on
 *   `PATCH` (Zod strips unknown keys; `AdminUpdateSettingsInput` has no
 *   field for it at all). There is no input anywhere on this page that
 *   could submit a raw key, matching plan.md §19's "secrets live only in
 *   `.env`" rule.
 * - **Not built here, deliberately**: email/SMS template management (no
 *   notification provider is wired up anywhere in this codebase —
 *   `shared/notify.ts` is a logged stub) and legal pages (owned by the
 *   parallel `content` module's `Page` type — linked to below, not
 *   duplicated).
 * - **Feature flags / maintenance mode — a real gap worth stating plainly**:
 *   both round-trip to real Mongo fields and the toggles below fire real
 *   optimistic `PATCH`es. But nothing else in this codebase reads either
 *   field yet — no maintenance-mode middleware gates the storefront, no
 *   code path branches on any flag in `featureFlags` (confirmed by reading
 *   every call site of `settings.service.ts#getSettingsSnapshot`, the only
 *   place either field leaves this module). Toggling here persists for
 *   real; it does not yet change any live behaviour anywhere.
 */

interface SettingsDraft {
  storeDetails: Settings['storeDetails'];
  shipping: Settings['shipping'];
  cod: Settings['cod'];
  /** Displayed as a 0–100 percentage string; converted to the `[0,1]`
   *  fraction `taxRate` (`@lulwah/contracts`' `Settings`) only at save. */
  taxRatePercent: string;
}

function ratesForAllEmirates(rates: ShippingRate[]): ShippingRate[] {
  return EMIRATES.map(
    (emirate) => rates.find((r) => r.emirate === emirate) ?? { emirate, feeFils: 0, etaMinDays: 1, etaMaxDays: 3 },
  );
}

function toDraft(settings: Settings): SettingsDraft {
  return {
    storeDetails: settings.storeDetails,
    shipping: { ...settings.shipping, rates: ratesForAllEmirates(settings.shipping.rates) },
    cod: settings.cod,
    taxRatePercent: (settings.taxRate * 100).toFixed(2),
  };
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useAdminSettingsQuery();
  const updateSettings = useUpdateSettingsMutation();

  // Sync the draft from server data exactly once, the same `ProductEditor`
  // precedent `lib/product-draft.ts` sets — the feature-flag/maintenance
  // toggles below mutate the same query cache independently and must not
  // clobber an in-progress edit to store details/shipping/COD/tax.
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const initialized = useRef(false);
  useEffect(() => {
    if (settings && !initialized.current) {
      setDraft(toDraft(settings));
      initialized.current = true;
    }
  }, [settings]);

  if (isLoading || !settings || !draft) {
    return (
      <div className="flex flex-col gap-16">
        <Skeleton className="h-[52px]" />
        <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[220px]" />
          ))}
        </div>
      </div>
    );
  }

  const parsedTaxPercent = Number(draft.taxRatePercent);
  const taxValid = Number.isFinite(parsedTaxPercent) && parsedTaxPercent >= 0 && parsedTaxPercent <= 100;
  const ratesValid = draft.shipping.rates.every(
    (r) => r.feeFils >= 0 && r.etaMinDays >= 1 && r.etaMaxDays >= r.etaMinDays,
  );
  const detailsValid = draft.storeDetails.name.trim() !== '' && taxValid && ratesValid;

  const handleSaveDetails = () => {
    if (!detailsValid) return;
    updateSettings.mutate({
      storeDetails: draft.storeDetails,
      shipping: draft.shipping,
      cod: draft.cod,
      taxRate: Math.round((parsedTaxPercent / 100) * 1_000_000) / 1_000_000,
    });
  };

  const updateRate = (emirate: Emirate, patch: Partial<Omit<ShippingRate, 'emirate'>>) => {
    setDraft({
      ...draft,
      shipping: {
        ...draft.shipping,
        rates: draft.shipping.rates.map((r) => (r.emirate === emirate ? { ...r, ...patch } : r)),
      },
    });
  };

  return (
    <div className="flex flex-col gap-16">
      <PageHeader
        title="Settings"
        description="Store details, shipping, COD, tax, feature flags and maintenance mode: real GET/PATCH /admin/settings."
        actions={
          <div className="flex items-center gap-12">
            {updateSettings.isSuccess ? <span className="text-body-sm text-success">Saved</span> : null}
            <Button type="button" onClick={handleSaveDetails} disabled={!detailsValid || updateSettings.isPending}>
              {updateSettings.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        }
      />

      {!detailsValid ? (
        <p className="text-body-sm text-danger">
          Store name is required; tax rate must be 0–100%; every shipping row needs a non-negative fee and a max ETA
          that is not shorter than its min ETA.
        </p>
      ) : null}
      {updateSettings.isError ? <p className="text-body-sm text-danger">{updateSettings.error.message}</p> : null}

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
        <Panel title="Store details & TRN">
          <div className="grid grid-cols-1 gap-16 sm:grid-cols-2">
            <Input
              label="Store name"
              value={draft.storeDetails.name}
              onChange={(e) => setDraft({ ...draft, storeDetails: { ...draft.storeDetails, name: e.target.value } })}
            />
            <Input
              label="TRN (Tax Registration Number)"
              value={draft.storeDetails.trn}
              onChange={(e) => setDraft({ ...draft, storeDetails: { ...draft.storeDetails, trn: e.target.value } })}
            />
            <Input
              label="Email"
              value={draft.storeDetails.email}
              onChange={(e) => setDraft({ ...draft, storeDetails: { ...draft.storeDetails, email: e.target.value } })}
            />
            <Input
              label="Phone"
              value={draft.storeDetails.phone}
              onChange={(e) => setDraft({ ...draft, storeDetails: { ...draft.storeDetails, phone: e.target.value } })}
            />
            <Input
              label="WhatsApp"
              value={draft.storeDetails.whatsapp}
              onChange={(e) =>
                setDraft({ ...draft, storeDetails: { ...draft.storeDetails, whatsapp: e.target.value } })
              }
            />
            <div className="flex flex-col gap-4">
              <label htmlFor="store-emirate" className={labelClassName}>
                Emirate
              </label>
              <select
                id="store-emirate"
                className={selectClassName}
                value={draft.storeDetails.address.emirate}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    storeDetails: {
                      ...draft.storeDetails,
                      address: { ...draft.storeDetails.address, emirate: e.target.value as Emirate },
                    },
                  })
                }
              >
                {EMIRATES.map((emirate) => (
                  <option key={emirate} value={emirate}>
                    {EMIRATE_LABELS[emirate]}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Address line 1"
              value={draft.storeDetails.address.line1}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  storeDetails: { ...draft.storeDetails, address: { ...draft.storeDetails.address, line1: e.target.value } },
                })
              }
            />
            <Input
              label="Address line 2"
              value={draft.storeDetails.address.line2}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  storeDetails: { ...draft.storeDetails, address: { ...draft.storeDetails.address, line2: e.target.value } },
                })
              }
            />
            <Input
              label="City"
              value={draft.storeDetails.address.city}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  storeDetails: { ...draft.storeDetails, address: { ...draft.storeDetails.address, city: e.target.value } },
                })
              }
            />
          </div>
        </Panel>

        <Panel title="COD fee & cap, tax rate">
          <div className="flex flex-col gap-16">
            <MoneyInput
              label="COD fee (AED)"
              valueFils={draft.cod.feeFils}
              onChange={(fils) => setDraft({ ...draft, cod: { ...draft.cod, feeFils: fils ?? 0 } })}
            />
            <MoneyInput
              label="COD max order value (AED)"
              valueFils={draft.cod.maxOrderFils}
              onChange={(fils) => setDraft({ ...draft, cod: { ...draft.cod, maxOrderFils: fils ?? 0 } })}
            />
            <Input
              label="VAT rate (%)"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={draft.taxRatePercent}
              onChange={(e) => setDraft({ ...draft, taxRatePercent: e.target.value })}
              {...(taxValid ? {} : { errorMessage: 'Enter a percentage between 0 and 100.' })}
            />
            <MoneyInput
              label="Free shipping threshold (AED)"
              valueFils={draft.shipping.freeShippingThresholdFils}
              onChange={(fils) =>
                setDraft({ ...draft, shipping: { ...draft.shipping, freeShippingThresholdFils: fils ?? 0 } })
              }
            />
          </div>
        </Panel>
      </div>

      <Panel title="Shipping rates by emirate">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-line text-left text-label uppercase tracking-label text-ink-70">
                <th className="py-8 pr-16">Emirate</th>
                <th className="py-8 pr-16">Fee (AED)</th>
                <th className="py-8 pr-16">ETA min (days)</th>
                <th className="py-8 pr-16">ETA max (days)</th>
              </tr>
            </thead>
            <tbody>
              {draft.shipping.rates.map((rate) => (
                <tr key={rate.emirate} className="border-b border-line">
                  <td className="py-8 pr-16 font-semibold text-ink">{EMIRATE_LABELS[rate.emirate]}</td>
                  <td className="py-8 pr-16">
                    <MoneyInput
                      label={`${EMIRATE_LABELS[rate.emirate]} fee`}
                      valueFils={rate.feeFils}
                      onChange={(fils) => updateRate(rate.emirate, { feeFils: fils ?? 0 })}
                    />
                  </td>
                  <td className="py-8 pr-16">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={rate.etaMinDays}
                      onChange={(e) => updateRate(rate.emirate, { etaMinDays: Math.max(1, Number(e.target.value) || 1) })}
                      className="h-[40px] w-[80px] border border-line bg-paper px-8 text-body-sm text-ink outline-none focus:border-zamurrad"
                    />
                  </td>
                  <td className="py-8 pr-16">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={rate.etaMaxDays}
                      onChange={(e) => updateRate(rate.emirate, { etaMaxDays: Math.max(1, Number(e.target.value) || 1) })}
                      className="h-[40px] w-[80px] border border-line bg-paper px-8 text-body-sm text-ink outline-none focus:border-zamurrad"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
        <FeatureFlagsPanel settings={settings} />
        <MaintenanceModePanel settings={settings} />
      </div>

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
        <PaymentGatewayPanel settings={settings} />
        <Panel title="Legal pages">
          <p className="text-body-sm text-ink-70">
            Legal pages (shipping, returns, privacy, terms, cookies) are owned by the Content module&apos;s Page
            type, not duplicated here.
          </p>
          <Link href="/content" className="mt-8 inline-block text-body-sm text-zamurrad hover:underline">
            Go to Content →
          </Link>
        </Panel>
      </div>
    </div>
  );
}

/**
 * plan.md §11.2 rule 2 — a genuine optimistic toggle, independent of the
 * batched store-details/shipping/cod/tax draft above: each checkbox fires
 * `PATCH { featureFlags }` immediately with the full updated map (the DTO
 * replaces `featureFlags` whole, per `settings.dto.ts`), rolls back on
 * failure, and re-syncs from the server on settle.
 */
function FeatureFlagsPanel({ settings }: { settings: Settings }) {
  const updateSettings = useUpdateSettingsMutation();
  const [newKey, setNewKey] = useState('');
  const flags = settings.featureFlags;
  const entries = Object.entries(flags);

  const setFlag = (key: string, value: boolean) => {
    updateSettings.mutate({ featureFlags: { ...flags, [key]: value } });
  };
  const removeFlag = (key: string) => {
    const next = Object.fromEntries(entries.filter(([k]) => k !== key));
    updateSettings.mutate({ featureFlags: next });
  };
  const addFlag = () => {
    const key = newKey.trim();
    if (!key || key in flags) return;
    updateSettings.mutate({ featureFlags: { ...flags, [key]: true } });
    setNewKey('');
  };

  return (
    <Panel title="Feature flags">
      <div className="flex flex-col gap-12">
        <p className="text-body-sm text-ink-70">
          Persisted for real in MongoDB, but no code path in this repo reads any of these flags yet. Toggling here
          has no live effect until a future feature is built to check it.
        </p>
        {entries.length === 0 ? (
          <p className="text-body-sm text-ink-70">No feature flags yet.</p>
        ) : (
          <ul className="flex flex-col gap-8">
            {entries.map(([key, value]) => (
              <li key={key} className="flex items-center justify-between gap-8">
                <label className="flex items-center gap-8 text-body-sm text-ink">
                  <input
                    type="checkbox"
                    checked={value}
                    disabled={updateSettings.isPending}
                    onChange={(e) => setFlag(key, e.target.checked)}
                  />
                  {key}
                </label>
                <button
                  type="button"
                  onClick={() => removeFlag(key)}
                  disabled={updateSettings.isPending}
                  className="text-body-sm text-danger hover:underline disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-end gap-8">
          <Input label="New flag key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <Button type="button" variant="secondary" onClick={addFlag} disabled={!newKey.trim() || updateSettings.isPending}>
            Add
          </Button>
        </div>
        {updateSettings.isError ? <p className="text-body-sm text-danger">{updateSettings.error.message}</p> : null}
      </div>
    </Panel>
  );
}

function MaintenanceModePanel({ settings }: { settings: Settings }) {
  const updateSettings = useUpdateSettingsMutation();

  return (
    <Panel title="Maintenance mode">
      <div className="flex flex-col gap-12">
        <p className="text-body-sm text-ink-70">
          Persisted for real, but no middleware in `apps/web`/`apps/api` currently reads this flag to actually block
          storefront traffic. Toggling here writes the value; it does not yet put the storefront into maintenance.
        </p>
        <label className="flex items-center gap-8 text-body-sm text-ink">
          <input
            type="checkbox"
            checked={settings.maintenanceMode}
            disabled={updateSettings.isPending}
            onChange={(e) => updateSettings.mutate({ maintenanceMode: e.target.checked })}
          />
          Storefront maintenance mode {settings.maintenanceMode ? 'ON' : 'OFF'}
        </label>
        {updateSettings.isError ? <p className="text-body-sm text-danger">{updateSettings.error.message}</p> : null}
      </div>
    </Panel>
  );
}

/** Read-only, per plan.md §19 — never an input for a raw key. */
function PaymentGatewayPanel({ settings }: { settings: Settings }) {
  const gw = settings.paymentGateway;
  return (
    <Panel title="Payment gateway">
      <div className="flex flex-col gap-8 text-body-sm">
        <div className="flex items-center justify-between">
          <span className="text-ink-70">Provider</span>
          <span className="font-semibold text-ink">{gw.provider}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-70">API key configured</span>
          <StatusPill ok={gw.apiKeyConfigured} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-70">Webhook secret configured</span>
          <StatusPill ok={gw.webhookSecretConfigured} />
        </div>
        <p className="mt-8 text-body-sm text-ink-70">
          Read-only status computed from server env vars. Real secrets live only in <code>.env</code>; there is no
          field anywhere in this form that can submit or display a raw key (plan.md §19).
        </p>
      </div>
    </Panel>
  );
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={cx(
        'rounded-sm border px-8 py-4 text-[10px] font-semibold uppercase tracking-label',
        ok ? 'border-success/40 bg-success/12 text-success' : 'border-warning/40 bg-warning/12 text-warning',
      )}
    >
      {ok ? 'Configured' : 'Not configured'}
    </span>
  );
}
