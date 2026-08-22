import { Worker } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { logger } from "../modules/logger.js";
import { redisConnectionOptions } from "../redis/connection.js";
import { sendPushToUser } from "../services/pushNotificationService.js";
import { emitToProperty } from "../socket/server.js";
import { socketEvents } from "../socket/socketEvents.js";

const messageForJob = (name: string, bookingRef: string) => {
  if (name === "booking-confirmed") return { type: "BOOKING_CONFIRMED" as const, title: "Booking confirmed", body: `${bookingRef} has been confirmed` };
  if (name === "booking-expired") return { type: "BOOKING_EXPIRED" as const, title: "Booking expired", body: `${bookingRef} was automatically cancelled` };
  if (name === "booking-cancelled") return { type: "BOOKING_EXPIRED" as const, title: "Booking cancelled", body: `${bookingRef} was cancelled` };
  return { type: "NEW_BOOKING_REQUEST" as const, title: "New booking request", body: `${bookingRef} is waiting for confirmation` };
};

export const createNotificationWorker = () =>
  new Worker(
    "notification",
    async (job) => {
      const booking = await prisma.booking.findUnique({
        where: { id: String(job.data.bookingId) },
        include: { stayProfile: { select: { ownerId: true } } },
      });
      if (!booking) return;
      const message = messageForJob(job.name, booking.bookingRef);
      const notification = await prisma.notification.create({
        data: {
          userId: booking.stayProfile.ownerId,
          bookingId: booking.id,
          type: message.type,
          title: message.title,
          body: message.body,
        },
      });
      emitToProperty(booking.stayProfileId, socketEvents.notificationNew, notification);
      await sendPushToUser({
        userId: booking.stayProfile.ownerId,
        bookingId: booking.id,
        title: message.title,
        body: message.body,
      });
      logger.info({ jobId: job.id, bookingId: booking.id, notificationId: notification.id }, "Notification created");
    },
    { connection: redisConnectionOptions(), concurrency: 10 },
  );
