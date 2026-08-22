import { api } from "@/lib/api-client";

export const registerPushDevice = (input: { token: string; platform: string; deviceId?: string }) =>
  api<{ id: string; isActive: boolean }>("/notifications/devices", { method: "POST", body: input });

export const unregisterPushDevice = (token: string) =>
  api<void>(`/notifications/devices/${encodeURIComponent(token)}`, { method: "DELETE" });
