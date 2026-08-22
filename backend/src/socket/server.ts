import { createAdapter } from "@socket.io/redis-adapter";
import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../modules/logger.js";
import { redisClient, redisSubscriber } from "../redis/client.js";

let io: Server | null = null;

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
};

export const initSocketServer = (httpServer: HttpServer) => {
  const origins = env.frontendOrigin.split(",").map((origin) => origin.trim());
  io = new Server(httpServer, {
    cors: {
      origin: origins.includes("*") ? true : origins,
      credentials: true,
    },
  });

  io.adapter(createAdapter(redisClient, redisSubscriber));

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.toString().replace(/^Bearer\s+/i, "");
      if (!token) throw new Error("Missing token");
      const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
        select: { id: true, role: true, status: true, stayProfiles: { select: { id: true } } },
      });
      if (!user || user.status !== "ACTIVE") throw new Error("Inactive user");
      socket.data.user = { id: user.id, role: user.role };
      socket.join(`user:${user.id}`);
      if (user.role === "ADMIN") socket.join("admin");
      user.stayProfiles.forEach((property) => socket.join(`property:${property.id}`));
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Socket authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id, userId: socket.data.user?.id }, "Socket connected");
    socket.emit("room:update", { rooms: Array.from(socket.rooms) });
  });

  return io;
};

export const getSocketServer = () => io;

export const emitToProperty = (propertyId: string, event: string, payload: unknown) => {
  io?.to(`property:${propertyId}`).to("admin").emit(event, payload);
};

export const closeSocketServer = async () => {
  await io?.close();
  io = null;
};
