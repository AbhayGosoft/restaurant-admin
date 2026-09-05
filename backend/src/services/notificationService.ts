import type { NotificationType } from "../../generated/prisma/enums.js";
import { prisma } from "../lib/prisma.js";
import { sendOneSignalPush } from "../lib/oneSignal.js";
import { emitToCustomer } from "../socket/server.js";
import { socketEvents } from "../socket/socketEvents.js";

export const notifyCustomer = async (input: {
  restaurantUserId: string;
  type: NotificationType;
  bookingId?: string;
  title: string;
  body: string;
}) => {
  const [notification, user] = await Promise.all([
    prisma.notification.create({
      data: {
        restaurantUserId: input.restaurantUserId,
        type: input.type,
        bookingId: input.bookingId,
        title: input.title,
        body: input.body,
      },
    }),
    prisma.restaurantUser.findUnique({ where: { id: input.restaurantUserId }, select: { playerId: true } }),
  ]);

  emitToCustomer(input.restaurantUserId, socketEvents.notificationNew, notification);

  if (user?.playerId) {
    await sendOneSignalPush({
      playerId: user.playerId,
      title: input.title,
      body: input.body,
      data: { type: input.type, bookingId: input.bookingId },
    });
  }

  return notification;
};
