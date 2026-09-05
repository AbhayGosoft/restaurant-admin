import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import type { RestaurantCategory } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { DialogFooter, FieldError, ResourceDialog, Req, cleanBody } from "@/components/resource/dialog-kit";

type CategoryForm = { label: string; sortOrder: number; isActive: boolean };

export function CategoriesSettingsPage() {
  const categories = useQuery({ queryKey: ["restaurant-categories"], queryFn: () => api<RestaurantCategory[]>("/admin/categories") });
  const [dialog, setDialog] = useState<RestaurantCategory | "new" | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CategoryForm>({ defaultValues: { label: "", sortOrder: 0, isActive: true } });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["restaurant-categories"] });

  const save = useMutation({
    mutationFn: (data: CategoryForm) =>
      dialog !== "new" && dialog
        ? api(`/admin/categories/${dialog.id}`, { method: "PATCH", body: cleanBody(data) })
        : api("/admin/categories", { method: "POST", body: cleanBody(data) }),
    onSuccess: async () => { await invalidate(); setDialog(null); },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api(`/admin/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => void invalidate(),
  });

  const openNew = () => { reset({ label: "", sortOrder: categories.data?.length ?? 0, isActive: true }); setDialog("new"); };
  const openEdit = (category: RestaurantCategory) => { reset({ label: category.label, sortOrder: category.sortOrder, isActive: category.isActive }); setDialog(category); };

  if (categories.isLoading) return <LoadingGrid />;
  if (categories.isError) return <StateView title="Couldn't load categories" message="Check the backend connection and try once more." action={() => void categories.refetch()} />;

  return (
    <div>
      <section className="resource-head">
        <span className="eyebrow"><Tags size={14} /> Restaurant categories</span>
        <Button type="button" onClick={openNew}><Plus size={17} /> Add category</Button>
      </section>
      <div className="card-grid">
        {categories.data?.map((category) => (
          <div className="card" key={category.id}>
            <div className="menu-category-card__head">
              <div><strong>{category.label}</strong> <small className="muted">({category.key})</small>{!category.isActive && <span className="badge badge--muted">Inactive</span>}</div>
              <div className="menu-category-card__actions">
                <button type="button" className="icon-button" aria-label="Edit category" onClick={() => openEdit(category)}><Pencil size={15} /></button>
                <button type="button" className="icon-button" aria-label="Deactivate category" onClick={() => deactivate.mutate(category.id)}><Trash2 size={15} /></button>
              </div>
            </div>
          </div>
        ))}
        {!categories.data?.length && <StateView title="No categories yet" message="Add categories restaurants can be tagged with, e.g. Pure Veg, North Indian." />}
      </div>

      {dialog && (
        <ResourceDialog title={dialog === "new" ? "Add category" : "Edit category"} eyebrow="Restaurant category" onClose={() => setDialog(null)}>
          <form noValidate onSubmit={handleSubmit((data) => save.mutate(data))}>
            <div className="property-form-grid">
              <label className="property-form-grid__wide"><span className="label-title">Label<Req /></span>
                <input placeholder="e.g. North Indian" {...register("label", { required: "Label is required" })} />
                <FieldError error={errors.label} />
              </label>
              <label>Sort order<input type="number" {...register("sortOrder", { valueAsNumber: true })} /></label>
              <label className="check-option"><input type="checkbox" {...register("isActive")} /><span>Active</span></label>
            </div>
            {save.error && <div className="form-error">{save.error.message}</div>}
            <DialogFooter onClose={() => setDialog(null)} loading={save.isPending} label={dialog === "new" ? "Add category" : "Save changes"} />
          </form>
        </ResourceDialog>
      )}
    </div>
  );
}
