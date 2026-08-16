import { Panel } from '../../../components/Panel';
import { PageHeader } from '../../../components/PageHeader';

/** plan.md §11.1 Settings — store details, shipping zones, COD fee/cap,
 *  tax rate, message templates, gateway keys (masked), feature flags,
 *  maintenance mode, legal pages. Section shells only. */
const SECTIONS = [
  'Store details & TRN',
  'Shipping zones & rates',
  'COD fee & cap',
  'Tax rate',
  'Email / SMS templates',
  'Payment gateway keys',
  'Feature flags',
  'Maintenance mode',
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-16">
      <PageHeader title="Settings" />
      <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
        {SECTIONS.map((section) => (
          <Panel key={section} title={section}>
            <p className="text-body-sm text-ink-70">Not yet wired — apps/api owns these values.</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
