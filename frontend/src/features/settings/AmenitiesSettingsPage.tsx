import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import type { Stay } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { FieldError, ResourceDialog, ResourceToolbar, DialogFooter, Req, cleanBody } from "@/components/resource/dialog-kit";

type Amenity = { id: string; name: string; icon?: string; appliesTo: "STAY" | "ROOM" | "BOTH" };

const appliesToFilterOptions = [{ value: "", label: "All types" }, { value: "ROOM", label: "Rooms only" }, { value: "STAY", label: "Properties only" }, { value: "BOTH", label: "Rooms and properties" }];

export function AmenitiesSettingsPage() {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const isAdmin = useAppStore((state) => state.user?.role === "ADMIN");
  const [dialog, setDialog] = useState<"create" | Amenity | null>(null);
  const [search, setSearch] = useState("");
  const [appliesToFilter, setAppliesToFilter] = useState("");
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const catalog = useQuery({ queryKey: ["amenities"], queryFn: () => api<Amenity[]>("/amenities") });
  const property = useQuery({ queryKey: ["property", propertyId], queryFn: () => api<Stay>(`/stays/${propertyId}`) });
  const propertyAmenityIds = (property.data as (Stay & { amenities?: { amenity: Amenity }[] }) | undefined)?.amenities?.map(({ amenity }) => amenity.id) ?? [];
  useEffect(() => {
    if (property.data) setAssignedIds(propertyAmenityIds);
  }, [property.dataUpdatedAt]);
  const assigned = new Set(assignedIds);
  const filteredCatalog = (catalog.data ?? []).filter((amenity) =>
    (!appliesToFilter || amenity.appliesTo === appliesToFilter) && amenity.name.toLowerCase().includes(search.toLowerCase()));

  const assign = useMutation({
    mutationFn: (amenityIds: string[]) => api<Stay>(`/stays/${propertyId}`, { method: "PATCH", body: { amenityIds } }),
    onMutate: async (amenityIds) => {
      await queryClient.cancelQueries({ queryKey: ["property", propertyId] });
      setAssignedIds(amenityIds);
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(["property", propertyId], updated);
      await queryClient.invalidateQueries({ queryKey: ["property", propertyId] });
    },
    onError: () => setAssignedIds(propertyAmenityIds),
  });
  const toggle = (amenityId: string) => {
    const current = assignedIds;
    assign.mutate(current.includes(amenityId) ? current.filter((id) => id !== amenityId) : [...current, amenityId]);
  };

  const removeAmenity = useMutation({
    mutationFn: (amenityId: string) => api<void>(`/amenities/${amenityId}`, { method: "DELETE" }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["amenities"] }); },
  });

  return (
    <div className="settings-section">
      <header className="settings-section__head">
        <div><h2>Amenities</h2><p>Choose which amenities this property offers. {isAdmin && "Admins can also manage the shared amenity catalog."}</p></div>
        {isAdmin && <Button onClick={() => setDialog("create")}><Plus size={17} /> Add to catalog</Button>}
      </header>
      <ResourceToolbar search={search} onSearchChange={setSearch} placeholder="Search amenities..." filter={appliesToFilter} onFilterChange={setAppliesToFilter} filterOptions={appliesToFilterOptions} onClear={() => { setSearch(""); setAppliesToFilter(""); }} />
      {catalog.isLoading || property.isLoading ? <LoadingGrid /> : catalog.isError || property.isError ? (
        <StateView title="Couldn't load amenities" message="Check the backend connection and try once more." action={() => { void catalog.refetch(); void property.refetch(); }} />
      ) : !catalog.data?.length ? (
        <StateView icon={Sparkles} title="No amenities in the catalog yet" message="Ask an admin to add amenities to the shared catalog." />
      ) : !filteredCatalog.length ? (
        <StateView icon={Sparkles} title="No amenities match" message="Try a different search term or filter." />
      ) : (
        <section className="resource-grid">
          {filteredCatalog.map((amenity) => (
            <article className={`resource-card amenity-card ${assigned.has(amenity.id) ? "amenity-card--selected" : ""}`} key={amenity.id} role="button" tabIndex={0} onClick={() => toggle(amenity.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") toggle(amenity.id); }}>
              <span className="card-icon">{amenity.icon || <Sparkles />}</span>
              <div className="resource-card__body">
                <div className="resource-card__line1"><h3>{amenity.name}</h3><span className={`status status--${assigned.has(amenity.id) ? "active" : "inactive"}`}>{assigned.has(amenity.id) ? "ENABLED" : "OFF"}</span></div>
                <div className="resource-card__line2"><span>{amenity.appliesTo === "BOTH" ? "Available for rooms and property" : `Available for ${amenity.appliesTo.toLowerCase()} records`}</span></div>
              </div>
              {isAdmin && (
                <span className="card-actions" onClick={(event) => event.stopPropagation()}>
                  <button type="button" className="property-edit-button" aria-label={`Edit ${amenity.name}`} onClick={() => setDialog(amenity)}><Pencil size={16} /></button>
                  <button type="button" className="property-edit-button property-edit-button--danger" aria-label={`Delete ${amenity.name}`} onClick={() => { if (window.confirm(`Delete ${amenity.name} from the catalog?`)) removeAmenity.mutate(amenity.id); }} disabled={removeAmenity.isPending}><Trash2 size={16} /></button>
                </span>
              )}
            </article>
          ))}
        </section>
      )}
      {assign.error && <div className="form-error">{assign.error.message}</div>}
      {dialog && <AmenityDialog mode={dialog === "create" ? "create" : "edit"} amenity={dialog === "create" ? undefined : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

type AmenityForm = { name: string; icon: string; appliesTo: "STAY" | "ROOM" | "BOTH" };

function AmenityDialog({ mode, amenity, onClose }: { mode: "create" | "edit"; amenity?: Amenity; onClose: () => void }) {
  const { register, handleSubmit, formState: { errors } } = useForm<AmenityForm>({
    defaultValues: { name: amenity?.name ?? "", icon: amenity?.icon ?? "", appliesTo: amenity?.appliesTo ?? "BOTH" },
  });
  const mutation = useMutation({
    mutationFn: (data: AmenityForm) => api<Amenity>(mode === "create" ? "/amenities" : `/amenities/${amenity!.id}`, { method: mode === "create" ? "POST" : "PUT", body: cleanBody(data) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["amenities"] });
      onClose();
    },
  });

  return (
    <ResourceDialog title={`${mode === "create" ? "Add" : "Edit"} amenity`} eyebrow="Shared amenity catalog" onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div className="property-form-grid">
          <label><span className="label-title">Name<Req /></span>
            <input {...register("name", { required: "Name is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
            <FieldError error={errors.name} />
          </label>
          <label>Icon label<input placeholder="wifi, pool, parking" {...register("icon")} /></label>
          <label className="property-form-grid__wide">Applies to<select {...register("appliesTo")}><option value="BOTH">Rooms and properties</option><option value="ROOM">Rooms only</option><option value="STAY">Properties only</option></select></label>
        </div>
        {mutation.error && <div className="form-error">{mutation.error.message}</div>}
        <DialogFooter onClose={onClose} loading={mutation.isPending} label={mode === "create" ? "Create amenity" : "Save changes"} />
      </form>
    </ResourceDialog>
  );
}
