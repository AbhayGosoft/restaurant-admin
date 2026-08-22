import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Ban, BedDouble, Building2, CalendarCheck, CheckCircle2, ChevronRight, Clock3, Plus, Users, Wrench, X, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import type { Booking } from "@/types/domain";
import { currency, shortDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { ResourceToolbar } from "@/components/resource/dialog-kit";
import { BookingDetailDialog } from "@/components/resource/booking-detail";
import { NewBookingDialog } from "./NewBookingDialog";
import { invalidateInventory, nextDay, type InventoryRoom, type InventoryRoomStatus, type InventorySummary } from "./types";

type DrawerView = "summary" | "rooms" | "bookings";

const roomStatusFilterOptions = [
  { value: "", label: "All statuses" },
  { value: "AVAILABLE", label: "Available" },
  { value: "BOOKED", label: "Booked" },
  { value: "OCCUPIED", label: "Occupied" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "MAINTENANCE", label: "Maintenance" },
];

const bookingStatusFilterOptions = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REJECTED", label: "Rejected" },
  { value: "EXPIRED", label: "Expired" },
  { value: "AUTO_CANCELLED", label: "Auto-cancelled" },
];

export function InventoryDrawer({ propertyId, date, onClose }: { propertyId: string; date: string; onClose: () => void }) {
  const [view, setView] = useState<DrawerView>("summary");
  const [selectedRoom, setSelectedRoom] = useState<InventoryRoom | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [newBookingRoomId, setNewBookingRoomId] = useState<string | "any" | null>(null);
  const role = useAppStore((state) => state.user?.role);
  const isAdmin = role === "ADMIN";

  const goBack = () => {
    if (selectedRoom) { setSelectedRoom(null); return; }
    if (view !== "summary") { setView("summary"); return; }
    onClose();
  };

  const title = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00`));
  const eyebrow = view === "summary" ? "Inventory" : view === "rooms" ? (selectedRoom ? selectedRoom.name : "Rooms") : "Bookings";

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="drawer-panel" role="dialog" aria-modal="true">
        <header className="drawer-panel__header">
          <button type="button" className="icon-button" aria-label="Back" onClick={goBack}><ArrowLeft /></button>
          <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X /></button>
        </header>
        <div className="drawer-panel__body">
          {view === "summary" && (
            <SummaryView
              propertyId={propertyId}
              date={date}
              isAdmin={isAdmin}
              onViewRooms={() => setView("rooms")}
              onViewBookings={() => setView("bookings")}
              onNewBooking={() => setNewBookingRoomId("any")}
            />
          )}
          {view === "rooms" && !selectedRoom && <RoomsListView propertyId={propertyId} date={date} onSelectRoom={setSelectedRoom} />}
          {view === "rooms" && selectedRoom && (
            <RoomActionView
              propertyId={propertyId}
              date={date}
              room={selectedRoom}
              isAdmin={isAdmin}
              onOpenBooking={setSelectedBooking}
              onNewBooking={() => setNewBookingRoomId(selectedRoom.id)}
              onChanged={() => setSelectedRoom(null)}
            />
          )}
          {view === "bookings" && <BookingsListView propertyId={propertyId} date={date} onSelectBooking={setSelectedBooking} />}
        </div>
      </section>
      {selectedBooking && <BookingDetailDialog booking={selectedBooking} role={role ?? "OWNER"} onClose={() => setSelectedBooking(null)} />}
      {newBookingRoomId && (
        <NewBookingDialog
          propertyId={propertyId}
          date={date}
          roomId={newBookingRoomId === "any" ? undefined : newBookingRoomId}
          onClose={() => setNewBookingRoomId(null)}
        />
      )}
    </div>
  );
}

function SummaryView({ propertyId, date, isAdmin, onViewRooms, onViewBookings, onNewBooking }: { propertyId: string; date: string; isAdmin: boolean; onViewRooms: () => void; onViewBookings: () => void; onNewBooking: () => void }) {
  const query = useQuery({ queryKey: ["inventory-summary", propertyId, date], queryFn: () => api<InventorySummary>(`/inventory/summary?propertyId=${propertyId}&date=${date}`) });
  if (query.isLoading) return <LoadingGrid />;
  if (query.isError || !query.data) return <StateView title="Couldn't load summary" message="Check the backend connection and try once more." action={() => void query.refetch()} />;
  const summary = query.data;

  return (
    <div className="inventory-summary">
      <div className="inventory-stat-grid">
        <InventoryStat icon={Building2} label="Total rooms" value={summary.totalRooms} tone="blue" />
        <InventoryStat icon={CheckCircle2} label="Available" value={summary.availableRooms} tone="green" />
        <InventoryStat icon={BedDouble} label="Booked" value={summary.bookedRooms} tone="violet" />
        <InventoryStat icon={Ban} label="Blocked" value={summary.blockedRooms} tone="orange" />
        <InventoryStat icon={Wrench} label="Maintenance" value={summary.maintenanceRooms} tone="orange" />
      </div>
      <div className="inventory-source-grid">
        <InventorySourceStat label="OTA bookings" value={summary.otaBookings} />
        <InventorySourceStat label="Direct bookings" value={summary.directBookings} />
        <InventorySourceStat label="Walk-in bookings" value={summary.walkInBookings} />
      </div>
      <div className="inventory-actions">
        <Button variant="secondary" onClick={onViewRooms}><BedDouble size={17} /> View rooms</Button>
        <Button variant="secondary" onClick={onViewBookings}><CalendarCheck size={17} /> View bookings</Button>
        {isAdmin && <Button onClick={onNewBooking}><Plus size={17} /> New booking</Button>}
      </div>
    </div>
  );
}

function InventoryStat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number; tone: string }) {
  return <article className="inventory-stat"><span className={`metric-card__icon tone-${tone}`}><Icon size={18} /></span><div><small>{label}</small><strong>{value}</strong></div></article>;
}

function InventorySourceStat({ label, value }: { label: string; value: number }) {
  return <div className="inventory-source-stat"><small>{label}</small><strong>{value}</strong></div>;
}

function roomStatusClass(status: InventoryRoomStatus) {
  if (status === "BOOKED" || status === "OCCUPIED") return "status--occupied";
  return `status--${status.toLowerCase()}`;
}

function roomStatusLabel(status: InventoryRoomStatus) {
  if (status === "BOOKED") return "Booked";
  if (status === "OCCUPIED") return "Occupied";
  if (status === "BLOCKED") return "Blocked";
  if (status === "MAINTENANCE") return "Maintenance";
  return "Available";
}

function RoomsListView({ propertyId, date, onSelectRoom }: { propertyId: string; date: string; onSelectRoom: (room: InventoryRoom) => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const query = useQuery({ queryKey: ["inventory-rooms", propertyId, date], queryFn: () => api<InventoryRoom[]>(`/inventory/rooms?propertyId=${propertyId}&date=${date}`) });
  if (query.isLoading) return <LoadingGrid />;
  if (query.isError) return <StateView title="Couldn't load rooms" message="Check the backend connection and try once more." action={() => void query.refetch()} />;
  const allRooms = query.data ?? [];
  if (!allRooms.length) return <StateView icon={BedDouble} title="No rooms yet" message="Add rooms to this property from Settings first." />;
  const rooms = allRooms.filter((room) =>
    (!statusFilter || room.status === statusFilter) &&
    `${room.name} ${room.roomNumber ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="inventory-room-list">
      <ResourceToolbar search={search} onSearchChange={setSearch} placeholder="Search rooms..." filter={statusFilter} onFilterChange={setStatusFilter} filterOptions={roomStatusFilterOptions} onClear={() => { setSearch(""); setStatusFilter(""); }} />
      {!rooms.length && <StateView icon={BedDouble} title="No rooms match" message="Try a different search term or filter." />}
      {rooms.map((room) => (
        <button type="button" key={room.id} className="inventory-room-row" onClick={() => onSelectRoom(room)}>
          <div className="inventory-room-row__main"><strong>{room.name}</strong><small>{room.roomTypeName ?? "No room type"}{room.roomNumber ? ` - Room ${room.roomNumber}` : ""}</small></div>
          <div className="inventory-room-row__badges">
            <span className={`status ${roomStatusClass(room.status)}`}>{roomStatusLabel(room.status)}</span>
            {!room.isClean && <span className="status status--pending">Housekeeping</span>}
          </div>
          <ChevronRight size={16} />
        </button>
      ))}
    </div>
  );
}

function RoomActionView({ propertyId, date, room, isAdmin, onOpenBooking, onNewBooking, onChanged }: { propertyId: string; date: string; room: InventoryRoom; isAdmin: boolean; onOpenBooking: (booking: Booking) => void; onNewBooking: () => void; onChanged: () => void }) {
  const bookingDetail = useQuery({ queryKey: ["booking", room.booking?.id], queryFn: () => api<Booking>(`/bookings/${room.booking!.id}`), enabled: Boolean(room.booking) });

  // Quick actions from the calendar apply no early-checkin/late-checkout charge — use
  // "Open booking" for the full check-in/check-out flow with charge options.
  const checkInMutation = useMutation({
    mutationFn: () => api<Booking>(`/bookings/${room.booking!.id}/check-in`, { method: "PATCH", body: { type: "NONE" } }),
    onSuccess: async () => { await invalidateInventory(propertyId, date); onChanged(); },
  });
  const checkoutMutation = useMutation({
    mutationFn: () => api<Booking>(`/bookings/${room.booking!.id}/check-out`, { method: "PATCH", body: { type: "NONE" } }),
    onSuccess: async () => { await invalidateInventory(propertyId, date); onChanged(); },
  });

  const unblockMutation = useMutation({
    mutationFn: () => api<void>(`/room-blocks/${room.block!.id}`, { method: "DELETE" }),
    onSuccess: async () => { await invalidateInventory(propertyId, date); onChanged(); },
  });

  const cleanMutation = useMutation({
    mutationFn: (isClean: boolean) => api(`/rooms/${room.id}`, { method: "PATCH", body: { isClean } }),
    onSuccess: async () => { await invalidateInventory(propertyId, date); onChanged(); },
  });

  if (room.status === "BOOKED" && room.booking) {
    const booking = room.booking;
    const liveStatus = bookingDetail.data?.bookingStatus;
    return (
      <div className="inventory-room-detail">
        <div className="inventory-room-detail__hero">
          <span className="status status--occupied">Booked</span>
          <h3>{booking.guestName}</h3>
          <p>{booking.guestPhone} - {(booking.source ?? "DIRECT_SITE").replaceAll("_", " ")}</p>
        </div>
        <div className="booking-highlight-grid">
          <div className="booking-highlight booking-highlight--orange"><span><Clock3 size={18} /></span><small>Check-in</small><strong>{shortDate(booking.checkInDate)}</strong></div>
          <div className="booking-highlight booking-highlight--green"><span><Clock3 size={18} /></span><small>Check-out</small><strong>{shortDate(booking.checkOutDate)}</strong></div>
          <div className="booking-highlight booking-highlight--blue"><span><Users size={18} /></span><small>Guests</small><strong>{booking.noOfGuests}</strong></div>
        </div>
        <div className="inventory-room-actions">
          <Button variant="secondary" loading={bookingDetail.isLoading} onClick={() => bookingDetail.data && onOpenBooking(bookingDetail.data)}>Open booking</Button>
          <ChangeRoomAction propertyId={propertyId} bookingId={booking.id} currentRoomId={room.id} date={date} onChanged={onChanged} />
          {liveStatus === "CONFIRMED" && <Button variant="secondary" loading={checkInMutation.isPending} onClick={() => checkInMutation.mutate()}>Check in</Button>}
          {liveStatus === "CHECKED_IN" && <Button variant="secondary" loading={checkoutMutation.isPending} onClick={() => checkoutMutation.mutate()}>Checkout</Button>}
        </div>
        {(checkInMutation.error || checkoutMutation.error) && <div className="form-error">{(checkInMutation.error ?? checkoutMutation.error)?.message}</div>}
      </div>
    );
  }

  if (room.status === "BOOKED") {
    return (
      <div className="inventory-room-detail">
        <div className="inventory-room-detail__hero">
          <span className="status status--occupied">Booked</span>
          <h3>{room.name}</h3>
          <p>This room is already reserved for the selected date.</p>
        </div>
      </div>
    );
  }

  if (room.status === "BLOCKED" || room.status === "MAINTENANCE" || room.status === "OCCUPIED") {
    return (
      <div className="inventory-room-detail">
        <div className="inventory-room-detail__hero">
          <span className={`status ${roomStatusClass(room.status)}`}>{roomStatusLabel(room.status)}</span>
          <h3>{room.name}</h3>
          {room.status === "OCCUPIED" && <p>This room is marked occupied and cannot be booked.</p>}
          {room.block && <p>{shortDate(room.block.startDate)} - {shortDate(room.block.endDate)}</p>}
        </div>
        {room.block?.notes && <div className="booking-notes"><strong>Notes</strong><p>{room.block.notes}</p></div>}
        {room.block && (
          <div className="inventory-room-actions">
            <Button variant="secondary" loading={unblockMutation.isPending} onClick={() => unblockMutation.mutate()}>Unblock room</Button>
          </div>
        )}
        {unblockMutation.error && <div className="form-error">{unblockMutation.error.message}</div>}
      </div>
    );
  }

  return (
    <div className="inventory-room-detail">
      <div className="inventory-room-detail__hero">
        <span className="status status--available">Available</span>
        <h3>{room.name}</h3>
        <p>{room.roomTypeName ?? "No room type"} - {currency.format(Number(room.basePrice))}/night</p>
      </div>
      <div className="inventory-room-actions">
        {isAdmin && <Button onClick={onNewBooking}><Plus size={17} /> New booking</Button>}
        <BlockRoomAction propertyId={propertyId} roomId={room.id} date={date} reason="BLOCKED" label="Block room" onChanged={onChanged} />
        <BlockRoomAction propertyId={propertyId} roomId={room.id} date={date} reason="MAINTENANCE" label="Mark maintenance" onChanged={onChanged} />
        <Button variant="secondary" loading={cleanMutation.isPending} onClick={() => cleanMutation.mutate(!room.isClean)}>{room.isClean ? "Mark dirty" : "Mark housekeeping done"}</Button>
      </div>
      {cleanMutation.error && <div className="form-error">{cleanMutation.error.message}</div>}
    </div>
  );
}

function ChangeRoomAction({ propertyId, bookingId, currentRoomId, date, onChanged }: { propertyId: string; bookingId: string; currentRoomId: string; date: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [targetRoomId, setTargetRoomId] = useState("");
  const rooms = useQuery({ queryKey: ["inventory-rooms", propertyId, date], queryFn: () => api<InventoryRoom[]>(`/inventory/rooms?propertyId=${propertyId}&date=${date}`), enabled: open });
  const options = (rooms.data ?? []).filter((room) => room.id !== currentRoomId && room.status === "AVAILABLE");
  const mutation = useMutation({
    mutationFn: () => api<Booking>(`/bookings/${bookingId}/room`, { method: "PATCH", body: { roomId: targetRoomId } }),
    onSuccess: async () => { await invalidateInventory(propertyId, date); setOpen(false); onChanged(); },
  });

  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>Change room</Button>;
  return (
    <div className="inventory-inline-form">
      <label>Move to
        <select value={targetRoomId} onChange={(event) => setTargetRoomId(event.target.value)}>
          <option value="">Select a free room</option>
          {options.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
        </select>
      </label>
      <div className="inventory-inline-form__actions">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="button" disabled={!targetRoomId} loading={mutation.isPending} onClick={() => mutation.mutate()}>Confirm move</Button>
      </div>
      {mutation.error && <div className="form-error">{mutation.error.message}</div>}
    </div>
  );
}

function BlockRoomAction({ propertyId, roomId, date, reason, label, onChanged }: { propertyId: string; roomId: string; date: string; reason: "BLOCKED" | "MAINTENANCE"; label: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [endDate, setEndDate] = useState(date);
  const [notes, setNotes] = useState("");
  const mutation = useMutation({
    mutationFn: () => api("/room-blocks", { method: "POST", body: { roomId, startDate: date, endDate: nextDay(endDate), reason, notes: notes || undefined } }),
    onSuccess: async () => { await invalidateInventory(propertyId, date); setOpen(false); onChanged(); },
  });

  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>{label}</Button>;
  return (
    <div className="inventory-inline-form">
      <label>Until (inclusive)<DateInput min={date} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
      <label>Notes<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <div className="inventory-inline-form__actions">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="button" loading={mutation.isPending} onClick={() => mutation.mutate()}>Confirm</Button>
      </div>
      {mutation.error && <div className="form-error">{mutation.error.message}</div>}
    </div>
  );
}

function BookingsListView({ propertyId, date, onSelectBooking }: { propertyId: string; date: string; onSelectBooking: (booking: Booking) => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const query = useQuery({ queryKey: ["inventory-bookings", propertyId, date], queryFn: () => api<Booking[]>(`/bookings?propertyId=${propertyId}&date=${date}`) });
  if (query.isLoading) return <LoadingGrid />;
  if (query.isError) return <StateView title="Couldn't load bookings" message="Check the backend connection and try once more." action={() => void query.refetch()} />;
  const allBookings = query.data ?? [];
  if (!allBookings.length) return <StateView icon={CalendarCheck} title="No bookings for this date" message="New bookings for this date will appear here." />;
  const bookings = allBookings.filter((booking) =>
    (!statusFilter || booking.bookingStatus === statusFilter) &&
    `${booking.guestName} ${booking.guestPhone} ${booking.bookingRef}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="inventory-room-list">
      <ResourceToolbar search={search} onSearchChange={setSearch} placeholder="Search bookings..." filter={statusFilter} onFilterChange={setStatusFilter} filterOptions={bookingStatusFilterOptions} onClear={() => { setSearch(""); setStatusFilter(""); }} />
      {!bookings.length && <StateView icon={CalendarCheck} title="No bookings match" message="Try a different search term or filter." />}
      {bookings.map((booking) => (
        <button type="button" key={booking.id} className="inventory-room-row" onClick={() => onSelectBooking(booking)}>
          <div className="inventory-room-row__main"><strong>{booking.guestName}</strong><small>{booking.room?.name ?? "Room"} - {booking.bookingRef}</small></div>
          <span className={`status status--${booking.bookingStatus.toLowerCase()}`}>{booking.bookingStatus}</span>
          <ChevronRight size={16} />
        </button>
      ))}
    </div>
  );
}
