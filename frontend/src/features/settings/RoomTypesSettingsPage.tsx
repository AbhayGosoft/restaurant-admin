import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Layers3, Pencil, Plus } from "lucide-react";
import { api, resolveAssetUrl } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import { currency } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import type { PropertyTax } from "@/features/settings/TaxesSettingsPage";
import { FieldError, ResourceDialog, ResourceToolbar, DialogFooter, CheckboxList, ImageManager, ListResponse, ManagedImage, Req, cleanBody, listItems, normalizeCover } from "@/components/resource/dialog-kit";
import type { Category } from "./CategoriesSettingsPage";

type AmenityOption = { id: string; name: string; appliesTo: "STAY" | "ROOM" | "BOTH" };

export type RoomTypeOption = {
  id: string;
  propertyId: string;
  categoryId?: string;
  name: string;
  slug?: string;
  description?: string;
  overview?: string;
  keyFeatures?: string[];
  pricePerNight?: number | string;
  capacity?: number;
  maxAdults?: number;
  maxChildren?: number;
  taxId?: string | null;
  tax?: Pick<PropertyTax, "id" | "name" | "percentage" | "type"> | null;
  smokingAllowed?: boolean;
  sizeSqFt?: number | string;
  bedType?: string;
  acType?: string;
  floor?: string;
  view?: string;
  attachedBathroom?: boolean;
  featuredImage?: string;
  galleryImages?: string[];
  isActive?: boolean;
  category?: { name: string };
  amenities?: { amenity: { id: string; name: string } }[];
  _count?: { rooms?: number; services?: number; ratePlans?: number };
};

const activeFilterOptions = [{ value: "", label: "All statuses" }, { value: "true", label: "Active" }, { value: "false", label: "Inactive" }];

export function RoomTypesSettingsPage() {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const isAdmin = useAppStore((state) => state.user?.role === "ADMIN");
  const [dialog, setDialog] = useState<"create" | RoomTypeOption | null>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const query = useQuery({
    queryKey: ["room-types", propertyId, search, activeFilter],
    queryFn: () => api<ListResponse<RoomTypeOption>>(`/room-types?propertyId=${propertyId}${search ? `&search=${encodeURIComponent(search)}` : ""}${activeFilter ? `&isActive=${activeFilter}` : ""}`),
  });
  const roomTypes = listItems<RoomTypeOption>(query.data);

  return (
    <div className="settings-section">
      <header className="settings-section__head">
        <div><h2>Room types</h2><p>Define sellable room products with capacity, tax and base pricing.</p></div>
        {isAdmin && <Button onClick={() => setDialog("create")}><Plus size={17} /> Add room type</Button>}
      </header>
      <ResourceToolbar search={search} onSearchChange={setSearch} placeholder="Search room types..." filter={activeFilter} onFilterChange={setActiveFilter} filterOptions={activeFilterOptions} onClear={() => { setSearch(""); setActiveFilter(""); }} />
      {query.isLoading ? <LoadingGrid /> : query.isError ? (
        <StateView title="Couldn't load room types" message="Check the backend connection and try once more." action={() => void query.refetch()} />
      ) : !roomTypes.length ? (
        <StateView icon={Layers3} title="No room types yet" message="Add your first room type to start listing rooms." />
      ) : (
        <section className="resource-grid">
          {roomTypes.map((roomType) => {
            const cover = resolveAssetUrl(roomType.featuredImage ?? roomType.galleryImages?.[0]);
            return (
              <article className="resource-card room-card" key={roomType.id}>
                <span className="resource-thumb">{cover ? <img src={cover} alt="" /> : <Layers3 />}</span>
                <div className="resource-card__body">
                  <div className="resource-card__line1"><h3>{roomType.name}</h3><span className={`status status--${roomType.isActive ? "active" : "inactive"}`}>{roomType.isActive ? "ACTIVE" : "INACTIVE"}</span></div>
                  <div className="resource-card__line2"><span>{roomType.category?.name || roomType.description || roomType.slug}</span><span className="dot">-</span><span>{roomType.capacity ?? 1} guests</span><span className="dot">-</span><span>{roomType.tax ? `${roomType.tax.name} (${Number(roomType.tax.percentage).toFixed(2)}%)` : "No tax"}</span><span className="dot">-</span><span>{roomType._count?.rooms ?? 0} rooms</span></div>
                </div>
                <strong className="resource-card__value">{currency.format(Number(roomType.pricePerNight ?? 0))}</strong>
                <button type="button" className="property-edit-button" aria-label={`Edit ${roomType.name}`} onClick={() => setDialog(roomType)}><Pencil size={16} /></button>
              </article>
            );
          })}
        </section>
      )}
      {dialog && <RoomTypeDialog roomType={dialog === "create" ? undefined : dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

type RoomTypeForm = {
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  overview: string;
  pricePerNight: number;
  capacity: number;
  maxAdults: number;
  maxChildren: number;
  taxId: string;
  acType: string;
  sizeSqFt?: number;
  bedType: string;
  floor: string;
  view: string;
  facilities: string;
  smokingAllowed: boolean;
  attachedBathroom: boolean;
  isActive: boolean;
};

function RoomTypeDialog({ roomType, onClose }: { roomType?: RoomTypeOption; onClose: () => void }) {
  const propertyId = useAppStore((state) => state.activeProperty!.id);
  const mode = roomType ? "edit" : "create";
  const categories = useQuery({ queryKey: ["categories", propertyId], queryFn: () => api<ListResponse<Category>>(`/categories?propertyId=${propertyId}`) });
  const taxes = useQuery({ queryKey: ["taxes", propertyId], queryFn: () => api<ListResponse<PropertyTax>>(`/taxes?propertyId=${propertyId}&isActive=true`) });
  const amenityCatalog = useQuery({ queryKey: ["amenities"], queryFn: () => api<AmenityOption[]>("/amenities") });
  const [amenityIds, setAmenityIds] = useState<string[]>(roomType?.amenities?.map(({ amenity }) => amenity.id) ?? []);
  const availableAmenities = (amenityCatalog.data ?? []).filter((amenity) => amenity.appliesTo !== "STAY");
  const initialGallery = roomType?.galleryImages ?? [];
  const [images, setImages] = useState<ManagedImage[]>(
    initialGallery.length
      ? initialGallery.map((imageUrl, sortOrder) => ({ imageUrl, sortOrder, isCover: imageUrl === roomType?.featuredImage || (!roomType?.featuredImage && sortOrder === 0) }))
      : roomType?.featuredImage
        ? [{ imageUrl: roomType.featuredImage, sortOrder: 0, isCover: true }]
        : [],
  );
  const { register, handleSubmit, setValue, watch, getValues, trigger, formState: { errors } } = useForm<RoomTypeForm>({
    defaultValues: {
      categoryId: roomType?.categoryId ?? "",
      name: roomType?.name ?? "",
      slug: roomType?.slug ?? "",
      description: roomType?.description ?? "",
      overview: roomType?.overview ?? "",
      pricePerNight: roomType?.pricePerNight === undefined ? undefined : Number(roomType.pricePerNight),
      capacity: roomType?.capacity ?? 1,
      maxAdults: roomType?.maxAdults ?? 1,
      maxChildren: roomType?.maxChildren ?? 0,
      taxId: roomType?.taxId ?? "",
      acType: roomType?.acType === "Non-AC" ? "Non-AC" : "AC",
      sizeSqFt: roomType?.sizeSqFt === undefined ? undefined : Number(roomType.sizeSqFt),
      bedType: roomType?.bedType ?? "",
      floor: roomType?.floor ?? "",
      view: roomType?.view ?? "",
      facilities: (roomType?.keyFeatures ?? []).join(", "),
      smokingAllowed: roomType?.smokingAllowed ?? false,
      attachedBathroom: roomType?.attachedBathroom ?? true,
      isActive: roomType?.isActive ?? true,
    },
  });
  const availableCategories = listItems<Category>(categories.data);
  const taxOptions = listItems<PropertyTax>(taxes.data);
  const categoryId = watch("categoryId");
  useEffect(() => {
    if (mode === "create" && !categoryId && availableCategories[0]?.id) setValue("categoryId", availableCategories[0].id);
  }, [mode, availableCategories, categoryId, setValue]);
  const capacity = watch("capacity");
  const maxAdults = watch("maxAdults");
  const maxChildren = watch("maxChildren");
  useEffect(() => {
    void trigger(["capacity", "maxAdults", "maxChildren"]);
  }, [capacity, maxAdults, maxChildren, trigger]);
  const mutation = useMutation({
    mutationFn: (data: RoomTypeForm) => {
      const normalizedImages = normalizeCover(images.map((image, sortOrder) => ({ ...image, sortOrder })));
      const featuredImage = normalizedImages.find((image) => image.isCover)?.imageUrl ?? normalizedImages[0]?.imageUrl;
      const { facilities, ...rest } = data;
      const body = cleanBody({
        ...rest,
        propertyId,
        featuredImage,
        keyFeatures: facilities.split(",").map((facility) => facility.trim()).filter(Boolean),
        galleryImages: normalizedImages.map((image) => image.imageUrl),
        amenityIds,
      });
      if (!data.taxId) body.taxId = null;
      return api<RoomTypeOption>(mode === "create" ? "/room-types" : `/room-types/${roomType!.id}`, {
        method: mode === "create" ? "POST" : "PUT",
        body,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["room-types"] });
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      onClose();
    },
  });

  return (
    <ResourceDialog title={`${mode === "create" ? "Add" : "Edit"} room type`} eyebrow="Sellable room product" onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div className="property-form-grid">
          <div className="property-form-grid__wide"><ImageManager images={images} onChange={(next) => setImages(normalizeCover(next))} supportsCover /></div>
          <label><span className="label-title">Category<Req /></span>
            <select {...register("categoryId", { required: "Select a category" })}>{availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
            <FieldError error={errors.categoryId} />
          </label>
          <label><span className="label-title">Name<Req /></span>
            <input {...register("name", { required: "Name is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
            <FieldError error={errors.name} />
          </label>
          <label>Slug<input placeholder="auto from name" {...register("slug", { minLength: { value: 2, message: "Enter at least 2 characters" } })} /><FieldError error={errors.slug} /></label>
          <label><span className="label-title">Price per night<Req /></span>
            <input step="0.01" type="number" {...register("pricePerNight", { required: "Price is required", valueAsNumber: true, min: { value: 0.01, message: "Must be greater than 0" } })} />
            <FieldError error={errors.pricePerNight} />
          </label>
          <label><span className="label-title">Capacity<Req /></span>
            <input type="number" {...register("capacity", {
              required: "Capacity is required",
              valueAsNumber: true,
              min: { value: 1, message: "Must be at least 1" },
              validate: (value) => {
                const { maxAdults, maxChildren } = getValues();
                if (Number.isNaN(maxAdults) || Number.isNaN(maxChildren)) return true;
                return maxAdults + maxChildren === value || "Capacity must equal max adults + max children";
              },
            })} />
            <FieldError error={errors.capacity} />
          </label>
          <label><span className="label-title">Max adults<Req /></span>
            <input type="number" {...register("maxAdults", {
              required: "Max adults is required",
              valueAsNumber: true,
              min: { value: 1, message: "Must be at least 1" },
              validate: (value) => {
                const { capacity, maxChildren } = getValues();
                if (Number.isNaN(capacity) || Number.isNaN(maxChildren)) return true;
                return value + maxChildren === capacity || "Max adults + max children must equal capacity";
              },
            })} />
            <FieldError error={errors.maxAdults} />
          </label>
          <label><span className="label-title">Max children<Req /></span>
            <input type="number" {...register("maxChildren", {
              required: "Max children is required",
              valueAsNumber: true,
              min: { value: 0, message: "Must be 0 or more" },
              validate: (value) => {
                const { capacity, maxAdults } = getValues();
                if (Number.isNaN(capacity) || Number.isNaN(maxAdults)) return true;
                return maxAdults + value === capacity || "Max adults + max children must equal capacity";
              },
            })} />
            <FieldError error={errors.maxChildren} />
          </label>
          <label>Tax<select {...register("taxId")}>
            <option value="">No tax</option>
            {taxOptions.map((tax) => <option key={tax.id} value={tax.id}>{tax.name} ({Number(tax.percentage).toFixed(2)}%)</option>)}
          </select></label>
          <label>AC type<select {...register("acType", { required: "Select an AC type" })}><option value="AC">AC</option><option value="Non-AC">Non-AC</option></select><FieldError error={errors.acType} /></label>
          <label>Size sq ft
            <input type="number" {...register("sizeSqFt", { valueAsNumber: true, min: { value: 1, message: "Must be at least 1" } })} />
            <FieldError error={errors.sizeSqFt} />
          </label>
          <label>Bed type<input placeholder="Queen Bed" {...register("bedType")} /></label>
          <label>Floor<input placeholder="1st Floor" {...register("floor")} /></label>
          <label>View<input placeholder="Garden view" {...register("view")} /></label>
          <label className="property-form-grid__wide">Description<textarea rows={3} {...register("description")} /></label>
          <label className="property-form-grid__wide">Overview<textarea rows={3} {...register("overview")} /></label>
          <label className="property-form-grid__wide">Facilities<input placeholder="Air conditioning, Extra bedding, Breakfast eligible" {...register("facilities")} /></label>
          <CheckboxList title="Amenities" items={availableAmenities.map((amenity) => ({ id: amenity.id, label: amenity.name }))} selected={amenityIds} onChange={setAmenityIds} />
          <div className="property-form-grid__wide room-options">
            <label className="check-option"><input type="checkbox" {...register("smokingAllowed")} /><span>Smoking allowed</span></label>
            <label className="check-option"><input type="checkbox" {...register("attachedBathroom")} /><span>Attached bathroom</span></label>
            <label className="check-option"><input type="checkbox" {...register("isActive")} /><span>Room type is active</span></label>
          </div>
        </div>
        {mutation.error && <div className="form-error">{mutation.error.message}</div>}
        <DialogFooter onClose={onClose} loading={mutation.isPending} label={mode === "create" ? "Create room type" : "Save room type"} />
      </form>
    </ResourceDialog>
  );
}
