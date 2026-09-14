import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminUser } from "@/types/domain";

export interface ActiveRestaurant {
  id: string;
  name: string;
  banner?: string | null;
}

export interface SelectedAdmin {
  id: string;
  name: string;
}

interface AppState {
  adminToken: string | null;
  admin: AdminUser | null;
  // SuperAdmin-only: the admin whose restaurants are currently being browsed, set by
  // the admin-picker flow (Admins list -> pick an admin -> their restaurants). Null for
  // a plain Admin, who is always scoped to their own restaurants.
  selectedAdmin: SelectedAdmin | null;
  activeRestaurant: ActiveRestaurant | null;
  sidebarOpen: boolean;
  setSession: (token: string, admin: AdminUser) => void;
  setAdmin: (admin: AdminUser) => void;
  clearSession: () => void;
  selectAdmin: (admin: SelectedAdmin) => void;
  exitAdminSelection: () => void;
  enterRestaurant: (restaurant: ActiveRestaurant) => void;
  exitWorkspace: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      adminToken: null,
      admin: null,
      selectedAdmin: null,
      activeRestaurant: null,
      sidebarOpen: false,
      setSession: (adminToken, admin) => set((state) => ({
        adminToken,
        admin,
        selectedAdmin: state.admin?.id === admin.id ? state.selectedAdmin : null,
        activeRestaurant: state.admin?.id === admin.id ? state.activeRestaurant : null,
      })),
      setAdmin: (admin) => set({ admin }),
      clearSession: () => set({ adminToken: null, admin: null, selectedAdmin: null, activeRestaurant: null }),
      selectAdmin: (selectedAdmin) => set({ selectedAdmin, activeRestaurant: null }),
      exitAdminSelection: () => set({ selectedAdmin: null }),
      enterRestaurant: (activeRestaurant) => set({ activeRestaurant }),
      exitWorkspace: () => set({ activeRestaurant: null }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: "restaurant-admin-session",
      partialize: ({ adminToken, admin, selectedAdmin, activeRestaurant }) => ({ adminToken, admin, selectedAdmin, activeRestaurant }),
    },
  ),
);
