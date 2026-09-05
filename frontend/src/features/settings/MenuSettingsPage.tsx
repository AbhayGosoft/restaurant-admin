import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LeafyGreen, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { clsx } from "clsx";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import type { MenuCategory, MenuItem } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { DialogFooter, FieldError, ImageManager, ResourceDialog, Req, cleanBody } from "@/components/resource/dialog-kit";

type CategoryForm = { name: string; sortOrder: number };
type ItemForm = { name: string; description: string; price: number; isVeg: boolean; sortOrder: number };

export function MenuSettingsPage() {
  const restaurantId = useAppStore((state) => state.activeRestaurant!.id);
  const base = `/admin/restaurants/${restaurantId}/menu`;
  const categories = useQuery({ queryKey: ["menu-categories", restaurantId], queryFn: () => api<MenuCategory[]>(`${base}/categories`) });

  const [categoryDialog, setCategoryDialog] = useState<MenuCategory | null | "new">(null);
  const [itemDialog, setItemDialog] = useState<{ categoryId: string; item: MenuItem | null } | null>(null);
  const [itemImage, setItemImage] = useState<{ imageUrl: string; sortOrder: number }[]>([]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["menu-categories", restaurantId] });

  const saveCategory = useMutation({
    mutationFn: (data: CategoryForm) =>
      categoryDialog !== "new" && categoryDialog
        ? api(`${base}/categories/${categoryDialog.id}`, { method: "PATCH", body: cleanBody(data) })
        : api(`${base}/categories`, { method: "POST", body: cleanBody(data) }),
    onSuccess: async () => { await invalidate(); setCategoryDialog(null); },
  });

  const deactivateCategory = useMutation({
    mutationFn: (id: string) => api(`${base}/categories/${id}`, { method: "DELETE" }),
    onSuccess: () => void invalidate(),
  });

  const saveItem = useMutation({
    mutationFn: (data: ItemForm) => {
      const body = cleanBody({ ...data, image: itemImage[0]?.imageUrl });
      return itemDialog?.item
        ? api(`${base}/items/${itemDialog.item.id}`, { method: "PATCH", body })
        : api(`${base}/categories/${itemDialog!.categoryId}/items`, { method: "POST", body });
    },
    onSuccess: async () => { await invalidate(); setItemDialog(null); },
  });

  const deactivateItem = useMutation({
    mutationFn: (id: string) => api(`${base}/items/${id}`, { method: "DELETE" }),
    onSuccess: () => void invalidate(),
  });

  const categoryForm = useForm<CategoryForm>({ defaultValues: { name: categoryDialog !== "new" && categoryDialog ? categoryDialog.name : "", sortOrder: categoryDialog !== "new" && categoryDialog ? categoryDialog.sortOrder : (categories.data?.length ?? 0) } });
  const itemForm = useForm<ItemForm>({
    defaultValues: {
      name: itemDialog?.item?.name ?? "",
      description: itemDialog?.item?.description ?? "",
      price: itemDialog?.item?.price ?? 0,
      isVeg: itemDialog?.item?.isVeg ?? true,
      sortOrder: itemDialog?.item?.sortOrder ?? 0,
    },
  });

  if (categories.isLoading) return <main className="page"><LoadingGrid /></main>;
  if (categories.isError) return <main className="page"><StateView title="Couldn't load the menu" message="Check the backend connection and try once more." action={() => void categories.refetch()} /></main>;

  return (
    <main className="page">
      <section className="resource-head">
        <span className="eyebrow"><UtensilsCrossed size={14} /> Menu</span>
        <Button type="button" onClick={() => { categoryForm.reset({ name: "", sortOrder: categories.data?.length ?? 0 }); setCategoryDialog("new"); }}><Plus size={17} /> Add category</Button>
      </section>

      {!categories.data?.length && <StateView title="No menu categories yet" message="Add your first category to start building the menu." />}

      <div className="menu-category-list">
        {categories.data?.map((category) => (
          <section className="card menu-category-card" key={category.id}>
            <header className="menu-category-card__head">
              <div><strong>{category.name}</strong>{!category.isActive && <span className="badge badge--muted">Inactive</span>}</div>
              <div className="menu-category-card__actions">
                <button type="button" className="icon-button" aria-label="Edit category" onClick={() => { categoryForm.reset({ name: category.name, sortOrder: category.sortOrder }); setCategoryDialog(category); }}><Pencil size={15} /></button>
                <button type="button" className="icon-button" aria-label="Deactivate category" onClick={() => deactivateCategory.mutate(category.id)}><Trash2 size={15} /></button>
                <Button type="button" variant="secondary" onClick={() => { itemForm.reset({ name: "", description: "", price: 0, isVeg: true, sortOrder: category.items.length }); setItemImage([]); setItemDialog({ categoryId: category.id, item: null }); }}><Plus size={15} /> Add item</Button>
              </div>
            </header>
            <div className="menu-item-list">
              {category.items.map((item) => (
                <div className="menu-item-row" key={item.id}>
                  {item.image ? <img src={item.image} alt="" className="menu-item-row__image" /> : <span className="menu-item-row__image menu-item-row__image--empty"><UtensilsCrossed size={16} /></span>}
                  <div className="menu-item-row__body">
                    <strong>{item.name} <LeafyGreen size={13} className={clsx("veg-dot", item.isVeg ? "veg-dot--veg" : "veg-dot--nonveg")} /></strong>
                    <small>{item.description}</small>
                  </div>
                  <span className="menu-item-row__price">₹{item.price}</span>
                  {!item.isActive && <span className="badge badge--muted">Inactive</span>}
                  <button type="button" className="icon-button" aria-label="Edit item" onClick={() => { itemForm.reset({ name: item.name, description: item.description ?? "", price: item.price, isVeg: item.isVeg, sortOrder: item.sortOrder }); setItemImage(item.image ? [{ imageUrl: item.image, sortOrder: 0 }] : []); setItemDialog({ categoryId: category.id, item }); }}><Pencil size={14} /></button>
                  <button type="button" className="icon-button" aria-label="Deactivate item" onClick={() => deactivateItem.mutate(item.id)}><Trash2 size={14} /></button>
                </div>
              ))}
              {!category.items.length && <small className="muted">No items in this category yet.</small>}
            </div>
          </section>
        ))}
      </div>

      {categoryDialog && (
        <ResourceDialog title={categoryDialog === "new" ? "Add category" : "Edit category"} eyebrow="Menu category" onClose={() => setCategoryDialog(null)}>
          <form noValidate onSubmit={categoryForm.handleSubmit((data) => saveCategory.mutate(data))}>
            <div className="property-form-grid">
              <label className="property-form-grid__wide"><span className="label-title">Category name<Req /></span>
                <input {...categoryForm.register("name", { required: "Category name is required" })} />
                <FieldError error={categoryForm.formState.errors.name} />
              </label>
              <label>Sort order<input type="number" {...categoryForm.register("sortOrder", { valueAsNumber: true })} /></label>
            </div>
            {saveCategory.error && <div className="form-error">{saveCategory.error.message}</div>}
            <DialogFooter onClose={() => setCategoryDialog(null)} loading={saveCategory.isPending} label={categoryDialog === "new" ? "Add category" : "Save changes"} />
          </form>
        </ResourceDialog>
      )}

      {itemDialog && (
        <ResourceDialog title={itemDialog.item ? "Edit item" : "Add item"} eyebrow="Menu item" onClose={() => setItemDialog(null)}>
          <form noValidate onSubmit={itemForm.handleSubmit((data) => saveItem.mutate(data))}>
            <div className="property-form-grid">
              <div className="property-form-grid__wide"><ImageManager images={itemImage} onChange={(next) => setItemImage(next.slice(-1).map((image, sortOrder) => ({ imageUrl: image.imageUrl, sortOrder })))} /></div>
              <label className="property-form-grid__wide"><span className="label-title">Item name<Req /></span>
                <input {...itemForm.register("name", { required: "Item name is required" })} />
                <FieldError error={itemForm.formState.errors.name} />
              </label>
              <label className="property-form-grid__wide">Description<textarea rows={2} {...itemForm.register("description")} /></label>
              <label><span className="label-title">Price (₹)<Req /></span><input type="number" min={0} step="0.01" {...itemForm.register("price", { required: true, valueAsNumber: true })} /></label>
              <label>Sort order<input type="number" {...itemForm.register("sortOrder", { valueAsNumber: true })} /></label>
              <label className="check-option"><input type="checkbox" {...itemForm.register("isVeg")} /><span>Vegetarian</span></label>
            </div>
            {saveItem.error && <div className="form-error">{saveItem.error.message}</div>}
            <DialogFooter onClose={() => setItemDialog(null)} loading={saveItem.isPending} label={itemDialog.item ? "Save changes" : "Add item"} />
          </form>
        </ResourceDialog>
      )}
    </main>
  );
}
