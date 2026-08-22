import { createHmac } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../modules/logger.js";

export type AdapterBookingSyncPayload = {
  pms_booking_id: string;
  event_type: "confirmed" | "cancelled";
  occurred_at: string;
};

const signPayload = (body: string, timestamp: string) =>
  createHmac("sha256", env.adapterHmacSecret ?? env.adapterApiKey ?? "")
    .update(`${timestamp}.`)
    .update(body)
    .digest("hex");

export const notifySaasAdapter = async (payload: AdapterBookingSyncPayload) => {
  if (!env.adapterCallbackUrl) {
    logger.warn({ payload }, "Adapter callback URL is not configured; skipping outbound sync");
    return;
  }

  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const response = await fetch(env.adapterCallbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-timestamp": timestamp,
      "x-signature": `sha256=${signPayload(body, timestamp)}`,
      ...(env.adapterApiKey ? { "x-api-key": env.adapterApiKey } : {}),
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Adapter sync failed with ${response.status}: ${text.slice(0, 300)}`);
  }
};
