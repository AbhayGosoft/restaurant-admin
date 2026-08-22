import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BedDouble, CalendarDays, Pencil, Plus, Users, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import type { Booking, Room } from "@/types/domain";
import { currency, shortDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { FieldError, ResourceDialog, ResourceToolbar, DialogFooter, ListResponse, Req, cleanBody, listItems } from "@/components/resource/dialog-kit";
import { BookingDetailDialog } from "@/components/resource/booking-detail";

type ResourceType = "bookings" | "rooms" | "guests";
type RoomTypeOption = { id: string; propertyId: string; categoryId?: string; name: string; pricePerNight?: number | string; gstType?: "NONE" | "GST_5" | "GST_12" | "GST_18"; maxAdults?: number; maxChildren?: number };

const meta: Record<ResourceType, { icon: LucideIcon; title: string; subtitle: string; endpoint: string }> = {
  bookings: { icon: CalendarDays, title: "Bookings", subtitle: "Manage every reservation from request to checkout.", endpoint: "/bookings" },
  rooms: { icon: BedDouble, title: "Rooms", subtitle: "A live view of inventory, readiness and pricing.", endpoint: "/rooms" },
  guests: { icon: Users, title: "Guests", subtitle: "Guest profiles are composed from your booking history.", endpoint: "/bookings" },
};

const filterFieldByType: Partial<Record<ResourceType, string>> = { bookings: "bookingStatus", rooms: "physicalStatus" };
const filterOptionsByType: Partial<Record<ResourceType, { value: string; label: string }[]>> = {
  bookings: [
    { value: "", label: "All statuses" },
    { value: "PENDING", label: "Pending" },
    { value: "CONFIRMED", label: "Confirmed" },
    { value: "CHECKED_IN", label: "Checked in" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "REJECTED", label: "Rejected" },
    { value: "EXPIRED", label: "Expired" },
    { value: "AUTO_CANCELLED", label: "Auto-cancelled" },
  ],
  rooms: [
    { value: "", label: "All statuses" },
    { value: "AVAILABLE", label: "Available" },
    { value: "OCCUPIED", label: "Occupied" },
    { value: "RESERVED", label: "Reserved" },
    { value: "MAINTENANCE", label: "Maintenance" },
  ],
};

const roomTypeFilterOptions = [
  { value: "", label: "All room types" },
  { value: "SINGLE", label: "Single" },
  { value: "DOUBLE", label: "Double" },
  { value: "DORM", label: "Dorm" },
  { value: "SUITE", label: "Suite" },
  { value: "FAMILY", label: "Family" },
  { value: "HALL", label: "Hall" },
  { value: "OTHER", label: "Other" },
];

export function ResourcePage({ type }: { type: ResourceType }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [roomTypeFilter, setRoomTypeFilter] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [dialog, setDialog] = useState<ResourceType | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const isOwner = useAppStore((state) => state.user?.role === "OWNER");
  const isAdmin = useAppStore((state) => state.user?.role === "ADMIN");
  const role = useAppStore((state) => state.user?.role);
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const current = meta[type];
  const filterField = filterFieldByType[type];
  const query = useQuery({ queryKey: [type, propertyId], queryFn: () => api<unknown>(`${current.endpoint}?propertyId=${propertyId}`) });
  const items = useMemo(() => {
    const raw = listItems<unknown>(query.data);
    const unique = type === "guests" ? Array.from(new Map((raw as Booking[]).map((b) => [b.guestPhone, b])).values()) : raw;
    return unique.filter((item) => {
      const matchesSearch = JSON.stringify(item).toLowerCase().includes(search.toLowerCase());
      const matchesFilter = !statusFilter || !filterField || (item as Record<string, unknown>)[filterField] === statusFilter;
      if (!matchesSearch || !matchesFilter) return false;
      if (type === "bookings") {
        const checkIn = new Date((item as Booking).checkInDate).toISOString().slice(0, 10);
        if (dateFrom && checkIn < dateFrom) return false;
        if (dateTo && checkIn > dateTo) return false;
      }
      if (type === "rooms") {
        const room = item as Room;
        if (roomTypeFilter && room.roomType !== roomTypeFilter) return false;
        const price = Number(room.basePrice);
        if (priceMin && price < Number(priceMin)) return false;
        if (priceMax && price > Number(priceMax)) return false;
      }
      return true;
    });
  }, [query.data, search, statusFilter, filterField, type, dateFrom, dateTo, roomTypeFilter, priceMin, priceMax]);
  const Icon = current.icon;
  const addable = type === "rooms" && isAdmin;

  return (
    <main className="page resource-page">
      <section className="resource-head">
        <span className="eyebrow"><Icon size={14} /> {current.title}</span>
        {addable && <Button onClick={() => setDialog(type)}><Plus size={18} /> Add room</Button>}
      </section>
      <ResourceToolbar search={search} onSearchChange={setSearch} placeholder={`Search ${type} by name...`} filter={statusFilter} onFilterChange={setStatusFilter} filterOptions={filterOptionsByType[type]} onClear={() => { setSearch(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); setRoomTypeFilter(""); setPriceMin(""); setPriceMax(""); }}>
        {type === "bookings" && (
          <div className="date-range-filter">
            <DateInput aria-label="Check-in from" className="filter-select" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <span>to</span>
            <DateInput aria-label="Check-in to" className="filter-select" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          </div>
        )}
        {type === "rooms" && (
          <>
            <select className="filter-select" aria-label="Room type" value={roomTypeFilter} onChange={(event) => setRoomTypeFilter(event.target.value)}>
              {roomTypeFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <div className="price-range-filter">
              <input type="number" min={0} inputMode="numeric" aria-label="Minimum price" placeholder="Min ₹" value={priceMin} onChange={(event) => setPriceMin(event.target.value)} />
              <span>-</span>
              <input type="number" min={0} inputMode="numeric" aria-label="Maximum price" placeholder="Max ₹" value={priceMax} onChange={(event) => setPriceMax(event.target.value)} />
            </div>
          </>
        )}
      </ResourceToolbar>
      {query.isLoading ? <LoadingGrid /> : query.isError ? (
        <StateView title={`Couldn't load ${type}`} message="Check the backend connection and try once more." action={() => void query.refetch()} />
      ) : !items.length ? (
        <StateView icon={Icon} title={`No ${type} yet`} message="Everything you add will be organized here automatically." />
      ) : (
        <section className="resource-grid">
          {items.map((item, index) => <ResourceCard key={(item as { id?: string }).id ?? index} type={type} item={item} canEdit={isOwner || isAdmin} onViewBooking={setSelectedBooking} onEditRoom={setEditingRoom} />)}
        </section>
      )}
      {selectedBooking && <BookingDetailDialog booking={selectedBooking} role={role ?? "OWNER"} onClose={() => setSelectedBooking(null)} />}
      {dialog === "rooms" && <RoomDialog mode="create" onClose={() => setDialog(null)} />}
      {editingRoom && <RoomDialog mode="edit" room={editingRoom} onClose={() => setEditingRoom(null)} />}
    </main>
  );
}

function ResourceCard({ type, item, canEdit = false, onViewBooking, onEditRoom }: { type: ResourceType; item: unknown; canEdit?: boolean; onViewBooking?: (booking: Booking) => void; onEditRoom?: (room: Room) => void }) {
  if (type === "bookings") {
    const booking = item as Booking;
    return (
      <article className="resource-card booking-card" role="button" tabIndex={0} onClick={() => onViewBooking?.(booking)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onViewBooking?.(booking); }}>
        <span className="date-tile"><strong>{shortDate(booking.checkInDate).split(" ")[0]}</strong><small>{shortDate(booking.checkInDate).split(" ")[1]}</small></span>
        <div className="resource-card__body">
          <div className="resource-card__line1"><h3>{booking.guestName}</h3><span className={`status status--${booking.bookingStatus.toLowerCase()}`}>{booking.bookingStatus}</span></div>
          <div className="resource-card__line2"><span>{booking.room?.name ?? "Room"}</span><span className="dot">•</span><span>{booking.bookingRef}</span></div>
        </div>
        <strong className="resource-card__value">{currency.format(Number(booking.totalAmount))}</strong>
      </article>
    );
  }
  if (type === "rooms") {
    const room = item as Room;
    return (
      <article className="resource-card room-card">
        <span className="resource-thumb"><BedDouble /></span>
        <div className="resource-card__body">
          <div className="resource-card__line1"><h3>{room.name}</h3><span className={`status status--${room.physicalStatus.toLowerCase()}`}>{room.physicalStatus}</span></div>
          <div className="resource-card__line2"><span>{room.roomType} - {room.roomNumber ? `Room ${room.roomNumber}` : "Unnumbered"}</span><span className="dot">•</span><span>{room.isClean ? "Clean" : "Needs attention"}</span></div>
        </div>
        <strong className="resource-card__value">{currency.format(Number(room.basePrice))}<small>/night</small></strong>
        {canEdit && <button type="button" className="property-edit-button" aria-label={`Edit ${room.name}`} onClick={() => onEditRoom?.(room)}><Pencil size={16} /></button>}
      </article>
    );
  }
  const value = item as Record<string, string>;
  return (
    <article className="resource-card">
      <span className="card-icon"><Users /></span>
      <div className="resource-card__body">
        <h3>{value.guestName || "Guest"}</h3>
        <div className="resource-card__line2"><span>{value.guestPhone || "No phone on file"}</span></div>
      </div>
    </article>
  );
}

type RoomForm = {
  roomTypeId: string;
  name: string;
  roomType: "SINGLE" | "DOUBLE" | "DORM" | "SUITE" | "FAMILY" | "HALL" | "OTHER";
  roomNumber: string;
  title: string;
  floor: string;
  physicalStatus: "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";
  capacityAdults: number;
  capacityChildren: number;
  basePrice?: number;
  extraBedPrice?: number;
  gstType: "NONE" | "GST_5" | "GST_12" | "GST_18";
  description: string;
  isClean: boolean;
  isBookable: boolean;
  showOnWebsite: boolean;
};

function RoomDialog({ mode, room, onClose }: { mode: "create" | "edit"; room?: Room; onClose: () => void }) {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const roomTypes = useQuery({ queryKey: ["room-types", propertyId], queryFn: () => api<ListResponse<RoomTypeOption>>(`/room-types?propertyId=${propertyId}`) });
  const roomTypeIdDefault = room ? (room as Room & { roomTypeId?: string; enterpriseRoomType?: { id: string } }).roomTypeId ?? (room as Room & { enterpriseRoomType?: { id: string } }).enterpriseRoomType?.id ?? "" : "";
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RoomForm>({
    defaultValues: {
      roomTypeId: roomTypeIdDefault,
      name: room?.name ?? "",
      roomType: (room?.roomType as RoomForm["roomType"]) ?? "OTHER",
      roomNumber: room?.roomNumber ?? "",
      title: room?.title ?? "",
      floor: room?.floor ?? "",
      physicalStatus: room?.physicalStatus ?? "AVAILABLE",
      capacityAdults: room?.capacityAdults ?? 1,
      capacityChildren: room?.capacityChildren ?? 0,
      basePrice: room ? Number(room.basePrice) : undefined,
      extraBedPrice: room?.extraBedPrice === undefined ? undefined : Number(room.extraBedPrice),
      gstType: room?.gstType ?? "NONE",
      description: room?.description ?? "",
      isClean: room?.isClean ?? true,
      isBookable: room?.isBookable ?? true,
      showOnWebsite: room?.showOnWebsite ?? true,
    },
  });
  const availableRoomTypes = listItems<RoomTypeOption>(roomTypes.data);
  const roomTypeId = watch("roomTypeId");
  const selectedRoomType = availableRoomTypes.find((item) => item.id === roomTypeId);
  const selectRoomType = (nextRoomTypeId: string) => {
    const selected = availableRoomTypes.find((item) => item.id === nextRoomTypeId);
    setValue("roomTypeId", nextRoomTypeId);
    if (selected?.pricePerNight !== undefined) setValue("basePrice", Number(selected.pricePerNight));
    if (selected?.gstType) setValue("gstType", selected.gstType);
    if (selected?.maxAdults !== undefined) setValue("capacityAdults", selected.maxAdults);
    if (selected?.maxChildren !== undefined) setValue("capacityChildren", selected.maxChildren);
  };
  const mutation = useMutation({
    mutationFn: (data: RoomForm) => api<Room>(mode === "create" ? "/rooms" : `/rooms/${room!.id}`, {
      method: mode === "create" ? "POST" : "PATCH",
      body: cleanBody({ ...data, stayProfileId: propertyId }, mode === "edit" ? ["stayProfileId"] : []),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      onClose();
    },
  });

  return (
    <ResourceDialog title={`${mode === "create" ? "Add" : "Edit"} room`} eyebrow="Room details" onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div className="property-form-grid">
          <label className="property-form-grid__wide">Room type<select value={roomTypeId} onChange={(event) => selectRoomType(event.target.value)}><option value="">No linked room type</option>{availableRoomTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label><span className="label-title">Room name<Req /></span>
            <input {...register("name", { required: "Room name is required" })} />
            <FieldError error={errors.name} />
          </label>
          <label>Bed type<select {...register("roomType")}><option value="SINGLE">Single</option><option value="DOUBLE">Double</option><option value="DORM">Dorm</option><option value="SUITE">Suite</option><option value="FAMILY">Family</option><option value="HALL">Hall</option><option value="OTHER">Other</option></select></label>
          <label>Room number<input {...register("roomNumber")} /></label>
          <label>Display title<input {...register("title")} /></label>
          <label>Floor<input {...register("floor")} /></label>
          <label>Status<select {...register("physicalStatus")}><option value="AVAILABLE">Available</option><option value="OCCUPIED">Occupied</option><option value="RESERVED">Reserved</option><option value="MAINTENANCE">Maintenance</option></select></label>
          <label><span className="label-title">Adult capacity<Req /></span>
            <input type="number" {...register("capacityAdults", { required: "Adult capacity is required", valueAsNumber: true, min: { value: 1, message: "Must be at least 1" } })} />
            <FieldError error={errors.capacityAdults} />
          </label>
          <label><span className="label-title">Children capacity<Req /></span>
            <input type="number" {...register("capacityChildren", { required: "Children capacity is required", valueAsNumber: true, min: { value: 0, message: "Must be 0 or more" } })} />
            <FieldError error={errors.capacityChildren} />
          </label>
          <label><span className="label-title">Base price{!selectedRoomType && <Req />}</span>
            <input step="0.01" type="number" {...register("basePrice", {
              valueAsNumber: true,
              validate: (value) => Boolean(selectedRoomType) || (value !== undefined && !Number.isNaN(value) && value > 0) || "Base price is required when no room type is linked",
            })} />
            <FieldError error={errors.basePrice} />
          </label>
          <label>Extra bed price
            <input step="0.01" type="number" {...register("extraBedPrice", { valueAsNumber: true, min: { value: 0, message: "Must be 0 or more" } })} />
            <FieldError error={errors.extraBedPrice} />
          </label>
          <label>GST<select {...register("gstType")}><option value="NONE">None</option><option value="GST_5">GST 5%</option><option value="GST_12">GST 12%</option><option value="GST_18">GST 18%</option></select></label>
          <label className="property-form-grid__wide">Description<textarea rows={3} {...register("description")} /></label>
          <div className="property-form-grid__wide room-options">
            <label className="check-option"><input type="checkbox" {...register("isClean")} /><span>Room is clean</span></label>
            <label className="check-option"><input type="checkbox" {...register("isBookable")} /><span>Accept bookings</span></label>
            <label className="check-option"><input type="checkbox" {...register("showOnWebsite")} /><span>Show on website</span></label>
          </div>
        </div>
        {mutation.error && <div className="form-error">{mutation.error.message}</div>}
        <DialogFooter onClose={onClose} loading={mutation.isPending} label={mode === "create" ? "Create room" : "Save changes"} />
      </form>
    </ResourceDialog>
  );
}
