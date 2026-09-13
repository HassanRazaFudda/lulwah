'use client';

import { useState } from 'react';
import { PageHeader } from '../../../components/PageHeader';
import { Panel } from '../../../components/Panel';
import { EditorTabs } from '../../../components/product-editor/EditorTabs';
import type { TabDef } from '../../../components/product-editor/EditorTabs';
import { HomeSectionsPanel } from '../../../components/content/HomeSectionsPanel';
import { BannersPanel } from '../../../components/content/BannersPanel';
import { MenusPanel } from '../../../components/content/MenusPanel';
import { PagesPanel } from '../../../components/content/PagesPanel';
import { CollectionsPanel } from '../../../components/content/CollectionsPanel';
import { MediaLibraryPanel } from '../../../components/content/MediaLibraryPanel';
import { LookbooksPanel } from '../../../components/content/LookbooksPanel';
import { JournalPanel } from '../../../components/content/JournalPanel';

type ContentTabId = 'homepage' | 'banners' | 'menus' | 'pages' | 'collections' | 'media' | 'lookbooks' | 'journal';

const TABS: TabDef[] = [
  { id: 'homepage', label: 'Homepage builder' },
  { id: 'banners', label: 'Banners' },
  { id: 'menus', label: 'Menus' },
  { id: 'pages', label: 'Pages' },
  { id: 'collections', label: 'Collections' },
  { id: 'media', label: 'Media library' },
  { id: 'lookbooks', label: 'Lookbooks' },
  { id: 'journal', label: 'Journal' },
];

/**
 * plan.md §11.1's Content screen, real per-tab CRUD replacing the old
 * six-static-card placeholder. Backend is three separate merged
 * workstreams: `apps/api/src/modules/content/*` (home sections, banners,
 * menus, pages, media library, and — new in P4 — lookbooks and journal
 * posts) and the pre-existing `catalog` module's `Collection`, extended
 * rather than duplicated (see `lib/queries/collections.ts`'s doc comment).
 * The P4 Lookbooks/Journal tabs follow `PagesPanel.tsx`'s exact CRUD shape
 * (see `LookbooksPanel.tsx`/`JournalPanel.tsx`'s own doc comments) and are
 * wired into this tab list the same way the other six entity types are.
 * RBAC: every mutation below goes through `apiRequest`, which attaches the
 * bearer token; the API's own `requireContentRead()`/`requireContentWrite()`
 * (`content.policy.ts`) is what actually enforces `content.read`/
 * `content.write` (Lookbook/Journal reuse these same two permissions, no
 * new ones) — a 403 surfaces as a normal `ApiClientError` through each
 * panel's existing error-handling (inline error text + a toast on
 * mutation failure), same as every other RBAC-gated screen in this app.
 */
export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<ContentTabId>('homepage');

  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Content" description="Homepage, banners, menus, pages, collections, media, lookbooks, journal" />

      <EditorTabs tabs={TABS} active={activeTab} onChange={(id) => setActiveTab(id as ContentTabId)} />

      <Panel>
        {activeTab === 'homepage' ? <HomeSectionsPanel /> : null}
        {activeTab === 'banners' ? <BannersPanel /> : null}
        {activeTab === 'menus' ? <MenusPanel /> : null}
        {activeTab === 'pages' ? <PagesPanel /> : null}
        {activeTab === 'collections' ? <CollectionsPanel /> : null}
        {activeTab === 'media' ? <MediaLibraryPanel /> : null}
        {activeTab === 'lookbooks' ? <LookbooksPanel /> : null}
        {activeTab === 'journal' ? <JournalPanel /> : null}
      </Panel>
    </div>
  );
}
