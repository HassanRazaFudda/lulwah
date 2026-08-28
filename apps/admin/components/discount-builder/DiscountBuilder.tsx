'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@lulwah/ui';
import { ConfirmDialog } from '../ConfirmDialog';
import { DiscountStatusPill } from '../DiscountStatusPill';
import { PageHeader } from '../PageHeader';
import { Panel } from '../Panel';
import { Skeleton } from '../Skeleton';
import { ToastStack, useToastState } from '../Toast';
import { EditorTabs } from '../product-editor/EditorTabs';
import type { TabDef } from '../product-editor/EditorTabs';
import { discountToDraft, emptyDiscountDraft } from '../../lib/discount-draft';
import type { DiscountDraft } from '../../lib/discount-draft';
import {
  useAdminDiscountQuery,
  useCreateDiscountMutation,
  useDeleteDiscountMutation,
  useToggleDiscountMutation,
  useUpdateDiscountMutation,
} from '../../lib/queries/discounts';
import { BasicsTab } from './BasicsTab';
import { BulkCodeGenerator } from './BulkCodeGenerator';
import { ConditionsScheduleTab } from './ConditionsScheduleTab';
import { LimitsBadgeTab } from './LimitsBadgeTab';
import { PreviewTab } from './PreviewTab';
import { ValueTargetsTab } from './ValueTargetsTab';

type TabId = 'basics' | 'value-targets' | 'conditions' | 'limits-badge' | 'preview' | 'bulk-codes';

/**
 * plan.md §11.1's Discounts builder, shared by `discounts/new` and
 * `discounts/[id]` — same shell shape as `ProductEditor` (local draft
 * state, synced from server data exactly once per id, Save/Create button,
 * disabled-until-required-fields-filled). Unlike products, every tab here
 * edits the same local `DiscountDraft` (`type`/`targets`/`conditions`/…
 * are all plain fields on the one `AdminCreateDiscountInput`/
 * `AdminUpdateDiscountInput` DTO — there's no nested Media/Variants/
 * Inventory sub-resource split the way Products has), so there's no
 * "disabled until saved once" tab gating; every tab (including Bulk codes)
 * is usable immediately on a brand-new, unsaved draft — bulk generation in
 * particular creates its own N discounts directly, it doesn't depend on
 * this draft ever being saved as a single discount first.
 */
export function DiscountBuilder({ discountId }: { discountId?: string }) {
  const router = useRouter();
  const isNew = !discountId;

  const { data: discount, isLoading } = useAdminDiscountQuery(discountId ?? '');
  const createDiscount = useCreateDiscountMutation();
  const updateDiscount = useUpdateDiscountMutation();
  const deleteDiscount = useDeleteDiscountMutation();
  const toggleDiscount = useToggleDiscountMutation();
  const { toasts, push, dismiss } = useToastState();

  const [activeTab, setActiveTab] = useState<TabId>('basics');
  const [draft, setDraft] = useState<DiscountDraft>(() => emptyDiscountDraft());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const syncedId = useRef<string | null>(null);

  useEffect(() => {
    if (discount && syncedId.current !== discount.id) {
      setDraft(discountToDraft(discount));
      syncedId.current = discount.id;
    }
  }, [discount]);

  const requiredFieldsMissing = draft.name.trim() === '' || (draft.mode === 'code' && (draft.code ?? '').trim() === '');

  const handleSave = () => {
    if (isNew) {
      createDiscount.mutate(draft, {
        onSuccess: (created) => router.replace(`/discounts/${created.id}`),
      });
    } else if (discountId) {
      updateDiscount.mutate({ id: discountId, draft });
    }
  };

  const handleToggle = () => {
    if (!discountId) return;
    toggleDiscount.mutate(discountId, {
      onError: () => push(`Couldn't change ${discount?.name ?? 'this discount'}'s status. Please try again.`, 'danger'),
    });
  };

  const handleDelete = () => {
    if (!discountId) return;
    deleteDiscount.mutate(discountId, {
      onSuccess: () => {
        push('Discount deleted.', 'success');
        router.push('/discounts');
      },
      onError: () => {
        push("Couldn't delete this discount. Please try again.", 'danger');
        setConfirmingDelete(false);
      },
    });
  };

  const saving = createDiscount.isPending || updateDiscount.isPending;
  const saveError = createDiscount.error ?? updateDiscount.error;
  const justSaved = !isNew && updateDiscount.isSuccess;

  if (!isNew && isLoading) {
    return (
      <div className="flex flex-col gap-16">
        <Skeleton className="h-[52px]" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (!isNew && !discount) {
    return <p className="text-body-sm text-ink-70">Discount not found.</p>;
  }

  const tabs: TabDef[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'value-targets', label: 'Value & targets' },
    { id: 'conditions', label: 'Conditions & schedule' },
    { id: 'limits-badge', label: 'Limits & badge' },
    { id: 'preview', label: 'Preview' },
    ...(draft.mode === 'code' ? [{ id: 'bulk-codes', label: 'Bulk codes' }] : []),
  ];

  return (
    <div className="flex flex-col gap-16">
      <PageHeader
        title={isNew ? 'New discount' : draft.name || 'Discount'}
        description={!isNew && discount ? `Used ${discount.usage.usedCount} time${discount.usage.usedCount === 1 ? '' : 's'}` : 'Fill in Basics, then save.'}
        actions={
          <div className="flex items-center gap-12">
            {!isNew && discount ? <DiscountStatusPill status={discount.status} /> : null}
            {!isNew && discount ? (
              <Button type="button" variant="secondary" onClick={handleToggle} disabled={toggleDiscount.isPending}>
                {discount.status === 'active' ? 'Disable' : 'Activate'}
              </Button>
            ) : null}
            {!isNew && discount ? (
              <Button type="button" variant="secondary" className="!border-danger !text-danger" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            ) : null}
            {justSaved ? <span className="text-body-sm text-success">Saved</span> : null}
            <Button type="button" onClick={handleSave} disabled={saving || requiredFieldsMissing}>
              {saving ? 'Saving…' : isNew ? 'Create discount' : 'Save changes'}
            </Button>
          </div>
        }
      />

      {requiredFieldsMissing ? (
        <p className="text-body-sm text-ink-70">A name is required{draft.mode === 'code' ? ', and a code is required for a code-mode discount' : ''}.</p>
      ) : null}
      {saveError ? <p className="text-body-sm text-danger">{saveError.message}</p> : null}

      <EditorTabs tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      <Panel>
        {activeTab === 'basics' ? <BasicsTab draft={draft} onChange={setDraft} /> : null}
        {activeTab === 'value-targets' ? <ValueTargetsTab draft={draft} onChange={setDraft} /> : null}
        {activeTab === 'conditions' ? <ConditionsScheduleTab draft={draft} onChange={setDraft} /> : null}
        {activeTab === 'limits-badge' ? (
          <LimitsBadgeTab draft={draft} onChange={setDraft} usedCount={discount?.usage.usedCount} />
        ) : null}
        {activeTab === 'preview' ? <PreviewTab draft={draft} /> : null}
        {activeTab === 'bulk-codes' && draft.mode === 'code' ? <BulkCodeGenerator draft={draft} /> : null}
      </Panel>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete discount"
        description="This permanently removes the discount from every list and can't be undone from this screen."
        confirmText={discount?.code ?? discount?.name ?? ''}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
        isPending={deleteDiscount.isPending}
      />

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
