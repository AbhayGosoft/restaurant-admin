import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil, Plus, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import type { AdminUser, Restaurant } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { CheckboxList, DialogFooter, FieldError, ResourceDialog, Req, cleanBody } from "@/components/resource/dialog-kit";

type AdminForm = { name: string; email: string; password: string; role: "ADMIN" | "SUPERADMIN" };

export function AdminsPage() {
  const admins = useQuery({ queryKey: ["admins"], queryFn: () => api<AdminUser[]>("/admin/admins") });
  const restaurants = useQuery({ queryKey: ["admin-restaurants", ""], queryFn: () => api<{ restaurants: Restaurant[] }>("/admin/restaurants?limit=200") });
  const [dialog, setDialog] = useState<AdminUser | "new" | null>(null);
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState<string[]>([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AdminForm>({ defaultValues: { name: "", email: "", password: "", role: "ADMIN" } });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admins"] });

  const save = useMutation({
    mutationFn: (data: AdminForm) => {
      const body = cleanBody({ ...data, restaurantIds: selectedRestaurantIds });
      return dialog !== "new" && dialog
        ? api(`/admin/admins/${dialog.id}`, { method: "PATCH", body })
        : api("/admin/admins", { method: "POST", body });
    },
    onSuccess: async () => { await invalidate(); setDialog(null); },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api(`/admin/admins/${id}`, { method: "DELETE" }),
    onSuccess: () => void invalidate(),
  });

  const openNew = () => { reset({ name: "", email: "", password: "", role: "ADMIN" }); setSelectedRestaurantIds([]); setDialog("new"); };
  const openEdit = (admin: AdminUser) => {
    reset({ name: admin.name, email: admin.email, password: "", role: admin.role });
    setSelectedRestaurantIds((admin.restaurants ?? []).map((r) => r.restaurant.id));
    setDialog(admin);
  };

  if (admins.isLoading) return <main className="page"><LoadingGrid /></main>;
  if (admins.isError) return <main className="page"><StateView title="Couldn't load admins" message="Check the backend connection and try once more." action={() => void admins.refetch()} /></main>;

  return (
    <main className="page">
      <section className="resource-head">
        <span className="eyebrow"><UserCog size={14} /> Admins</span>
        <Button type="button" onClick={openNew}><Plus size={17} /> Add admin</Button>
      </section>

      <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Restaurants</th><th>Status</th><th /></tr></thead>
          <tbody>
            {admins.data?.map((admin) => (
              <tr key={admin.id}>
                <td>{admin.name}</td>
                <td>{admin.email}</td>
                <td>{admin.role === "SUPERADMIN" ? <span className="badge"><ShieldCheck size={12} /> SuperAdmin</span> : "Admin"}</td>
                <td>{(admin.restaurants ?? []).map((r) => r.restaurant.name).join(", ") || "—"}</td>
                <td><span className={`badge badge--${admin.status.toLowerCase()}`}>{admin.status}</span></td>
                <td>
                  <button type="button" className="icon-button" aria-label="Edit admin" onClick={() => openEdit(admin)}><Pencil size={15} /></button>
                  <button type="button" className="icon-button" aria-label="Deactivate admin" onClick={() => deactivate.mutate(admin.id)}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dialog && (
        <ResourceDialog title={dialog === "new" ? "Add admin" : "Edit admin"} eyebrow="Admin account" onClose={() => setDialog(null)}>
          <form noValidate onSubmit={handleSubmit((data) => save.mutate(data))}>
            <div className="property-form-grid">
              <label><span className="label-title">Name<Req /></span><input {...register("name", { required: "Name is required" })} /><FieldError error={errors.name} /></label>
              <label><span className="label-title">Email<Req /></span><input type="email" disabled={dialog !== "new"} {...register("email", { required: "Email is required" })} /><FieldError error={errors.email} /></label>
              <label><span className="label-title">{dialog === "new" ? <>Password<Req /></> : "New password (optional)"}</span>
                <PasswordInput placeholder={dialog === "new" ? "Set a password" : "Leave blank to keep current password"} {...register("password", { required: dialog === "new" ? "Password is required" : false, minLength: { value: 8, message: "Use at least 8 characters" } })} />
                <FieldError error={errors.password} />
              </label>
              <label>Role<select {...register("role")}><option value="ADMIN">Admin</option><option value="SUPERADMIN">SuperAdmin</option></select></label>
              {restaurants.data && (
                <CheckboxList title="Assigned restaurants" items={restaurants.data.restaurants.map((r) => ({ id: r.id, label: r.name }))} selected={selectedRestaurantIds} onChange={setSelectedRestaurantIds} />
              )}
            </div>
            {save.error && <div className="form-error">{save.error.message}</div>}
            <DialogFooter onClose={() => setDialog(null)} loading={save.isPending} label={dialog === "new" ? "Add admin" : "Save changes"} />
          </form>
        </ResourceDialog>
      )}
    </main>
  );
}
