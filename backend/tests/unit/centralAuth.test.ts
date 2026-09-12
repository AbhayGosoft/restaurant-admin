import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const jwtVerify = vi.fn();
vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => ({})),
  jwtVerify: (...args: unknown[]) => jwtVerify(...args),
}));

let verifyCentralToken: typeof import("../../src/lib/centralAuth.js").verifyCentralToken;

beforeAll(async () => {
  ({ verifyCentralToken } = await import("../../src/lib/centralAuth.js"));
});

afterEach(() => {
  vi.clearAllMocks();
});

const validPayload = {
  sub: "42",
  central_user_id: 42,
  phone_number: "+919876543210",
  phone_verified: true,
  name: "Sujal Sharma",
  email: "sujal@example.com",
};

describe("verifyCentralToken", () => {
  it("rejects an empty token without calling jose", async () => {
    await expect(verifyCentralToken("")).rejects.toThrow(/required/i);
    expect(jwtVerify).not.toHaveBeenCalled();
  });

  it("wraps a jose verification failure (bad signature, wrong alg, expired, etc.) as a 401 ApiError", async () => {
    jwtVerify.mockRejectedValue(new Error("signature verification failed"));
    await expect(verifyCentralToken("bad-token")).rejects.toMatchObject({
      statusCode: 401,
      message: expect.stringContaining("signature verification failed"),
    });
  });

  it("rejects a token whose phone_verified claim is not true", async () => {
    jwtVerify.mockResolvedValue({ payload: { ...validPayload, phone_verified: false } });
    await expect(verifyCentralToken("tok")).rejects.toMatchObject({ statusCode: 401 });
  });

  it("returns normalized claims for a valid token", async () => {
    jwtVerify.mockResolvedValue({ payload: validPayload });
    const claims = await verifyCentralToken("tok");
    expect(claims).toMatchObject({
      sub: "42",
      centralUserId: 42,
      phoneNumber: "+919876543210",
      phoneVerified: true,
      name: "Sujal Sharma",
      email: "sujal@example.com",
    });
  });
});
