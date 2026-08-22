export type UserRole = "ADMIN" | "OWNER";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  businessName?: string;
  avatarUrl?: string | null;
  role: UserRole;
  setupCompleted?: boolean;
  currentStep?: string;
}

export interface Stay {
  id: string;
  ownerId?: string;
  name: string;
  type: string;
  description?: string;
  cancellationPolicy?: string;
  houseRules?: string;
  addressLine: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  contactNumber: string;
  website?: string;
  starRating?: number;
  checkInTime: string;
  checkOutTime: string;
  taxesIncluded?: boolean;
  taxPercent?: number;
  cancellationFeePercent?: number;
  facilities?: string[];
  nearByPlaces?: { name: string; type?: string; distance_km?: number; latitude?: number; longitude?: number }[];
  images?: StayImage[];
  status: "ACTIVE" | "INACTIVE";
  rooms?: Room[];
  owner?: { id: string; name: string; email: string; phone?: string };
}

export interface StayImage {
  id?: string;
  imageUrl: string;
  isCover: boolean;
  sortOrder: number;
}

export interface Room {
  id: string;
  name: string;
  roomNumber?: string;
  roomType: string;
  title?: string;
  floor?: string;
  capacityAdults: number;
  capacityChildren: number;
  extraBedPrice?: number | string;
  gstType: "NONE" | "GST_5" | "GST_12" | "GST_18";
  description?: string;
  physicalStatus: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";
  isClean: boolean;
  isBookable: boolean;
  showOnWebsite: boolean;
  basePrice: number | string;
  images?: RoomImage[];
  stayProfile?: Pick<Stay, "id" | "name">;
}

export interface RoomImage {
  id?: string;
  imageUrl: string;
  sortOrder: number;
}

export interface Booking {
  id: string;
  bookingRef: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  checkInDate: string;
  checkOutDate: string;
  noOfGuests: number;
  totalAmount: number | string;
  bookingStatus: "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CANCELLED" | "COMPLETED" | "EXPIRED" | "AUTO_CANCELLED" | "REJECTED";
  paymentStatus?: "UNPAID" | "PARTIAL" | "PAID" | "REFUNDED";
  source?: "DIRECT_SITE" | "PHONE" | "WALK_IN" | "ADMIN_ADDED" | "SAAS_ADAPTER";
  ownerResponseDeadline?: string;
  expiresAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  earlyCheckinType?: "NONE" | "FULL" | "MANUAL";
  earlyCheckinCharge?: number | string;
  lateCheckoutType?: "NONE" | "FULL" | "MANUAL";
  lateCheckoutCharge?: number | string;
  version?: number;
  respondedAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  payments?: Payment[];
  room?: Pick<Room, "id" | "name" | "roomNumber" | "roomType" | "title" | "floor" | "capacityAdults" | "capacityChildren" | "basePrice">;
  stayProfile?: Pick<Stay, "id" | "name" | "city" | "type" | "checkInTime" | "checkOutTime"> & { ownerId?: string };
  ratePlanId?: string;
  ratePlan?: { id: string; name: string };
  charges?: BookingCharge[];
  services?: BookingServiceLine[];
  guests?: BookingGuestMember[];
}

export interface BookingCharge {
  id: string;
  label: string;
  amount: number | string;
  createdAt?: string;
}

export interface BookingServiceLine {
  id: string;
  serviceId?: string;
  title: string;
  price: number | string;
  quantity: number;
}

export interface BookingGuestMember {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface Owner {
  id: string;
  name: string;
  email: string;
  phone?: string;
  businessName?: string;
  status: "ACTIVE" | "INACTIVE";
  mustResetPassword?: boolean;
  setupCompleted?: boolean;
  currentStep?: string;
  createdAt?: string;
  updatedAt?: string;
  _count?: { stayProfiles?: number };
  stayProfiles?: Stay[];
}

export interface Payment {
  id: string;
  amount: number | string;
  paymentMode: "CASH" | "UPI" | "CARD" | "BANK_TRANSFER" | "OTHER";
  transactionRef?: string;
  paidAt: string;
  status: "SUCCESS" | "FAILED" | "PENDING" | "REFUNDED";
}
