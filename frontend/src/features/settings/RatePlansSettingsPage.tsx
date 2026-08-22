import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { IndianRupee, Pencil, Plus } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import { currency } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { FieldError, ResourceDialog, ResourceToolbar, DialogFooter, CheckboxList, ListResponse, Req, cleanBody, listItems } from "@/components/resource/dialog-kit";
import type { RoomTypeOption } from "./RoomTypesSettingsPage";
import type { Service } from "./ServicesSettingsPage";

const activeFilterOptions = [{ value: "", label: "All statuses" }, { value: "true", label: "Active" }, { value: "false", label: "Inactive" }];

export type RatePlan = {
  id: string;
  propertyId: string;
  name: string;
  description?: string;
  amountType: "FLAT" | "PERCENTAGE";
  amountValue: number | string;
  applicability: "ALL" | "SPECIFIC_DAYS" | "DATE_RANGE" | "SPECIFIC_MONTHS" | "SPECIFIC_YEARS";
  startDate?: string;
  endDate?: string;
  isRefundable?: boolean;
  mealPlan?: "ROOM_ONLY" | "BREAKFAST" | "HALF_BOARD" | "FULL_BOARD" | "ALL_INCLUSIVE";
  freeCancellation?: boolean;
  payAtHotel?: boolean;
  advancePaymentPercent?: number | string;
  cancellationPolicy?: string;
  isActive: boolean;
  _count?: { roomTypes?: number; services?: number };
  roomTypes?: { roomType: RoomTypeOption }[];
  services?: { service: Service }[];
};

export function RatePlansSettingsPage() {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const isAdmin = useAppStore((state) => state.user?.role === "ADMIN");
  const [dialog, setDialog] = useState<"create" | RatePlan | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const query = useQuery({
    queryKey: ["rate-plans", propertyId, search, activeFilter],
    queryFn: () => api<ListResponse<RatePlan>>(`/rate-plans?propertyId=${propertyId}${search ? `&search=${encodeURIComponent(search)}` : ""}${activeFilter ? `&isActive=${activeFilter}` : ""}`),
  });
  const ratePlans = listItems<RatePlan>(query.data);

  return (
    <div className="settings-section">
      <header className="settings-section__head">
        <div><h2>Rate plans</h2><p>Create seasonal and promotional pricing rules for this property.</p></div>
        {isAdmin && <Button onClick={() => setDialog("create")}><Plus size={17} /> Add rate plan</Button>}
      </header>
      <ResourceToolbar search={search} onSearchChange={setSearch} placeholder="Search rate plans..." filter={activeFilter} onFilterChange={setActiveFilter} filterOptions={activeFilterOptions} onClear={() => { setSearch(""); setActiveFilter(""); }} />
      {query.isLoading ? <LoadingGrid /> : query.isError ? (
        <StateView title="Couldn't load rate plans" message="Check the backend connection and try once more." action={() => void query.refetch()} />
      ) : !ratePlans.length ? (
        <StateView icon={IndianRupee} title="No rate plans yet" message="Add a rate plan to start adjusting prices." />
      ) : (
        <section className="resource-grid">
          {ratePlans.map((plan) => (
            <article className="resource-card" key={plan.id}>
              <span className="card-icon"><IndianRupee /></span>
              <div className="resource-card__body">
                <div className="resource-card__line1"><h3>{plan.name}</h3><span className={`status status--${plan.isActive ? "active" : "inactive"}`}>{plan.isActive ? "ACTIVE" : "INACTIVE"}</span></div>
                <div className="resource-card__line2"><span>{plan.description || plan.applicability.replaceAll("_", " ")}</span><span className="dot">•</span><span>{plan._count?.roomTypes ?? 0} room types</span><span className="dot">•</span><span>{plan._count?.services ?? 0} services</span></div>
              </div>
              <strong className="resource-card__value">{plan.amountType === "PERCENTAGE" ? `${plan.amountValue}%` : currency.format(Number(plan.amountValue))}</strong>
              <button type="button" className="property-edit-button" aria-label={`Edit ${plan.name}`} onClick={() => setDialog(plan)}><Pencil size={16} /></button>
            </article>
          ))}
        </section>
      )}
      {dialog && <RatePlanDialog ratePlan={dialog === "create" ? undefined : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

type RatePlanForm = {
  name: string;
  description: string;
  amountType: "FLAT" | "PERCENTAGE";
  amountValue: number;
  applicability: "ALL" | "SPECIFIC_DAYS" | "DATE_RANGE" | "SPECIFIC_MONTHS" | "SPECIFIC_YEARS";
  startDate: string;
  endDate: string;
  isRefundable: boolean;
  mealPlan: "ROOM_ONLY" | "BREAKFAST" | "HALF_BOARD" | "FULL_BOARD" | "ALL_INCLUSIVE";
  freeCancellation: boolean;
  payAtHotel: boolean;
  advancePaymentPercent: number;
  cancellationPolicy: string;
  isActive: boolean;
};

function RatePlanDialog({ ratePlan, onClose }: { ratePlan?: RatePlan; onClose: () => void }) {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const mode = ratePlan ? "edit" : "create";
  const services = useQuery({ queryKey: ["services", propertyId], queryFn: () => api<ListResponse<Service>>(`/services?propertyId=${propertyId}`) });
  const roomTypes = useQuery({ queryKey: ["room-types", propertyId], queryFn: () => api<ListResponse<RoomTypeOption>>(`/room-types?propertyId=${propertyId}`) });
  const detail = useQuery({
    queryKey: ["rate-plan", ratePlan?.id],
    queryFn: () => api<RatePlan>(`/rate-plans/${ratePlan!.id}`),
    enabled: mode === "edit",
    staleTime: 0,
    refetchOnMount: "always",
  });
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<RatePlanForm>({
    defaultValues: {
      name: ratePlan?.name ?? "", description: ratePlan?.description ?? "", amountType: ratePlan?.amountType ?? "FLAT", amountValue: ratePlan?.amountValue === undefined ? undefined : Number(ratePlan.amountValue), applicability: ratePlan?.applicability ?? "ALL", startDate: ratePlan?.startDate?.slice(0, 10) ?? "", endDate: ratePlan?.endDate?.slice(0, 10) ?? "",
      isRefundable: ratePlan?.isRefundable ?? true, mealPlan: ratePlan?.mealPlan ?? "ROOM_ONLY", freeCancellation: ratePlan?.freeCancellation ?? false, payAtHotel: ratePlan?.payAtHotel ?? false,
      advancePaymentPercent: ratePlan?.advancePaymentPercent === undefined || ratePlan?.advancePaymentPercent === null ? 0 : Number(ratePlan.advancePaymentPercent),
      cancellationPolicy: ratePlan?.cancellationPolicy ?? "",
      isActive: ratePlan?.isActive ?? true,
    },
  });
  const [roomTypeIds, setRoomTypeIds] = useState<string[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  useEffect(() => {
    if (!detail.data) return;
    reset({
      name: detail.data.name, description: detail.data.description ?? "", amountType: detail.data.amountType, amountValue: Number(detail.data.amountValue), applicability: detail.data.applicability, startDate: detail.data.startDate?.slice(0, 10) ?? "", endDate: detail.data.endDate?.slice(0, 10) ?? "",
      isRefundable: detail.data.isRefundable ?? true, mealPlan: detail.data.mealPlan ?? "ROOM_ONLY", freeCancellation: detail.data.freeCancellation ?? false, payAtHotel: detail.data.payAtHotel ?? false,
      advancePaymentPercent: detail.data.advancePaymentPercent === undefined || detail.data.advancePaymentPercent === null ? 0 : Number(detail.data.advancePaymentPercent),
      cancellationPolicy: detail.data.cancellationPolicy ?? "",
      isActive: detail.data.isActive,
    });
    setRoomTypeIds(detail.data.roomTypes?.map(({ roomType }) => roomType.id) ?? []);
    setServiceIds(detail.data.services?.map(({ service }) => service.id) ?? []);
  }, [detail.data, reset]);
  const availableRoomTypes = listItems<RoomTypeOption>(roomTypes.data);
  const availableServices = listItems<Service>(services.data);
  const amountType = watch("amountType");
  const applicability = watch("applicability");
  const mutation = useMutation({
    mutationFn: (data: RatePlanForm) => api<RatePlan>(mode === "create" ? "/rate-plans" : `/rate-plans/${ratePlan!.id}`, { method: mode === "create" ? "POST" : "PUT", body: cleanBody({ ...data, propertyId, roomTypeIds, serviceIds }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rate-plans"] });
      if (ratePlan?.id) await queryClient.invalidateQueries({ queryKey: ["rate-plan", ratePlan.id] });
      onClose();
    },
  });

  return (
    <ResourceDialog title={`${mode === "create" ? "Add" : "Edit"} rate plan`} eyebrow="Pricing rule" onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div className="property-form-grid">
          <label><span className="label-title">Name<Req /></span>
            <input {...register("name", { required: "Name is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
            <FieldError error={errors.name} />
          </label>
          <label>Adjustment<select {...register("amountType")}><option value="FLAT">Flat amount</option><option value="PERCENTAGE">Percentage</option></select></label>
          <label><span className="label-title">Value<Req /></span>
            <input step="0.01" type="number" {...register("amountValue", { required: "Value is required", valueAsNumber: true, min: { value: 0, message: "Must be 0 or more" }, max: amountType === "PERCENTAGE" ? { value: 100, message: "Percentage cannot exceed 100" } : undefined })} />
            <FieldError error={errors.amountValue} />
          </label>
          <label>Applies when<select {...register("applicability")}><option value="ALL">Always</option><option value="DATE_RANGE">Date range</option><option value="SPECIFIC_DAYS">Specific days</option><option value="SPECIFIC_MONTHS">Specific months</option><option value="SPECIFIC_YEARS">Specific years</option></select></label>
          {applicability === "DATE_RANGE" && <>
            <label><span className="label-title">Start date<Req /></span><DateInput {...register("startDate", { required: "Start date is required" })} /><FieldError error={errors.startDate} /></label>
            <label><span className="label-title">End date<Req /></span><DateInput {...register("endDate", { required: "End date is required" })} /><FieldError error={errors.endDate} /></label>
          </>}
          <label>Meal plan<select {...register("mealPlan")}><option value="ROOM_ONLY">Room only</option><option value="BREAKFAST">Breakfast included</option><option value="HALF_BOARD">Half board</option><option value="FULL_BOARD">Full board</option><option value="ALL_INCLUSIVE">All inclusive</option></select></label>
          <label>Advance payment percent<input step="0.01" type="number" min="0" max="100" {...register("advancePaymentPercent", { valueAsNumber: true, min: { value: 0, message: "Must be 0 or more" }, max: { value: 100, message: "Cannot exceed 100" } })} /><FieldError error={errors.advancePaymentPercent} /></label>
          <label className="property-form-grid__wide">Description<textarea rows={3} {...register("description")} /></label>
          <label className="property-form-grid__wide">Cancellation policy<textarea rows={3} placeholder="Leave blank to use the property's own cancellation policy" {...register("cancellationPolicy")} /></label>
          <CheckboxList title="Room types" items={availableRoomTypes.map((item) => ({ id: item.id, label: item.name }))} selected={roomTypeIds} onChange={setRoomTypeIds} />
          <CheckboxList title="Services" items={availableServices.map((item) => ({ id: item.id, label: item.title }))} selected={serviceIds} onChange={setServiceIds} />
          <div className="property-form-grid__wide room-options">
            <label className="check-option"><input type="checkbox" {...register("isRefundable")} /><span>Refundable</span></label>
            <label className="check-option"><input type="checkbox" {...register("freeCancellation")} /><span>Free cancellation</span></label>
            <label className="check-option"><input type="checkbox" {...register("payAtHotel")} /><span>Pay at hotel</span></label>
            <label className="check-option"><input type="checkbox" {...register("isActive")} /><span>Rate plan is active</span></label>
          </div>
        </div>
        {mutation.error && <div className="form-error">{mutation.error.message}</div>}
        <DialogFooter onClose={onClose} loading={mutation.isPending} label={mode === "create" ? "Create rate plan" : "Save rate plan"} />
      </form>
    </ResourceDialog>
  );
}
