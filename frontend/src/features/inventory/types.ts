import { queryClient } from "@/lib/query-client";

export type CalendarDayStatus = "AVAILABLE" | "LOW" | "FULL";

export type CalendarDay = {
  date: string;
  totalRooms: number;
  availableRooms: number;
  bookedRooms: number;
  blockedRooms: number;
  maintenanceRooms: number;
  status: CalendarDayStatus;
};

export type InventorySummary = {
  date: string;
  totalRooms: number;
  availableRooms: number;
  bookedRooms: number;
  blockedRooms: number;
  maintenanceRooms: number;
  otaBookings: number;
  directBookings: number;
  walkInBookings: number;
};

export type InventoryRoomStatus = "AVAILABLE" | "BOOKED" | "BLOCKED" | "MAINTENANCE" | "OCCUPIED";

export type InventoryRoom = {
  id: string;
  name: string;
  roomNumber?: string | null;
  floor?: string | null;
  physicalStatus?: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";
  roomTypeName?: string | null;
  basePrice: number | string;
  isClean: boolean;
  isBookable: boolean;
  status: InventoryRoomStatus;
  booking: {
    id: string;
    bookingRef: string;
    guestName: string;
    guestPhone: string;
    source: string;
    checkInDate: string;
    checkOutDate: string;
    noOfGuests: number;
  } | null;
  block: {
    id: string;
    reason: "BLOCKED" | "MAINTENANCE";
    notes?: string | null;
    startDate: string;
    endDate: string;
  } | null;
};

export function nextDay(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function invalidateInventory(propertyId: string, date: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["inventory-calendar", propertyId] }),
    queryClient.invalidateQueries({ queryKey: ["inventory-summary", propertyId, date] }),
    queryClient.invalidateQueries({ queryKey: ["inventory-rooms", propertyId, date] }),
    queryClient.invalidateQueries({ queryKey: ["inventory-bookings", propertyId, date] }),
    queryClient.invalidateQueries({ queryKey: ["bookings"] }),
    queryClient.invalidateQueries({ queryKey: ["rooms"] }),
  ]);
}
