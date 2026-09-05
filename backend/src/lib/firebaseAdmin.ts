import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { env } from "../config/env.js";
import { ApiError } from "../utils/http.js";
import { logger } from "../modules/logger.js";

type ServiceAccountShape = { project_id: string; client_email: string; private_key: string };

const serviceAccount = (): ServiceAccountShape | null => {
  if (env.firebaseServiceAccountJson) {
    return JSON.parse(env.firebaseServiceAccountJson) as ServiceAccountShape;
  }
  if (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey) {
    return {
      project_id: env.firebaseProjectId,
      client_email: env.firebaseClientEmail,
      private_key: env.firebasePrivateKey.replace(/\\n/g, "\n"),
    };
  }
  return null;
};

const firebaseApp = () => {
  if (getApps().length) return getApps()[0];
  const account = serviceAccount();
  if (!account) return null;
  return initializeApp({
    credential: cert({
      projectId: account.project_id,
      clientEmail: account.client_email,
      privateKey: account.private_key,
    }),
  });
};

/**
 * Verifies a Firebase phone-auth ID token server-side and returns the trusted
 * UID + phone number. Never trust a client-supplied UID/phone — always derive
 * them from this.
 */
export const verifyFirebaseIdToken = async (idToken: string): Promise<{ uid: string; phone: string }> => {
  const app = firebaseApp();
  if (!app) {
    logger.error("Firebase Admin credentials are not configured; cannot verify ID tokens");
    throw new ApiError(500, "Authentication service is not configured");
  }

  try {
    const decoded = await getAuth(app).verifyIdToken(idToken);
    if (!decoded.phone_number) {
      throw new ApiError(401, "Firebase token has no verified phone number");
    }
    return { uid: decoded.uid, phone: decoded.phone_number };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.warn({ err: error }, "Firebase ID token verification failed");
    throw new ApiError(401, "Invalid or expired Firebase token");
  }
};
