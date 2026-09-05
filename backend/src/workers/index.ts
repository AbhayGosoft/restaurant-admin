import type { Worker } from "bullmq";
import { logger } from "../modules/logger.js";
import { createReminderWorker } from "./reminderWorker.js";

let workers: Worker[] = [];

export const startWorkers = () => {
  if (workers.length) return workers;
  workers = [createReminderWorker()];
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
