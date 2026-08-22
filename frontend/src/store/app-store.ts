import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types/domain";

export interface ActiveOwner {
  id: string;
  name: string;
  email: string;
}

export interface ActiveProperty {
  id: string;
  name: string;
  type: string;
}

interface AppState {
  token: string | null;
  user: User | null;
  activeOwner: ActiveOwner | null;
  activeProperty: ActiveProperty | null;
  sidebarOpen: boolean;
  setSession: (token: string, user: User) => void;
  setUser: (user: User) => void;
  clearSession: () => void;
  enterProperty: (owner: ActiveOwner | null, property: ActiveProperty) => void;
  exitWorkspace: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      activeOwner: null,
      activeProperty: null,
      sidebarOpen: false,
      setSession: (token, user) => set((state) => ({
        token,
        user,
        activeOwner: state.user?.id === user.id ? state.activeOwner : null,
        activeProperty: state.user?.id === user.id ? state.activeProperty : null,
      })),
      setUser: (user) => set({ user }),
      clearSession: () => set({ token: null, user: null, activeOwner: null, activeProperty: null }),
      enterProperty: (activeOwner, activeProperty) => set({ activeOwner, activeProperty }),
      exitWorkspace: () => set({ activeOwner: null, activeProperty: null }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: "darshan-connector-session",
      partialize: ({ token, user, activeOwner, activeProperty }) => ({ token, user, activeOwner, activeProperty }),
    },
  ),
);
