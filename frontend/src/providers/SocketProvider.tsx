import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Socket } from "socket.io-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import { createSocket } from "@/socket/socket-client";
import { socketEvents } from "@/socket/events";

type SocketContextValue = {
  socket: Socket | null;
  connected: boolean;
};

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: ReactNode }) {
  const token = useAppStore((state) => state.adminToken);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const nextSocket = createSocket(token);
    setSocket(nextSocket);
    const refreshBookings = () => void queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });

    nextSocket.on("connect", () => {
      setConnected(true);
      refreshBookings();
    });
    nextSocket.on("disconnect", () => setConnected(false));
    nextSocket.on("reconnect", refreshBookings);
    nextSocket.on(socketEvents.bookingNew, refreshBookings);
    nextSocket.on(socketEvents.bookingModified, refreshBookings);
    nextSocket.on(socketEvents.bookingCancelled, refreshBookings);

    return () => {
      nextSocket.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [token]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
