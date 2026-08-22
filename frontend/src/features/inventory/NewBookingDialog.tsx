import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Booking } from "@/types/domain";
import { EMAIL_PATTERN, FieldError, PhoneField, ResourceDialog, DialogFooter, Req, cleanBody } from "@/components/resource/dialog-kit";
import { DateInput } from "@/components/ui/DateInput";
import { invalidateInventory, nextDay, type InventoryRoom } from "./types";

type NewBookingForm = {
  roomId: string;
  guestName: string;
  guestPhone: string;
  guestEmail: string;
  checkInDate: string;
  checkOutDate: string;
  noOfGuests: number;
  totalAmount?: number;
  source: "DIRECT_SITE" | "PHONE" | "WALK_IN" | "ADMIN_ADDED";
  notes: string;
};

const todayDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function NewBookingDialog({ propertyId, date, roomId, onClose }: { propertyId: string; date: string; roomId?: string; onClose: () => void }) {
  const today = todayDate();
  const initialCheckInDate = date < today ? today : date;
  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<NewBookingForm>({
    defaultValues: {
      roomId: roomId ?? "",
      guestName: "",
      guestPhone: "",
      guestEmail: "",
      checkInDate: initialCheckInDate,
      checkOutDate: nextDay(initialCheckInDate),
      noOfGuests: 1,
      totalAmount: undefined,
      source: "WALK_IN",
      notes: "",
    },
  });
  const checkInDate = watch("checkInDate") || initialCheckInDate;
  const checkOutDate = watch("checkOutDate") || nextDay(checkInDate);
  const minCheckOutDate = nextDay(checkInDate);

  useEffect(() => {
    if (checkOutDate <= checkInDate) {
      setValue("checkOutDate", minCheckOutDate, { shouldDirty: true, shouldValidate: true });
    }
  }, [checkInDate, checkOutDate, minCheckOutDate, setValue]);

  const rooms = useQuery({
    queryKey: ["inventory-rooms", propertyId, checkInDate, checkOutDate],
    queryFn: () => api<InventoryRoom[]>(`/inventory/rooms?propertyId=${propertyId}&date=${checkInDate}&checkOutDate=${checkOutDate}`),
    enabled: Boolean(checkInDate && checkOutDate),
  });
  const availableRooms = (rooms.data ?? []).filter((room) => room.status === "AVAILABLE" && room.isBookable);

  const mutation = useMutation({
    mutationFn: (data: NewBookingForm) => api<Booking>("/bookings", { method: "POST", body: cleanBody({ ...data, stayProfileId: propertyId }) }),
    onSuccess: async () => {
      await invalidateInventory(propertyId, date);
      onClose();
    },
  });

  return (
    <ResourceDialog title="New booking" eyebrow="Manual booking" onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div className="property-form-grid">
          <label className="property-form-grid__wide"><span className="label-title">Room<Req /></span>
            <select {...register("roomId", { required: "Select a room" })}>
              <option value="">Select a room</option>
              {availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
            </select>
            <FieldError error={errors.roomId} />
          </label>
          <label><span className="label-title">Guest name<Req /></span>
            <input {...register("guestName", { required: "Guest name is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
            <FieldError error={errors.guestName} />
          </label>
          <label><span className="label-title">Phone<Req /></span>
            <PhoneField control={control} name="guestPhone" error={errors.guestPhone} required />
          </label>
          <label>Email
            <input type="email" {...register("guestEmail", { validate: (value) => !value || EMAIL_PATTERN.test(value) || "Enter a valid email address" })} />
            <FieldError error={errors.guestEmail} />
          </label>
          <label><span className="label-title">Check-in<Req /></span>
            <DateInput
              min={today}
              {...register("checkInDate", {
                required: "Check-in date is required",
                validate: (value) => value >= today || "Check-in cannot be before today",
              })}
            />
            <FieldError error={errors.checkInDate} />
          </label>
          <label><span className="label-title">Check-out<Req /></span>
            <DateInput
              min={minCheckOutDate}
              {...register("checkOutDate", {
                required: "Check-out date is required",
                validate: (value) => value >= minCheckOutDate || "Check-out must be after check-in",
              })}
            />
            <FieldError error={errors.checkOutDate} />
          </label>
          <label><span className="label-title">Guests<Req /></span>
            <input type="number" {...register("noOfGuests", { required: "Guest count is required", valueAsNumber: true, min: { value: 1, message: "Must be at least 1" } })} />
            <FieldError error={errors.noOfGuests} />
          </label>
          <label>Amount (optional)
            <input type="number" step="0.01" placeholder="Auto from room price" {...register("totalAmount", { valueAsNumber: true, min: { value: 0, message: "Must be 0 or more" } })} />
            <FieldError error={errors.totalAmount} />
          </label>
          <label>Source
            <select {...register("source")}>
              <option value="WALK_IN">Walk-in</option>
              <option value="PHONE">Phone</option>
              <option value="DIRECT_SITE">Direct site</option>
              <option value="ADMIN_ADDED">Admin added</option>
            </select>
          </label>
          <label className="property-form-grid__wide">Notes<textarea rows={2} {...register("notes")} /></label>
        </div>
        {mutation.error && <div className="form-error">{mutation.error.message}</div>}
        <DialogFooter onClose={onClose} loading={mutation.isPending} label="Create booking" />
      </form>
    </ResourceDialog>
  );
}
