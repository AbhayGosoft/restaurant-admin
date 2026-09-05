import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

vi.mock("../../src/lib/prisma.js", async () => {
  const { createMockPrisma } = await import("../helpers/mockPrisma.js");
  return { prisma: createMockPrisma() };
});

vi.mock("../../src/lib/firebaseAdmin.js", () => ({
  verifyFirebaseIdToken: vi.fn(),
}));

let prisma: any;
let verifyFirebaseIdToken: any;
let authenticateCustomer: typeof import("../../src/services/customerAuthService.js").authenticateCustomer;
let refreshCustomerSession: typeof import("../../src/services/customerAuthService.js").refreshCustomerSession;
let logoutCustomer: typeof import("../../src/services/customerAuthService.js").logoutCustomer;

beforeAll(async () => {
  ({ prisma } = await import("../../src/lib/prisma.js"));
  ({ verifyFirebaseIdToken } = await import("../../src/lib/firebaseAdmin.js"));
  ({ authenticateCustomer, refreshCustomerSession, logoutCustomer } = await import("../../src/services/customerAuthService.js"));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("authenticateCustomer", () => {
  it("creates a new RestaurantUser using only server-verified Firebase identity", async () => {
    verifyFirebaseIdToken.mockResolvedValue({ uid: "fb-uid-1", phone: "+919999999999" });
    prisma.restaurantUser.findUnique.mockResolvedValue(null);
    prisma.restaurantUser.create.mockImplementation((args: any) => ({ id: "user-1", ...args.data }));
    prisma.refreshSession.create.mockResolvedValue({ id: "session-1" });

    const result = await authenticateCustomer({ firebaseToken: "tok", name: "Rahul", player_id: undefined } as any);

    expect(result.isNewUser).toBe(true);
    expect(prisma.restaurantUser.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ firebaseUid: "fb-uid-1", phone: "+919999999999" }) }),
    );
    // The phone number came from Firebase, never from client input (none was supplied here).
    expect(result.user.phone).toBe("+919999999999");
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
  });

  it("updates the existing user's player_id on a returning login", async () => {
    verifyFirebaseIdToken.mockResolvedValue({ uid: "fb-uid-1", phone: "+919999999999" });
    prisma.restaurantUser.findUnique.mockResolvedValue({ id: "user-1", firebaseUid: "fb-uid-1", phone: "+919999999999", name: "Rahul", email: null, playerId: "old-player" });
    prisma.restaurantUser.update.mockImplementation((args: any) => ({ id: "user-1", ...args.data }));
    prisma.refreshSession.create.mockResolvedValue({ id: "session-2" });

    const result = await authenticateCustomer({ firebaseToken: "tok", playerId: "new-player-id" } as any);

    expect(result.isNewUser).toBe(false);
    expect(prisma.restaurantUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ playerId: "new-player-id" }) }),
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
