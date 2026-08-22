import { createClient } from "redis";
import { env } from "../config/env.js";
import { logger } from "../modules/logger.js";

export const redisClient = createClient({ url: env.redisUrl, RESP: 2 });
export const redisSubscriber = redisClient.duplicate();

let connected = false;

export const connectRedis = async () => {
  if (connected) return;
  redisClient.on("error", (error) => logger.error({ error }, "Redis client error"));
  redisSubscriber.on("error", (error) => logger.error({ error }, "Redis subscriber error"));
  await Promise.all([redisClient.connect(), redisSubscriber.connect()]);
  connected = true;
  logger.info({ redisUrl: env.redisUrl }, "Redis connected");
};

export const disconnectRedis = async () => {
  if (!connected) return;
  await Promise.allSettled([redisClient.quit(), redisSubscriber.quit()]);
  connected = false;
};
