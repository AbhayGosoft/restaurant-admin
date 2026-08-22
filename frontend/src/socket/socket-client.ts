import { io, type Socket } from "socket.io-client";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/api\/?$/, "").replace(/\/$/, "");
export const createSocket = (token: string): Socket =>
  io(API_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });
