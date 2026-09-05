import { Queue } from "bullmq";
import { redisConnectionOptions } from "../redis/connection.js";
import { logger } from "../modules/logger.js";

const connection = redisConnectionOptions();

export const reminderQueue = new Queue("booking-reminder", { connection });

export const closeQueues = async () => {
  await Promise.allSettled([reminderQueue.close()]);
};

/** Schedules (or reschedules) the reminder push for a booking via a persistent delayed job. */
export const scheduleReminder = async (bookingId: string, sendAt: Date) => {
  const delay = Math.max(sendAt.getTime() - Date.now(), 0);
  const job = await reminderQueue.add(
    "reminder",
    { bookingId },
    { delay, removeOnComplete: true, removeOnFail: 500, attempts: 3, backoff: { type: "exponential", delay: 5000 } },
  );
  return job.id ?? null;
};

export const cancelReminder = async (jobId: string | null | undefined) => {
  if (!jobId) return;
  try {
    const job = await reminderQueue.getJob(jobId);
    await job?.remove();
  } catch (error) {
    logger.warn({ jobId, err: error }, "Failed to remove reminder job");
  }
};
