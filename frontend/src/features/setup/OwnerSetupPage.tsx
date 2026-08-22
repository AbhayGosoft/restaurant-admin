import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, type SubmitHandler } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, ChevronLeft } from "lucide-react";
import { api } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import type { Stay } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { FieldError, ImageManager, PhoneField, type ManagedImage, Req, normalizeCover } from "@/components/resource/dialog-kit";
import { OwnersHeader, ProfileModal } from "@/features/owners/OwnersPage";

type OwnerOption = { id: string; name: string; email: string; status?: "ACTIVE" | "INACTIVE" };

type PropertyForm = {
  ownerId: string;
  name: string;
  type: string;
  description: string;
  addressLine: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  contactNumber: string;
  checkInTime: string;
  checkOutTime: string;
};

const propertyInitial: PropertyForm = {
  ownerId: "",
  name: "",
  type: "HOMESTAY",
  description: "",
  addressLine: "",
  city: "",
  state: "",
  country: "India",
  pincode: "",
  contactNumber: "",
  checkInTime: "12:00",
  checkOutTime: "10:00",
};

export function OwnerSetupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const presetOwnerId = searchParams.get("ownerId") ?? undefined;
  const enterProperty = useAppStore((state) => state.enterProperty);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="setup-page">
      <OwnersHeader onOpenProfile={() => setProfileOpen(true)} />
      <section className="setup-main">
        <div className="setup-page-head">
          <button type="button" className="context-action setup-page-head__back" onClick={() => navigate("/")}><ChevronLeft size={15} /> Back to owners</button>
          <div>
            <span className="eyebrow"><Building2 size={28} /> Admin setup</span>
            <h1>Add a new property</h1>
          </div>
        </div>
        <div className="setup-card">
          <PropertyStep
            presetOwnerId={presetOwnerId}
            onCancel={() => navigate("/")}
            onDone={(created, selectedOwner) => {
              enterProperty({ id: selectedOwner.id, name: selectedOwner.name, email: selectedOwner.email }, { id: created.id, name: created.name, type: created.type });
              navigate("/");
            }}
          />
        </div>
      </section>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

function PropertyStep({ presetOwnerId, onCancel, onDone }: { presetOwnerId?: string; onCancel: () => void; onDone: (property: Stay, owner: OwnerOption) => void }) {
  const owners = useQuery({ queryKey: ["owners"], queryFn: () => api<OwnerOption[]>("/owners") });
  const [images, setImages] = useState<ManagedImage[]>([]);
  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<PropertyForm>({ defaultValues: { ...propertyInitial, ownerId: presetOwnerId ?? "" } });
  const ownerId = watch("ownerId");
  useEffect(() => {
    if (presetOwnerId || ownerId) return;
    const firstActiveOwner = owners.data?.find((owner) => owner.status !== "INACTIVE") ?? owners.data?.[0];
    if (firstActiveOwner) setValue("ownerId", firstActiveOwner.id);
  }, [owners.data, ownerId, presetOwnerId, setValue]);
  const mutation = useMutation({
    mutationFn: (data: PropertyForm) => {
      const normalizedImages = normalizeCover(images);
      return api<Stay>("/stays", {
        method: "POST",
        body: clean({
          ...data,
          images: normalizedImages.map(({ imageUrl, isCover }, sortOrder) => ({ imageUrl, isCover: Boolean(isCover), sortOrder })),
          amenityIds: [],
        }),
      });
    },
    onSuccess: async (created, data) => {
      await queryClient.invalidateQueries({ queryKey: ["properties"] });
      const selectedOwner = owners.data?.find((item) => item.id === data.ownerId);
      if (selectedOwner) onDone(created, selectedOwner);
    },
  });
  const selectedOwnerOption = owners.data?.find((item) => item.id === presetOwnerId);
  const onSubmit: SubmitHandler<PropertyForm> = (data) => mutation.mutate(data);

  return <SetupForm
    eyebrow="Property details"
    title="Create property / stay profile"
    submit="Create property"
    loading={mutation.isPending}
    error={mutation.error?.message || (owners.error ? owners.error.message : undefined)}
    onSubmit={handleSubmit(onSubmit)}
    onCancel={onCancel}
  >
    <div className="setup-form-grid">
      {presetOwnerId ? (
        <label className="wide">Owner<input disabled value={selectedOwnerOption ? `${selectedOwnerOption.name} - ${selectedOwnerOption.email}` : "Loading..."} /></label>
      ) : (
        <label className="wide"><span className="label-title">Owner<Req /></span>
          <select {...register("ownerId", { required: "Select an owner" })}><option value="">Select owner</option>{owners.data?.map((owner) => <option key={owner.id} value={owner.id}>{owner.name} - {owner.email}</option>)}</select>
          <FieldError error={errors.ownerId} />
        </label>
      )}
    </div>
    <div className="setup-form-grid_images">
      <div className="wide"><ImageManager images={images} onChange={(next) => setImages(normalizeCover(next))} supportsCover /></div>
    </div>
    <div className="setup-form-grid">
      <label><span className="label-title">Name<Req /></span><input {...register("name", { required: "Name is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} /><FieldError error={errors.name} /></label>
      <label>Type<select {...register("type")}><option value="HOMESTAY">Homestay</option><option value="DHARAMSHALA">Dharamshala</option><option value="AIRBNB">Airbnb</option><option value="HOTEL">Hotel</option><option value="RESORT">Resort</option><option value="ASHRAM">Ashram</option><option value="OTHER">Other</option></select></label>
      <label className="wide">Description<textarea rows={3} {...register("description")} /></label>
      <label className="wide"><span className="label-title">Address<Req /></span><input {...register("addressLine", { required: "Address is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} /><FieldError error={errors.addressLine} /></label>
      <label><span className="label-title">City<Req /></span><input {...register("city", { required: "City is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} /><FieldError error={errors.city} /></label>
      <label><span className="label-title">State<Req /></span><input {...register("state", { required: "State is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} /><FieldError error={errors.state} /></label>
      <label><span className="label-title">Country<Req /></span><input {...register("country", { required: "Country is required" })} /><FieldError error={errors.country} /></label>
      <label><span className="label-title">Pincode<Req /></span><input {...register("pincode", { required: "Pincode is required", minLength: { value: 3, message: "Enter at least 3 characters" } })} /><FieldError error={errors.pincode} /></label>
      <label><span className="label-title">Contact number<Req /></span><PhoneField control={control} name="contactNumber" error={errors.contactNumber} required /></label>
      <label><span className="label-title">Check-in time<Req /></span><input type="time" {...register("checkInTime", { required: "Check-in time is required" })} /><FieldError error={errors.checkInTime} /></label>
      <label><span className="label-title">Check-out time<Req /></span><input type="time" {...register("checkOutTime", { required: "Check-out time is required" })} /><FieldError error={errors.checkOutTime} /></label>
    </div>
  </SetupForm>;
}

function SetupForm({ eyebrow, title, submit, loading, error, onSubmit, onCancel, children }: { eyebrow: string; title: string; submit: string; loading: boolean; error?: string; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void; children: React.ReactNode }) {
  return <form noValidate onSubmit={onSubmit}>
    <span className="eyebrow">{eyebrow}</span>
    <h2>{title}</h2>
    {children}
    {error && <div className="form-error">{error}</div>}
    <footer>
      <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button type="submit" loading={loading}>{submit} <ArrowRight size={17} /></Button>
    </footer>
  </form>;
}

function clean<T extends Record<string, unknown>>(body: T) {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== "" && value !== undefined && value !== null && !(typeof value === "number" && Number.isNaN(value))));
}
