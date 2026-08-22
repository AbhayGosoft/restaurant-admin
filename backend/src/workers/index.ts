import type { Worker } from "bullmq";
import { logger } from "../modules/logger.js";
import { createAdapterSyncWorker } from "./adapterSyncWorker.js";
import { createBookingExpirationWorker } from "./bookingExpirationWorker.js";
import { createNotificationWorker } from "./notificationWorker.js";

let workers: Worker[] = [];

export const startWorkers = () => {
  if (workers.length) return workers;
  workers = [createBookingExpirationWorker(), createAdapterSyncWorker(), createNotificationWorker()];
  workers.forEach((worker) => {
    worker.on("failed", (job, error) => logger.error({ jobId: job?.id, queue: worker.name, err: error }, "Worker job failed"));
    worker.on("error", (error) => logger.error({ queue: worker.name, err: error }, "Worker error"));
  });
  logger.info("BullMQ workers started");
  return workers;
};

export const closeWorkers = async () => {
  await Promise.allSettled(workers.map((worker) => worker.close()));
  workers = [];
};
