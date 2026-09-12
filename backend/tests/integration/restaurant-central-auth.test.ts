import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/lib/prisma.js", async () => {
  const { createMockPrisma } = await import("../helpers/mockPrisma.js");
  return { prisma: createMockPrisma() };
});

vi.mock("../../src/lib/centralAuth.js", () => ({
  verifyCentralToken: vi.fn(),
}));

let app: import("express").Express;
let prisma: any;
let verifyCentralToken: any;
let appKey: string;
let ApiError: typeof import("../../src/utils/http.js").ApiError;

const validBody = {
  phone: "+919876543210",
  central_token: "signed-jwt",
  central_user_id: 42,
  name: "Sujal Sharma",
  email: "sujal@example.com",
  player_id: "8f3c1a90-1234-4c5e-9a77-0b2d5e6f7a81",
};

beforeAll(async () => {
  ({ app } = await import("../../src/app.js"));
  ({ prisma } = await import("../../src/lib/prisma.js"));
  ({ verifyCentralToken } = await import("../../src/lib/centralAuth.js"));
  ({ env: { restaurantAppApiKey: appKey } } = (await import("../../src/config/env.js")) as any);
  ({ ApiError } = await import("../../src/utils/http.js"));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/restaurant/auth", () => {
  it("rejects a call with no app key", async () => {
    const res = await request(app).post("/api/restaurant/auth").send(validBody);
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ status: false });
  });

  it("rejects a call with the wrong app key", async () => {
    const res = await request(app)
      .post("/api/restaurant/auth")
      .set("Authorization", "Bearer wrong-key")
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("rejects a malformed phone number with 422", async () => {
    const res = await request(app)
      .post("/api/restaurant/auth")
      .set("Authorization", `Bearer ${appKey}`)
      .send({ ...validBody, phone: "9876543210" });
    expect(res.status).toBe(422);
  });

  it("rejects when central_token verification fails", async () => {
    verifyCentralToken.mockRejectedValue(new ApiError(401, "Invalid central_token: expired"));
    const res = await request(app)
      .post("/api/restaurant/auth")
      .set("Authorization", `Bearer ${appKey}`)
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("rejects when the token's phone_number claim disagrees with the body", async () => {
    verifyCentralToken.mockResolvedValue({
      sub: "42",
      centralUserId: 42,
      phoneNumber: "+910000000000",
      phoneVerified: true,
    });
    const res = await request(app)
      .post("/api/restaurant/auth")
      .set("Authorization", `Bearer ${appKey}`)
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("logs in an existing user by phone without recreating them", async () => {
    verifyCentralToken.mockResolvedValue({
      sub: "42",
      centralUserId: 42,
      phoneNumber: "+919876543210",
      phoneVerified: true,
      name: "Sujal Sharma",
      email: "sujal@example.com",
    });
    prisma.restaurantUser.findUnique.mockResolvedValue({
      id: "987",
      phone: "+919876543210",
      name: "Sujal Sharma",
      email: "sujal@example.com",
      playerId: null,
      centralUserId: null,
    });
    prisma.restaurantUser.update.mockImplementation((args: any) => ({ id: "987", phone: "+919876543210", ...args.data }));
    prisma.refreshSession.create.mockResolvedValue({ id: "session-1" });

    const res = await request(app)
      .post("/api/restaurant/auth")
      .set("Authorization", `Bearer ${appKey}`)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
    expect(res.body.data.user.id).toBe("987");
    expect(res.body.data.access_token).toBeTruthy();
    expect(prisma.restaurantUser.create).not.toHaveBeenCalled();
  });

  it("creates a new user on first login for a phone", async () => {
    verifyCentralToken.mockResolvedValue({
      sub: "42",
      centralUserId: 42,
      phoneNumber: "+919876543210",
      phoneVerified: true,
    });
    prisma.restaurantUser.findUnique.mockResolvedValue(null);
    prisma.restaurantUser.create.mockImplementation((args: any) => ({ id: "new-user-1", ...args.data }));
    prisma.refreshSession.create.mockResolvedValue({ id: "session-2" });

    const res = await request(app)
      .post("/api/restaurant/auth")
      .set("Authorization", `Bearer ${appKey}`)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe("new-user-1");
    expect(prisma.restaurantUser.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: "+919876543210", centralUserId: 42 }) }),
    );
  });
});
