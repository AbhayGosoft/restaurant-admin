import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Socket } from "socket.io-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import type { Booking } from "@/types/domain";
import { createSocket } from "@/socket/socket-client";
import { socketEvents } from "@/socket/events";

type SocketContextValue = {
  socket: Socket | null;
  connected: boolean;
};

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: ReactNode }) {
  const token = useAppStore((state) => state.token);
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
    const refreshBookings = () => {
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["pending-bookings"] });
    };
    const upsertBooking = (booking: Booking) => {
      queryClient.setQueryData<Booking[]>(["pending-bookings"], (current = []) => {
        const withoutCurrent = current.filter((item) => item.id !== booking.id);
        return booking.bookingStatus === "PENDING" ? [booking, ...withoutCurrent] : withoutCurrent;
      });
      refreshBookings();
    };

    nextSocket.on("connect", () => {
      setConnected(true);
      refreshBookings();
    });
    nextSocket.on("disconnect", () => setConnected(false));
    nextSocket.on("reconnect", refreshBookings);
    nextSocket.on(socketEvents.bookingNew, upsertBooking);
    nextSocket.on(socketEvents.bookingConfirmed, upsertBooking);
    nextSocket.on(socketEvents.bookingCancelled, upsertBooking);
    nextSocket.on(socketEvents.bookingExpired, upsertBooking);
    nextSocket.on(socketEvents.bookingCheckedIn, upsertBooking);
    nextSocket.on(socketEvents.bookingCheckedOut, upsertBooking);
    nextSocket.on(socketEvents.bookingRoomChanged, upsertBooking);
    nextSocket.on(socketEvents.bookingExtended, upsertBooking);
    nextSocket.on(socketEvents.notificationNew, () => void queryClient.invalidateQueries({ queryKey: ["notifications"] }));

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
