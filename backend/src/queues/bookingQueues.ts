import { Queue } from "bullmq";
import { redisConnectionOptions } from "../redis/connection.js";

const connection = redisConnectionOptions();

export const bookingExpirationQueue = new Queue("booking-expiration", { connection });
export const adapterSyncQueue = new Queue("adapter-sync", { connection });
export const notificationQueue = new Queue("notification", { connection });

export const closeQueues = async () => {
  await Promise.allSettled([
    bookingExpirationQueue.close(),
    adapterSyncQueue.close(),
    notificationQueue.close(),
  ]);
};
