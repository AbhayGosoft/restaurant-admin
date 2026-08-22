import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import type { Stay, StayImage } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { FieldError, ImageManager, PhoneField, Req, cleanBody, normalizeCover } from "@/components/resource/dialog-kit";
import { MapPicker } from "@/components/resource/MapPicker";

type GeneralForm = {
  name: string;
  type: string;
  description: string;
  cancellationPolicy: string;
  houseRules: string;
  addressLine: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  contactNumber: string;
  website: string;
  starRating: string;
  checkInTime: string;
  checkOutTime: string;
  taxesIncluded: boolean;
  taxPercent: string;
  cancellationFeePercent: string;
  facilities: string;
};

const emptyForm: GeneralForm = {
  name: "",
  type: "HOMESTAY",
  description: "",
  cancellationPolicy: "",
  houseRules: "",
  addressLine: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "India",
  pincode: "",
  latitude: undefined,
  longitude: undefined,
  contactNumber: "",
  website: "",
  starRating: "",
  checkInTime: "12:00",
  checkOutTime: "10:00",
  taxesIncluded: false,
  taxPercent: "",
  cancellationFeePercent: "",
  facilities: "",
};

export function GeneralSettingsPage() {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const enterProperty = useAppStore((state) => state.enterProperty);
  const activeOwner = useAppStore((state) => state.activeOwner);
  const property = useQuery({ queryKey: ["property", propertyId], queryFn: () => api<Stay>(`/stays/${propertyId}`) });
  const [images, setImages] = useState<StayImage[]>([]);
  const [saved, setSaved] = useState(false);
  const { register, control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<GeneralForm>({ defaultValues: emptyForm });
  const latitude = watch("latitude");
  const longitude = watch("longitude");

  useEffect(() => {
    if (!property.data) return;
    const stay = property.data;
    reset({
      name: stay.name, type: stay.type, description: stay.description ?? "",
      cancellationPolicy: stay.cancellationPolicy ?? "", houseRules: stay.houseRules ?? "",
      addressLine: stay.addressLine,
      addressLine2: stay.addressLine2 ?? "",
      city: stay.city, state: stay.state, country: stay.country, pincode: stay.pincode,
      latitude: stay.latitude !== undefined && stay.latitude !== null ? Number(stay.latitude) : undefined,
      longitude: stay.longitude !== undefined && stay.longitude !== null ? Number(stay.longitude) : undefined,
      contactNumber: stay.contactNumber, website: stay.website ?? "", starRating: stay.starRating ? String(stay.starRating) : "",
      checkInTime: stay.checkInTime, checkOutTime: stay.checkOutTime,
      taxesIncluded: stay.taxesIncluded ?? false,
      taxPercent: stay.taxPercent !== undefined && stay.taxPercent !== null ? String(stay.taxPercent) : "",
      cancellationFeePercent: stay.cancellationFeePercent !== undefined && stay.cancellationFeePercent !== null ? String(stay.cancellationFeePercent) : "",
      facilities: (stay.facilities ?? []).join(", "),
    });
    setImages(stay.images ?? []);
  }, [property.data, reset]);

  const pickLocation = (lat: number, lng: number) => {
    setValue("latitude", lat, { shouldDirty: true });
    setValue("longitude", lng, { shouldDirty: true });
  };

  const mutation = useMutation({
    mutationFn: (data: GeneralForm) =>
      api<Stay>(`/stays/${propertyId}`, {
        method: "PATCH",
        body: cleanBody({
          ...data,
          facilities: data.facilities.split(",").map((facility) => facility.trim()).filter(Boolean),
          images: images.map(({ imageUrl, isCover }, sortOrder) => ({ imageUrl, isCover, sortOrder })),
        }),
      }),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["property", propertyId] });
      enterProperty(activeOwner, { id: updated.id, name: updated.name, type: updated.type });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  if (property.isLoading) return <LoadingGrid />;
  if (property.isError) return <StateView title="Couldn't load property" message="Check the backend connection and try once more." action={() => void property.refetch()} />;

  return (
    <form className="settings-form" noValidate onSubmit={handleSubmit((data) => mutation.mutate(data))}>
      <div className="property-form-grid">
        <div className="property-form-grid__wide"><ImageManager images={images} onChange={(next) => setImages(normalizeCover(next).map((image) => ({ ...image, isCover: Boolean(image.isCover) })))} supportsCover /></div>
        <label><span className="label-title">Property name<Req /></span>
          <input {...register("name", { required: "Property name is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
          <FieldError error={errors.name} />
        </label>
        <label>Property type<select {...register("type")}><option value="HOMESTAY">Homestay</option><option value="DHARAMSHALA">Dharamshala</option><option value="AIRBNB">Airbnb</option><option value="HOTEL">Hotel</option><option value="RESORT">Resort</option><option value="ASHRAM">Ashram</option><option value="OTHER">Other</option></select></label>
        <label className="property-form-grid__wide">Description<textarea rows={3} {...register("description")} /></label>
        <label className="property-form-grid__wide">Cancellation policy<textarea rows={3} placeholder="Describe cancellation terms for guests" {...register("cancellationPolicy")} /></label>
        <label className="property-form-grid__wide">House rules<textarea rows={3} placeholder="Describe house rules for guests" {...register("houseRules")} /></label>
        <label className="property-form-grid__wide"><span className="label-title">Address<Req /></span>
          <input {...register("addressLine", { required: "Address is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
          <FieldError error={errors.addressLine} />
        </label>
        <label className="property-form-grid__wide">Address line 2<input {...register("addressLine2")} /></label>
        <label className="property-form-grid__wide">Location on map<MapPicker latitude={latitude} longitude={longitude} onChange={pickLocation} /></label>
        <label><span className="label-title">City<Req /></span>
          <input {...register("city", { required: "City is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
          <FieldError error={errors.city} />
        </label>
        <label><span className="label-title">State<Req /></span>
          <input {...register("state", { required: "State is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
          <FieldError error={errors.state} />
        </label>
        <label><span className="label-title">Country<Req /></span>
          <input {...register("country", { required: "Country is required" })} />
          <FieldError error={errors.country} />
        </label>
        <label><span className="label-title">Pincode<Req /></span>
          <input {...register("pincode", { required: "Pincode is required", minLength: { value: 3, message: "Enter at least 3 characters" } })} />
          <FieldError error={errors.pincode} />
        </label>
        <label><span className="label-title">Contact number<Req /></span>
          <PhoneField control={control} name="contactNumber" error={errors.contactNumber} required />
        </label>
        <label>Website<input type="url" placeholder="https://example.com" {...register("website")} /></label>
        <label>Star rating<select {...register("starRating")}><option value="">Not set</option><option value="1">1 star</option><option value="2">2 star</option><option value="3">3 star</option><option value="4">4 star</option><option value="5">5 star</option></select></label>
        <label><span className="label-title">Check-in time<Req /></span>
          <input type="time" {...register("checkInTime", { required: "Check-in time is required" })} />
          <FieldError error={errors.checkInTime} />
        </label>
        <label><span className="label-title">Check-out time<Req /></span>
          <input type="time" {...register("checkOutTime", { required: "Check-out time is required" })} />
          <FieldError error={errors.checkOutTime} />
        </label>
        <label>Tax percent<input type="number" step="0.01" min="0" max="100" placeholder="e.g. 12" {...register("taxPercent")} /></label>
        <label>Cancellation fee percent<input type="number" step="0.01" min="0" max="100" {...register("cancellationFeePercent")} /></label>
        <label className="check-option"><input type="checkbox" {...register("taxesIncluded")} /><span>Prices already include tax</span></label>
        <label className="property-form-grid__wide">Facilities<input placeholder="Restaurant, Pool, Banquet Hall" {...register("facilities")} /></label>
      </div>
      {mutation.error && <div className="form-error">{mutation.error.message}</div>}
      <footer className="settings-form__footer">
        {saved && <span className="settings-saved">Saved</span>}
        <Button type="submit" loading={mutation.isPending}><Save size={17} /> Save changes</Button>
      </footer>
    </form>
  );
}
