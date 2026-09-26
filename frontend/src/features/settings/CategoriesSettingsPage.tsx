import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import type { HardDeleteResult, RestaurantCategory } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { ConfirmDialog, DialogFooter, FieldError, Notice, ResourceDialog, Req, StatusTabs, cleanBody, hardDeleteMessage, type ListStatus } from "@/components/resource/dialog-kit";

type CategoryForm = { label: string; sortOrder: number; isActive: boolean };

export function CategoriesSettingsPage() {
  const categories = useQuery({ queryKey: ["restaurant-categories"], queryFn: () => api<RestaurantCategory[]>("/admin/categories") });
  const [dialog, setDialog] = useState<RestaurantCategory | "new" | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<RestaurantCategory | null>(null);
  const [view, setView] = useState<ListStatus>("active");
  const [notice, setNotice] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CategoryForm>({ defaultValues: { label: "", sortOrder: 0, isActive: true } });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["restaurant-categories"] });

  const save = useMutation({
    mutationFn: (data: CategoryForm) =>
      dialog !== "new" && dialog
        ? api(`/admin/categories/${dialog.id}`, { method: "PATCH", body: cleanBody(data) })
        : api("/admin/categories", { method: "POST", body: cleanBody(data) }),
    onSuccess: async () => { await invalidate(); setDialog(null); },
  });

  const remove = useMutation({
    mutationFn: (category: RestaurantCategory) => api<HardDeleteResult>(`/admin/categories/${category.id}/permanent`, { method: "DELETE" }),
    onSuccess: (result, category) => { setNotice(hardDeleteMessage(category.label, result)); setCategoryToDelete(null); void invalidate(); },
  });

  const openNew = () => { reset({ label: "", sortOrder: categories.data?.length ?? 0, isActive: true }); setDialog("new"); };
  const openEdit = (category: RestaurantCategory) => { reset({ label: category.label, sortOrder: category.sortOrder, isActive: category.isActive }); setDialog(category); };

  if (categories.isLoading) return <LoadingGrid />;
  if (categories.isError) return <StateView title="Couldn't load categories" message="Check the backend connection and try once more." action={() => void categories.refetch()} />;

  const active = (categories.data ?? []).filter((category) => category.isActive);
  const inactive = (categories.data ?? []).filter((category) => !category.isActive);
  const visible = view === "active" ? active : inactive;

  return (
    <div>
      <section className="resource-head">
        <span className="eyebrow"><Tags size={14} /> Restaurant categories</span>
        <Button type="button" onClick={openNew}><Plus size={17} /> Add category</Button>
      </section>
      <StatusTabs value={view} onChange={setView} activeCount={active.length} inactiveCount={inactive.length} />
      {notice && <Notice message={notice} onClose={() => setNotice("")} />}
      <div className="card-grid">
        {visible.map((category) => (
          <div className="card" key={category.id}>
            <div className="menu-category-card__head">
              <div><strong>{category.label}</strong> <small className="muted">({category.key})</small></div>
              <div className="menu-category-card__actions">
                <button type="button" className="icon-button" aria-label="Edit category" onClick={() => openEdit(category)}><Pencil size={15} /></button>
                <button type="button" className="icon-button icon-button--danger" aria-label="Delete category permanently" title="Delete permanently" onClick={() => { remove.reset(); setCategoryToDelete(category); }}><Trash2 size={15} /></button>
              </div>
            </div>
          </div>
        ))}
        {!visible.length && (view === "active"
          ? <StateView title="No active categories" message="Add categories restaurants can be tagged with, e.g. Pure Veg, North Indian." />
          : <StateView title="No deactivated categories" message="Categories marked inactive in the edit form show up here." />)}
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
      {categoryToDelete && <ConfirmDialog title="Delete category permanently?" message={`${categoryToDelete.label} will be removed from every restaurant. This cannot be undone.`} confirmLabel="Delete permanently" danger loading={remove.isPending} error={remove.error?.message} onClose={() => setCategoryToDelete(null)} onConfirm={() => remove.mutate(categoryToDelete)} />}
    </div>
  );
}
