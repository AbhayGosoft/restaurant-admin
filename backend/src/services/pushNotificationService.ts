import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../modules/logger.js";

const serviceAccount = () => {
  if (env.firebaseServiceAccountJson) {
    return JSON.parse(env.firebaseServiceAccountJson) as { project_id: string; client_email: string; private_key: string };
  }
  if (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey) {
    return {
      project_id: env.firebaseProjectId,
      client_email: env.firebaseClientEmail,
      private_key: env.firebasePrivateKey.replace(/\\n/g, "\n"),
    };
  }
  return null;
};

const firebaseApp = () => {
  if (getApps().length) return getApps()[0];
  const account = serviceAccount();
  if (!account) return null;
  return initializeApp({
    credential: cert({
      projectId: account.project_id,
      clientEmail: account.client_email,
      privateKey: account.private_key,
    }),
  });
};

export const sendPushToUser = async (input: { userId: string; title: string; body: string; bookingId?: string }) => {
  const app = firebaseApp();
  if (!app) {
    logger.warn({ userId: input.userId }, "Firebase credentials are not configured; skipping push notification");
    return;
  }

  const devices = await prisma.pushDevice.findMany({
    where: { userId: input.userId, isActive: true },
    select: { token: true },
  });
  if (!devices.length) return;

  const response = await getMessaging(app).sendEachForMulticast({
    tokens: devices.map((device) => device.token),
    notification: { title: input.title, body: input.body },
    data: {
      type: "booking_notification",
      ...(input.bookingId ? { bookingId: input.bookingId } : {}),
    },
    android: {
      priority: "high",
      notification: {
        channelId: "booking_alerts",
        sound: "default",
      },
    },
  });

  const invalidTokens = response.responses
    .map((item, index) => ({ item, token: devices[index]?.token }))
    .filter(({ item }) => item.error?.code === "messaging/registration-token-not-registered")
    .map(({ token }) => token)
    .filter((token): token is string => Boolean(token));

  if (invalidTokens.length) {
    await prisma.pushDevice.updateMany({ where: { token: { in: invalidTokens } }, data: { isActive: false } });
  }

  if (response.failureCount) {
    const errors = response.responses
      .map((item, index) => ({ error: item.error, token: devices[index]?.token }))
      .filter(({ error }) => Boolean(error))
      .map(({ error, token }) => ({ code: error?.code, message: error?.message, token: token?.slice(0, 12) }));
    logger.warn({ userId: input.userId, errors }, "Some push notifications failed to send");
  }

  logger.info({ userId: input.userId, successCount: response.successCount, failureCount: response.failureCount }, "Push notification sent");
};
