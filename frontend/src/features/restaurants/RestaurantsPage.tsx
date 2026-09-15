import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, MapPin, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { api, resolveAssetUrl } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import type { Restaurant } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { DialogFooter, FieldError, PhoneField, ResourceDialog, ResourceToolbar, Req, cleanBody } from "@/components/resource/dialog-kit";

type CreateForm = {
  name: string; cuisineLabel: string; addressLine: string; city: string; phone: string;
  latitude: number; longitude: number; prepTimeMin: number; prepTimeMax: number;
  priceForTwo: number; seatingCapacity: number; maxPartySize: number;
};

const emptyForm: CreateForm = {
  name: "", cuisineLabel: "", addressLine: "", city: "", phone: "",
  latitude: 0, longitude: 0, prepTimeMin: 20, prepTimeMax: 35,
  priceForTwo: 300, seatingCapacity: 40, maxPartySize: 12,
};

export function RestaurantsPage() {
  const navigate = useNavigate();
  const enterRestaurant = useAppStore((state) => state.enterRestaurant);
  const isSuperAdmin = useAppStore((state) => state.admin?.role === "SUPERADMIN");
  const selectedAdmin = useAppStore((state) => state.selectedAdmin);
  const exitAdminSelection = useAppStore((state) => state.exitAdminSelection);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const restaurants = useQuery({
    queryKey: ["admin-restaurants", search, selectedAdmin?.id ?? "self"],
    queryFn: () =>
      api<{ restaurants: Restaurant[] }>(
        `/admin/restaurants?${new URLSearchParams({
          ...(search ? { search } : {}),
          ...(selectedAdmin ? { adminId: selectedAdmin.id } : {}),
          limit: "100",
        })}`,
      ),
  });

  // If this admin manages exactly one restaurant, skip the picker entirely and go
  // straight into it — the list would otherwise be a pointless extra click.
  useEffect(() => {
    if (!search && restaurants.data?.restaurants.length === 1) {
      const [only] = restaurants.data.restaurants;
      enterRestaurant({ id: only.id, name: only.name, banner: only.banner });
    }
  }, [search, restaurants.data, enterRestaurant]);

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<CreateForm>({ defaultValues: emptyForm });

  const create = useMutation({
    mutationFn: (data: CreateForm) =>
      api<Restaurant>("/admin/restaurants", {
        method: "POST",
        body: cleanBody(selectedAdmin ? { ...data, adminId: selectedAdmin.id } : data),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-restaurants"] });
      reset(emptyForm);
      setDialogOpen(false);
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api(`/admin/restaurants/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-restaurants"] }),
  });

  const enter = (restaurant: Restaurant) => {
    enterRestaurant({ id: restaurant.id, name: restaurant.name, banner: restaurant.banner });
    navigate("/");
  };

  return (
    <main className="page">
      {selectedAdmin && (
        <Button type="button" variant="ghost" onClick={() => { exitAdminSelection(); navigate("/"); }}>
          <ArrowLeft size={14} /> Back to admins
        </Button>
      )}
      <section className="resource-head">
        <span className="eyebrow">
          <UtensilsCrossed size={14} /> {selectedAdmin ? `${selectedAdmin.name}'s restaurants` : "Restaurants"}
        </span>
        <Button type="button" onClick={() => { reset(emptyForm); setDialogOpen(true); }}><Plus size={17} /> Add restaurant</Button>
      </section>

      <ResourceToolbar search={search} onSearchChange={setSearch} placeholder="Search restaurants..." />

      {restaurants.isLoading && <LoadingGrid />}
      {restaurants.isError && <StateView title="Couldn't load restaurants" message="Check the backend connection and try once more." action={() => void restaurants.refetch()} />}
      {restaurants.isSuccess && !restaurants.data.restaurants.length && (
        <StateView
          title="No restaurants yet"
          message={
            selectedAdmin
              ? `${selectedAdmin.name} hasn't been assigned to any restaurant yet.`
              : isSuperAdmin
                ? "Add the first restaurant to get started."
                : "You haven't been assigned to any restaurant yet. Contact your SuperAdmin."
          }
        />
      )}

      <div className="card-grid">
        {restaurants.data?.restaurants.map((restaurant) => (
          <button type="button" className="card restaurant-picker-card" key={restaurant.id} onClick={() => enter(restaurant)}>
            {restaurant.banner ? <img src={resolveAssetUrl(restaurant.banner)} alt="" /> : <span className="restaurant-picker-card__placeholder"><UtensilsCrossed /></span>}
            <div className="restaurant-picker-card__body">
              <strong>{restaurant.name}</strong>
              <small>{restaurant.cuisineLabel}</small>
              <small className="muted"><MapPin size={12} /> {restaurant.city}</small>
            </div>
            <ArrowRight size={18} />
            {isSuperAdmin && (
              <span
                role="button"
                tabIndex={0}
                className="icon-button restaurant-picker-card__delete"
                aria-label="Deactivate restaurant"
                onClick={(event) => { event.stopPropagation(); deactivate.mutate(restaurant.id); }}
              >
                <Trash2 size={14} />
              </span>
            )}
          </button>
        ))}
      </div>

      {dialogOpen && (
        <ResourceDialog title="Add restaurant" eyebrow="New restaurant" onClose={() => setDialogOpen(false)}>
          <form noValidate onSubmit={handleSubmit((data) => create.mutate(data))}>
            <div className="property-form-grid">
              <label className="property-form-grid__wide"><span className="label-title">Restaurant name<Req /></span>
                <input {...register("name", { required: "Name is required" })} />
                <FieldError error={errors.name} />
              </label>
              <label className="property-form-grid__wide"><span className="label-title">Cuisine label<Req /></span>
                <input placeholder="Pure Veg • North Indian" {...register("cuisineLabel", { required: "Cuisine label is required" })} />
                <FieldError error={errors.cuisineLabel} />
              </label>
              <label className="property-form-grid__wide"><span className="label-title">Address<Req /></span>
                <input {...register("addressLine", { required: "Address is required" })} />
                <FieldError error={errors.addressLine} />
              </label>
              <label><span className="label-title">City<Req /></span><input {...register("city", { required: "City is required" })} /><FieldError error={errors.city} /></label>
              <label><span className="label-title">Phone<Req /></span><PhoneField control={control} name="phone" error={errors.phone} required /></label>
              <label><span className="label-title">Latitude<Req /></span><input type="number" step="0.0000001" {...register("latitude", { required: true, valueAsNumber: true })} /></label>
              <label><span className="label-title">Longitude<Req /></span><input type="number" step="0.0000001" {...register("longitude", { required: true, valueAsNumber: true })} /></label>
              <label>Prep time min<input type="number" {...register("prepTimeMin", { valueAsNumber: true })} /></label>
              <label>Prep time max<input type="number" {...register("prepTimeMax", { valueAsNumber: true })} /></label>
              <label>Price for two (₹)<input type="number" {...register("priceForTwo", { valueAsNumber: true })} /></label>
              <label>Seating capacity<input type="number" {...register("seatingCapacity", { valueAsNumber: true })} /></label>
              <label>Max party size<input type="number" {...register("maxPartySize", { valueAsNumber: true })} /></label>
            </div>
            {create.error && <div className="form-error">{create.error.message}</div>}
            <DialogFooter onClose={() => setDialogOpen(false)} loading={create.isPending} label="Add restaurant" />
          </form>
        </ResourceDialog>
      )}
    </main>
  );
}
