import { useEffect, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/app-store";
import { closeTopModal } from "@/lib/modal-stack";

export function BackButtonProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (closeTopModal()) return;

      if (location.pathname !== "/") {
        navigate(-1);
        return;
      }

      // Switching between the admin picker, the restaurant picker, and the workspace
      // happens via app state (selectedAdmin / activeRestaurant), not the URL, so
      // browser history has nothing to go back to here — without this, back on the
      // dashboard's or restaurant picker's "/" would exit the app instead of stepping
      // up one level.
      const { activeRestaurant, exitWorkspace, selectedAdmin, exitAdminSelection } = useAppStore.getState();
      if (activeRestaurant) {
        exitWorkspace();
        return;
      }
      if (selectedAdmin) {
        exitAdminSelection();
        return;
      }

      if (canGoBack) {
        window.history.back();
        return;
      }

      void CapacitorApp.exitApp();
    });

    return () => {
      void listenerPromise.then((handle) => handle.remove());
    };
  }, [location.pathname, navigate]);

  return <>{children}</>;
}
