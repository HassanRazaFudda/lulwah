'use client';

import { useState } from 'react';
import type { DragEvent } from 'react';
import type { HomeSection, HomeSectionType } from '@lulwah/contracts';
import { Button } from '@lulwah/ui';
import { Panel } from '../Panel';
import { Skeleton } from '../Skeleton';
import { TypedConfirmDialog } from '../TypedConfirmDialog';
import { pushToast } from '../../lib/stores/toast-store';
import {
  useAdminHomeSectionsQuery,
  useCreateHomeSectionMutation,
  useUpdateHomeSectionMutation,
  useDeleteHomeSectionMutation,
  useReorderHomeSectionsMutation,
  useToggleHomeSectionActiveMutation,
} from '../../lib/queries/content-home-sections';
import type { HomeSectionDraft } from '../../lib/queries/content-home-sections';
import { defaultHomeSectionSettings, HOME_SECTION_TYPE_LABELS } from './home-section-defaults';
import { HomeSectionSettingsForm } from './HomeSectionSettingsForm';
import { labelClassName, selectClassName } from '../product-editor/field-styles';

const ALL_TYPES = Object.keys(HOME_SECTION_TYPE_LABELS) as HomeSectionType[];

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function sectionToDraft(section: HomeSection): HomeSectionDraft {
  return {
    type: section.type,
    settings: section.settings,
    sortOrder: section.sortOrder,
    isActive: section.isActive,
    startsAt: section.startsAt ? toDatetimeLocal(new Date(section.startsAt)) : null,
    endsAt: section.endsAt ? toDatetimeLocal(new Date(section.endsAt)) : null,
  };
}

/**
 * plan.md §11.1's homepage builder: "drag-and-drop the ordered
 * `home_sections`, each with a typed settings form." Drag reorder is
 * native HTML5 drag-and-drop (`draggable` + `dragstart`/`dragover`/`drop`)
 * — no drag library is a dependency of this app, and the brief explicitly
 * allows "a reasonably simple implementation rather than an elaborate one"
 * for this class of interaction. See this task's report for the
 * live-preview-iframe gap — not built here, documented below the list
 * instead of pointed at a route that wouldn't render anything real.
 */
export function HomeSectionsPanel() {
  const { data: sections, isLoading } = useAdminHomeSectionsQuery();
  const createSection = useCreateHomeSectionMutation();
  const updateSection = useUpdateHomeSectionMutation();
  const deleteSection = useDeleteHomeSectionMutation();
  const reorder = useReorderHomeSectionsMutation();
  const toggleActive = useToggleHomeSectionActiveMutation();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<HomeSectionDraft | null>(null);
  const [newType, setNewType] = useState<HomeSectionType>('hero');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const sorted = (sections ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  const startEdit = (section: HomeSection) => {
    setExpandedId(section.id);
    setDraft(sectionToDraft(section));
  };

  const handleAdd = () => {
    createSection.mutate(
      {
        type: newType,
        settings: defaultHomeSectionSettings(newType),
        sortOrder: sorted.length,
        isActive: true,
        startsAt: null,
        endsAt: null,
      },
      {
        onSuccess: (section) => {
          pushToast('success', `${HOME_SECTION_TYPE_LABELS[newType]} section added.`);
          startEdit(section);
        },
        onError: (error) => pushToast('error', `Could not add section: ${error.message}`),
      },
    );
  };

  const handleSave = () => {
    if (!expandedId || !draft) return;
    updateSection.mutate(
      { id: expandedId, draft },
      {
        onSuccess: () => pushToast('success', 'Section saved.'),
        onError: (error) => pushToast('error', `Could not save section: ${error.message}`),
      },
    );
  };

  const handleDelete = () => {
    if (!pendingDeleteId) return;
    deleteSection.mutate(pendingDeleteId, {
      onSuccess: () => {
        pushToast('success', 'Section deleted.');
        setPendingDeleteId(null);
        if (expandedId === pendingDeleteId) setExpandedId(null);
      },
      onError: (error) => pushToast('error', `Could not delete section: ${error.message}`),
    });
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const next = sorted.slice();
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved as HomeSection);
    setDragIndex(null);
    reorder.mutate(
      next.map((s) => s.id),
      { onError: (error) => pushToast('error', `Could not reorder sections: ${error.message}`) },
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[56px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-16">
      <div className="flex flex-wrap items-end gap-8">
        <div className="flex flex-col gap-4">
          <span className={labelClassName}>Add a section</span>
          <select className={selectClassName} value={newType} onChange={(e) => setNewType(e.target.value as HomeSectionType)}>
            {ALL_TYPES.map((type) => (
              <option key={type} value={type}>
                {HOME_SECTION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" onClick={handleAdd} disabled={createSection.isPending}>
          {createSection.isPending ? 'Adding…' : 'Add section'}
        </Button>
      </div>

      <div className="flex flex-col gap-8">
        {sorted.length === 0 ? <p className="text-body-sm text-ink-70">No home sections yet. Add one above.</p> : null}
        {sorted.map((section, index) => {
          const isExpanded = expandedId === section.id;
          return (
            <div key={section.id} className="border border-line bg-paper">
              <div
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                onDrop={() => handleDrop(index)}
                className="flex cursor-grab items-center gap-12 px-16 py-12 active:cursor-grabbing"
              >
                <span className="text-ink-70" aria-hidden="true">
                  ⠿
                </span>
                <span className="flex-1 text-body-sm font-semibold text-ink">{HOME_SECTION_TYPE_LABELS[section.type]}</span>
                <span
                  className={
                    section.isActive
                      ? 'text-label uppercase tracking-label text-success'
                      : 'text-label uppercase tracking-label text-ink-70'
                  }
                >
                  {section.isActive ? 'Active' : 'Inactive'}
                </span>
                <button
                  type="button"
                  className="text-body-sm text-ink-70 hover:text-ink"
                  onClick={() =>
                    toggleActive.mutate(
                      { id: section.id, isActive: !section.isActive },
                      { onError: (error) => pushToast('error', `Could not update section: ${error.message}`) },
                    )
                  }
                >
                  {section.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <Button type="button" variant="secondary" onClick={() => (isExpanded ? setExpandedId(null) : startEdit(section))}>
                  {isExpanded ? 'Close' : 'Edit'}
                </Button>
                <button
                  type="button"
                  className="text-body-sm text-danger hover:underline"
                  onClick={() => setPendingDeleteId(section.id)}
                >
                  Delete
                </button>
              </div>

              {isExpanded && draft ? (
                <div className="flex flex-col gap-16 border-t border-line p-16">
                  <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
                    <div className="flex flex-col gap-4">
                      <span className={labelClassName}>Starts at (optional)</span>
                      <input
                        type="datetime-local"
                        className={selectClassName}
                        value={draft.startsAt ?? ''}
                        onChange={(e) => setDraft({ ...draft, startsAt: e.target.value || null })}
                      />
                    </div>
                    <div className="flex flex-col gap-4">
                      <span className={labelClassName}>Ends at (optional)</span>
                      <input
                        type="datetime-local"
                        className={selectClassName}
                        value={draft.endsAt ?? ''}
                        onChange={(e) => setDraft({ ...draft, endsAt: e.target.value || null })}
                      />
                    </div>
                  </div>

                  <HomeSectionSettingsForm
                    type={draft.type}
                    settings={draft.settings}
                    onChange={(settings) => setDraft({ ...draft, settings })}
                  />

                  {updateSection.isError ? <p className="text-body-sm text-danger">{updateSection.error.message}</p> : null}

                  <div className="flex justify-end gap-8">
                    <Button type="button" variant="secondary" onClick={() => setExpandedId(null)}>
                      Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={updateSection.isPending}>
                      {updateSection.isPending ? 'Saving…' : 'Save section'}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Panel title="Live preview">
        <p className="text-body-sm text-ink-70">
          plan.md §11.1 calls for a live preview iframe alongside the section list. `apps/web` has no route today
          that renders `home_sections` from this API. Home is still built from hardcoded editorial sections
          (`docs/implemented-plan.md` §5.1), and this task's brief scoped `apps/web` changes out (a separate P3
          workstream). Pointing an iframe at the storefront's current homepage would show unrelated hardcoded
          content, not a preview of what's edited above; that would misrepresent what this screen does, so it's
          intentionally left out rather than faked. The section list/editor above is real and saves to the real
          API; wiring an actual preview is a documented follow-up once `apps/web`'s Home reads from
          `GET /content/home`.
        </p>
      </Panel>

      <TypedConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete home section"
        description="This permanently removes the section from the homepage builder. Type DELETE to confirm."
        confirmLabel="DELETE"
        onConfirm={handleDelete}
        onCancel={() => setPendingDeleteId(null)}
        isPending={deleteSection.isPending}
        errorMessage={deleteSection.isError ? deleteSection.error.message : null}
      />
    </div>
  );
}
