import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, Phone, Users, X } from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import type { Pagination, RestaurantBooking } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { ResourceDialog, ResourceToolbar } from "@/components/resource/dialog-kit";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
];

const CANCEL_REASONS = ["Change of plans", "Booked by mistake", "Found a better option", "Restaurant not responding", "Other"];

export function BookingsPage() {
  const restaurantId = useAppStore((state) => state.activeRestaurant?.id);
  const isSuperAdmin = useAppStore((state) => state.admin?.role === "SUPERADMIN");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RestaurantBooking | null>(null);
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0]);

  const query = useQuery({
    queryKey: ["admin-bookings", restaurantId, status, page, isSuperAdmin],
    queryFn: () =>
      api<{ bookings: RestaurantBooking[]; pagination: Pagination }>(
        `/admin/bookings?${new URLSearchParams({ ...(restaurantId ? { restaurantId } : {}), ...(status ? { status } : {}), page: String(page), limit: "20" })}`,
      ),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => api(`/admin/bookings/${id}/cancel`, { method: "POST", body: { reason: cancelReason } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-bookings"] });
      setSelected(null);
    },
  });

  const bookings = query.data?.bookings ?? [];

  return (
    <main className="page">
      <section className="resource-head">
        <span className="eyebrow"><CalendarDays size={14} /> Bookings</span>
      </section>

      <ResourceToolbar
        search=""
        onSearchChange={() => {}}
        placeholder=""
        filter={status}
        onFilterChange={(value) => { setStatus(value); setPage(1); }}
        filterOptions={STATUS_OPTIONS}
      />

      {query.isLoading && <LoadingGrid />}
      {query.isError && <StateView title="Couldn't load bookings" message="Check the backend connection and try once more." action={() => void query.refetch()} />}
      {query.isSuccess && !bookings.length && <StateView title="No bookings found" message="Bookings will show up here once customers start reserving tables." />}

      {bookings.length > 0 && (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Booking</th><th>Guest</th><th>Date &amp; time</th><th>People</th><th>Status</th><th>Advance</th></tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="data-table__row" onClick={() => setSelected(booking)}>
                  <td>{booking.humanBookingId}</td>
                  <td>{booking.fullName}<br /><small className="muted">{booking.mobileNumber}</small></td>
                  <td>{booking.date} · {booking.time}</td>
                  <td>{booking.people}</td>
                  <td><span className={clsx("badge", `badge--${booking.status}`)}>{booking.status}</span></td>
                  <td>₹{booking.advancePaid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {query.data && query.data.pagination.totalPages > 1 && (
        <div className="pagination-row">
          <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span>Page {page} of {query.data.pagination.totalPages}</span>
          <Button type="button" variant="secondary" disabled={!query.data.pagination.hasNextPage} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}

      {selected && (
        <ResourceDialog title={selected.humanBookingId} eyebrow="Booking details" onClose={() => setSelected(null)}>
          <div className="booking-detail-body">
            <div className="booking-detail-row"><Users size={16} /> {selected.fullName} · {selected.people} people</div>
            <div className="booking-detail-row"><Phone size={16} /> {selected.mobileNumber}</div>
            <div className="booking-detail-row"><CalendarDays size={16} /> {selected.date} at {selected.time}</div>
            <div className="booking-detail-row">Table preference: <strong>{selected.tablePreference}</strong></div>
            {selected.specialRequest && <div className="booking-detail-row">Special request: {selected.specialRequest}</div>}
            <div className="booking-detail-row">Advance paid: <strong>₹{selected.advancePaid}</strong></div>
            <div className="booking-detail-row">Status: <span className={clsx("badge", `badge--${selected.status}`)}>{selected.status}</span></div>
            {selected.cancellationReason && <div className="booking-detail-row">Cancellation reason: {selected.cancellationReason}</div>}
            {selected.refund && <div className="booking-detail-row">Refund: {selected.refund.eligible ? `₹${selected.refund.amount} eligible` : "Not eligible"}</div>}

            {selected.status === "upcoming" && (
              <div className="booking-cancel-row">
                <select value={cancelReason} onChange={(event) => setCancelReason(event.target.value)}>
                  {CANCEL_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                </select>
                <Button type="button" variant="ghost" loading={cancel.isPending} onClick={() => cancel.mutate(selected.id)}><X size={15} /> Cancel booking</Button>
              </div>
            )}
            {cancel.error && <div className="form-error">{cancel.error.message}</div>}
          </div>
        </ResourceDialog>
      )}
    </main>
  );
}
