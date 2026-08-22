import { redisClient } from "./client.js";

const key = (bookingId: string) => `booking:pending:${bookingId}`;

export type PendingBookingMetadata = {
  bookingId: string;
  bookingRef: string;
  propertyId: string;
  ownerId: string;
  expiresAt: string;
};

export const savePendingBookingMetadata = async (metadata: PendingBookingMetadata) => {
  const ttlSeconds = Math.max(1, Math.ceil((new Date(metadata.expiresAt).getTime() - Date.now()) / 1000));
  await redisClient.set(key(metadata.bookingId), JSON.stringify(metadata), { EX: ttlSeconds });
};

export const deletePendingBookingMetadata = async (bookingId: string) => {
  await redisClient.del(key(bookingId));
};
