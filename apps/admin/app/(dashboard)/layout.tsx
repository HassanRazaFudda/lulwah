import type { ReactNode } from 'react';
import { Sidebar } from '../../components/Sidebar';

/**
 * Chrome shared by every screen in plan.md §11.1's list — a fixed sidebar
 * plus a scrollable content column. `login/page.tsx` sits outside this
 * route group deliberately: it has no sidebar to render.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-24">{children}</main>
    </div>
  );
}
