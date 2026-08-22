import { Worker } from "bullmq";
import { logger } from "../modules/logger.js";
import { redisConnectionOptions } from "../redis/connection.js";
import { expireBooking } from "../services/bookingLifecycleService.js";

export const createBookingExpirationWorker = () =>
  new Worker(
    "booking-expiration",
    async (job) => {
      logger.info({ jobId: job.id, bookingId: job.data.bookingId }, "Processing booking expiration");
      await expireBooking(String(job.data.bookingId));
    },
    { connection: redisConnectionOptions(), concurrency: 10 },
  );
