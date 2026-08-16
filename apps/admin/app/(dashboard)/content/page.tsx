import { Panel } from '../../../components/Panel';
import { PageHeader } from '../../../components/PageHeader';

/** plan.md §11.1 Content — homepage builder / banners / menus / pages /
 *  collections / media library. Section shells only; each is its own
 *  sizeable editor in the full build, out of scope here. */
const SECTIONS = [
  { title: 'Homepage builder', description: 'Drag-and-drop ordered home_sections with a live preview.' },
  { title: 'Banners', description: 'Desktop/mobile assets with scheduling.' },
  { title: 'Menus', description: 'Nested drag-and-drop with featured imagery per column.' },
  { title: 'Pages', description: 'Rich text EN/AR.' },
  { title: 'Collections', description: 'Manual ordering or a rule builder for automated collections.' },
  { title: 'Media library', description: 'Folders, search, bulk alt-text edit.' },
];

export default function ContentPage() {
  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Content" description="Homepage, banners, menus, pages, collections, media" />
      <div className="grid grid-cols-1 gap-16 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Panel key={section.title} title={section.title}>
            <p className="text-body-sm text-ink-70">{section.description}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
