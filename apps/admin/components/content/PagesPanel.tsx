'use client';

import { useState } from 'react';
import type { Page, PageStatus } from '@lulwah/contracts';
import { Button, Input } from '@lulwah/ui';
import { Skeleton } from '../Skeleton';
import { TypedConfirmDialog } from '../TypedConfirmDialog';
import { pushToast } from '../../lib/stores/toast-store';
import {
  useAdminPagesQuery,
  useCreatePageMutation,
  useUpdatePageMutation,
  useDeletePageMutation,
} from '../../lib/queries/content-pages';
import type { PageDraft } from '../../lib/queries/content-pages';
import { labelClassName, selectClassName, textareaClassName } from '../product-editor/field-styles';

function pageToDraft(page: Page): PageDraft {
  return {
    slug: page.slug,
    titleEn: page.titleEn,
    titleAr: page.titleAr,
    bodyEn: page.bodyEn,
    bodyAr: page.bodyAr,
    status: page.status,
    seo: page.seo,
  };
}

function emptyDraft(): PageDraft {
  return { slug: '', titleEn: '', titleAr: '', bodyEn: '', bodyAr: '', status: 'draft', seo: {} };
}

/**
 * plan.md §11.1: "Pages — rich text EN/AR." No rich-text editor library is
 * a dependency anywhere in this app (checked `package.json` and every
 * existing content-editing surface — the product editor's own Description
 * field, `BasicsTab.tsx`, is a plain `<textarea>` too) — the backend does
 * sanitize `bodyEn`/`bodyAr` as HTML server-side (`content/sanitize.ts`),
 * so pasted HTML is accepted and cleaned, but there is no WYSIWYG toolbar
 * here. Per this task's brief, that's the honest fallback rather than
 * shipping something that only looks like a rich editor.
 */
export function PagesPanel() {
  const { data: pages, isLoading } = useAdminPagesQuery();
  const createPage = useCreatePageMutation();
  const updatePage = useUpdatePageMutation();
  const deletePage = useDeletePageMutation();

  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<PageDraft>(emptyDraft());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const list = pages ?? [];

  const startNew = () => {
    setDraft(emptyDraft());
    setEditingId('new');
  };
  const startEdit = (page: Page) => {
    setDraft(pageToDraft(page));
    setEditingId(page.id);
  };

  const handleSave = () => {
    if (editingId === 'new') {
      createPage.mutate(draft, {
        onSuccess: () => {
          pushToast('success', 'Page created.');
          setEditingId(null);
        },
        onError: (error) => pushToast('error', `Could not create page: ${error.message}`),
      });
    } else if (editingId) {
      updatePage.mutate(
        { id: editingId, draft },
        {
          onSuccess: () => {
            pushToast('success', 'Page saved.');
            setEditingId(null);
          },
          onError: (error) => pushToast('error', `Could not save page: ${error.message}`),
        },
      );
    }
  };

  const handleDelete = () => {
    if (!pendingDeleteId) return;
    deletePage.mutate(pendingDeleteId, {
      onSuccess: () => {
        pushToast('success', 'Page deleted.');
        setPendingDeleteId(null);
        if (editingId === pendingDeleteId) setEditingId(null);
      },
      onError: (error) => pushToast('error', `Could not delete page: ${error.message}`),
    });
  };

  const saving = createPage.isPending || updatePage.isPending;
  const pendingDeletePage = list.find((p) => p.id === pendingDeleteId) ?? null;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[48px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-16">
      <div className="flex justify-end">
        <Button type="button" onClick={startNew}>
          New page
        </Button>
      </div>

      <div className="flex flex-col gap-8">
        {list.length === 0 ? <p className="text-body-sm text-ink-70">No pages yet.</p> : null}
        {list.map((page) => (
          <div key={page.id} className="border border-line bg-paper">
            <div className="flex flex-wrap items-center gap-12 px-16 py-12">
              <span className="text-body-sm font-semibold text-ink">{page.titleEn || '(untitled)'}</span>
              <span className="text-body-sm text-ink-70">/{page.slug}</span>
              <span
                className={
                  page.status === 'published'
                    ? 'text-label uppercase tracking-label text-success'
                    : 'text-label uppercase tracking-label text-ink-70'
                }
              >
                {page.status}
              </span>
              <div className="flex-1" />
              <Button type="button" variant="secondary" onClick={() => startEdit(page)}>
                Edit
              </Button>
              <button type="button" className="text-body-sm text-danger hover:underline" onClick={() => setPendingDeleteId(page.id)}>
                Delete
              </button>
            </div>

            {editingId === page.id ? (
              <div className="border-t border-line p-16">
                <PageForm draft={draft} onChange={setDraft} />
                {updatePage.isError ? <p className="mt-8 text-body-sm text-danger">{updatePage.error.message}</p> : null}
                <div className="mt-16 flex justify-end gap-8">
                  <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save page'}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {editingId === 'new' ? (
        <div className="border border-line bg-paper p-16">
          <h3 className="mb-16 text-body font-semibold text-ink">New page</h3>
          <PageForm draft={draft} onChange={setDraft} />
          {createPage.isError ? <p className="mt-8 text-body-sm text-danger">{createPage.error.message}</p> : null}
          <div className="mt-16 flex justify-end gap-8">
            <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Create page'}
            </Button>
          </div>
        </div>
      ) : null}

      <TypedConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete page"
        description="This permanently removes the page. Type the page's slug to confirm."
        confirmLabel={pendingDeletePage?.slug ?? ''}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
        isPending={deletePage.isPending}
        errorMessage={deletePage.isError ? deletePage.error.message : null}
      />
    </div>
  );
}

function PageForm({ draft, onChange }: { draft: PageDraft; onChange: (next: PageDraft) => void }) {
  return (
    <div className="flex flex-col gap-16">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
        <Input label="Title (EN)" value={draft.titleEn} onChange={(e) => onChange({ ...draft, titleEn: e.target.value })} />
        <Input label="Title (AR)" value={draft.titleAr} onChange={(e) => onChange({ ...draft, titleAr: e.target.value })} />
        <Input
          label="Slug — auto if left blank on create"
          value={draft.slug}
          onChange={(e) => onChange({ ...draft, slug: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <label className={labelClassName} htmlFor="page-body-en">
            Body (EN) — HTML, sanitized server-side; no WYSIWYG toolbar in this pass
          </label>
          <textarea
            id="page-body-en"
            className={textareaClassName + ' min-h-[220px] font-mono text-body-sm'}
            value={draft.bodyEn}
            onChange={(e) => onChange({ ...draft, bodyEn: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-4">
          <label className={labelClassName} htmlFor="page-body-ar">
            Body (AR)
          </label>
          <textarea
            id="page-body-ar"
            className={textareaClassName + ' min-h-[220px] font-mono text-body-sm'}
            value={draft.bodyAr}
            onChange={(e) => onChange({ ...draft, bodyAr: e.target.value })}
            dir="rtl"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <span className={labelClassName}>Status</span>
        <select
          className={selectClassName}
          value={draft.status}
          onChange={(e) => onChange({ ...draft, status: e.target.value as PageStatus })}
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <Input
          label="SEO title (EN) — optional"
          value={draft.seo.titleEn ?? ''}
          onChange={(e) => onChange({ ...draft, seo: { ...draft.seo, titleEn: e.target.value } })}
        />
        <Input
          label="SEO description (EN) — optional"
          value={draft.seo.descEn ?? ''}
          onChange={(e) => onChange({ ...draft, seo: { ...draft.seo, descEn: e.target.value } })}
        />
      </div>
    </div>
  );
}
