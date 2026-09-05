import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import type { SlotConfiguration, SlotMeal } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { DialogFooter, FieldError, ResourceDialog, Req, cleanBody } from "@/components/resource/dialog-kit";

type SlotForm = { meal: SlotMeal; time: string; sortOrder: number };

const to24 = (value: string) => value; // <input type="time"> already gives "HH:mm"
const to12 = (time24: string) => {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
};
const from12to24 = (time12: string) => {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time12.trim());
  if (!match) return "12:00";
  let hour = Number(match[1]);
  const minute = match[2];
  const period = match[3]!.toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
};

export function SlotsSettingsPage() {
  const restaurantId = useAppStore((state) => state.activeRestaurant!.id);
  const base = `/admin/restaurants/${restaurantId}/slots`;
  const slots = useQuery({ queryKey: ["admin-slots", restaurantId], queryFn: () => api<SlotConfiguration[]>(base) });
  const [dialog, setDialog] = useState<SlotConfiguration | "new" | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-slots", restaurantId] });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SlotForm>({
    defaultValues: { meal: "LUNCH", time: "12:00", sortOrder: 0 },
  });

  const save = useMutation({
    mutationFn: (data: SlotForm) => {
      const body = cleanBody({ meal: data.meal, time: to12(to24(data.time)), sortOrder: data.sortOrder });
      return dialog !== "new" && dialog
        ? api(`${base}/${dialog.id}`, { method: "PATCH", body })
        : api(base, { method: "POST", body });
    },
    onSuccess: async () => { await invalidate(); setDialog(null); },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api(`${base}/${id}`, { method: "DELETE" }),
    onSuccess: () => void invalidate(),
  });

  const openNew = () => { reset({ meal: "LUNCH", time: "12:00", sortOrder: slots.data?.length ?? 0 }); setDialog("new"); };
  const openEdit = (slot: SlotConfiguration) => { reset({ meal: slot.meal, time: from12to24(slot.time), sortOrder: slot.sortOrder }); setDialog(slot); };

  if (slots.isLoading) return <main className="page"><LoadingGrid /></main>;
  if (slots.isError) return <main className="page"><StateView title="Couldn't load slots" message="Check the backend connection and try once more." action={() => void slots.refetch()} /></main>;

  const lunch = (slots.data ?? []).filter((s) => s.meal === "LUNCH").sort((a, b) => a.sortOrder - b.sortOrder);
  const dinner = (slots.data ?? []).filter((s) => s.meal === "DINNER").sort((a, b) => a.sortOrder - b.sortOrder);

  const renderGroup = (label: string, items: SlotConfiguration[]) => (
    <section className="card">
      <header className="menu-category-card__head"><strong>{label}</strong></header>
      <div className="slot-chip-list">
        {items.map((slot) => (
          <div key={slot.id} className={`slot-chip ${slot.isActive ? "" : "slot-chip--inactive"}`}>
            <Clock size={13} /> {slot.time}
            <button type="button" className="icon-button" aria-label="Edit slot" onClick={() => openEdit(slot)}><Pencil size={13} /></button>
            <button type="button" className="icon-button" aria-label="Deactivate slot" onClick={() => deactivate.mutate(slot.id)}><Trash2 size={13} /></button>
          </div>
        ))}
        {!items.length && <small className="muted">No {label.toLowerCase()} slots configured.</small>}
      </div>
    </section>
  );

  return (
    <main className="page">
      <section className="resource-head">
        <span className="eyebrow"><Clock size={14} /> Slots</span>
        <Button type="button" onClick={openNew}><Plus size={17} /> Add slot</Button>
      </section>
      {renderGroup("Lunch", lunch)}
      {renderGroup("Dinner", dinner)}

      {dialog && (
        <ResourceDialog title={dialog === "new" ? "Add slot" : "Edit slot"} eyebrow="Slot configuration" onClose={() => setDialog(null)}>
          <form noValidate onSubmit={handleSubmit((data) => save.mutate(data))}>
            <div className="property-form-grid">
              <label><span className="label-title">Meal<Req /></span>
                <select {...register("meal", { required: true })}><option value="LUNCH">Lunch</option><option value="DINNER">Dinner</option></select>
              </label>
              <label><span className="label-title">Time<Req /></span>
                <input type="time" {...register("time", { required: "Time is required" })} />
                <FieldError error={errors.time} />
              </label>
              <label>Sort order<input type="number" {...register("sortOrder", { valueAsNumber: true })} /></label>
            </div>
            {save.error && <div className="form-error">{save.error.message}</div>}
            <DialogFooter onClose={() => setDialog(null)} loading={save.isPending} label={dialog === "new" ? "Add slot" : "Save changes"} />
          </form>
        </ResourceDialog>
      )}
    </main>
  );
}
