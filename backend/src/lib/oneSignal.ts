import { env } from "../config/env.js";
import { logger } from "../modules/logger.js";

/**
 * Sends a push notification to a single OneSignal player id via the REST API.
 * Degrades gracefully (logs + no-ops) when OneSignal credentials aren't
 * configured, matching how Firebase push was handled in this codebase before.
 */
export const sendOneSignalPush = async (input: { playerId: string; title: string; body: string; data?: Record<string, unknown> }) => {
  if (!env.oneSignalAppId || !env.oneSignalApiKey) {
    logger.warn({ playerId: input.playerId }, "OneSignal credentials are not configured; skipping push notification");
    return;
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${env.oneSignalApiKey}`,
      },
      body: JSON.stringify({
        app_id: env.oneSignalAppId,
        include_player_ids: [input.playerId],
        headings: { en: input.title },
        contents: { en: input.body },
        data: input.data ?? {},
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.warn({ status: response.status, body: text }, "OneSignal push failed");
    }
  } catch (error) {
    logger.warn({ err: error }, "OneSignal push request errored");
  }
};
