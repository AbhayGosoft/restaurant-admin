import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange, IndianRupee, Percent, Repeat, TicketPercent } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import { currency } from "@/lib/format";
import type { Booking } from "@/types/domain";
import { LoadingGrid, StateView } from "@/components/ui/StateView";

const STATUS_LABELS: Record<Booking["bookingStatus"], string> = {
  PENDING: "Pending", CONFIRMED: "Confirmed", CHECKED_IN: "Checked in", CANCELLED: "Cancelled", COMPLETED: "Completed",
  EXPIRED: "Expired", AUTO_CANCELLED: "Auto-cancelled", REJECTED: "Rejected",
};
const SOURCE_LABELS: Record<string, string> = {
  DIRECT_SITE: "Direct site", PHONE: "Phone", WALK_IN: "Walk-in", ADMIN_ADDED: "Admin added", SAAS_ADAPTER: "Channel manager",
};

export function ReportsPage() {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const query = useQuery({ queryKey: ["bookings", propertyId, "reports"], queryFn: () => api<Booking[]>(`/bookings?propertyId=${propertyId}`) });
  const bookings = useMemo(() => query.data ?? [], [query.data]);

  const revenueBookings = useMemo(() => bookings.filter((b) => b.bookingStatus !== "CANCELLED" && b.bookingStatus !== "REJECTED"), [bookings]);
  const totalRevenue = useMemo(() => revenueBookings.reduce((sum, b) => sum + Number(b.totalAmount || 0), 0), [revenueBookings]);
  const avgBookingValue = revenueBookings.length ? totalRevenue / revenueBookings.length : 0;
  const cancelledCount = bookings.filter((b) => b.bookingStatus === "CANCELLED" || b.bookingStatus === "REJECTED" || b.bookingStatus === "AUTO_CANCELLED").length;
  const cancellationRate = bookings.length ? (cancelledCount / bookings.length) * 100 : 0;

  const revenueByMonth = useMemo(() => {
    const buckets = new Map<string, number>();
    revenueBookings.forEach((booking) => {
      const date = new Date(booking.checkInDate);
      const key = new Intl.DateTimeFormat("en-IN", { month: "short", year: "2-digit" }).format(date);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(booking.totalAmount || 0));
    });
    return Array.from(buckets.entries()).slice(-6);
  }, [revenueBookings]);
  const maxMonthRevenue = Math.max(1, ...revenueByMonth.map(([, value]) => value));

  const statusBreakdown = useMemo(() => {
    const counts = new Map<Booking["bookingStatus"], number>();
    bookings.forEach((b) => counts.set(b.bookingStatus, (counts.get(b.bookingStatus) ?? 0) + 1));
    return Array.from(counts.entries()).sort(([, a], [, b]) => b - a);
  }, [bookings]);

  const sourceBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    bookings.forEach((b) => { const source = b.source ?? "DIRECT_SITE"; counts.set(source, (counts.get(source) ?? 0) + 1); });
    return Array.from(counts.entries()).sort(([, a], [, b]) => b - a);
  }, [bookings]);
  const maxSourceCount = Math.max(1, ...sourceBreakdown.map(([, value]) => value));

  if (query.isLoading) return <main className="page"><LoadingGrid /></main>;
  if (query.isError) return <main className="page"><StateView title="Couldn't load reports" message="Check the backend connection and try once more." action={() => void query.refetch()} /></main>;

  return (
    <main className="page reports-page">
      <section className="resource-head">
        <span className="eyebrow"><CalendarRange size={14} /> Reports</span>
      </section>

      <section className="metric-grid">
        <Metric icon={IndianRupee} tone="green" label="Total revenue" value={currency.format(totalRevenue)} detail={`${revenueBookings.length} revenue-generating bookings`} />
        <Metric icon={Repeat} tone="blue" label="Total bookings" value={String(bookings.length)} detail="All-time, this property" />
        <Metric icon={TicketPercent} tone="violet" label="Avg. booking value" value={currency.format(avgBookingValue)} detail="Per confirmed booking" />
        <Metric icon={Percent} tone="orange" label="Cancellation rate" value={`${cancellationRate.toFixed(1)}%`} detail={`${cancelledCount} of ${bookings.length} bookings`} />
      </section>

      <section className="dashboard-grid">
        <div className="panel panel--wide">
          <div className="panel__header"><div><span className="eyebrow">Trend</span><h2>Revenue by month</h2></div></div>
          {!revenueByMonth.length ? <div className="mini-empty"><IndianRupee /><p>No revenue booked yet.</p></div> : (
            <div className="report-bar-chart">
              {revenueByMonth.map(([month, value]) => (
                <div className="report-bar-chart__col" key={month} title={currency.format(value)}>
                  <span className="report-bar-chart__value">{currency.format(value)}</span>
                  <span className="report-bar-chart__bar" style={{ height: `${Math.max(6, (value / maxMonthRevenue) * 100)}%` }} />
                  <small>{month}</small>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="panel">
          <div className="panel__header"><div><span className="eyebrow">Breakdown</span><h2>Booking status</h2></div></div>
          {!statusBreakdown.length ? <div className="mini-empty"><Repeat /><p>No bookings yet.</p></div> : (
            <div className="report-status-list">
              {statusBreakdown.map(([status, count]) => (
                <div className="report-status-row" key={status}>
                  <span className={`status status--${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>
                  <div className="report-status-row__track"><span className={`report-status-row__fill status--${status.toLowerCase()}`} style={{ width: `${(count / bookings.length) * 100}%` }} /></div>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header"><div><span className="eyebrow">Breakdown</span><h2>Booking sources</h2></div></div>
        {!sourceBreakdown.length ? <div className="mini-empty"><CalendarRange /><p>No bookings yet.</p></div> : (
          <div className="report-status-list">
            {sourceBreakdown.map(([source, count]) => (
              <div className="report-status-row" key={source}>
                <span className="report-status-row__label">{SOURCE_LABELS[source] ?? source}</span>
                <div className="report-status-row__track"><span className="report-status-row__fill report-status-row__fill--brand" style={{ width: `${(count / maxSourceCount) * 100}%` }} /></div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({ icon: Icon, tone, label, value, detail }: { icon: typeof IndianRupee; tone: string; label: string; value: string; detail: string }) {
  return <article className="metric-card"><span className={`metric-card__icon tone-${tone}`}><Icon /></span><div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div></article>;
}
