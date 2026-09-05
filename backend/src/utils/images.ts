import { z } from "zod";
import { env } from "../config/env.js";

export const imageUrlSchema = z.string().refine(
  (value) => {
    if (value.startsWith("/uploads/images/")) return true;
    return z.string().url().safeParse(value).success;
  },
  { message: "Invalid image URL" },
);

// Stored image values are either already-absolute URLs (pasted by a user) or backend-relative
// upload paths like "/uploads/images/x.jpg". Clients on a different origin (the admin web app,
// the Capacitor Android build) can't resolve the latter, so it must go through this first.
export function resolveAssetUrl(path: string): string;
export function resolveAssetUrl(path: string | null | undefined): string | undefined;
export function resolveAssetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return path;
  return `${env.publicOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}
