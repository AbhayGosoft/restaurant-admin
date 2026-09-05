import { createAdapter } from "@socket.io/redis-adapter";
import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../modules/logger.js";
import { redisClient, redisSubscriber } from "../redis/client.js";

let io: Server | null = null;

type AdminJwtPayload = { sub: string; type: "admin" };
type CustomerJwtPayload = { sub: string; type: "customer" };

const authenticateSocket = async (token: string) => {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as AdminJwtPayload;
    if (decoded.type === "admin") {
      const admin = await prisma.adminUser.findUnique({
        where: { id: decoded.sub },
        select: { id: true, role: true, status: true, restaurants: { select: { restaurantId: true } } },
      });
      if (!admin || admin.status !== "ACTIVE") return null;
      return { kind: "admin" as const, id: admin.id, role: admin.role, restaurantIds: admin.restaurants.map((r) => r.restaurantId) };
    }
  } catch {
    // fall through to customer secret
  }

  try {
    const decoded = jwt.verify(token, env.customerJwtSecret) as CustomerJwtPayload;
    if (decoded.type === "customer") {
      const customer = await prisma.restaurantUser.findUnique({ where: { id: decoded.sub }, select: { id: true } });
      if (!customer) return null;
      return { kind: "customer" as const, id: customer.id };
    }
  } catch {
    // neither secret verified the token
  }

  return null;
};

export const initSocketServer = (httpServer: HttpServer) => {
  const origins = env.frontendOrigin.split(",").map((origin) => origin.trim());
  io = new Server(httpServer, {
    cors: { origin: origins.includes("*") ? true : origins, credentials: true },
  });

  io.adapter(createAdapter(redisClient, redisSubscriber));

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.toString().replace(/^Bearer\s+/i, "");
      if (!token) throw new Error("Missing token");

      const identity = await authenticateSocket(token);
      if (!identity) throw new Error("Invalid or expired token");

      if (identity.kind === "admin") {
        socket.data.admin = { id: identity.id, role: identity.role };
        socket.join("admin");
        if (identity.role === "SUPERADMIN") {
          socket.join("restaurant:all");
        } else {
          identity.restaurantIds.forEach((restaurantId) => socket.join(`restaurant:${restaurantId}`));
        }
      } else {
        socket.data.customer = { id: identity.id };
        socket.join(`customer:${identity.id}`);
      }

      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Socket authentication failed"));
    }
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id, admin: socket.data.admin?.id, customer: socket.data.customer?.id }, "Socket connected");
  });

  return io;
};

export const getSocketServer = () => io;

export const emitToRestaurant = (restaurantId: string, event: string, payload: unknown) => {
  io?.to(`restaurant:${restaurantId}`).to("restaurant:all").emit(event, payload);
};

export const emitToCustomer = (customerId: string, event: string, payload: unknown) => {
  io?.to(`customer:${customerId}`).emit(event, payload);
};

export const closeSocketServer = async () => {
  await io?.close();
  io = null;
};
