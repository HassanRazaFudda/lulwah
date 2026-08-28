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

type ContentTabId = 'homepage' | 'banners' | 'menus' | 'pages' | 'collections' | 'media';

const TABS: TabDef[] = [
  { id: 'homepage', label: 'Homepage builder' },
  { id: 'banners', label: 'Banners' },
  { id: 'menus', label: 'Menus' },
  { id: 'pages', label: 'Pages' },
  { id: 'collections', label: 'Collections' },
  { id: 'media', label: 'Media library' },
];

/**
 * plan.md §11.1's Content screen, real per-tab CRUD replacing the old
 * six-static-card placeholder. Backend is two separate merged
 * workstreams: `apps/api/src/modules/content/*` (home sections, banners,
 * menus, pages, media library — a genuinely new module) and the
 * pre-existing `catalog` module's `Collection`, extended rather than
 * duplicated (see `lib/queries/collections.ts`'s doc comment). RBAC:
 * every mutation below goes through `apiRequest`, which attaches the
 * bearer token; the API's own `requireContentRead()`/`requireContentWrite()`
 * (`content.policy.ts`) is what actually enforces `content.read`/
 * `content.write` — a 403 surfaces as a normal `ApiClientError` through
 * each panel's existing error-handling (inline error text + a toast on
 * mutation failure), same as every other RBAC-gated screen in this app.
 */
export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<ContentTabId>('homepage');

  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Content" description="Homepage, banners, menus, pages, collections, media" />

      <EditorTabs tabs={TABS} active={activeTab} onChange={(id) => setActiveTab(id as ContentTabId)} />

      <Panel>
        {activeTab === 'homepage' ? <HomeSectionsPanel /> : null}
        {activeTab === 'banners' ? <BannersPanel /> : null}
        {activeTab === 'menus' ? <MenusPanel /> : null}
        {activeTab === 'pages' ? <PagesPanel /> : null}
        {activeTab === 'collections' ? <CollectionsPanel /> : null}
        {activeTab === 'media' ? <MediaLibraryPanel /> : null}
      </Panel>
    </div>
  );
}
