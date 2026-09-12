import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./env.js";

/**
 * OpenAPI spec generated from `@openapi` JSDoc blocks in src/docs/** (mirrors src/routes/**
 * 1:1 by filename — e.g. routes/admin/menu.routes.ts <-> docs/admin/menu.docs.ts). Docs live
 * apart from the routes themselves because a single endpoint's schema/response block is
 * routinely longer than its handler; keeping them separate keeps route files readable while
 * the mirrored filenames make "where are this endpoint's docs" a non-question.
 * Served as interactive docs at /api/docs and raw JSON at /api/docs.json (see app.ts).
 */
const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Restaurant Backend API",
      version: "1.0.0",
      description:
        "REST API for the Restaurant admin/customer platform: customer-facing discovery/booking/payments, " +
        "the admin/superadmin back office, and the Darshan Admin central-auth server-to-server bridge.",
    },
    servers: [{ url: `${env.publicOrigin}`, description: env.nodeEnv === "production" ? "Production" : "Current environment" }],
    // Tags are resource-based, not role-based: an admin and a customer endpoint for the same
    // resource (e.g. slots) share one tag, distinguished within the operation by its `security`
    // and path rather than by a separate "Admin: X" heading per role.
    tags: [
      { name: "Health", description: "Service health check" },
      { name: "Restaurant Central Auth", description: "Server-to-server bridge used only by Darshan Admin (central auth) to mint app sessions" },
      { name: "Customer Auth", description: "Session refresh/logout for the app (login/registration happens via the central auth bridge)" },
      { name: "Admin Auth", description: "Admin/SuperAdmin login and account" },
      { name: "Restaurants", description: "Restaurant discovery and management (customer read access, admin/superadmin write access)" },
      { name: "Menu", description: "Menu categories and items (customer read access, admin write access)" },
      { name: "Slots", description: "Booking slot configuration and availability (customer read access, admin write access)" },
      { name: "Bookings", description: "Bookings (customer's own, plus admin/superadmin management across restaurants)" },
      { name: "Payments", description: "Razorpay payment order creation and verification" },
      { name: "Categories", description: "Restaurant category taxonomy (superadmin write, admin read)" },
      { name: "Admins", description: "Admin account management (superadmin only)" },
      { name: "Uploads", description: "Image uploads" },
    ],
    components: {
      securitySchemes: {
        ClientKey: {
          type: "apiKey",
          in: "header",
          name: "x-client-key",
          description: "Shared secret for the admin web frontend. Required on every /api/* route except the /api/restaurant/* bridge.",
        },
        AdminBearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Admin/SuperAdmin session token from POST /api/admin/auth/login.",
        },
        CustomerBearer: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Customer access token, issued by the central auth bridge and renewed via POST /api/auth/refresh.",
        },
        RestaurantAppKey: {
          type: "http",
          scheme: "bearer",
          description: "Server-to-server app key for the Darshan Admin (central auth) bridge. Distinct trust boundary from ClientKey.",
        },
      },
      schemas: {
        SuccessEnvelope: {
          type: "object",
          properties: {
            status: { type: "boolean", example: true },
            message: { type: "string", example: "OK" },
            data: {},
          },
          required: ["status", "message"],
        },
        ErrorEnvelope: {
          type: "object",
          properties: {
            status: { type: "boolean", example: false },
            message: { type: "string", example: "Something went wrong" },
          },
          required: ["status", "message"],
        },
        ValidationErrorEnvelope: {
          type: "object",
          properties: {
            status: { type: "boolean", example: false },
            message: { type: "string", example: "Validation failed" },
            errors: { type: "array", items: { type: "object" } },
          },
          required: ["status", "message", "errors"],
        },
        AdminSummary: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            email: { type: "string", format: "email" },
            role: { type: "string", enum: ["ADMIN", "SUPERADMIN"] },
            status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            page: { type: "integer", example: 1 },
            limit: { type: "integer", example: 20 },
            total: { type: "integer", example: 42 },
            totalPages: { type: "integer", example: 3 },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: "Missing/invalid credentials",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
        },
        Forbidden: {
          description: "Authenticated but not allowed to perform this action",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
        },
        NotFound: {
          description: "Resource not found",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
        },
        ValidationError: {
          description: "Request failed schema validation",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ValidationErrorEnvelope" } } },
        },
      },
    },
    security: [{ ClientKey: [] }],
  },
  // Both patterns are globbed (unmatched ones are simply empty) so docs work equally
  // from `tsx` (reads .ts source) and from a `tsc` build run as `node dist/src/server.js`
  // (reads the compiled .js, since dist ships without the original .ts comments' source).
  apis: ["./src/docs/**/*.ts", "./dist/src/docs/**/*.js"],
};

export const swaggerSpec = swaggerJsdoc(options);
