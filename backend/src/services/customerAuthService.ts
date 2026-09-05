import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { verifyFirebaseIdToken } from "../lib/firebaseAdmin.js";
import { env } from "../config/env.js";
import { signCustomerAccessToken } from "../middleware/auth.js";
import { ApiError } from "../utils/http.js";
import { logger } from "../modules/logger.js";

const hashToken = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");
const generateRefreshToken = () => crypto.randomBytes(48).toString("hex");

const refreshExpiry = () => new Date(Date.now() + env.customerRefreshTokenTtlDays * 24 * 60 * 60 * 1000);

const issueSession = async (restaurantUserId: string) => {
  const rawRefreshToken = generateRefreshToken();
  await prisma.refreshSession.create({
    data: {
      restaurantUserId,
      tokenHash: hashToken(rawRefreshToken),
      expiresAt: refreshExpiry(),
    },
  });
  return { accessToken: signCustomerAccessToken(restaurantUserId), refreshToken: rawRefreshToken };
};

export const authenticateCustomer = async (input: {
  firebaseToken: string;
  name?: string;
  email?: string;
  playerId?: string;
}) => {
  const { uid, phone } = await verifyFirebaseIdToken(input.firebaseToken);

  const existing = await prisma.restaurantUser.findUnique({ where: { firebaseUid: uid } });

  const user = existing
    ? await prisma.restaurantUser.update({
        where: { id: existing.id },
        data: {
          name: input.name?.trim() || existing.name,
          email: input.email?.trim() || existing.email,
          playerId: input.playerId ?? existing.playerId,
        },
      })
    : await prisma.restaurantUser.create({
        data: {
          firebaseUid: uid,
          phone,
          name: input.name?.trim() || "Guest",
          email: input.email?.trim(),
          playerId: input.playerId,
        },
      });

  const session = await issueSession(user.id);
  return { user, ...session, isNewUser: !existing };
};

export const refreshCustomerSession = async (rawRefreshToken: string) => {
  if (!rawRefreshToken) throw new ApiError(401, "Refresh token is required");
  const tokenHash = hashToken(rawRefreshToken);

  const session = await prisma.refreshSession.findUnique({ where: { tokenHash } });
  if (!session) throw new ApiError(401, "Invalid refresh token");

  if (session.revokedAt) {
    // Reuse of an already-rotated/revoked token — treat as compromised and kill every
    // active session for this user so a stolen token can't keep minting access tokens.
    logger.warn({ restaurantUserId: session.restaurantUserId }, "Refresh token reuse detected; revoking all sessions");
    await prisma.refreshSession.updateMany({
      where: { restaurantUserId: session.restaurantUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new ApiError(401, "Refresh token has already been used");
  }

  if (session.expiresAt < new Date()) throw new ApiError(401, "Refresh token has expired");

  const rawNewToken = generateRefreshToken();
  const newSession = await prisma.$transaction(async (tx) => {
    const created = await tx.refreshSession.create({
      data: {
        restaurantUserId: session.restaurantUserId,
        tokenHash: hashToken(rawNewToken),
        expiresAt: refreshExpiry(),
      },
    });
    await tx.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), replacedById: created.id },
    });
    return created;
  });

  return {
    accessToken: signCustomerAccessToken(session.restaurantUserId),
    refreshToken: rawNewToken,
    restaurantUserId: session.restaurantUserId,
    sessionId: newSession.id,
  };
};

export const logoutCustomer = async (rawRefreshToken: string) => {
  if (!rawRefreshToken) return;
  const tokenHash = hashToken(rawRefreshToken);
  await prisma.refreshSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
};
