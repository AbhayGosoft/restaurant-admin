import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, BedDouble, CalendarCheck, ChevronRight, CircleCheck, Clock3, IndianRupee, Layers3, Sparkles, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import { currency, shortDate } from "@/lib/format";
import type { Booking, Room } from "@/types/domain";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { ListResponse, listItems } from "@/components/resource/dialog-kit";
import type { RoomTypeOption } from "@/features/settings/RoomTypesSettingsPage";

export function PropertyDashboardPage() {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const propertyName = useAppStore((state) => state.activeProperty!.name);
  const bookings = useQuery({ queryKey: ["bookings", propertyId], queryFn: () => api<Booking[]>(`/bookings?propertyId=${propertyId}`) });
  const rooms = useQuery({ queryKey: ["rooms", propertyId], queryFn: () => api<Room[]>(`/rooms?propertyId=${propertyId}`) });
  const roomTypes = useQuery({ queryKey: ["room-types", propertyId], queryFn: () => api<ListResponse<RoomTypeOption>>(`/room-types?propertyId=${propertyId}`) });
  const loading = bookings.isLoading || rooms.isLoading || roomTypes.isLoading;
  const hasError = bookings.isError && rooms.isError && roomTypes.isError;
  const bookingList = bookings.data ?? [];
  const roomList = rooms.data ?? [];
  const roomTypeCount = listItems<RoomTypeOption>(roomTypes.data).length;
  const revenue = bookingList.filter((b) => b.bookingStatus !== "CANCELLED").reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const occupied = roomList.filter((room) => room.physicalStatus === "OCCUPIED").length;

  return (
    <main className="page">
      <section className="welcome-row">
        <span className="eyebrow"><Sparkles size={14} /> {propertyName}</span>
      </section>
      {loading ? <LoadingGrid /> : hasError ? <StateView title="Couldn't reach the backend" message="Start Backend-pms on port 4000, then refresh this workspace." action={() => { void bookings.refetch(); void rooms.refetch(); void roomTypes.refetch(); }} /> : <>
        <section className="metric-grid">
          <Metric icon={IndianRupee} tone="green" label="Total revenue" value={currency.format(revenue)} detail="Confirmed value at this property" />
          <Metric icon={CalendarCheck} tone="violet" label="Active bookings" value={String(bookingList.filter((b) => ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(b.bookingStatus)).length)} detail={`${bookingList.filter((b) => b.bookingStatus === "PENDING").length} awaiting action`} />
          <Metric icon={BedDouble} tone="orange" label="Occupancy" value={roomList.length ? `${Math.round((occupied / roomList.length) * 100)}%` : "0%"} detail={`${occupied} of ${roomList.length} rooms occupied`} />
          <Metric icon={Layers3} tone="blue" label="Room types" value={String(roomTypeCount)} detail={`${roomList.filter((r) => r.physicalStatus === "AVAILABLE").length} rooms ready`} />
        </section>
        <section className="dashboard-grid">
          <div className="panel panel--wide">
            <div className="panel__header"><div><span className="eyebrow">Arrivals & requests</span><h2>Recent bookings</h2></div><Link to="/bookings">View all <ChevronRight size={16} /></Link></div>
            <div className="booking-list">{bookingList.slice(0, 5).map((booking) => <article className="booking-row" key={booking.id}><span className="date-tile"><strong>{shortDate(booking.checkInDate).split(" ")[0]}</strong><small>{shortDate(booking.checkInDate).split(" ")[1]}</small></span><div className="booking-row__main"><strong>{booking.guestName}</strong><small>{booking.room?.name ?? "Room"}</small></div><span className={`status status--${booking.bookingStatus.toLowerCase()}`}>{booking.bookingStatus}</span><strong className="booking-amount">{currency.format(Number(booking.totalAmount))}</strong></article>)}
            {!bookingList.length && <div className="mini-empty"><CalendarCheck /><p>Your newest bookings will appear here.</p></div>}</div>
          </div>
          <div className="panel">
            <div className="panel__header"><div><span className="eyebrow">Today</span><h2>Room pulse</h2></div><span className="live-pill"><i /> Live</span></div>
            <div className="room-pulse">
              <PulseRow icon={CircleCheck} label="Ready" value={roomList.filter((r) => r.physicalStatus === "AVAILABLE" && r.isClean).length} tone="ready" />
              <PulseRow icon={UserRound} label="Occupied" value={occupied} tone="occupied" />
              <PulseRow icon={Clock3} label="Reserved" value={roomList.filter((r) => r.physicalStatus === "RESERVED").length} tone="reserved" />
              <PulseRow icon={BedDouble} label="Attention" value={roomList.filter((r) => !r.isClean || r.physicalStatus === "MAINTENANCE").length} tone="attention" />
            </div>
            <Link to="/rooms" className="panel-action">Manage rooms <ArrowUpRight size={17} /></Link>
          </div>
        </section>
      </>}
    </main>
  );
}

function Metric({ icon: Icon, tone, label, value, detail }: { icon: typeof IndianRupee; tone: string; label: string; value: string; detail: string }) {
  return <article className="metric-card"><span className={`metric-card__icon tone-${tone}`}><Icon /></span><div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div></article>;
}

function PulseRow({ icon: Icon, label, value, tone }: { icon: typeof CircleCheck; label: string; value: number; tone: string }) {
  return <div className="pulse-row"><span className={`pulse-icon pulse-icon--${tone}`}><Icon /></span><span><strong>{label}</strong><small>rooms</small></span><b>{value}</b></div>;
}
