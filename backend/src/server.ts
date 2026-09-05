import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { closeQueues } from "./queues/reminderQueue.js";
import { connectRedis, disconnectRedis } from "./redis/client.js";
import { closeSocketServer, initSocketServer } from "./socket/server.js";
import { logger } from "./modules/logger.js";
import { closeWorkers, startWorkers } from "./workers/index.js";

await connectRedis();

const server = app.listen(env.port, () => {
  logger.info({ port: env.port }, `Restaurant backend API running on http://localhost:${env.port}`);
});

initSocketServer(server);
startWorkers();

const shutdown = async () => {
  await closeWorkers();
  await closeQueues();
  await closeSocketServer();
  await disconnectRedis();
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
