import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminUser } from "@/types/domain";

export interface ActiveRestaurant {
  id: string;
  name: string;
  banner?: string | null;
}

interface AppState {
  adminToken: string | null;
  admin: AdminUser | null;
  activeRestaurant: ActiveRestaurant | null;
  sidebarOpen: boolean;
  setSession: (token: string, admin: AdminUser) => void;
  setAdmin: (admin: AdminUser) => void;
  clearSession: () => void;
  enterRestaurant: (restaurant: ActiveRestaurant) => void;
  exitWorkspace: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      adminToken: null,
      admin: null,
      activeRestaurant: null,
      sidebarOpen: false,
      setSession: (adminToken, admin) => set((state) => ({
        adminToken,
        admin,
        activeRestaurant: state.admin?.id === admin.id ? state.activeRestaurant : null,
      })),
      setAdmin: (admin) => set({ admin }),
      clearSession: () => set({ adminToken: null, admin: null, activeRestaurant: null }),
      enterRestaurant: (activeRestaurant) => set({ activeRestaurant }),
      exitWorkspace: () => set({ activeRestaurant: null }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: "restaurant-admin-session",
      partialize: ({ adminToken, admin, activeRestaurant }) => ({ adminToken, admin, activeRestaurant }),
    },
  ),
);
