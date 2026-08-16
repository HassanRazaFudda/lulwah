import { create } from 'zustand';

interface AdminUiState {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

/**
 * Small client-only UI state — plan.md §4.1 picks Zustand over Redux for
 * exactly this: drawers, filters, nothing that needs to survive a refresh
 * or round-trip the server. The sidebar's collapsed/expanded state lives
 * here so the collapse button and the dashboard layout shell can both read
 * and flip it without prop-drilling through every screen.
 */
export const useAdminUiStore = create<AdminUiState>((set) => ({
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
}));
