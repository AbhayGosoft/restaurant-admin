import { env } from "../config/env.js";

export const redisConnectionOptions = () => {
  const url = new URL(env.redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: env.redisPassword,
    tls: url.protocol === "rediss:" ? {} : undefined,
  };
};
