import { useAppStore } from "@/store/app-store";
import type { ApiEnvelope } from "@/types/domain";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "/api"
).replace(/\/$/, "");

const CLIENT_KEY = import.meta.env.VITE_CLIENT_KEY as string | undefined;

const ASSET_ORIGIN = (
  (import.meta.env.VITE_API_PROXY_TARGET as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/api\/?$/, "") ||
  ""
).replace(/\/$/, "");

// Uploaded files (banners, gallery, menu item images) come back from the API as paths
// relative to the backend (e.g. "/uploads/images/x.jpg"). Rendered directly in an <img>,
// the browser resolves that against the *frontend's* origin instead of the backend's,
// so it must be rewritten to the backend origin here. Already-absolute URLs (external
// image links, blob:/data: previews) are left untouched.
export function resolveAssetUrl(path?: string | null): string {
  if (!path) return "";
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(path) || path.startsWith("blob:") || path.startsWith("data:")) return path;
  return `${ASSET_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = useAppStore.getState().adminToken;
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(CLIENT_KEY ? { "x-client-key": CLIENT_KEY } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok || payload?.status === false) {
    if (response.status === 401) useAppStore.getState().clearSession();
    throw new ApiError(response.status, payload?.message || "Something went wrong");
  }

  return (payload?.data ?? (payload as unknown as T));
}

export async function uploadImages(files: FileList | File[]): Promise<{ urls: string[] }> {
  const token = useAppStore.getState().adminToken;
  const formData = new FormData();
  Array.from(files).forEach((file) => formData.append("images", file));

  const response = await fetch(`${API_URL}/uploads/images`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(CLIENT_KEY ? { "x-client-key": CLIENT_KEY } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) useAppStore.getState().clearSession();
    throw new ApiError(response.status, payload?.message || "Image upload failed");
  }
  return payload as { urls: string[] };
}
