import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Booking } from "@/types/domain";
import { usePendingBookings } from "@/hooks/usePendingBookings";
import { BookingPopupModal } from "@/features/bookings/BookingPopupModal";
import { useAppStore } from "@/store/app-store";

export function NotificationProvider({ children }: { children: ReactNode }) {
  const isOwner = useAppStore((state) => state.user?.role === "OWNER");
  const pendingBookings = usePendingBookings();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string>>(new Set());
  const audio = useMemo(() => {
    if (typeof Audio === "undefined") return null;
    const instance = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=");
    instance.volume = 0.35;
    return instance;
  }, []);
  const pending = (pendingBookings.data ?? []).filter((booking) => booking.bookingStatus === "PENDING" && !dismissed.has(booking.id));
  const activeBooking = pending[0] as Booking | undefined;

  useEffect(() => {
    const currentIds = new Set((pendingBookings.data ?? []).map((booking) => booking.id));
    const hasNewBooking = Array.from(currentIds).some((id) => !knownIds.current.has(id));
    if (hasNewBooking) void audio?.play().catch(() => undefined);
    knownIds.current = currentIds;
  }, [audio, pendingBookings.data]);

  return (
    <>
      {children}
      {isOwner && activeBooking && <BookingPopupModal booking={activeBooking} onClose={() => setDismissed((current) => new Set(current).add(activeBooking.id))} />}
    </>
  );
}
