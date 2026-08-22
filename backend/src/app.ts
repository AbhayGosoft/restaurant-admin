import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { pinoHttp } from "pino-http";
import type { Request } from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./utils/http.js";
import { requireClientKey } from "./middleware/auth.js";
import { logger } from "./modules/logger.js";
import authRoutes from "./routes/auth.routes.js";
import ownersRoutes from "./routes/owners.routes.js";
import amenitiesRoutes from "./routes/amenities.routes.js";
import staysRoutes from "./routes/stays.routes.js";
import roomsRoutes from "./routes/rooms.routes.js";
import setupRoutes from "./routes/setup.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";
import roomTypesRoutes from "./routes/roomTypes.routes.js";
import ratePlansRoutes from "./routes/ratePlans.routes.js";
import servicesRoutes from "./routes/services.routes.js";
import taxesRoutes from "./routes/taxes.routes.js";
import policiesRoutes from "./routes/policies.routes.js";
import bookingsRoutes from "./routes/bookings.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import settlementsRoutes from "./routes/settlements.routes.js";
import integrationsRoutes from "./routes/integrations.routes.js";
import adapterRoutes from "./routes/adapter.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import uploadsRoutes from "./routes/uploads.routes.js";
import roomBlocksRoutes from "./routes/roomBlocks.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";

export const app = express();

const origins = env.frontendOrigin.split(",").map((origin) => origin.trim());

// Uploaded images are served by this API but rendered by frontends on other origins
// (web app on a different port/domain, mobile WebView, partner adapters), so the
// default same-origin CORP would silently block <img> tags from loading them.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(cookieParser());
app.use(pinoHttp({ logger }));
app.use(express.json({ limit: "2mb", verify: (req, _res, buf) => { (req as Request).rawBody = Buffer.from(buf); } }));
app.use(express.urlencoded({ extended: true }));
if (env.nodeEnv === "development") {
  app.use(morgan("dev"));
}
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500 }));
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.get("/", (_req, res) => {
  res.json({
    name: "Backend PMS API",
    status: "ok",
    docs: "/api/health",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Partner adapter routes authenticate with their own x-api-key (requireAdapterKey)
// and must stay reachable by external systems, so the app client key is skipped for them.
app.use((req, res, next) => {
  if (req.path.startsWith("/api/partner") || req.path.startsWith("/api/integrations") || req.path.startsWith("/api/adapter")) {
    return next();
  }
  return requireClientKey(req, res, next);
});

app.use("/api/auth", authRoutes);
app.use("/api/owners", ownersRoutes);
app.use("/api/amenities", amenitiesRoutes);
app.use("/api/stays", staysRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/setup", setupRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/room-types", roomTypesRoutes);
app.use("/api/rate-plans", ratePlansRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/taxes", taxesRoutes);
app.use("/api/policies", policiesRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/settlements", settlementsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/room-blocks", roomBlocksRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/partner", integrationsRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/adapter", adapterRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);
