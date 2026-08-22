import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil, Percent, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { DialogFooter, FieldError, ListResponse, Req, ResourceDialog, ResourceToolbar, cleanBody, listItems } from "@/components/resource/dialog-kit";

type TaxType = "GST" | "SERVICE_TAX" | "OTHER";

export type PropertyTax = {
  id: string;
  propertyId: string;
  name: string;
  type: TaxType;
  percentage: number | string;
  description?: string;
  isActive: boolean;
};

type TaxForm = {
  name: string;
  type: TaxType;
  percentage: number;
  description: string;
  isActive: boolean;
};

const typeFilterOptions = [
  { value: "", label: "All tax types" },
  { value: "GST", label: "GST" },
  { value: "SERVICE_TAX", label: "Service tax" },
  { value: "OTHER", label: "Other" },
];

const taxTypeLabels: Record<TaxType, string> = {
  GST: "GST",
  SERVICE_TAX: "Service tax",
  OTHER: "Other",
};

export function TaxesSettingsPage() {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const [dialog, setDialog] = useState<"create" | PropertyTax | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const query = useQuery({
    queryKey: ["taxes", propertyId, search, typeFilter],
    queryFn: () => api<ListResponse<PropertyTax>>(`/taxes?propertyId=${propertyId}${search ? `&search=${encodeURIComponent(search)}` : ""}${typeFilter ? `&type=${typeFilter}` : ""}`),
  });
  const taxes = listItems<PropertyTax>(query.data);

  return (
    <div className="settings-section">
      <header className="settings-section__head">
        <div><h2>Taxes</h2><p>Create and manage tax rules for this property.</p></div>
        <Button onClick={() => setDialog("create")}><Plus size={17} /> Add tax</Button>
      </header>
      <ResourceToolbar search={search} onSearchChange={setSearch} placeholder="Search taxes..." filter={typeFilter} onFilterChange={setTypeFilter} filterOptions={typeFilterOptions} onClear={() => { setSearch(""); setTypeFilter(""); }} />
      {query.isLoading ? <LoadingGrid /> : query.isError ? (
        <StateView title="Couldn't load taxes" message="Check the backend connection and try once more." action={() => void query.refetch()} />
      ) : !taxes.length ? (
        <StateView icon={Percent} title="No taxes yet" message="Add tax rules for this property." />
      ) : (
        <section className="resource-grid">
          {taxes.map((tax) => <TaxCard key={tax.id} tax={tax} onEdit={() => setDialog(tax)} />)}
        </section>
      )}
      {dialog && <TaxDialog tax={dialog === "create" ? undefined : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function TaxCard({ tax, onEdit }: { tax: PropertyTax; onEdit: () => void }) {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const remove = useMutation({
    mutationFn: () => api<void>(`/taxes/${tax.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["taxes", propertyId] });
    },
  });

  return (
    <article className="resource-card">
      <span className="resource-thumb"><Percent /></span>
      <div className="resource-card__body">
        <div className="resource-card__line1"><h3>{tax.name}</h3><span className={`status status--${tax.isActive ? "active" : "inactive"}`}>{tax.isActive ? "ACTIVE" : "INACTIVE"}</span></div>
        <div className="resource-card__line2"><span>{taxTypeLabels[tax.type]}</span><span className="dot">-</span><span>{tax.description || "No description"}</span></div>
      </div>
      <strong className="resource-card__value">{Number(tax.percentage).toFixed(2)}%<small>rate</small></strong>
      <button type="button" className="property-edit-button" aria-label={`Edit ${tax.name}`} onClick={onEdit}><Pencil size={16} /></button>
      <button type="button" className="property-edit-button property-edit-button--danger" aria-label={`Delete ${tax.name}`} disabled={remove.isPending} onClick={() => remove.mutate()}><Trash2 size={16} /></button>
    </article>
  );
}

function TaxDialog({ tax, onClose }: { tax?: PropertyTax; onClose: () => void }) {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const mode = tax ? "edit" : "create";
  const { register, handleSubmit, formState: { errors } } = useForm<TaxForm>({
    defaultValues: {
      name: tax?.name ?? "",
      type: tax?.type ?? "GST",
      percentage: tax?.percentage === undefined ? 0 : Number(tax.percentage),
      description: tax?.description ?? "",
      isActive: tax?.isActive ?? true,
    },
  });
  const mutation = useMutation({
    mutationFn: (data: TaxForm) => api<PropertyTax>(mode === "create" ? "/taxes" : `/taxes/${tax!.id}`, {
      method: mode === "create" ? "POST" : "PUT",
      body: cleanBody({ ...data, propertyId }, mode === "edit" ? ["propertyId"] : []),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["taxes", propertyId] });
      onClose();
    },
  });

  return (
    <ResourceDialog title={`${mode === "create" ? "Add" : "Edit"} tax`} eyebrow="Tax rule" onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div className="property-form-grid">
          <label><span className="label-title">Name<Req /></span>
            <input placeholder="e.g. GST 12%" {...register("name", { required: "Name is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
            <FieldError error={errors.name} />
          </label>
          <label>Type<select {...register("type")}><option value="GST">GST</option><option value="SERVICE_TAX">Service tax</option><option value="OTHER">Other</option></select></label>
          <label><span className="label-title">Percentage<Req /></span>
            <input type="number" step="0.01" min={0} max={100} {...register("percentage", { required: "Percentage is required", valueAsNumber: true, min: { value: 0, message: "Must be 0 or more" }, max: { value: 100, message: "Cannot exceed 100" } })} />
            <FieldError error={errors.percentage} />
          </label>
          <label className="property-form-grid__wide">Description<textarea rows={3} {...register("description")} /></label>
          <div className="property-form-grid__wide room-options">
            <label className="check-option"><input type="checkbox" {...register("isActive")} /><span>Tax is active</span></label>
          </div>
        </div>
        {mutation.error && <div className="form-error">{mutation.error.message}</div>}
        <DialogFooter onClose={onClose} loading={mutation.isPending} label={mode === "create" ? "Create tax" : "Save tax"} />
      </form>
    </ResourceDialog>
  );
}
