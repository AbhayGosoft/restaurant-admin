import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Camera, LoaderCircle, Search, X } from "lucide-react";
import { Controller, type Control, type FieldError as RHFFieldError, type FieldValues, type Path } from "react-hook-form";
import { resolveAssetUrl, uploadImages } from "@/lib/api-client";
import { useBackCloseable } from "@/lib/modal-stack";
import { Button } from "@/components/ui/Button";

export type ManagedImage = { imageUrl: string; sortOrder: number; isCover?: boolean };
export type ListResponse<T> = T[] | { data?: T[] };

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN = /^(?:\d{7,10}|\+\d{8,14})$/;

const COUNTRY_CODES = [
  { value: "+1", label: "United States (+1)" },
  { value: "+1", label: "Canada (+1)" },
  { value: "+1", label: "Puerto Rico (+1)" },
  { value: "+1", label: "United States Virgin Islands (+1)" },
  { value: "+1242", label: "Bahamas (+1242)" },
  { value: "+1246", label: "Barbados (+1246)" },
  { value: "+1264", label: "Anguilla (+1264)" },
  { value: "+1268", label: "Antigua and Barbuda (+1268)" },
  { value: "+1284", label: "British Virgin Islands (+1284)" },
  { value: "+1340", label: "U.S. Virgin Islands (+1340)" },
  { value: "+1441", label: "Bermuda (+1441)" },
  { value: "+1473", label: "Grenada (+1473)" },
  { value: "+1649", label: "Turks and Caicos Islands (+1649)" },
  { value: "+1664", label: "Montserrat (+1664)" },
  { value: "+1670", label: "Northern Mariana Islands (+1670)" },
  { value: "+1671", label: "Guam (+1671)" },
  { value: "+1684", label: "American Samoa (+1684)" },
  { value: "+1758", label: "Saint Lucia (+1758)" },
  { value: "+1767", label: "Dominica (+1767)" },
  { value: "+1784", label: "Saint Vincent and the Grenadines (+1784)" },
  { value: "+1787", label: "Puerto Rico (+1787)" },
  { value: "+1809", label: "Dominican Republic (+1809)" },
  { value: "+1829", label: "Dominican Republic (+1829)" },
  { value: "+1849", label: "Dominican Republic (+1849)" },
  { value: "+1868", label: "Trinidad and Tobago (+1868)" },
  { value: "+1869", label: "Saint Kitts and Nevis (+1869)" },
  { value: "+1876", label: "Jamaica (+1876)" },
  { value: "+20", label: "Egypt (+20)" },
  { value: "+212", label: "Morocco (+212)" },
  { value: "+213", label: "Algeria (+213)" },
  { value: "+216", label: "Tunisia (+216)" },
  { value: "+218", label: "Libya (+218)" },
  { value: "+220", label: "Gambia (+220)" },
  { value: "+221", label: "Senegal (+221)" },
  { value: "+222", label: "Mauritania (+222)" },
  { value: "+223", label: "Mali (+223)" },
  { value: "+224", label: "Guinea (+224)" },
  { value: "+225", label: "Côte d'Ivoire (+225)" },
  { value: "+226", label: "Burkina Faso (+226)" },
  { value: "+227", label: "Niger (+227)" },
  { value: "+228", label: "Togo (+228)" },
  { value: "+229", label: "Benin (+229)" },
  { value: "+230", label: "Mauritius (+230)" },
  { value: "+231", label: "Liberia (+231)" },
  { value: "+232", label: "Sierra Leone (+232)" },
  { value: "+233", label: "Ghana (+233)" },
  { value: "+234", label: "Nigeria (+234)" },
  { value: "+235", label: "Chad (+235)" },
  { value: "+236", label: "Central African Republic (+236)" },
  { value: "+237", label: "Cameroon (+237)" },
  { value: "+238", label: "Cape Verde (+238)" },
  { value: "+239", label: "São Tomé and Príncipe (+239)" },
  { value: "+240", label: "Equatorial Guinea (+240)" },
  { value: "+241", label: "Gabon (+241)" },
  { value: "+242", label: "Republic of the Congo (+242)" },
  { value: "+243", label: "Democratic Republic of the Congo (+243)" },
  { value: "+244", label: "Angola (+244)" },
  { value: "+245", label: "Guinea-Bissau (+245)" },
  { value: "+246", label: "British Indian Ocean Territory (+246)" },
  { value: "+248", label: "Seychelles (+248)" },
  { value: "+249", label: "Sudan (+249)" },
  { value: "+250", label: "Rwanda (+250)" },
  { value: "+251", label: "Ethiopia (+251)" },
  { value: "+252", label: "Somalia (+252)" },
  { value: "+253", label: "Djibouti (+253)" },
  { value: "+254", label: "Kenya (+254)" },
  { value: "+255", label: "Tanzania (+255)" },
  { value: "+256", label: "Uganda (+256)" },
  { value: "+257", label: "Burundi (+257)" },
  { value: "+258", label: "Mozambique (+258)" },
  { value: "+260", label: "Zambia (+260)" },
  { value: "+261", label: "Madagascar (+261)" },
  { value: "+262", label: "Réunion (+262)" },
  { value: "+263", label: "Zimbabwe (+263)" },
  { value: "+264", label: "Namibia (+264)" },
  { value: "+265", label: "Malawi (+265)" },
  { value: "+266", label: "Lesotho (+266)" },
  { value: "+267", label: "Botswana (+267)" },
  { value: "+268", label: "Eswatini (+268)" },
  { value: "+269", label: "Comoros (+269)" },
  { value: "+27", label: "South Africa (+27)" },
  { value: "+290", label: "Saint Helena (+290)" },
  { value: "+291", label: "Eritrea (+291)" },
  { value: "+297", label: "Aruba (+297)" },
  { value: "+298", label: "Faroe Islands (+298)" },
  { value: "+299", label: "Greenland (+299)" },
  { value: "+30", label: "Greece (+30)" },
  { value: "+31", label: "Netherlands (+31)" },
  { value: "+32", label: "Belgium (+32)" },
  { value: "+33", label: "France (+33)" },
  { value: "+34", label: "Spain (+34)" },
  { value: "+350", label: "Gibraltar (+350)" },
  { value: "+351", label: "Portugal (+351)" },
  { value: "+352", label: "Luxembourg (+352)" },
  { value: "+353", label: "Ireland (+353)" },
  { value: "+354", label: "Iceland (+354)" },
  { value: "+355", label: "Albania (+355)" },
  { value: "+356", label: "Malta (+356)" },
  { value: "+357", label: "Cyprus (+357)" },
  { value: "+358", label: "Finland (+358)" },
  { value: "+359", label: "Bulgaria (+359)" },
  { value: "+36", label: "Hungary (+36)" },
  { value: "+37", label: "Reserved (+37)" },
  { value: "+370", label: "Lithuania (+370)" },
  { value: "+371", label: "Latvia (+371)" },
  { value: "+372", label: "Estonia (+372)" },
  { value: "+373", label: "Moldova (+373)" },
  { value: "+374", label: "Armenia (+374)" },
  { value: "+375", label: "Belarus (+375)" },
  { value: "+376", label: "Andorra (+376)" },
  { value: "+377", label: "Monaco (+377)" },
  { value: "+378", label: "San Marino (+378)" },
  { value: "+379", label: "Vatican City (+379)" },
  { value: "+380", label: "Ukraine (+380)" },
  { value: "+381", label: "Serbia (+381)" },
  { value: "+382", label: "Montenegro (+382)" },
  { value: "+383", label: "Kosovo (+383)" },
  { value: "+385", label: "Croatia (+385)" },
  { value: "+386", label: "Slovenia (+386)" },
  { value: "+387", label: "Bosnia and Herzegovina (+387)" },
  { value: "+389", label: "North Macedonia (+389)" },
  { value: "+39", label: "Italy (+39)" },
  { value: "+40", label: "Romania (+40)" },
  { value: "+41", label: "Switzerland (+41)" },
  { value: "+420", label: "Czech Republic (+420)" },
  { value: "+421", label: "Slovakia (+421)" },
  { value: "+423", label: "Liechtenstein (+423)" },
  { value: "+43", label: "Austria (+43)" },
  { value: "+44", label: "United Kingdom (+44)" },
  { value: "+45", label: "Denmark (+45)" },
  { value: "+46", label: "Sweden (+46)" },
  { value: "+47", label: "Norway (+47)" },
  { value: "+48", label: "Poland (+48)" },
  { value: "+49", label: "Germany (+49)" },
  { value: "+500", label: "Falkland Islands (+500)" },
  { value: "+501", label: "Belize (+501)" },
  { value: "+502", label: "Guatemala (+502)" },
  { value: "+503", label: "El Salvador (+503)" },
  { value: "+504", label: "Honduras (+504)" },
  { value: "+505", label: "Nicaragua (+505)" },
  { value: "+506", label: "Costa Rica (+506)" },
  { value: "+507", label: "Panama (+507)" },
  { value: "+508", label: "Saint Pierre and Miquelon (+508)" },
  { value: "+509", label: "Haiti (+509)" },
  { value: "+51", label: "Peru (+51)" },
  { value: "+52", label: "Mexico (+52)" },
  { value: "+53", label: "Cuba (+53)" },
  { value: "+54", label: "Argentina (+54)" },
  { value: "+55", label: "Brazil (+55)" },
  { value: "+56", label: "Chile (+56)" },
  { value: "+57", label: "Colombia (+57)" },
  { value: "+58", label: "Venezuela (+58)" },
  { value: "+590", label: "Guadeloupe (+590)" },
  { value: "+591", label: "Bolivia (+591)" },
  { value: "+592", label: "Guyana (+592)" },
  { value: "+593", label: "Ecuador (+593)" },
  { value: "+594", label: "French Guiana (+594)" },
  { value: "+595", label: "Paraguay (+595)" },
  { value: "+596", label: "Martinique (+596)" },
  { value: "+597", label: "Suriname (+597)" },
  { value: "+598", label: "Uruguay (+598)" },
  { value: "+599", label: "Caribbean Netherlands (+599)" },
  { value: "+60", label: "Malaysia (+60)" },
  { value: "+61", label: "Australia (+61)" },
  { value: "+62", label: "Indonesia (+62)" },
  { value: "+63", label: "Philippines (+63)" },
  { value: "+64", label: "New Zealand (+64)" },
  { value: "+65", label: "Singapore (+65)" },
  { value: "+66", label: "Thailand (+66)" },
  { value: "+670", label: "Timor-Leste (+670)" },
  { value: "+671", label: "Australia (Christmas Island) (+671)" },
  { value: "+672", label: "Australia (Norfolk Island) (+672)" },
  { value: "+673", label: "Brunei (+673)" },
  { value: "+674", label: "Nauru (+674)" },
  { value: "+675", label: "Papua New Guinea (+675)" },
  { value: "+676", label: "Tonga (+676)" },
  { value: "+677", label: "Solomon Islands (+677)" },
  { value: "+678", label: "Vanuatu (+678)" },
  { value: "+679", label: "Fiji (+679)" },
  { value: "+680", label: "Palau (+680)" },
  { value: "+681", label: "Wallis and Futuna (+681)" },
  { value: "+682", label: "Cook Islands (+682)" },
  { value: "+683", label: "Niue (+683)" },
  { value: "+685", label: "Samoa (+685)" },
  { value: "+686", label: "Kiribati (+686)" },
  { value: "+687", label: "New Caledonia (+687)" },
  { value: "+688", label: "Tuvalu (+688)" },
  { value: "+689", label: "French Polynesia (+689)" },
  { value: "+7", label: "Russia (+7)" },
  { value: "+7", label: "Kazakhstan (+7)" },
  { value: "+81", label: "Japan (+81)" },
  { value: "+82", label: "South Korea (+82)" },
  { value: "+84", label: "Vietnam (+84)" },
  { value: "+86", label: "China (+86)" },
  { value: "+90", label: "Turkey (+90)" },
  { value: "+91", label: "India (+91)" },
  { value: "+92", label: "Pakistan (+92)" },
  { value: "+93", label: "Afghanistan (+93)" },
  { value: "+94", label: "Sri Lanka (+94)" },
  { value: "+95", label: "Myanmar (+95)" },
  { value: "+96", label: "Reserved (+96)" },
  { value: "+961", label: "Lebanon (+961)" },
  { value: "+962", label: "Jordan (+962)" },
  { value: "+963", label: "Syria (+963)" },
  { value: "+964", label: "Iraq (+964)" },
  { value: "+965", label: "Kuwait (+965)" },
  { value: "+966", label: "Saudi Arabia (+966)" },
  { value: "+967", label: "Yemen (+967)" },
  { value: "+968", label: "Oman (+968)" },
  { value: "+970", label: "Palestine (+970)" },
  { value: "+971", label: "United Arab Emirates (+971)" },
  { value: "+972", label: "Israel (+972)" },
  { value: "+973", label: "Bahrain (+973)" },
  { value: "+974", label: "Qatar (+974)" },
  { value: "+975", label: "Bhutan (+975)" },
  { value: "+976", label: "Mongolia (+976)" },
  { value: "+977", label: "Nepal (+977)" },
  { value: "+98", label: "Iran (+98)" },
] as const;

const COUNTRY_CODE_VALUES = COUNTRY_CODES.map((code) => code.value).sort((a, b) => b.length - a.length);
const SORTED_COUNTRY_CODES = [...COUNTRY_CODES].sort((a, b) => a.label.localeCompare(b.label));

function splitPhone(value: string) {
  const normalized = value.trim();
  const matchedCountry = normalized.startsWith("+")
    ? COUNTRY_CODE_VALUES.find((code) => normalized.startsWith(code))
    : undefined;
  const countryCode = matchedCountry ?? "+91";
  const number = normalized.startsWith(countryCode)
    ? normalized.slice(countryCode.length)
    : normalized.replace(/\D/g, "");
  return { countryCode, number: number.replace(/\D/g, "").slice(0, 10) };
}

export function PhoneInput({ value, onChange, required = false }: { value: string; onChange: (value: string) => void; required?: boolean }) {
  const { countryCode, number } = splitPhone(value);
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const update = (nextCountryCode: string, nextNumber: string) => onChange(`${nextCountryCode}${nextNumber.replace(/\D/g, "").slice(0, 10)}`);

  useEffect(() => {
    if (!open) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [open]);

  const openDropdown = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setOpenUp(spaceBelow < 240 && spaceAbove > spaceBelow);
    }
    setOpen(true);
  };

  return (
    <div className="phone-input" ref={containerRef}>
      <input type="tel" inputMode="numeric" maxLength={10} pattern="[0-9]*" required={required} value={number} onChange={(event) => update(countryCode, event.target.value)} />
      <div className="country-select">
        <button
          ref={buttonRef}
          type="button"
          className="country-select__button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={(event) => {
            event.stopPropagation();
            open ? setOpen(false) : openDropdown();
          }}
        >
          <span>{countryCode}</span>
          <span aria-hidden="true">▾</span>
        </button>
        {open && (
          <div className={clsx("country-select__panel", openUp && "country-select__panel--top")} role="listbox" aria-label="Country code list">
            {SORTED_COUNTRY_CODES.map((code) => (
              <button
                key={`${code.value}-${code.label}`}
                type="button"
                role="option"
                aria-selected={code.value === countryCode}
                className={clsx("country-select__option", code.value === countryCode && "country-select__option--selected")}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  update(code.value, number);
                }}
              >
                {code.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PhoneField<T extends FieldValues>({ control, name, error, required = false }: { control: Control<T>; name: Path<T>; error?: RHFFieldError; required?: boolean }) {
  return <>
    <Controller control={control} name={name} rules={{
      required: required ? "Phone number is required" : false,
      validate: (value) => !value || PHONE_PATTERN.test(value) || "Enter a valid phone number with up to 10 digits or international code",
    }} render={({ field }) => <PhoneInput value={field.value ?? ""} onChange={field.onChange} required={required} />} />
    <FieldError error={error} />
  </>;
}

export function FieldError({ error }: { error?: RHFFieldError }) {
  if (!error?.message) return null;
  return <small className="field-error">{String(error.message)}</small>;
}

export function Req() {
  return <span className="required-mark" aria-hidden="true">*</span>;
}

export function ResourceToolbar({ search, onSearchChange, placeholder, filter, onFilterChange, filterOptions, onClear, children }: {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  filter?: string;
  onFilterChange?: (value: string) => void;
  filterOptions?: { value: string; label: string }[];
  onClear?: () => void;
  children?: ReactNode;
}) {
  const hasFilter = Boolean(filter) || Boolean(search);
  return (
    <section className="toolbar">
      <div className="search-box"><Search size={19} /><input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={placeholder} /></div>
      {filterOptions && onFilterChange && (
        <select className="filter-select" aria-label="Filter" value={filter} onChange={(event) => onFilterChange(event.target.value)}>
          {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      )}
      {onClear && (
        <button type="button" className="toolbar-clear-button" onClick={onClear} disabled={!hasFilter}>Clear</button>
      )}
      {children}
    </section>
  );
}

export function listItems<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object" && "data" in value && Array.isArray((value as { data?: unknown }).data)) return (value as { data: T[] }).data;
  return value ? [value as T] : [];
}

export function cleanBody<T extends Record<string, unknown>>(body: T, omit: string[] = []) {
  return Object.fromEntries(
    Object.entries(body).filter(([key, value]) => {
      if (omit.includes(key)) return false;
      if (value === "" || value === undefined || value === null) return false;
      if (typeof value === "number" && Number.isNaN(value)) return false;
      return true;
    }),
  );
}

export function normalizeCover<T extends ManagedImage>(images: T[], supportsCover = true): T[] {
  return images.map((image, index) => ({ ...image, sortOrder: index, isCover: supportsCover ? image.isCover || (!images.some((item) => item.isCover) && index === 0) : image.isCover }));
}

export function ResourceDialog({ title, eyebrow, dialogClassName, onClose, children }: { title: string; eyebrow: string; dialogClassName?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  useBackCloseable(true, onClose);
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={clsx("property-dialog", dialogClassName)} role="dialog" aria-modal="true" aria-labelledby="resource-dialog-title">
        <header><div><span className="eyebrow">{eyebrow}</span><h2 id="resource-dialog-title">{title}</h2></div><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X /></button></header>
        {children}
      </section>
    </div>
  );
}

export function DialogFooter({ onClose, loading, label }: { onClose: () => void; loading: boolean; label: string }) {
  return <footer><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={loading}>{label}</Button></footer>;
}

export function CheckboxList({ title, items, selected, onChange }: { title: string; items: { id: string; label: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  return (
    <div className="property-form-grid__wide choice-panel">
      <strong>{title}</strong>
      {items.length ? items.map((item) => <label className="check-option" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => onChange(event.target.checked ? [...selected, item.id] : selected.filter((id) => id !== item.id))} /><span>{item.label}</span></label>) : <small>No {title.toLowerCase()} available for this property.</small>}
    </div>
  );
}

type PendingPreview = { localUrl: string; file: File };

export function ImageManager({ images, onChange, supportsCover = false }: { images: ManagedImage[]; onChange: (images: ManagedImage[]) => void; supportsCover?: boolean }) {
  const [imageUrl, setImageUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [pendingPreviews, setPendingPreviews] = useState<PendingPreview[]>([]);

  const clearPending = (files: File[]) => {
    setPendingPreviews((current) => {
      current.filter((preview) => files.includes(preview.file)).forEach((preview) => URL.revokeObjectURL(preview.localUrl));
      return current.filter((preview) => !files.includes(preview.file));
    });
  };

  const upload = useMutation({
    mutationFn: (files: File[]) => uploadImages(files),
    onSuccess: (result, files) => {
      clearPending(files);
      onChange([...images, ...result.urls.map((imageUrl, index) => ({ imageUrl, sortOrder: images.length + index, isCover: supportsCover && images.length === 0 && index === 0 }))]);
    },
    onError: (_error, files) => clearPending(files),
  });

  const handleFiles = (fileList: FileList) => {
    const files = Array.from(fileList);
    setPendingPreviews((current) => [...current, ...files.map((file) => ({ localUrl: URL.createObjectURL(file), file }))]);
    upload.mutate(files);
  };

  const addImage = () => {
    try {
      const parsed = new URL(imageUrl);
      if (!["http:", "https:", "data:"].includes(parsed.protocol)) throw new Error();
      onChange([...images, { imageUrl: parsed.toString(), sortOrder: images.length, isCover: supportsCover && images.length === 0 }]);
      setImageUrl("");
      setUrlError("");
    } catch {
      setUrlError("Enter a valid image URL");
    }
  };

  return (
    <div className="image-manager">
      <div className="image-url-heading"><strong>Images</strong><small>Add a URL or upload local images for testing</small></div>
      <div className="image-url-row"><input type="url" value={imageUrl} placeholder="https://example.com/property.jpg" onChange={(event) => setImageUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addImage(); } }} /><button type="button" className="image-upload-button" disabled={!imageUrl.trim()} onClick={addImage}><Camera size={17} /> Add image</button></div>
      {urlError && <div className="form-error">{urlError}</div>}
      <div className="image-manager__title"><div><strong>Upload</strong><small>JPEG, PNG, WebP or GIF - up to 5 MB each</small></div><label className="image-upload-button"><Camera size={17} /> {upload.isPending ? "Uploading..." : "Upload images"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={upload.isPending} onChange={(event) => { if (event.target.files?.length) handleFiles(event.target.files); event.target.value = ""; }} /></label></div>
      {images.length > 0 || pendingPreviews.length > 0 ? (
        <div className="image-preview-grid">
          {images.map((image, index) => (
            <div className="image-preview" key={`${image.imageUrl}-${index}`}>
              <img src={resolveAssetUrl(image.imageUrl)} alt={`Uploaded ${index + 1}`} />
              {supportsCover && <button type="button" className={image.isCover ? "cover-badge cover-badge--active" : "cover-badge"} onClick={() => onChange(images.map((item, itemIndex) => ({ ...item, isCover: itemIndex === index })))}>{image.isCover ? "Cover" : "Set cover"}</button>}
              <button type="button" className="image-remove" aria-label={`Remove image ${index + 1}`} onClick={() => onChange(normalizeCover(images.filter((_, itemIndex) => itemIndex !== index), supportsCover))}><X size={15} /></button>
            </div>
          ))}
          {pendingPreviews.map((preview) => (
            <div className="image-preview image-preview--pending" key={preview.localUrl}>
              <img src={preview.localUrl} alt="Uploading" />
              <span className="image-preview__spinner"><LoaderCircle size={18} className="spin" /></span>
            </div>
          ))}
        </div>
      ) : <div className="image-empty"><Camera /><span>No images uploaded yet</span></div>}
      {upload.error && <div className="form-error">{upload.error.message}</div>}
    </div>
  );
}
