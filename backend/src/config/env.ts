import "dotenv/config";

const required = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  publicOrigin: (process.env.PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 4000}`).replace(/\/$/, ""),
  databaseUrl: required("DATABASE_URL"),

  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,

  customerJwtSecret: required("CUSTOMER_JWT_SECRET"),
  customerAccessTokenTtl: process.env.CUSTOMER_ACCESS_TOKEN_TTL ?? "15m",
  customerRefreshTokenTtlDays: Number(process.env.CUSTOMER_REFRESH_TOKEN_TTL_DAYS ?? 30),

  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "*",
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  logLevel: process.env.LOG_LEVEL ?? "info",

  superAdminName: process.env.SUPERADMIN_NAME ?? "Super Admin",
  superAdminEmail: process.env.SUPERADMIN_EMAIL,
  superAdminPassword: process.env.SUPERADMIN_PASSWORD,

  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,

  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  restaurantBookingAdvanceInr: Number(process.env.RESTAURANT_BOOKING_ADVANCE_INR ?? 99),

  oneSignalAppId: process.env.ONESIGNAL_APP_ID,
  oneSignalApiKey: process.env.ONESIGNAL_API_KEY,

  bookingModificationCutoffMinutes: Number(process.env.BOOKING_MODIFICATION_CUTOFF_MINUTES ?? 60),
  bookingReminderMinutesBefore: Number(process.env.BOOKING_REMINDER_MINUTES_BEFORE ?? 120),

  appClientKey: process.env.APP_CLIENT_KEY,
};
