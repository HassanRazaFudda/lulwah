'use client';

import { useState } from 'react';
import type { JournalPost, JournalPostStatus } from '@lulwah/contracts';
import { Button, Input } from '@lulwah/ui';
import { Skeleton } from '../Skeleton';
import { TypedConfirmDialog } from '../TypedConfirmDialog';
import { pushToast } from '../../lib/stores/toast-store';
import {
  useAdminJournalPostsQuery,
  useCreateJournalPostMutation,
  useUpdateJournalPostMutation,
  useDeleteJournalPostMutation,
} from '../../lib/queries/content-journal';
import type { JournalPostDraft } from '../../lib/queries/content-journal';
import { labelClassName, selectClassName, textareaClassName } from '../product-editor/field-styles';
import { MediaRefField } from './MediaRefField';

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function postToDraft(post: JournalPost): JournalPostDraft {
  return {
    slug: post.slug,
    titleEn: post.titleEn,
    titleAr: post.titleAr,
    coverMedia: post.coverMedia,
    excerptEn: post.excerptEn,
    excerptAr: post.excerptAr,
    bodyEn: post.bodyEn,
    bodyAr: post.bodyAr,
    publishedAt: post.publishedAt ? toDatetimeLocal(new Date(post.publishedAt)) : null,
    status: post.status,
    seo: post.seo,
  };
}

function emptyDraft(): JournalPostDraft {
  return {
    slug: '',
    titleEn: '',
    titleAr: '',
    coverMedia: null,
    excerptEn: '',
    excerptAr: '',
    bodyEn: '',
    bodyAr: '',
    publishedAt: null,
    status: 'draft',
    seo: {},
  };
}

/**
 * P4 — Journal editorial posts (`@lulwah/contracts`' `content.ts`: backs
 * `journal_teaser` home sections' `postSlugs` tie-in). Same real CRUD shape
 * `PagesPanel.tsx` established (`Page` is the closest structural match:
 * slug, bilingual title, sanitized HTML body via a plain textarea, SEO,
 * draft/published status), with `coverMedia` (`MediaRefField`, reused
 * verbatim) and `excerptEn`/`excerptAr`/`publishedAt` layered on top —
 * `publishedAt` follows `BannersPanel.tsx`'s own `startsAt`/`endsAt`
 * datetime-local-string round-trip precedent.
 */
export function JournalPanel() {
  const { data: posts, isLoading } = useAdminJournalPostsQuery();
  const createPost = useCreateJournalPostMutation();
  const updatePost = useUpdateJournalPostMutation();
  const deletePost = useDeleteJournalPostMutation();

  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [draft, setDraft] = useState<JournalPostDraft>(emptyDraft());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const list = (posts ?? []).slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const startNew = () => {
    setDraft(emptyDraft());
    setEditingId('new');
  };
  const startEdit = (post: JournalPost) => {
    setDraft(postToDraft(post));
    setEditingId(post.id);
  };

  const handleSave = () => {
    if (editingId === 'new') {
      createPost.mutate(draft, {
        onSuccess: () => {
          pushToast('success', 'Journal post created.');
          setEditingId(null);
        },
        onError: (error) => pushToast('error', `Could not create journal post: ${error.message}`),
      });
    } else if (editingId) {
      updatePost.mutate(
        { id: editingId, draft },
        {
          onSuccess: () => {
            pushToast('success', 'Journal post saved.');
            setEditingId(null);
          },
          onError: (error) => pushToast('error', `Could not save journal post: ${error.message}`),
        },
      );
    }
  };

  const handleDelete = () => {
    if (!pendingDeleteId) return;
    deletePost.mutate(pendingDeleteId, {
      onSuccess: () => {
        pushToast('success', 'Journal post deleted.');
        setPendingDeleteId(null);
        if (editingId === pendingDeleteId) setEditingId(null);
      },
      onError: (error) => pushToast('error', `Could not delete journal post: ${error.message}`),
    });
  };

  const saving = createPost.isPending || updatePost.isPending;
  const pendingDeletePost = list.find((p) => p.id === pendingDeleteId) ?? null;

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
          New journal post
        </Button>
      </div>

      <div className="flex flex-col gap-8">
        {list.length === 0 ? <p className="text-body-sm text-ink-70">No journal posts yet.</p> : null}
        {list.map((post) => (
          <div key={post.id} className="border border-line bg-paper">
            <div className="flex flex-wrap items-center gap-12 px-16 py-12">
              <span className="text-body-sm font-semibold text-ink">{post.titleEn || '(untitled)'}</span>
              <span className="text-body-sm text-ink-70">/{post.slug}</span>
              <span
                className={
                  post.status === 'published'
                    ? 'text-label uppercase tracking-label text-success'
                    : 'text-label uppercase tracking-label text-ink-70'
                }
              >
                {post.status}
              </span>
              <div className="flex-1" />
              <Button type="button" variant="secondary" onClick={() => startEdit(post)}>
                Edit
              </Button>
              <button
                type="button"
                className="text-body-sm text-danger hover:underline"
                onClick={() => setPendingDeleteId(post.id)}
              >
                Delete
              </button>
            </div>

            {editingId === post.id ? (
              <div className="border-t border-line p-16">
                <JournalForm draft={draft} onChange={setDraft} />
                {updatePost.isError ? <p className="mt-8 text-body-sm text-danger">{updatePost.error.message}</p> : null}
                <div className="mt-16 flex justify-end gap-8">
                  <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save post'}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {editingId === 'new' ? (
        <div className="border border-line bg-paper p-16">
          <h3 className="mb-16 text-body font-semibold text-ink">New journal post</h3>
          <JournalForm draft={draft} onChange={setDraft} />
          {createPost.isError ? <p className="mt-8 text-body-sm text-danger">{createPost.error.message}</p> : null}
          <div className="mt-16 flex justify-end gap-8">
            <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Creating…' : 'Create post'}
            </Button>
          </div>
        </div>
      ) : null}

      <TypedConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete journal post"
        description="This permanently removes the journal post. Type the post's slug to confirm."
        confirmLabel={pendingDeletePost?.slug ?? ''}
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
        isPending={deletePost.isPending}
        errorMessage={deletePost.isError ? deletePost.error.message : null}
      />
    </div>
  );
}

function JournalForm({ draft, onChange }: { draft: JournalPostDraft; onChange: (next: JournalPostDraft) => void }) {
  return (
    <div className="flex flex-col gap-16">
      <div className="grid grid-cols-1 gap-16 md:grid-cols-3">
        <Input label="Title (EN)" value={draft.titleEn} onChange={(e) => onChange({ ...draft, titleEn: e.target.value })} />
        <Input label="Title (AR)" value={draft.titleAr} onChange={(e) => onChange({ ...draft, titleAr: e.target.value })} />
        <Input
          label="Slug (auto if left blank on create)"
          value={draft.slug}
          onChange={(e) => onChange({ ...draft, slug: e.target.value })}
        />
      </div>

      <MediaRefField label="Cover media" value={draft.coverMedia} onChange={(v) => onChange({ ...draft, coverMedia: v })} />

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <Input
          label="Excerpt (EN)"
          value={draft.excerptEn}
          onChange={(e) => onChange({ ...draft, excerptEn: e.target.value })}
        />
        <Input
          label="Excerpt (AR)"
          value={draft.excerptAr}
          onChange={(e) => onChange({ ...draft, excerptAr: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <label className={labelClassName} htmlFor="journal-body-en">
            Body (EN): HTML, sanitized server-side; no WYSIWYG toolbar in this pass
          </label>
          <textarea
            id="journal-body-en"
            className={textareaClassName + ' min-h-[160px] font-mono text-body-sm'}
            value={draft.bodyEn}
            onChange={(e) => onChange({ ...draft, bodyEn: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-4">
          <label className={labelClassName} htmlFor="journal-body-ar">
            Body (AR)
          </label>
          <textarea
            id="journal-body-ar"
            className={textareaClassName + ' min-h-[160px] font-mono text-body-sm'}
            value={draft.bodyAr}
            onChange={(e) => onChange({ ...draft, bodyAr: e.target.value })}
            dir="rtl"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Status</span>
          <select
            className={selectClassName}
            value={draft.status}
            onChange={(e) => onChange({ ...draft, status: e.target.value as JournalPostStatus })}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Published at (optional; auto-set on first publish if left blank)</span>
          <input
            type="datetime-local"
            className={selectClassName}
            value={draft.publishedAt ?? ''}
            onChange={(e) => onChange({ ...draft, publishedAt: e.target.value || null })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        <Input
          label="SEO title (EN, optional)"
          value={draft.seo.titleEn ?? ''}
          onChange={(e) => onChange({ ...draft, seo: { ...draft.seo, titleEn: e.target.value } })}
        />
        <Input
          label="SEO description (EN, optional)"
          value={draft.seo.descEn ?? ''}
          onChange={(e) => onChange({ ...draft, seo: { ...draft.seo, descEn: e.target.value } })}
        />
      </div>
    </div>
  );
}
