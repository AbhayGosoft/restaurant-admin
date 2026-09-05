import { Worker } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { redisConnectionOptions } from "../redis/connection.js";
import { notifyCustomer } from "../services/notificationService.js";
import { to12Hour } from "../utils/slotTime.js";

export const createReminderWorker = () =>
  new Worker(
    "booking-reminder",
    async (job) => {
      const { bookingId } = job.data as { bookingId: string };
      const booking = await prisma.restaurantBooking.findUnique({ where: { id: bookingId } });
      if (!booking || booking.status !== "UPCOMING") return;

      await notifyCustomer({
        restaurantUserId: booking.restaurantUserId,
        type: "BOOKING_REMINDER",
        bookingId: booking.id,
        title: "Your table is booked soon",
        body: `Reminder: your booking ${booking.humanBookingId} at ${booking.restaurantNameSnapshot} is at ${to12Hour(booking.time)} today.`,
      });
    },
    { connection: redisConnectionOptions(), concurrency: 5 },
  );
