import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

vi.mock("../../src/lib/prisma.js", async () => {
  const { createMockPrisma } = await import("../helpers/mockPrisma.js");
  return { prisma: createMockPrisma() };
});

let prisma: any;
let authenticateCentralUser: typeof import("../../src/services/customerAuthService.js").authenticateCentralUser;
let refreshCustomerSession: typeof import("../../src/services/customerAuthService.js").refreshCustomerSession;
let logoutCustomer: typeof import("../../src/services/customerAuthService.js").logoutCustomer;

beforeAll(async () => {
  ({ prisma } = await import("../../src/lib/prisma.js"));
  ({ authenticateCentralUser, refreshCustomerSession, logoutCustomer } = await import(
    "../../src/services/customerAuthService.js"
  ));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("authenticateCentralUser", () => {
  it("creates a new RestaurantUser when the phone has never logged in before", async () => {
    prisma.restaurantUser.findUnique.mockResolvedValue(null);
    prisma.restaurantUser.create.mockImplementation((args: any) => ({ id: "user-1", ...args.data }));
    prisma.refreshSession.create.mockResolvedValue({ id: "session-1" });

    const result = await authenticateCentralUser({ phone: "+919999999999", centralUserId: 42, name: "Rahul" });

    expect(result.isNewUser).toBe(true);
    expect(prisma.restaurantUser.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: "+919999999999", centralUserId: 42 }) }),
    );
    expect(result.user.phone).toBe("+919999999999");
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it("returns the existing user by phone untouched aside from backfilled fields — never recreated", async () => {
    prisma.restaurantUser.findUnique.mockResolvedValue({
      id: "user-1",
      phone: "+919999999999",
      name: "Rahul",
      email: null,
      playerId: "old-player",
      centralUserId: null,
    });
    prisma.restaurantUser.update.mockImplementation((args: any) => ({ id: "user-1", ...args.data }));
    prisma.refreshSession.create.mockResolvedValue({ id: "session-2" });

    const result = await authenticateCentralUser({ phone: "+919999999999", centralUserId: 42, playerId: "new-player-id" });

    expect(result.isNewUser).toBe(false);
    expect(prisma.restaurantUser.create).not.toHaveBeenCalled();
    expect(prisma.restaurantUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ centralUserId: 42, playerId: "new-player-id" }),
      }),
    );
  });
});

describe("refreshCustomerSession", () => {
  it("rejects an unknown refresh token", async () => {
    prisma.refreshSession.findUnique.mockResolvedValue(null);
    await expect(refreshCustomerSession("bogus-token")).rejects.toThrow(/invalid refresh token/i);
  });

  it("rejects an expired refresh token", async () => {
    prisma.refreshSession.findUnique.mockResolvedValue({ id: "s1", restaurantUserId: "u1", revokedAt: null, expiresAt: new Date(Date.now() - 1000) });
    await expect(refreshCustomerSession("expired-token")).rejects.toThrow(/expired/i);
  });

  it("detects reuse of an already-rotated token and revokes it again is rejected", async () => {
    prisma.refreshSession.findUnique.mockResolvedValue({ id: "s1", restaurantUserId: "u1", revokedAt: new Date(), expiresAt: new Date(Date.now() + 100000) });
    prisma.refreshSession.updateMany.mockResolvedValue({ count: 3 });
    await expect(refreshCustomerSession("reused-token")).rejects.toThrow(/already been used/i);
    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ restaurantUserId: "u1", revokedAt: null }) }),
    );
  });

  it("rotates a valid token: revokes the old session and issues a new one", async () => {
    prisma.refreshSession.findUnique.mockResolvedValue({ id: "s1", restaurantUserId: "u1", revokedAt: null, expiresAt: new Date(Date.now() + 100000) });
    prisma.refreshSession.create.mockResolvedValue({ id: "s2" });
    prisma.refreshSession.update.mockResolvedValue({ id: "s1" });

    const result = await refreshCustomerSession("valid-token");
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(prisma.refreshSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s1" }, data: expect.objectContaining({ replacedById: "s2" }) }),
    );
  });
});

describe("logoutCustomer", () => {
  it("revokes the session matching the given refresh token", async () => {
    prisma.refreshSession.updateMany.mockResolvedValue({ count: 1 });
    await logoutCustomer("some-token");
    const expectedHash = crypto.createHash("sha256").update("some-token").digest("hex");
    expect(prisma.refreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ tokenHash: expectedHash }) }),
    );
  });

  it("is a no-op for an empty token", async () => {
    await logoutCustomer("");
    expect(prisma.refreshSession.updateMany).not.toHaveBeenCalled();
  });
});
