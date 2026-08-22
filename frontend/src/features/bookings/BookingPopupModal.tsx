import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Ban, CheckCircle2, Clock3, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { queryClient } from "@/lib/query-client";
import { useBackCloseable } from "@/lib/modal-stack";
import { currency, shortDate } from "@/lib/format";
import { confirmBooking, rejectBooking } from "@/services/booking-api";
import type { Booking } from "@/types/domain";

export function BookingPopupModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const [now, setNow] = useState(Date.now());
  const expiresAt = useMemo(() => new Date(booking.expiresAt ?? booking.ownerResponseDeadline ?? Date.now()).getTime(), [booking.expiresAt, booking.ownerResponseDeadline]);
  const remainingMs = Math.max(0, expiresAt - now);
  const remaining = `${String(Math.floor(remainingMs / 60000)).padStart(2, "0")}:${String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0")}`;
  const settle = async () => {
    await queryClient.invalidateQueries({ queryKey: ["bookings"] });
    await queryClient.invalidateQueries({ queryKey: ["pending-bookings"] });
    window.setTimeout(onClose, 900);
  };
  const confirm = useMutation({ mutationFn: () => confirmBooking(booking.id), onSuccess: settle });
  const reject = useMutation({ mutationFn: () => rejectBooking(booking.id), onSuccess: settle });
  useBackCloseable(true, onClose);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (booking.bookingStatus !== "PENDING") {
      const closeTimer = window.setTimeout(onClose, 900);
      return () => window.clearTimeout(closeTimer);
    }
  }, [booking.bookingStatus, onClose]);

  return (
    <div className="live-booking-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="live-booking-modal" role="dialog" aria-modal="true">
        <header>
          <span className="live-booking-timer"><Clock3 size={16} /> {remaining}</span>
          <button className="icon-button" type="button" aria-label="Close booking popup" onClick={onClose}><X /></button>
        </header>
        <div className="live-booking-main">
          <span className={`status status--${booking.bookingStatus.toLowerCase()}`}>{booking.bookingStatus}</span>
          <h2>{booking.guestName}</h2>
          <p>{booking.stayProfile?.name ?? "Property"} - {booking.room?.name ?? "Room"}</p>
          <div className="live-booking-facts">
            <span><small>Check-in</small><strong>{shortDate(booking.checkInDate)}</strong></span>
            <span><small>Guests</small><strong>{booking.noOfGuests}</strong></span>
            <span><small>Amount</small><strong>{currency.format(Number(booking.totalAmount))}</strong></span>
          </div>
        </div>
        <footer>
          <Button variant="secondary" loading={reject.isPending} disabled={confirm.isPending} onClick={() => reject.mutate()}><Ban size={16} /> Reject</Button>
          <Button loading={confirm.isPending} disabled={reject.isPending} onClick={() => confirm.mutate()}><CheckCircle2 size={16} /> Confirm</Button>
        </footer>
        {(confirm.error || reject.error) && <div className="form-error">{(confirm.error ?? reject.error)?.message}</div>}
      </section>
    </div>
  );
}
