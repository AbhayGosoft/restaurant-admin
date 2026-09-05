import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.logLevel,
  base: { service: "restaurant-backend-api" },
  transport:
    env.nodeEnv === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true, singleLine: true },
        }
      : undefined,
});
