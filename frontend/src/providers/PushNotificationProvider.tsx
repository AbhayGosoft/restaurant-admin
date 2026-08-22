import { useEffect, type ReactNode } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { queryClient } from "@/lib/query-client";
import { registerPushDevice } from "@/services/push-device-api";
import { useAppStore } from "@/store/app-store";

export function PushNotificationProvider({ children }: { children: ReactNode }) {
  const token = useAppStore((state) => state.token);

  useEffect(() => {
    if (!token || !Capacitor.isNativePlatform()) return;
    let cancelled = false;

    const setupPush = async () => {
      try {
        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== "granted" || cancelled) return;

        await PushNotifications.register();

        await PushNotifications.removeAllListeners();
        await PushNotifications.addListener("registration", async ({ value }) => {
          if (!cancelled) {
            try {
              await registerPushDevice({ token: value, platform: Capacitor.getPlatform() });
              console.log("Push device token registered", value);
            } catch (error) {
              console.error("Failed to register push device token", error);
            }
          }
        });
        await PushNotifications.addListener("registrationError", (error) => {
          console.error("Push registration failed", error);
        });
        await PushNotifications.addListener("pushNotificationReceived", () => {
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["bookings"] });
          void queryClient.invalidateQueries({ queryKey: ["pending-bookings"] });
        });
        await PushNotifications.addListener("pushNotificationActionPerformed", () => {
          void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          void queryClient.invalidateQueries({ queryKey: ["bookings"] });
          void queryClient.invalidateQueries({ queryKey: ["pending-bookings"] });
        });
      } catch (error) {
        // Push registration needs a real google-services.json wired into the native
        // build (Firebase project console) — without it this rejects instead of
        // taking the app down, so the rest of the app keeps working.
        console.error("Push notification setup failed", error);
      }
    };

    void setupPush();
    return () => {
      cancelled = true;
      void PushNotifications.removeAllListeners();
    };
  }, [token]);

  return <>{children}</>;
}
