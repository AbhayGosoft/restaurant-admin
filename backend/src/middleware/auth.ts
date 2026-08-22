import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "../../generated/prisma/enums.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/http.js";

type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export const signAuthToken = (payload: JwtPayload) =>
  jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
      throw new ApiError(401, "Missing bearer token");
    }

    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user || user.status !== "ACTIVE") {
      throw new ApiError(401, "User is inactive or does not exist");
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(401, "Invalid token"));
  }
};

export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "Insufficient permissions"));
    }
    return next();
  };

const timingSafeEqual = (a: string, b: string) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against itself so both branches take the same time.
    return crypto.timingSafeEqual(bufA, bufA) && false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
};

export const requireAdapterKey = (req: Request, _res: Response, next: NextFunction) => {
  if (!env.adapterApiKey) {
    return next(new ApiError(401, "Adapter API key is not configured"));
  }

  const authHeader = req.headers.authorization ?? "";
  const provided = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : String(req.headers["x-api-key"] ?? "");

  if (!provided || !timingSafeEqual(provided, env.adapterApiKey)) {
    return next(new ApiError(401, "Invalid adapter API key"));
  }
  return next();
};

export const requireAdapterHmac = (req: Request, _res: Response, next: NextFunction) => {
  if (!env.adapterHmacSecret) {
    return next(new ApiError(401, "Adapter HMAC secret is not configured"));
  }

  const signature = String(req.headers["x-signature"] ?? "");
  const timestamp = String(req.headers["x-timestamp"] ?? "");
  if (!signature || !timestamp || !req.rawBody) {
    return next(new ApiError(401, "Missing adapter signature"));
  }

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > 5 * 60 * 1000) {
    return next(new ApiError(401, "Adapter signature timestamp is outside the allowed window"));
  }

  const expected = crypto
    .createHmac("sha256", env.adapterHmacSecret)
    .update(`${timestamp}.`)
    .update(req.rawBody)
    .digest("hex");
  const normalizedSignature = signature.startsWith("sha256=") ? signature.slice("sha256=".length) : signature;

  if (!timingSafeEqual(normalizedSignature, expected)) {
    return next(new ApiError(401, "Invalid adapter signature"));
  }
  return next();
};

export const requireClientKey = (req: Request, _res: Response, next: NextFunction) => {
  if (!env.appClientKey) {
    return next(new ApiError(401, "Client key is not configured"));
  }

  const provided = String(req.headers["x-client-key"] ?? "");
  if (!provided || !timingSafeEqual(provided, env.appClientKey)) {
    return next(new ApiError(401, "Invalid client key"));
  }
  return next();
};
