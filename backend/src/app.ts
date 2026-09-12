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

import customerAuthRoutes from "./routes/customerAuth.routes.js";
import restaurantCentralAuthRoutes from "./routes/restaurantCentralAuth.routes.js";
import adminAuthRoutes from "./routes/adminAuth.routes.js";
import restaurantsRoutes from "./routes/restaurants.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import myBookingsRoutes from "./routes/myBookings.routes.js";
import restaurantBookingsRoutes from "./routes/restaurantBookings.routes.js";
import uploadsRoutes from "./routes/uploads.routes.js";

import adminAdminsRoutes from "./routes/admin/admins.routes.js";
import adminRestaurantsRoutes from "./routes/admin/restaurants.routes.js";
import adminMenuRoutes from "./routes/admin/menu.routes.js";
import adminSlotsRoutes from "./routes/admin/slots.routes.js";
import adminBookingsRoutes from "./routes/admin/bookings.routes.js";
import adminCategoriesRoutes from "./routes/admin/categories.routes.js";

export const app = express();

const origins = env.frontendOrigin.split(",").map((origin) => origin.trim());

// Uploaded images are served by this API but rendered by the admin frontend on another
// origin, so the default same-origin CORP would silently block <img> tags from loading them.
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
  res.json({ name: "Restaurant Backend API", status: "ok", docs: "/api/health" });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Darshan Admin (central auth) server-to-server bridge — authenticated by its own
// app key (see requireRestaurantAppKey), not the admin frontend's x-client-key, so
// it must be mounted ahead of the requireClientKey gate below.
app.use("/api/restaurant", restaurantCentralAuthRoutes);

app.use("/api", requireClientKey);

// Customer-facing
app.use("/api/auth", customerAuthRoutes);
app.use("/api/restaurants", restaurantsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/my-restaurant-bookings", myBookingsRoutes);
app.use("/api/restaurant-bookings", restaurantBookingsRoutes);

// Admin / SuperAdmin
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/admins", adminAdminsRoutes);
app.use("/api/admin/categories", adminCategoriesRoutes);
app.use("/api/admin/restaurants/:restaurantId/menu", adminMenuRoutes);
app.use("/api/admin/restaurants/:restaurantId/slots", adminSlotsRoutes);
app.use("/api/admin/restaurants", adminRestaurantsRoutes);
app.use("/api/admin/bookings", adminBookingsRoutes);
app.use("/api/uploads", uploadsRoutes);

app.use((_req, res) => {
  res.status(404).json({ status: false, message: "Route not found" });
});

app.use(errorHandler);
