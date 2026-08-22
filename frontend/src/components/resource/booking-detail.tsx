import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PhoneInput } from "@/components/resource/dialog-kit";
import {
  ArrowLeftRight,
  Ban,
  BedDouble,
  CheckCircle2,
  CircleDollarSign,
  CircleUserRound,
  Clock3,
  LogIn,
  LogOut,
  Pencil,
  Percent,
  Plus,
  ReceiptText,
  Repeat,
  ShieldCheck,
  Trash2,
  UserPlus,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import type { Booking, BookingGuestMember, Room } from "@/types/domain";
import { currency } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { ResourceDialog, listItems, type ListResponse } from "@/components/resource/dialog-kit";
import type { Service } from "@/features/settings/ServicesSettingsPage";
import type { RatePlan } from "@/features/settings/RatePlansSettingsPage";

type StayCharge = { type: "NONE" | "FULL" | "MANUAL"; charge?: number };
type BookingAction = "check-in" | "check-out" | "extend" | "change-room" | "rate-plan" | "exchange" | null;

export function BookingDetailDialog({ booking, role, onClose }: { booking: Booking; role: "ADMIN" | "OWNER"; onClose: () => void }) {
  const [current, setCurrent] = useState(booking);
  const [activeAction, setActiveAction] = useState<BookingAction>(null);
  const [addingGuest, setAddingGuest] = useState(false);
  const [editingGuest, setEditingGuest] = useState<BookingGuestMember | null>(null);
  const [addingService, setAddingService] = useState(false);
  const [addingCharge, setAddingCharge] = useState(false);
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const nights = Math.max(1, Math.round((new Date(current.checkOutDate).getTime() - new Date(current.checkInDate).getTime()) / 86400000));
  const paidAmount = (current.payments ?? []).filter((payment) => payment.status === "SUCCESS").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balance = Math.max(0, Number(current.totalAmount) - paidAmount);
  const statusOptions = getBookingStatusOptions(current.bookingStatus);
  const canOperate = current.bookingStatus === "CONFIRMED" || current.bookingStatus === "CHECKED_IN";
  const canEditExtras = ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(current.bookingStatus);

  const applyUpdate = (updated: Booking) => {
    setCurrent(updated);
    setActiveAction(null);
    void queryClient.invalidateQueries({ queryKey: ["bookings"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: Booking["bookingStatus"]) => api<Booking>(`/bookings/${current.id}/status`, { method: "PATCH", body: { status } }),
    onSuccess: applyUpdate,
  });
  const checkInMutation = useMutation({
    mutationFn: (input: StayCharge) => api<Booking>(`/bookings/${current.id}/check-in`, { method: "PATCH", body: input }),
    onSuccess: applyUpdate,
  });
  const checkOutMutation = useMutation({
    mutationFn: (input: StayCharge) => api<Booking>(`/bookings/${current.id}/check-out`, { method: "PATCH", body: input }),
    onSuccess: applyUpdate,
  });
  const extendMutation = useMutation({
    mutationFn: (input: { checkOutDate: string; totalAmount: number }) => api<Booking>(`/bookings/${current.id}/extend`, { method: "PATCH", body: input }),
    onSuccess: applyUpdate,
  });
  const roomChangeMutation = useMutation({
    mutationFn: (roomId: string) => api<Booking>(`/bookings/${current.id}/room`, { method: "PATCH", body: { roomId } }),
    onSuccess: applyUpdate,
  });
  const ratePlanMutation = useMutation({
    mutationFn: (input: { ratePlanId: string | null; totalAmount: number }) => api<Booking>(`/bookings/${current.id}/rate-plan`, { method: "PATCH", body: input }),
    onSuccess: applyUpdate,
  });
  const exchangeMutation = useMutation({
    mutationFn: (withBookingId: string) => api<Booking>(`/bookings/${current.id}/exchange`, { method: "POST", body: { withBookingId } }),
    onSuccess: applyUpdate,
  });
  const addGuestMutation = useMutation({
    mutationFn: (input: { name: string; phone?: string; email?: string }) => api<Booking>(`/bookings/${current.id}/guests`, { method: "POST", body: input }),
    onSuccess: (updated) => { setCurrent(updated); setAddingGuest(false); void queryClient.invalidateQueries({ queryKey: ["bookings"] }); },
  });
  const updateGuestMutation = useMutation({
    mutationFn: (input: { guestId: string; name: string; phone?: string; email?: string }) => api<Booking>(`/bookings/${current.id}/guests/${input.guestId}`, { method: "PATCH", body: input }),
    onSuccess: (updated) => { setCurrent(updated); setEditingGuest(null); void queryClient.invalidateQueries({ queryKey: ["bookings"] }); },
  });
  const removeGuestMutation = useMutation({
    mutationFn: (guestId: string) => api<Booking>(`/bookings/${current.id}/guests/${guestId}`, { method: "DELETE" }),
    onSuccess: (updated) => { setCurrent(updated); void queryClient.invalidateQueries({ queryKey: ["bookings"] }); },
  });
  const addServiceMutation = useMutation({
    mutationFn: (input: { serviceId: string; quantity: number }) => api<Booking>(`/bookings/${current.id}/services`, { method: "POST", body: input }),
    onSuccess: (updated) => { setCurrent(updated); setAddingService(false); void queryClient.invalidateQueries({ queryKey: ["bookings"] }); },
  });
  const updateServiceQtyMutation = useMutation({
    mutationFn: (input: { lineId: string; quantity: number }) => api<Booking>(`/bookings/${current.id}/services/${input.lineId}`, { method: "PATCH", body: { quantity: input.quantity } }),
    onSuccess: (updated) => { setCurrent(updated); void queryClient.invalidateQueries({ queryKey: ["bookings"] }); },
  });
  const removeServiceMutation = useMutation({
    mutationFn: (lineId: string) => api<Booking>(`/bookings/${current.id}/services/${lineId}`, { method: "DELETE" }),
    onSuccess: (updated) => { setCurrent(updated); void queryClient.invalidateQueries({ queryKey: ["bookings"] }); },
  });
  const addChargeMutation = useMutation({
    mutationFn: (input: { label: string; amount: number }) => api<Booking>(`/bookings/${current.id}/charges`, { method: "POST", body: input }),
    onSuccess: (updated) => { setCurrent(updated); setAddingCharge(false); void queryClient.invalidateQueries({ queryKey: ["bookings"] }); },
  });
  const removeChargeMutation = useMutation({
    mutationFn: (chargeId: string) => api<Booking>(`/bookings/${current.id}/charges/${chargeId}`, { method: "DELETE" }),
    onSuccess: (updated) => { setCurrent(updated); void queryClient.invalidateQueries({ queryKey: ["bookings"] }); },
  });

  return (
    <ResourceDialog title={current.bookingRef} eyebrow={`${role === "ADMIN" ? "Admin" : "Owner"} booking control`} dialogClassName="booking-dialog" onClose={onClose}>
      <div className="booking-detail">
        <section className="booking-detail__hero">
          <div>
            <span className={`status status--${current.bookingStatus.toLowerCase()}`}>{current.bookingStatus}</span>
            <h3>{current.guestName}</h3>
            <p>{current.room?.name ?? "Room"}</p>
          </div>
          <strong>{currency.format(Number(current.totalAmount))}</strong>
        </section>

        <section className="booking-highlight-grid">
          <BookingHighlight icon={Clock3} label="Check-in" value={formatDateTime(current.checkInDate, current.stayProfile?.checkInTime)} tone="orange" />
          <BookingHighlight icon={Clock3} label="Check-out" value={formatDateTime(current.checkOutDate, current.stayProfile?.checkOutTime)} tone="green" />
          <BookingHighlight icon={CircleUserRound} label="Guests" value={`${current.noOfGuests} guest${current.noOfGuests === 1 ? "" : "s"} - ${nights} night${nights === 1 ? "" : "s"}`} tone="blue" />
          <BookingHighlight icon={CircleDollarSign} label="Payment" value={`${current.paymentStatus ?? "UNPAID"} - ${currency.format(balance)} due`} tone="violet" />
        </section>

        <section className="booking-detail-grid">
          <BookingInfoPanel title="Guest" icon={CircleUserRound} rows={[
            ["Name", current.guestName],
            ["Phone", current.guestPhone],
            ["Email", current.guestEmail || "Not provided"],
          ]} />
          <BookingInfoPanel title="Room" icon={BedDouble} rows={[
            ["Room", current.room?.name ?? "Room"],
            ["Number", current.room?.roomNumber || "Unassigned"],
            ["Base price", current.room?.basePrice === undefined ? "Not provided" : currency.format(Number(current.room.basePrice))],
          ]} />
          <BookingInfoPanel title="Booking" icon={ReceiptText} rows={[
            ["Source", (current.source ?? "DIRECT_SITE").replaceAll("_", " ")],
            ["Rate plan", current.ratePlan?.name ?? "None"],
            ["Created", current.createdAt ? formatDateTime(current.createdAt) : "Not provided"],
            ["Responded", current.respondedAt ? formatDateTime(current.respondedAt) : "Awaiting response"],
          ]} />
          <BookingInfoPanel title="Stay" icon={LogIn} rows={[
            ["Checked in", current.checkedInAt ? formatDateTime(current.checkedInAt) : "Not yet"],
            ["Checked out", current.checkedOutAt ? formatDateTime(current.checkedOutAt) : "Not yet"],
            ...(current.earlyCheckinType && current.earlyCheckinType !== "NONE" ? [["Early check-in", `${current.earlyCheckinType === "FULL" ? "Full night" : "Manual"} · ${currency.format(Number(current.earlyCheckinCharge ?? 0))}`] as [string, string]] : []),
            ...(current.lateCheckoutType && current.lateCheckoutType !== "NONE" ? [["Late checkout", `${current.lateCheckoutType === "FULL" ? "Full night" : "Manual"} · ${currency.format(Number(current.lateCheckoutCharge ?? 0))}`] as [string, string]] : []),
          ]} />
        </section>

        <section className="booking-line-section">
          <div className="booking-line-section__head">
            <h4><UserPlus size={16} /> Guests</h4>
            {canEditExtras && <button type="button" className="booking-line-section__add" onClick={() => { setAddingGuest(true); setEditingGuest(null); }}><Plus size={13} /> Add</button>}
          </div>
          {current.guests?.length ? (
            <div className="booking-line-list">
              {current.guests.map((guest) => (
                <div className="booking-line-item" key={guest.id}>
                  <div><strong>{guest.name}</strong><small>{guest.phone || guest.email || "No contact info"}</small></div>
                  {canEditExtras && (
                    <span className="booking-line-item__actions">
                      <button type="button" aria-label={`Edit ${guest.name}`} onClick={() => { setEditingGuest(guest); setAddingGuest(false); }}><Pencil size={14} /></button>
                      <button type="button" aria-label={`Remove ${guest.name}`} disabled={removeGuestMutation.isPending} onClick={() => removeGuestMutation.mutate(guest.id)}><Trash2 size={14} /></button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="booking-line-section__empty">No additional guests added.</p>}
          {addingGuest && (
            <GuestForm loading={addGuestMutation.isPending} error={addGuestMutation.error} onCancel={() => setAddingGuest(false)} onSubmit={(input) => addGuestMutation.mutate(input)} />
          )}
          {editingGuest && (
            <GuestForm initial={editingGuest} loading={updateGuestMutation.isPending} error={updateGuestMutation.error} onCancel={() => setEditingGuest(null)} onSubmit={(input) => updateGuestMutation.mutate({ guestId: editingGuest.id, ...input })} />
          )}
        </section>

        <section className="booking-line-section">
          <div className="booking-line-section__head">
            <h4><Utensils size={16} /> Services</h4>
            {canEditExtras && <button type="button" className="booking-line-section__add" onClick={() => setAddingService(true)}><Plus size={13} /> Add</button>}
          </div>
          {current.services?.length ? (
            <div className="booking-line-list">
              {current.services.map((line) => (
                <div className="booking-line-item" key={line.id}>
                  <div><strong>{line.title}</strong><small>{currency.format(Number(line.price))} × {line.quantity}</small></div>
                  <strong className="booking-line-item__value">{currency.format(Number(line.price) * line.quantity)}</strong>
                  {canEditExtras && (
                    <span className="booking-line-item__actions">
                      <button type="button" aria-label={`Increase ${line.title} quantity`} disabled={updateServiceQtyMutation.isPending} onClick={() => updateServiceQtyMutation.mutate({ lineId: line.id, quantity: line.quantity + 1 })}>+</button>
                      <button type="button" aria-label={`Decrease ${line.title} quantity`} disabled={updateServiceQtyMutation.isPending || line.quantity <= 1} onClick={() => updateServiceQtyMutation.mutate({ lineId: line.id, quantity: line.quantity - 1 })}>-</button>
                      <button type="button" aria-label={`Remove ${line.title}`} disabled={removeServiceMutation.isPending} onClick={() => removeServiceMutation.mutate(line.id)}><Trash2 size={14} /></button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="booking-line-section__empty">No services added to this booking.</p>}
          {addingService && (
            <AddServiceForm propertyId={propertyId} loading={addServiceMutation.isPending} error={addServiceMutation.error} onCancel={() => setAddingService(false)} onSubmit={(input) => addServiceMutation.mutate(input)} />
          )}
        </section>

        <section className="booking-line-section">
          <div className="booking-line-section__head">
            <h4><ReceiptText size={16} /> Extra charges</h4>
            {canEditExtras && <button type="button" className="booking-line-section__add" onClick={() => setAddingCharge(true)}><Plus size={13} /> Add</button>}
          </div>
          {current.charges?.length ? (
            <div className="booking-line-list">
              {current.charges.map((charge) => (
                <div className="booking-line-item" key={charge.id}>
                  <div><strong>{charge.label}</strong></div>
                  <strong className="booking-line-item__value">{currency.format(Number(charge.amount))}</strong>
                  {canEditExtras && (
                    <span className="booking-line-item__actions">
                      <button type="button" aria-label={`Remove ${charge.label}`} disabled={removeChargeMutation.isPending} onClick={() => removeChargeMutation.mutate(charge.id)}><Trash2 size={14} /></button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="booking-line-section__empty">No extra charges added.</p>}
          {addingCharge && (
            <AddChargeForm loading={addChargeMutation.isPending} error={addChargeMutation.error} onCancel={() => setAddingCharge(false)} onSubmit={(input) => addChargeMutation.mutate(input)} />
          )}
        </section>

        <section className="booking-payment-strip">
          <div><small>Paid</small><strong>{currency.format(paidAmount)}</strong></div>
          <div><small>Balance</small><strong>{currency.format(balance)}</strong></div>
          <div><small>Payments</small><strong>{current.payments?.length ?? 0}</strong></div>
        </section>

        {current.notes && <section className="booking-notes"><strong>Notes</strong><p>{current.notes}</p></section>}

        <section className="booking-actions">
          <div>
            <ShieldCheck size={18} />
            <span>{role === "ADMIN" ? "Admin can supervise and update this booking." : "Owner can control bookings for assigned properties."}</span>
          </div>
          <div>
            {current.bookingStatus === "CONFIRMED" && <button type="button" className="booking-action booking-action--primary" onClick={() => setActiveAction("check-in")}><LogIn size={15} /> Check in</button>}
            {current.bookingStatus === "CHECKED_IN" && <button type="button" className="booking-action booking-action--primary" onClick={() => setActiveAction("check-out")}><LogOut size={15} /> Check out</button>}
            {canOperate && <button type="button" className="booking-action booking-action--neutral" onClick={() => setActiveAction("extend")}><Clock3 size={15} /> Extend stay</button>}
            {canOperate && <button type="button" className="booking-action booking-action--neutral" onClick={() => setActiveAction("change-room")}><Repeat size={15} /> Change room</button>}
            {canOperate && <button type="button" className="booking-action booking-action--neutral" onClick={() => setActiveAction("exchange")}><ArrowLeftRight size={15} /> Exchange room</button>}
            {canEditExtras && <button type="button" className="booking-action booking-action--neutral" onClick={() => setActiveAction("rate-plan")}><Percent size={15} /> Rate plan</button>}
            {statusOptions.map((status) => <button type="button" key={status} className={`booking-action booking-action--${status.toLowerCase()}`} disabled={statusMutation.isPending} onClick={() => statusMutation.mutate(status)}>{statusIcon(status)} {statusLabel(status)}</button>)}
          </div>
        </section>
        {statusMutation.error && <div className="form-error">{statusMutation.error.message}</div>}

        {activeAction === "check-in" && (
          <StayChargeForm
            title="Check in guest"
            chargeLabel="Early check-in charge"
            nightlyRate={Number(current.room?.basePrice ?? 0)}
            loading={checkInMutation.isPending}
            error={checkInMutation.error}
            onCancel={() => setActiveAction(null)}
            onSubmit={(input) => checkInMutation.mutate(input)}
          />
        )}
        {activeAction === "check-out" && (
          <StayChargeForm
            title="Check out guest"
            chargeLabel="Late check-out charge"
            nightlyRate={Number(current.room?.basePrice ?? 0)}
            loading={checkOutMutation.isPending}
            error={checkOutMutation.error}
            onCancel={() => setActiveAction(null)}
            onSubmit={(input) => checkOutMutation.mutate(input)}
          />
        )}
        {activeAction === "extend" && (
          <ExtendStayForm
            booking={current}
            loading={extendMutation.isPending}
            error={extendMutation.error}
            onCancel={() => setActiveAction(null)}
            onSubmit={(checkOutDate, totalAmount) => extendMutation.mutate({ checkOutDate, totalAmount })}
          />
        )}
        {activeAction === "change-room" && (
          <ChangeRoomForm
            booking={current}
            propertyId={propertyId}
            loading={roomChangeMutation.isPending}
            error={roomChangeMutation.error}
            onCancel={() => setActiveAction(null)}
            onSubmit={(roomId) => roomChangeMutation.mutate(roomId)}
          />
        )}
        {activeAction === "exchange" && (
          <ExchangeRoomForm
            booking={current}
            propertyId={propertyId}
            loading={exchangeMutation.isPending}
            error={exchangeMutation.error}
            onCancel={() => setActiveAction(null)}
            onSubmit={(withBookingId) => exchangeMutation.mutate(withBookingId)}
          />
        )}
        {activeAction === "rate-plan" && (
          <RatePlanForm
            booking={current}
            propertyId={propertyId}
            loading={ratePlanMutation.isPending}
            error={ratePlanMutation.error}
            onCancel={() => setActiveAction(null)}
            onSubmit={(input) => ratePlanMutation.mutate(input)}
          />
        )}
      </div>
    </ResourceDialog>
  );
}

function StayChargeForm({ title, chargeLabel, nightlyRate, loading, error, onCancel, onSubmit }: {
  title: string;
  chargeLabel: string;
  nightlyRate: number;
  loading: boolean;
  error: Error | null;
  onCancel: () => void;
  onSubmit: (input: StayCharge) => void;
}) {
  const [type, setType] = useState<StayCharge["type"]>("NONE");
  const [amount, setAmount] = useState("");

  return (
    <section className="booking-inline-form">
      <h4>{title}</h4>
      <div className="stay-charge-options">
        <label><input type="radio" name="stayChargeType" checked={type === "NONE"} onChange={() => setType("NONE")} /> No charge</label>
        <label><input type="radio" name="stayChargeType" checked={type === "FULL"} onChange={() => setType("FULL")} /> Full night ({currency.format(nightlyRate)})</label>
        <label><input type="radio" name="stayChargeType" checked={type === "MANUAL"} onChange={() => setType("MANUAL")} /> Manual amount</label>
      </div>
      {type === "MANUAL" && (
        <div className="property-form-grid">
          <label>{chargeLabel}<input type="number" min={0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        </div>
      )}
      {error && <div className="form-error">{error.message}</div>}
      <div className="booking-inline-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" loading={loading} onClick={() => onSubmit({ type, charge: type === "MANUAL" ? Number(amount || 0) : undefined })}>Confirm</Button>
      </div>
    </section>
  );
}

function ExtendStayForm({ booking, loading, error, onCancel, onSubmit }: {
  booking: Booking;
  loading: boolean;
  error: Error | null;
  onCancel: () => void;
  onSubmit: (checkOutDate: string, totalAmount: number) => void;
}) {
  const minCheckOutDate = new Date(new Date(booking.checkOutDate).getTime() + 86_400_000).toISOString().slice(0, 10);
  const [checkOutDate, setCheckOutDate] = useState(minCheckOutDate);
  const [totalAmount, setTotalAmount] = useState(String(Number(booking.totalAmount) + Number(booking.room?.basePrice ?? 0)));

  return (
    <section className="booking-inline-form">
      <h4>Extend stay</h4>
      <div className="property-form-grid">
        <label>New check-out date<DateInput min={minCheckOutDate} value={checkOutDate} onChange={(event) => setCheckOutDate(event.target.value)} /></label>
        <label>New total amount<input type="number" min={0} step="0.01" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} /></label>
      </div>
      {error && <div className="form-error">{error.message}</div>}
      <div className="booking-inline-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" loading={loading} onClick={() => onSubmit(checkOutDate, Number(totalAmount))}>Extend stay</Button>
      </div>
    </section>
  );
}

function ChangeRoomForm({ booking, propertyId, loading, error, onCancel, onSubmit }: {
  booking: Booking;
  propertyId: string;
  loading: boolean;
  error: Error | null;
  onCancel: () => void;
  onSubmit: (roomId: string) => void;
}) {
  const rooms = useQuery({ queryKey: ["rooms", propertyId], queryFn: () => api<Room[]>(`/rooms?propertyId=${propertyId}`) });
  const [roomId, setRoomId] = useState("");
  const options = (rooms.data ?? []).filter((room) => room.id !== booking.room?.id);

  return (
    <section className="booking-inline-form">
      <h4>Change room</h4>
      <div className="property-form-grid">
        <label>Move to
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            <option value="">Select a room</option>
            {options.map((room) => <option key={room.id} value={room.id}>{room.name}{room.roomNumber ? ` - Room ${room.roomNumber}` : ""}</option>)}
          </select>
        </label>
      </div>
      {error && <div className="form-error">{error.message}</div>}
      <div className="booking-inline-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" loading={loading} disabled={!roomId} onClick={() => onSubmit(roomId)}>Move room</Button>
      </div>
    </section>
  );
}

function ExchangeRoomForm({ booking, propertyId, loading, error, onCancel, onSubmit }: {
  booking: Booking;
  propertyId: string;
  loading: boolean;
  error: Error | null;
  onCancel: () => void;
  onSubmit: (withBookingId: string) => void;
}) {
  const bookings = useQuery({ queryKey: ["bookings", propertyId], queryFn: () => api<Booking[]>(`/bookings?propertyId=${propertyId}`) });
  const [withBookingId, setWithBookingId] = useState("");
  const options = (bookings.data ?? []).filter((item) =>
    item.id !== booking.id && ["CONFIRMED", "CHECKED_IN"].includes(item.bookingStatus) && item.room?.id !== booking.room?.id);

  return (
    <section className="booking-inline-form">
      <h4>Exchange room with another booking</h4>
      <div className="property-form-grid">
        <label>Swap with
          <select value={withBookingId} onChange={(event) => setWithBookingId(event.target.value)}>
            <option value="">Select a booking</option>
            {options.map((item) => <option key={item.id} value={item.id}>{item.bookingRef} - {item.guestName} - {item.room?.name}</option>)}
          </select>
        </label>
      </div>
      {error && <div className="form-error">{error.message}</div>}
      <div className="booking-inline-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" loading={loading} disabled={!withBookingId} onClick={() => onSubmit(withBookingId)}>Exchange rooms</Button>
      </div>
    </section>
  );
}

function RatePlanForm({ booking, propertyId, loading, error, onCancel, onSubmit }: {
  booking: Booking;
  propertyId: string;
  loading: boolean;
  error: Error | null;
  onCancel: () => void;
  onSubmit: (input: { ratePlanId: string | null; totalAmount: number }) => void;
}) {
  const ratePlans = useQuery({ queryKey: ["rate-plans", propertyId], queryFn: () => api<ListResponse<RatePlan>>(`/rate-plans?propertyId=${propertyId}`) });
  const options = listItems<RatePlan>(ratePlans.data).filter((plan) => plan.isActive);
  const [ratePlanId, setRatePlanId] = useState(booking.ratePlanId ?? "");
  const [totalAmount, setTotalAmount] = useState(String(Number(booking.totalAmount)));

  return (
    <section className="booking-inline-form">
      <h4>Change rate plan</h4>
      <div className="property-form-grid">
        <label>Rate plan
          <select value={ratePlanId} onChange={(event) => setRatePlanId(event.target.value)}>
            <option value="">No rate plan</option>
            {options.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
        </label>
        <label>New total amount<input type="number" min={0} step="0.01" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} /></label>
      </div>
      {error && <div className="form-error">{error.message}</div>}
      <div className="booking-inline-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" loading={loading} onClick={() => onSubmit({ ratePlanId: ratePlanId || null, totalAmount: Number(totalAmount) })}>Save rate plan</Button>
      </div>
    </section>
  );
}

function GuestForm({ initial, loading, error, onCancel, onSubmit }: {
  initial?: BookingGuestMember;
  loading: boolean;
  error: Error | null;
  onCancel: () => void;
  onSubmit: (input: { name: string; phone?: string; email?: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneError = phone && phoneDigits.length < 7 ? "Enter at least 7 digits" : undefined;

  return (
    <section className="booking-inline-form">
      <h4>{initial ? "Edit guest" : "Add guest"}</h4>
      <div className="property-form-grid">
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Phone<PhoneInput value={phone} onChange={setPhone} /></label>
        {phoneError && <small className="field-error">{phoneError}</small>}
        <label className="property-form-grid__wide">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      </div>
      {error && <div className="form-error">{error.message}</div>}
      <div className="booking-inline-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" loading={loading} disabled={name.trim().length < 2 || Boolean(phoneError)} onClick={() => onSubmit({ name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined })}>{initial ? "Save guest" : "Add guest"}</Button>
      </div>
    </section>
  );
}

function AddServiceForm({ propertyId, loading, error, onCancel, onSubmit }: {
  propertyId: string;
  loading: boolean;
  error: Error | null;
  onCancel: () => void;
  onSubmit: (input: { serviceId: string; quantity: number }) => void;
}) {
  const services = useQuery({ queryKey: ["services", propertyId], queryFn: () => api<ListResponse<Service>>(`/services?propertyId=${propertyId}`) });
  const options = listItems<Service>(services.data).filter((service) => service.isAvailable);
  const [serviceId, setServiceId] = useState("");
  const [quantity, setQuantity] = useState("1");

  return (
    <section className="booking-inline-form">
      <h4>Add service</h4>
      <div className="property-form-grid">
        <label>Service
          <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
            <option value="">Select a service</option>
            {options.map((service) => <option key={service.id} value={service.id}>{service.title} - {currency.format(Number(service.price))}</option>)}
          </select>
        </label>
        <label>Quantity<input type="number" min={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
      </div>
      {error && <div className="form-error">{error.message}</div>}
      <div className="booking-inline-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" loading={loading} disabled={!serviceId} onClick={() => onSubmit({ serviceId, quantity: Math.max(1, Number(quantity || 1)) })}>Add service</Button>
      </div>
    </section>
  );
}

function AddChargeForm({ loading, error, onCancel, onSubmit }: {
  loading: boolean;
  error: Error | null;
  onCancel: () => void;
  onSubmit: (input: { label: string; amount: number }) => void;
}) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");

  return (
    <section className="booking-inline-form">
      <h4>Add extra charge</h4>
      <div className="property-form-grid">
        <label>Reason<input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Minibar, Damage fee" /></label>
        <label>Amount<input type="number" min={0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      </div>
      {error && <div className="form-error">{error.message}</div>}
      <div className="booking-inline-form__actions">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="button" loading={loading} disabled={label.trim().length < 2 || !amount} onClick={() => onSubmit({ label: label.trim(), amount: Number(amount) })}>Add charge</Button>
      </div>
    </section>
  );
}

function BookingHighlight({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: "orange" | "green" | "blue" | "violet" }) {
  return <div className={`booking-highlight booking-highlight--${tone}`}><span><Icon size={18} /></span><small>{label}</small><strong>{value}</strong></div>;
}

function BookingInfoPanel({ title, icon: Icon, rows }: { title: string; icon: LucideIcon; rows: [string, string][] }) {
  return (
    <div className="booking-info-panel">
      <h4><Icon size={17} /> {title}</h4>
      {rows.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
    </div>
  );
}

function getBookingStatusOptions(status: Booking["bookingStatus"]): Booking["bookingStatus"][] {
  if (status === "PENDING") return ["CONFIRMED", "REJECTED"];
  // Bookings only reach COMPLETED through the check-out flow (see /bookings/:id/check-out),
  // which records the late-checkout charge — there's no direct "Complete" jump from here.
  if (status === "CONFIRMED") return ["CANCELLED"];
  return [];
}

function statusLabel(status: Booking["bookingStatus"]) {
  if (status === "CONFIRMED") return "Confirm";
  if (status === "COMPLETED") return "Complete";
  if (status === "CANCELLED") return "Cancel";
  if (status === "REJECTED") return "Reject";
  return status;
}

function statusIcon(status: Booking["bookingStatus"]) {
  if (status === "CANCELLED" || status === "REJECTED") return <Ban size={15} />;
  return <CheckCircle2 size={15} />;
}

export function formatDateTime(value: string, time?: string) {
  const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  return time ? `${date}, ${formatTime(time)}` : `${date}, ${new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(value))}`;
}

function formatTime(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(date);
}
