import { api } from "@/lib/api-client";
import type { Booking } from "@/types/domain";

export const fetchPendingBookings = () => api<Booking[]>("/bookings?status=PENDING");

export const confirmBooking = (bookingId: string) =>
  api<Booking>(`/bookings/${bookingId}/status`, { method: "PATCH", body: { status: "CONFIRMED" } });

export const rejectBooking = (bookingId: string) =>
  api<Booking>(`/bookings/${bookingId}/status`, { method: "PATCH", body: { status: "REJECTED" } });
