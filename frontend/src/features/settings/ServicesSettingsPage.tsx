import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Utensils } from "lucide-react";
import { api, resolveAssetUrl } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import { currency } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { FieldError, ResourceDialog, ResourceToolbar, DialogFooter, CheckboxList, ImageManager, ManagedImage, ListResponse, Req, cleanBody, listItems } from "@/components/resource/dialog-kit";
import type { RoomTypeOption } from "./RoomTypesSettingsPage";

const availabilityFilterOptions = [{ value: "", label: "All statuses" }, { value: "true", label: "Available" }, { value: "false", label: "Unavailable" }];

export type Service = {
  id: string;
  propertyId: string;
  title: string;
  description?: string;
  price: number | string;
  priceType?: "PER_STAY" | "PER_GUEST" | "PER_ROOM";
  gstType: "NONE" | "GST_5" | "GST_12" | "GST_18";
  isMandatory?: boolean;
  quantityAllowed?: number | null;
  availableDays?: string[];
  validFrom?: string | null;
  validTo?: string | null;
  images?: string[];
  isAvailable: boolean;
  _count?: { roomTypes?: number; ratePlans?: number };
  roomTypes?: { roomType: RoomTypeOption }[];
};

const toDateInputValue = (value?: string | null) => (value ? value.slice(0, 10) : "");

const dayOptions = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

export function ServicesSettingsPage() {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const isAdmin = useAppStore((state) => state.user?.role === "ADMIN");
  const [dialog, setDialog] = useState<"create" | Service | null>(null);
  const [search, setSearch] = useState("");
  const [availableFilter, setAvailableFilter] = useState("");
  const query = useQuery({
    queryKey: ["services", propertyId, search, availableFilter],
    queryFn: () => api<ListResponse<Service>>(`/services?propertyId=${propertyId}${search ? `&search=${encodeURIComponent(search)}` : ""}${availableFilter ? `&isAvailable=${availableFilter}` : ""}`),
  });
  const services = listItems<Service>(query.data);

  return (
    <div className="settings-section">
      <header className="settings-section__head">
        <div><h2>Services</h2><p>Add extras that can be sold alongside rooms at this property.</p></div>
        {isAdmin && <Button onClick={() => setDialog("create")}><Plus size={17} /> Add service</Button>}
      </header>
      <ResourceToolbar search={search} onSearchChange={setSearch} placeholder="Search services..." filter={availableFilter} onFilterChange={setAvailableFilter} filterOptions={availabilityFilterOptions} onClear={() => { setSearch(""); setAvailableFilter(""); }} />
      {query.isLoading ? <LoadingGrid /> : query.isError ? (
        <StateView title="Couldn't load services" message="Check the backend connection and try once more." action={() => void query.refetch()} />
      ) : !services.length ? (
        <StateView icon={Utensils} title="No services yet" message="Add a service to offer it alongside bookings." />
      ) : (
        <section className="resource-grid">
          {services.map((service) => {
            const cover = resolveAssetUrl(service.images?.[0]);
            return (
              <article className="resource-card room-card" key={service.id}>
                <span className="resource-thumb">{cover ? <img src={cover} alt="" /> : <Utensils />}</span>
                <div className="resource-card__body">
                  <div className="resource-card__line1"><h3>{service.title}</h3><span className={`status status--${service.isAvailable ? "active" : "inactive"}`}>{service.isAvailable ? "AVAILABLE" : "INACTIVE"}</span></div>
                  <div className="resource-card__line2"><span>{service.description || "Extra service"}</span><span className="dot">•</span><span>{service._count?.roomTypes ?? 0} room types</span></div>
                </div>
                <strong className="resource-card__value">{currency.format(Number(service.price))}</strong>
                <button type="button" className="property-edit-button" aria-label={`Edit ${service.title}`} onClick={() => setDialog(service)}><Pencil size={16} /></button>
              </article>
            );
          })}
        </section>
      )}
      {dialog && <ServiceDialog service={dialog === "create" ? undefined : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

type ServiceForm = {
  title: string;
  description: string;
  price: number;
  priceType: "PER_STAY" | "PER_GUEST" | "PER_ROOM";
  gstType: "NONE" | "GST_5" | "GST_12" | "GST_18";
  isMandatory: boolean;
  quantityAllowed?: number;
  validFrom: string;
  validTo: string;
  isAvailable: boolean;
};

function ServiceDialog({ service, onClose }: { service?: Service; onClose: () => void }) {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const mode = service ? "edit" : "create";
  const roomTypes = useQuery({ queryKey: ["room-types", propertyId], queryFn: () => api<ListResponse<RoomTypeOption>>(`/room-types?propertyId=${propertyId}`) });
  const detail = useQuery({ queryKey: ["service", service?.id], queryFn: () => api<Service>(`/services/${service!.id}`), enabled: mode === "edit" });
  const [images, setImages] = useState<ManagedImage[]>((service?.images ?? []).map((imageUrl, sortOrder) => ({ imageUrl, sortOrder })));
  const [roomTypeIds, setRoomTypeIds] = useState<string[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<ServiceForm>({
    defaultValues: {
      title: service?.title ?? "", description: service?.description ?? "", price: service?.price === undefined ? 0 : Number(service.price),
      priceType: service?.priceType ?? "PER_STAY", gstType: service?.gstType ?? "NONE",
      isMandatory: service?.isMandatory ?? false, quantityAllowed: service?.quantityAllowed ?? undefined,
      validFrom: toDateInputValue(service?.validFrom), validTo: toDateInputValue(service?.validTo),
      isAvailable: service?.isAvailable ?? true,
    },
  });
  useEffect(() => {
    if (!detail.data) return;
    reset({
      title: detail.data.title, description: detail.data.description ?? "", price: Number(detail.data.price),
      priceType: detail.data.priceType ?? "PER_STAY", gstType: detail.data.gstType,
      isMandatory: detail.data.isMandatory ?? false, quantityAllowed: detail.data.quantityAllowed ?? undefined,
      validFrom: toDateInputValue(detail.data.validFrom), validTo: toDateInputValue(detail.data.validTo),
      isAvailable: detail.data.isAvailable,
    });
    setRoomTypeIds(detail.data.roomTypes?.map(({ roomType }) => roomType.id) ?? []);
    setAvailableDays(detail.data.availableDays ?? []);
    setImages((detail.data.images ?? []).map((imageUrl, sortOrder) => ({ imageUrl, sortOrder })));
  }, [detail.data, reset]);
  const availableRoomTypes = listItems<RoomTypeOption>(roomTypes.data);
  const mutation = useMutation({
    mutationFn: (data: ServiceForm) => api<Service>(mode === "create" ? "/services" : `/services/${service!.id}`, { method: mode === "create" ? "POST" : "PUT", body: cleanBody({ ...data, propertyId, images: images.map((image) => image.imageUrl), roomTypeIds, availableDays }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["services"] });
      onClose();
    },
  });
  const toggleDay = (day: string) => setAvailableDays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day]));

  return (
    <ResourceDialog title={`${mode === "create" ? "Add" : "Edit"} service`} eyebrow="Extra service" onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div className="property-form-grid">
          <div className="property-form-grid__wide"><ImageManager images={images} onChange={setImages} /></div>
          <label><span className="label-title">Title<Req /></span>
            <input {...register("title", { required: "Title is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
            <FieldError error={errors.title} />
          </label>
          <label><span className="label-title">Price<Req /></span>
            <input step="0.01" type="number" {...register("price", { required: "Price is required", valueAsNumber: true, min: { value: 0, message: "Must be 0 or more" } })} />
            <FieldError error={errors.price} />
          </label>
          <label>GST<select {...register("gstType")}><option value="NONE">None</option><option value="GST_5">GST 5%</option><option value="GST_12">GST 12%</option><option value="GST_18">GST 18%</option></select></label>
          <label>Price type<select {...register("priceType")}><option value="PER_STAY">Per stay</option><option value="PER_GUEST">Per guest</option><option value="PER_ROOM">Per room</option></select></label>
          <label>Quantity allowed<input type="number" min="1" placeholder="Blank = unlimited" {...register("quantityAllowed", { valueAsNumber: true, min: { value: 1, message: "Must be at least 1" } })} /><FieldError error={errors.quantityAllowed} /></label>
          <label className="property-form-grid__wide">Description<textarea rows={3} {...register("description")} /></label>
          <label>Valid from<input type="date" {...register("validFrom")} /></label>
          <label>Valid to<input type="date" {...register("validTo")} /></label>
          <div className="property-form-grid__wide choice-panel">
            <strong>Available days</strong>
            {dayOptions.map((day) => (
              <label className="check-option" key={day.value}>
                <input type="checkbox" checked={availableDays.includes(day.value)} onChange={() => toggleDay(day.value)} />
                <span>{day.label}</span>
              </label>
            ))}
          </div>
          <CheckboxList title="Room types" items={availableRoomTypes.map((item) => ({ id: item.id, label: item.name }))} selected={roomTypeIds} onChange={setRoomTypeIds} />
          <div className="property-form-grid__wide room-options">
            <label className="check-option"><input type="checkbox" {...register("isMandatory")} /><span>Mandatory service</span></label>
            <label className="check-option"><input type="checkbox" {...register("isAvailable")} /><span>Service is available</span></label>
          </div>
        </div>
        {mutation.error && <div className="form-error">{mutation.error.message}</div>}
        <DialogFooter onClose={onClose} loading={mutation.isPending} label={mode === "create" ? "Create service" : "Save service"} />
      </form>
    </ResourceDialog>
  );
}
