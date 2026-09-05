import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../../src/lib/prisma.js", async () => {
  const { createMockPrisma } = await import("../helpers/mockPrisma.js");
  return { prisma: createMockPrisma() };
});

let app: import("express").Express;
let prisma: any;
let signAdminToken: typeof import("../../src/middleware/auth.js").signAdminToken;
let signCustomerAccessToken: typeof import("../../src/middleware/auth.js").signCustomerAccessToken;
let clientKey: string;

// Every /api route sits behind the shared x-client-key gate (see app.ts); auth
// boundary tests below are about the JWT/role logic behind it, so always send it.
const api = (method: "get" | "post" | "patch" | "delete") => (path: string) => request(app)[method](path).set("x-client-key", clientKey);

beforeAll(async () => {
  ({ app } = await import("../../src/app.js"));
  ({ prisma } = await import("../../src/lib/prisma.js"));
  ({ signAdminToken, signCustomerAccessToken } = await import("../../src/middleware/auth.js"));
  ({ env: { appClientKey: clientKey } } = (await import("../../src/config/env.js")) as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("cross-audience token rejection", () => {
  it("rejects requests to customer APIs with no token", async () => {
    const res = await api("get")("/api/my-restaurant-bookings");
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ status: false });
  });

  it("rejects an admin-signed token on a customer-only endpoint", async () => {
    const adminToken = signAdminToken({ sub: "admin-1", email: "a@b.com", role: "ADMIN" });
    const res = await api("get")("/api/my-restaurant-bookings").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(401);
  });

  it("rejects a customer-signed token on an admin-only endpoint", async () => {
    const customerToken = signCustomerAccessToken("customer-1");
    const res = await api("get")("/api/admin/restaurants").set("Authorization", `Bearer ${customerToken}`);
    expect(res.status).toBe(401);
  });

  it("rejects requests to admin APIs with no token", async () => {
    const res = await api("get")("/api/admin/restaurants");
    expect(res.status).toBe(401);
  });

  it("rejects an expired/garbage bearer token", async () => {
    const res = await api("get")("/api/my-restaurant-bookings").set("Authorization", "Bearer not-a-real-jwt");
    expect(res.status).toBe(401);
  });

  it("rejects a request missing the shared client key entirely", async () => {
    const res = await request(app).get("/api/restaurants");
    expect(res.status).toBe(401);
  });
});

describe("SuperAdmin-only routes", () => {
  it("rejects a plain ADMIN token on a SuperAdmin-only route", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({ id: "admin-1", email: "a@b.com", role: "ADMIN", status: "ACTIVE" });
    const token = signAdminToken({ sub: "admin-1", email: "a@b.com", role: "ADMIN" });

    const res = await api("get")("/api/admin/admins").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("allows a SUPERADMIN token through", async () => {
    prisma.adminUser.findUnique.mockResolvedValue({ id: "super-1", email: "s@b.com", role: "SUPERADMIN", status: "ACTIVE" });
    prisma.adminUser.findMany.mockResolvedValue([]);
    const token = signAdminToken({ sub: "super-1", email: "s@b.com", role: "SUPERADMIN" });

    const res = await api("get")("/api/admin/admins").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(true);
  });
});

describe("booking ownership (IDOR protection)", () => {
  it("rejects a customer fetching another customer's booking", async () => {
    prisma.restaurantUser.findUnique.mockResolvedValue({ id: "customer-A", phone: "+911111111111" });
    prisma.restaurantBooking.findUnique.mockResolvedValue({
      id: "booking-1",
      restaurantUserId: "customer-B",
      status: "UPCOMING",
      date: new Date("2099-01-01"),
      time: "12:00",
      humanBookingId: "#RB0101",
      restaurantId: "r1",
      restaurantNameSnapshot: "Test",
      restaurantImageSnapshot: null,
      ratingSnapshot: "4.5",
      cuisineLabelSnapshot: "Veg",
      distanceKmSnapshot: null,
      people: 2,
      tablePreference: "ANY",
      specialRequest: null,
      fullName: "A",
      mobileNumber: "999",
      email: null,
      cancellationReason: null,
      advancePaid: "99",
    });

    const token = signCustomerAccessToken("customer-A");
    const res = await api("get")("/api/restaurant-bookings/booking-1").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
