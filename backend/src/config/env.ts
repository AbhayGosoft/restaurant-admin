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
  // Where uploaded assets (/uploads/images/...) are actually reachable from — needed to turn
  // backend-relative image paths into absolute URLs for external consumers (e.g. GoAdapter),
  // which have no way to know our relative-path convention.
  publicOrigin: (process.env.PUBLIC_ORIGIN ?? `http://localhost:${process.env.PORT ?? 4000}`).replace(/\/$/, ""),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN,
  frontendOrigin: process.env.FRONTEND_ORIGIN?? "*",
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  logLevel: process.env.LOG_LEVEL ?? "info",
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
  adapterApiKey: process.env.SAAS_ADAPTER_API_KEY,
  adapterHmacSecret: process.env.SAAS_ADAPTER_HMAC_SECRET,
  adapterCallbackUrl: process.env.SAAS_ADAPTER_CALLBACK_URL,
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY,
  appClientKey: process.env.APP_CLIENT_KEY,
};
