import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { DialogFooter, FieldError, ListResponse, Req, ResourceDialog, ResourceToolbar, cleanBody, listItems } from "@/components/resource/dialog-kit";

type PolicyType = "CANCELLATION" | "HOUSE_RULE";

type PropertyPolicy = {
  id: string;
  propertyId: string;
  type: PolicyType;
  title: string;
  content: string;
  isActive: boolean;
};

type PolicyForm = {
  type: PolicyType;
  title: string;
  content: string;
  isActive: boolean;
};

const policyTypeFilterOptions = [
  { value: "", label: "All policy types" },
  { value: "CANCELLATION", label: "Cancellation" },
  { value: "HOUSE_RULE", label: "House rules" },
];

const policyTypeLabels: Record<PolicyType, string> = {
  CANCELLATION: "Cancellation",
  HOUSE_RULE: "House rules",
};

export function PoliciesSettingsPage() {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const [dialog, setDialog] = useState<"create" | PropertyPolicy | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const query = useQuery({
    queryKey: ["policies", propertyId, search, typeFilter],
    queryFn: () => api<ListResponse<PropertyPolicy>>(`/policies?propertyId=${propertyId}${search ? `&search=${encodeURIComponent(search)}` : ""}${typeFilter ? `&type=${typeFilter}` : ""}`),
  });
  const policies = listItems<PropertyPolicy>(query.data);

  return (
    <div className="settings-section">
      <header className="settings-section__head">
        <div><h2>Policies</h2><p>Create cancellation policies and house rules shown for this property.</p></div>
        <Button onClick={() => setDialog("create")}><Plus size={17} /> Add policy</Button>
      </header>
      <ResourceToolbar search={search} onSearchChange={setSearch} placeholder="Search policies..." filter={typeFilter} onFilterChange={setTypeFilter} filterOptions={policyTypeFilterOptions} onClear={() => { setSearch(""); setTypeFilter(""); }} />
      {query.isLoading ? <LoadingGrid /> : query.isError ? (
        <StateView title="Couldn't load policies" message="Check the backend connection and try once more." action={() => void query.refetch()} />
      ) : !policies.length ? (
        <StateView icon={ShieldCheck} title="No policies yet" message="Add cancellation policies or house rules for this property." />
      ) : (
        <section className="resource-grid">
          {policies.map((policy) => <PolicyCard key={policy.id} policy={policy} onEdit={() => setDialog(policy)} />)}
        </section>
      )}
      {dialog && <PolicyDialog policy={dialog === "create" ? undefined : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function PolicyCard({ policy, onEdit }: { policy: PropertyPolicy; onEdit: () => void }) {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const remove = useMutation({
    mutationFn: () => api<void>(`/policies/${policy.id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["policies", propertyId] });
    },
  });

  return (
    <article className="resource-card">
      <span className="resource-thumb"><ShieldCheck /></span>
      <div className="resource-card__body">
        <div className="resource-card__line1"><h3>{policy.title}</h3><span className={`status status--${policy.isActive ? "active" : "inactive"}`}>{policy.isActive ? "ACTIVE" : "INACTIVE"}</span></div>
        <div className="resource-card__line2"><span>{policyTypeLabels[policy.type]}</span><span className="dot">-</span><span>{policy.content}</span></div>
      </div>
      <button type="button" className="property-edit-button" aria-label={`Edit ${policy.title}`} onClick={onEdit}><Pencil size={16} /></button>
      <button type="button" className="property-edit-button property-edit-button--danger" aria-label={`Delete ${policy.title}`} disabled={remove.isPending} onClick={() => remove.mutate()}><Trash2 size={16} /></button>
    </article>
  );
}

function PolicyDialog({ policy, onClose }: { policy?: PropertyPolicy; onClose: () => void }) {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const mode = policy ? "edit" : "create";
  const { register, handleSubmit, formState: { errors } } = useForm<PolicyForm>({
    defaultValues: {
      type: policy?.type ?? "CANCELLATION",
      title: policy?.title ?? "",
      content: policy?.content ?? "",
      isActive: policy?.isActive ?? true,
    },
  });
  const mutation = useMutation({
    mutationFn: (data: PolicyForm) => api<PropertyPolicy>(mode === "create" ? "/policies" : `/policies/${policy!.id}`, {
      method: mode === "create" ? "POST" : "PUT",
      body: cleanBody({ ...data, propertyId }, mode === "edit" ? ["propertyId"] : []),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["policies", propertyId] });
      onClose();
    },
  });

  return (
    <ResourceDialog title={`${mode === "create" ? "Add" : "Edit"} policy`} eyebrow="Guest policy" onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div className="property-form-grid">
          <label>Type<select {...register("type")}><option value="CANCELLATION">Cancellation</option><option value="HOUSE_RULE">House rules</option></select></label>
          <label><span className="label-title">Title<Req /></span>
            <input placeholder="e.g. Free cancellation" {...register("title", { required: "Title is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
            <FieldError error={errors.title} />
          </label>
          <label className="property-form-grid__wide"><span className="label-title">Policy text<Req /></span>
            <textarea rows={5} placeholder="Write the policy guests should see..." {...register("content", { required: "Policy text is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
            <FieldError error={errors.content} />
          </label>
          <div className="property-form-grid__wide room-options">
            <label className="check-option"><input type="checkbox" {...register("isActive")} /><span>Policy is active</span></label>
          </div>
        </div>
        {mutation.error && <div className="form-error">{mutation.error.message}</div>}
        <DialogFooter onClose={onClose} loading={mutation.isPending} label={mode === "create" ? "Create policy" : "Save policy"} />
      </form>
    </ResourceDialog>
  );
}
