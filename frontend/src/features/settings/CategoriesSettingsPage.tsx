import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Tags } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { FieldError, ResourceDialog, ResourceToolbar, DialogFooter, ListResponse, Req, cleanBody, listItems } from "@/components/resource/dialog-kit";

export type Category = { id: string; propertyId: string; name: string; slug: string; description?: string; isActive: boolean; _count?: { roomTypes?: number } };

const activeFilterOptions = [{ value: "", label: "All statuses" }, { value: "true", label: "Active" }, { value: "false", label: "Inactive" }];

export function CategoriesSettingsPage() {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const isAdmin = useAppStore((state) => state.user?.role === "ADMIN");
  const [dialog, setDialog] = useState<"create" | Category | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const query = useQuery({
    queryKey: ["categories", propertyId, search, activeFilter],
    queryFn: () => api<ListResponse<Category>>(`/categories?propertyId=${propertyId}${search ? `&search=${encodeURIComponent(search)}` : ""}${activeFilter ? `&isActive=${activeFilter}` : ""}`),
  });
  const categories = listItems<Category>(query.data);

  return (
    <div className="settings-section">
      <header className="settings-section__head">
        <div><h2>Categories</h2><p>Group room types under this property's backend categories.</p></div>
        {isAdmin && <Button onClick={() => setDialog("create")}><Plus size={17} /> Add category</Button>}
      </header>
      <ResourceToolbar search={search} onSearchChange={setSearch} placeholder="Search categories..." filter={activeFilter} onFilterChange={setActiveFilter} filterOptions={activeFilterOptions} onClear={() => { setSearch(""); setActiveFilter(""); }} />
      {query.isLoading ? <LoadingGrid /> : query.isError ? (
        <StateView title="Couldn't load categories" message="Check the backend connection and try once more." action={() => void query.refetch()} />
      ) : !categories.length ? (
        <StateView icon={Tags} title="No categories yet" message="Add your first category to start organizing room types." />
      ) : (
        <section className="resource-grid">
          {categories.map((category) => (
            <article className="resource-card" key={category.id}>
              <span className="card-icon"><Tags /></span>
              <div className="resource-card__body">
                <div className="resource-card__line1"><h3>{category.name}</h3><span className={`status status--${category.isActive ? "active" : "inactive"}`}>{category.isActive ? "ACTIVE" : "INACTIVE"}</span></div>
                <div className="resource-card__line2"><span>{category.description || category.slug}</span><span className="dot">-</span><span>{category._count?.roomTypes ?? 0} room types</span></div>
              </div>
              <button type="button" className="property-edit-button" aria-label={`Edit ${category.name}`} onClick={() => setDialog(category)}><Pencil size={16} /></button>
            </article>
          ))}
        </section>
      )}
      {dialog && <CategoryDialog category={dialog === "create" ? undefined : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

type CategoryForm = { name: string; slug: string; description: string; isActive: boolean };

function CategoryDialog({ category, onClose }: { category?: Category; onClose: () => void }) {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const mode = category ? "edit" : "create";
  const { register, handleSubmit, formState: { errors } } = useForm<CategoryForm>({
    defaultValues: { name: category?.name ?? "", slug: category?.slug ?? "", description: category?.description ?? "", isActive: category?.isActive ?? true },
  });
  const mutation = useMutation({
    mutationFn: (data: CategoryForm) => api<Category>(mode === "create" ? "/categories" : `/categories/${category!.id}`, { method: mode === "create" ? "POST" : "PUT", body: cleanBody({ ...data, propertyId }) }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
      onClose();
    },
  });

  return (
    <ResourceDialog title={`${mode === "create" ? "Add" : "Edit"} category`} eyebrow="Property category" onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div className="property-form-grid">
          <label><span className="label-title">Name<Req /></span>
            <input {...register("name", { required: "Category name is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
            <FieldError error={errors.name} />
          </label>
          <label>Slug
            <input placeholder="auto from name" {...register("slug", { minLength: { value: 2, message: "Enter at least 2 characters" } })} />
            <FieldError error={errors.slug} />
          </label>
          <label className="property-form-grid__wide">Description<textarea rows={3} {...register("description")} /></label>
          <div className="property-form-grid__wide room-options">
            <label className="check-option"><input type="checkbox" {...register("isActive")} /><span>Category is active</span></label>
          </div>
        </div>
        {mutation.error && <div className="form-error">{mutation.error.message}</div>}
        <DialogFooter onClose={onClose} loading={mutation.isPending} label={mode === "create" ? "Create category" : "Save category"} />
      </form>
    </ResourceDialog>
  );
}
