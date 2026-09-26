export type AdminRole = "ADMIN" | "SUPERADMIN";
export type RecordStatus = "ACTIVE" | "INACTIVE";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: RecordStatus;
  createdAt?: string;
  restaurants?: { restaurant: { id: string; name: string } }[];
}

export interface RestaurantCategory {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface RestaurantAddress {
  line: string;
  city: string;
  state?: string | null;
  country: string;
  pincode?: string | null;
}

export interface Restaurant {
  id: string;
  name: string;
  banner?: string | null;
  gallery: string[];
  categories: string[];
  cuisineLabel: string;
  isPureVeg: boolean;
  rating: number;
  ratingCount: number;
  prepTimeMin: number;
  prepTimeMax: number;
  priceForTwo: number;
  offerText?: string | null;
  offerSubText?: string | null;
  about?: string | null;
  // Public detail/list responses nest address; admin responses use flat fields — support both.
  address?: RestaurantAddress;
  addressLine?: string;
  city?: string;
  state?: string | null;
  country?: string;
  pincode?: string | null;
  phone: string;
  latitude: number;
  longitude: number;
  seatingCapacity?: number;
  maxPartySize: number;
  status: RecordStatus;
  createdAt?: string;
  distanceKm?: number | null;
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image?: string | null;
  isVeg: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  items: MenuItem[];
}

export type SlotMeal = "LUNCH" | "DINNER";

export interface SlotConfiguration {
  id: string;
  meal: SlotMeal;
  time: string; // "12:00 PM"
  sortOrder: number;
  isActive: boolean;
}

export type DiningTableStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";
export interface DiningTable {
  id: string;
  name: string;
  capacity: number;
  preference: "ANY" | "WINDOW" | "INDOOR" | "OUTDOOR";
  section?: string | null;
  status: DiningTableStatus;
}

export type BookingClientStatus = "upcoming" | "past" | "cancelled";
export type TablePreference = "Any Table" | "Window Seat" | "Indoor Seat" | "Outdoor Seat";

export interface RestaurantBooking {
  id: string;
  humanBookingId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantImage?: string | null;
  rating: number;
  cuisineLabel: string;
  distanceKm?: number | null;
  date: string;
  time: string;
  people: number;
  tablePreference: TablePreference;
  specialRequest?: string;
  fullName: string;
  mobileNumber: string;
  email?: string;
  status: BookingClientStatus;
  cancellationReason?: string | null;
  advancePaid: number;
  table?: Pick<DiningTable, "id" | "name" | "capacity" | "preference" | "section"> | null;
  preorder?: { id: string; subtotal: number; total: number; items: { id: string; menuItemId: string; name: string; unitPrice: number; quantity: number; note?: string | null; lineTotal: number }[] } | null;
  refund?: { eligible: boolean; amount: number };
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

/** Standard backend envelope: { status, message, data }. */
export interface ApiEnvelope<T> {
  status: boolean;
  message: string;
  data: T;
}

/** Response of every DELETE .../permanent endpoint. */
export interface HardDeleteResult {
  deleted: boolean;
  deactivated: boolean;
}
