import { useQuery } from "@tanstack/react-query";
import { fetchPendingBookings } from "@/services/booking-api";
import { useAppStore } from "@/store/app-store";

export const usePendingBookings = () => {
  const token = useAppStore((state) => state.token);
  const role = useAppStore((state) => state.user?.role);
  return useQuery({
    queryKey: ["pending-bookings"],
    queryFn: fetchPendingBookings,
    // Owner-facing "confirm within 5 minutes" workflow. Without a propertyId this call is
    // unscoped for ADMIN on the backend (see bookings.routes.ts), so it must not run for
    // admins here or they'd get every owner's pending-booking popups/sounds.
    enabled: Boolean(token) && role === "OWNER",
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });
};
