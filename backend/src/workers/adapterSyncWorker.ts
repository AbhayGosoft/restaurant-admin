import { Worker } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { notifySaasAdapter } from "../adapters/saasAdapterClient.js";
import { logger } from "../modules/logger.js";
import { redisConnectionOptions } from "../redis/connection.js";

export const createAdapterSyncWorker = () =>
  new Worker(
    "adapter-sync",
    async (job) => {
      const booking = await prisma.booking.findUnique({
        where: { id: String(job.data.bookingId) },
        select: { id: true, bookingRef: true, bookingStatus: true, updatedAt: true },
      });
      if (!booking) return;
      await notifySaasAdapter({
        pms_booking_id: booking.bookingRef,
        event_type: booking.bookingStatus === "CONFIRMED" ? "confirmed" : "cancelled",
        occurred_at: booking.updatedAt.toISOString(),
      });
      logger.info({ jobId: job.id, bookingId: booking.id, status: booking.bookingStatus }, "Adapter sync completed");
    },
    { connection: redisConnectionOptions(), concurrency: 5 },
  );
