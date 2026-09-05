import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import type { Restaurant, RestaurantCategory } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { CheckboxList, FieldError, ImageManager, PhoneField, Req, cleanBody, normalizeCover } from "@/components/resource/dialog-kit";

type GeneralForm = {
  name: string;
  cuisineLabel: string;
  isPureVeg: boolean;
  prepTimeMin: number;
  prepTimeMax: number;
  priceForTwo: number;
  offerText: string;
  offerSubText: string;
  about: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  latitude: number;
  longitude: number;
  phone: string;
  seatingCapacity: number;
  maxPartySize: number;
};

const emptyForm: GeneralForm = {
  name: "", cuisineLabel: "", isPureVeg: false, prepTimeMin: 20, prepTimeMax: 35,
  priceForTwo: 0, offerText: "", offerSubText: "", about: "", addressLine: "",
  city: "", state: "", country: "India", pincode: "", latitude: 0, longitude: 0,
  phone: "", seatingCapacity: 40, maxPartySize: 12,
};

export function GeneralSettingsPage() {
  const restaurantId = useAppStore((state) => state.activeRestaurant!.id);
  const enterRestaurant = useAppStore((state) => state.enterRestaurant);
  const restaurant = useQuery({ queryKey: ["admin-restaurant", restaurantId], queryFn: () => api<Restaurant>(`/admin/restaurants/${restaurantId}`) });
  const categories = useQuery({ queryKey: ["restaurant-categories"], queryFn: () => api<RestaurantCategory[]>("/admin/categories") });
  const [banner, setBanner] = useState<{ imageUrl: string; sortOrder: number }[]>([]);
  const [gallery, setGallery] = useState<{ imageUrl: string; sortOrder: number }[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<GeneralForm>({ defaultValues: emptyForm });

  useEffect(() => {
    if (!restaurant.data) return;
    const r = restaurant.data;
    reset({
      name: r.name, cuisineLabel: r.cuisineLabel, isPureVeg: r.isPureVeg,
      prepTimeMin: r.prepTimeMin, prepTimeMax: r.prepTimeMax, priceForTwo: r.priceForTwo,
      offerText: r.offerText ?? "", offerSubText: r.offerSubText ?? "", about: r.about ?? "",
      addressLine: r.addressLine ?? r.address?.line ?? "",
      city: r.city ?? r.address?.city ?? "",
      state: r.state ?? r.address?.state ?? "",
      country: r.country ?? r.address?.country ?? "India",
      pincode: r.pincode ?? r.address?.pincode ?? "",
      latitude: r.latitude, longitude: r.longitude, phone: r.phone,
      seatingCapacity: r.seatingCapacity ?? 40, maxPartySize: r.maxPartySize,
    });
    setBanner(r.banner ? [{ imageUrl: r.banner, sortOrder: 0 }] : []);
    setGallery(r.gallery.map((imageUrl, sortOrder) => ({ imageUrl, sortOrder })));
  }, [restaurant.data, reset]);

  useEffect(() => {
    if (!restaurant.data || !categories.data) return;
    const keySet = new Set(restaurant.data.categories);
    setSelectedCategoryIds(categories.data.filter((category) => keySet.has(category.key)).map((category) => category.id));
  }, [restaurant.data, categories.data]);

  const mutation = useMutation({
    mutationFn: (data: GeneralForm) =>
      api<Restaurant>(`/admin/restaurants/${restaurantId}`, {
        method: "PATCH",
        body: cleanBody({
          ...data,
          banner: banner[0]?.imageUrl,
          gallery: gallery.map((image) => image.imageUrl),
          categoryIds: selectedCategoryIds,
        }),
      }),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-restaurant", restaurantId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-restaurants"] });
      enterRestaurant({ id: updated.id, name: updated.name, banner: updated.banner });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (restaurant.isLoading) return <LoadingGrid />;
  if (restaurant.isError) return <StateView title="Couldn't load restaurant" message="Check the backend connection and try once more." action={() => void restaurant.refetch()} />;

  return (
    <form className="settings-form" noValidate onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <div className="property-form-grid">
        <div className="property-form-grid__wide">
          <span className="label-title">Banner image</span>
          <ImageManager images={banner} onChange={(next) => setBanner(next.slice(-1).map((image, sortOrder) => ({ imageUrl: image.imageUrl, sortOrder })))} />
        </div>
        <div className="property-form-grid__wide">
          <span className="label-title">Gallery images</span>
          <ImageManager images={gallery} onChange={(next) => setGallery(normalizeCover(next, false))} />
        </div>
        <label><span className="label-title">Restaurant name<Req /></span>
          <input {...register("name", { required: "Restaurant name is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
          <FieldError error={errors.name} />
        </label>
        <label><span className="label-title">Cuisine label<Req /></span>
          <input placeholder="Pure Veg • North Indian • Chinese" {...register("cuisineLabel", { required: "Cuisine label is required" })} />
          <FieldError error={errors.cuisineLabel} />
        </label>
        <label className="check-option"><input type="checkbox" {...register("isPureVeg")} /><span>Pure vegetarian restaurant</span></label>
        {categories.data && (
          <CheckboxList title="Categories" items={categories.data.map((c) => ({ id: c.id, label: c.label }))} selected={selectedCategoryIds} onChange={setSelectedCategoryIds} />
        )}
        <label className="property-form-grid__wide">About<textarea rows={3} {...register("about")} /></label>
        <label><span className="label-title">Prep time min (mins)<Req /></span><input type="number" min={0} {...register("prepTimeMin", { required: true, valueAsNumber: true })} /></label>
        <label><span className="label-title">Prep time max (mins)<Req /></span><input type="number" min={0} {...register("prepTimeMax", { required: true, valueAsNumber: true })} /></label>
        <label><span className="label-title">Price for two (₹)<Req /></span><input type="number" min={0} {...register("priceForTwo", { required: true, valueAsNumber: true })} /></label>
        <label>Offer text<input placeholder="50% OFF" {...register("offerText")} /></label>
        <label>Offer sub text<input placeholder="up to ₹100 on first order" {...register("offerSubText")} /></label>
        <label className="property-form-grid__wide"><span className="label-title">Address<Req /></span>
          <input {...register("addressLine", { required: "Address is required" })} />
          <FieldError error={errors.addressLine} />
        </label>
        <label><span className="label-title">City<Req /></span><input {...register("city", { required: "City is required" })} /><FieldError error={errors.city} /></label>
        <label>State<input {...register("state")} /></label>
        <label><span className="label-title">Country<Req /></span><input {...register("country", { required: "Country is required" })} /></label>
        <label>Pincode<input {...register("pincode")} /></label>
        <label><span className="label-title">Latitude<Req /></span><input type="number" step="0.0000001" {...register("latitude", { required: true, valueAsNumber: true, min: -90, max: 90 })} /></label>
        <label><span className="label-title">Longitude<Req /></span><input type="number" step="0.0000001" {...register("longitude", { required: true, valueAsNumber: true, min: -180, max: 180 })} /></label>
        <label><span className="label-title">Phone<Req /></span><PhoneField control={control} name="phone" error={errors.phone} required /></label>
        <label><span className="label-title">Seating capacity<Req /></span><input type="number" min={1} {...register("seatingCapacity", { required: true, valueAsNumber: true })} /></label>
        <label><span className="label-title">Max party size<Req /></span><input type="number" min={1} {...register("maxPartySize", { required: true, valueAsNumber: true })} /></label>
      </div>
      {mutation.error && <div className="form-error">{mutation.error.message}</div>}
      <footer className="settings-form__footer">
        {saved && <span className="settings-saved">Saved</span>}
        <Button type="submit" loading={mutation.isPending}><Save size={17} /> Save changes</Button>
      </footer>
    </form>
  );
}
