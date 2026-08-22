import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, ChevronRight, LogOut, Pencil, Plus, Trash2, User as UserIcon, Users } from "lucide-react";
import { api, resolveAssetUrl } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import { initials } from "@/lib/format";
import { useBackCloseable } from "@/lib/modal-stack";
import type { Owner, Stay } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { EMAIL_PATTERN, FieldError, PhoneField, ResourceDialog, ResourceToolbar, DialogFooter, Req, cleanBody } from "@/components/resource/dialog-kit";

const statusFilterOptions = [{ value: "", label: "All statuses" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }];

export function OwnersPage({ initialOwnerId }: { initialOwnerId?: string } = {}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dialog, setDialog] = useState<"create" | Owner | null>(null);
  const [activeOwnerId, setActiveOwnerId] = useState<string | null>(initialOwnerId ?? null);
  const [profileOpen, setProfileOpen] = useState(false);
  const query = useQuery({ queryKey: ["owners"], queryFn: () => api<Owner[]>("/owners") });
  const owners = useMemo(
    () => (query.data ?? []).filter((owner) =>
      (!statusFilter || owner.status === statusFilter) && JSON.stringify(owner).toLowerCase().includes(search.toLowerCase())),
    [query.data, search, statusFilter],
  );

  return (
    <div className="owners-shell">
      <OwnersHeader onOpenProfile={() => setProfileOpen(true)} />
      <main className="page owners-page">
        <section className="resource-head">
          <span className="eyebrow"><Users size={14} /> Owners</span>
          <Button onClick={() => setDialog("create")}><Plus size={18} /> Add owner</Button>
        </section>
        <ResourceToolbar search={search} onSearchChange={setSearch} placeholder="Search owners..." filter={statusFilter} onFilterChange={setStatusFilter} filterOptions={statusFilterOptions} onClear={() => { setSearch(""); setStatusFilter(""); }} />
        {query.isLoading ? <LoadingGrid /> : query.isError ? (
          <StateView title="Couldn't load owners" message="Check the backend connection and try once more." action={() => void query.refetch()} />
        ) : !owners.length ? (
          <StateView icon={Users} title="No owners yet" message="Add your first owner to start creating properties." />
        ) : (
          <section className="owner-grid">
            {owners.map((owner) => <OwnerCard key={owner.id} owner={owner} onOpen={() => setActiveOwnerId(owner.id)} onEdit={() => setDialog(owner)} />)}
          </section>
        )}
        {dialog && <OwnerDialog mode={dialog === "create" ? "create" : "edit"} owner={dialog === "create" ? undefined : dialog} onClose={() => setDialog(null)} />}
        {activeOwnerId && <OwnerPropertiesModal ownerId={activeOwnerId} onClose={() => setActiveOwnerId(null)} />}
      </main>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

export function OwnersHeader({ onOpenProfile }: { onOpenProfile: () => void }) {
  const user = useAppStore((state) => state.user);
  const clearSession = useAppStore((state) => state.clearSession);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [menuOpen]);
  useBackCloseable(menuOpen, () => setMenuOpen(false));

  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="brand"><span className="brand__mark"><Building2 /></span><span>Darshan PMS</span></div>
      </div>
      <div className="topbar__right">
        <div className="avatar-menu" ref={menuRef}>
          <button type="button" className="avatar-menu__trigger" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            {user?.avatarUrl ? <img className="avatar-img" src={resolveAssetUrl(user.avatarUrl)} alt="" /> : <span className="avatar avatar--small">{initials(user?.name)}</span>}
          </button>
          {menuOpen && (
            <div className="avatar-menu__panel" role="menu">
              <div className="avatar-menu__header">
                <div className="avatar-menu__header-text"><strong>{user?.name}</strong><small>{user?.email}</small></div>
              </div>
              <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenProfile(); }}><UserIcon size={16} /> My Profile</button>
              <button type="button" role="menuitem" className="avatar-menu__signout" onClick={clearSession}><LogOut size={16} /> Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const user = useAppStore((state) => state.user);
  const clearSession = useAppStore((state) => state.clearSession);

  return (
    <ResourceDialog title="My profile" eyebrow="Account" onClose={onClose}>
      <div className="profile-photo-row">
        <div className="profile-photo">
          {user?.avatarUrl ? <img src={resolveAssetUrl(user.avatarUrl)} alt="" /> : <span>{initials(user?.name)}</span>}
        </div>
        <div className="profile-modal-identity">
          <strong>{user?.name}</strong>
          <small>{user?.role === "ADMIN" ? "Administrator" : "Property owner"}</small>
        </div>
      </div>
      <div className="property-form-grid">
        <label>Email address<input value={user?.email ?? ""} disabled readOnly /></label>
        <label>Mobile number<input value={user?.phone || "Not set"} disabled readOnly /></label>
        {user?.businessName && <label className="property-form-grid__wide">Business name<input value={user.businessName} disabled readOnly /></label>}
      </div>
      <footer>
        <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
        <Button type="button" variant="secondary" onClick={clearSession}><LogOut size={17} /> Sign out</Button>
      </footer>
    </ResourceDialog>
  );
}

function OwnerCard({ owner, onOpen, onEdit }: { owner: Owner; onOpen: () => void; onEdit: () => void }) {
  const removeOwner = useMutation({
    mutationFn: () => api<void>(`/owners/${owner.id}`, { method: "DELETE" }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["owners"] }); },
  });
  const handleDelete = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!window.confirm(`Delete owner ${owner.name}? Owners with properties cannot be deleted.`)) return;
    removeOwner.mutate();
  };

  const propertyCount = owner._count?.stayProfiles ?? owner.stayProfiles?.length ?? 0;

  return (
    <>
      <article className="resource-card owner-card owner-card--pickable" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(); }}>
        <span className="card-icon"><Users /></span>
        <div className="resource-card__body">
          <div className="resource-card__line1">
            <h3>{owner.name}</h3>
            <span className={`status status--${owner.status.toLowerCase()}`}>{owner.status}</span>
          </div>
          <div className="resource-card__line2">
            <span>{owner.email}</span>
            <span className="dot">•</span>
            <span>{propertyCount} propert{propertyCount === 1 ? "y" : "ies"}</span>
          </div>
        </div>
        <span className="card-actions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="property-edit-button" aria-label={`Edit ${owner.name}`} onClick={onEdit}><Pencil size={16} /></button>
          <button type="button" className="property-edit-button property-edit-button--danger" aria-label={`Delete ${owner.name}`} onClick={handleDelete} disabled={removeOwner.isPending}><Trash2 size={16} /></button>
        </span>
        <ChevronRight size={18} className="resource-card__chevron" />
      </article>
      {removeOwner.error && <div className="form-error">{removeOwner.error.message}</div>}
    </>
  );
}

function OwnerPropertiesModal({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const enterProperty = useAppStore((state) => state.enterProperty);
  const detail = useQuery({ queryKey: ["owner", ownerId], queryFn: () => api<Owner>(`/owners/${ownerId}`) });
  const properties = detail.data?.stayProfiles ?? [];

  const openProperty = (property: Stay) => {
    if (!detail.data) return;
    enterProperty({ id: detail.data.id, name: detail.data.name, email: detail.data.email }, { id: property.id, name: property.name, type: property.type });
    onClose();
    navigate("/");
  };

  return (
    <ResourceDialog title={detail.data ? `${detail.data.name}'s properties` : "Properties"} eyebrow="Select a property to enter" dialogClassName="owner-properties-dialog" onClose={onClose}>
      {detail.isLoading ? <LoadingGrid /> : detail.isError ? (
        <StateView title="Couldn't load properties" message="Check the backend connection and try once more." action={() => void detail.refetch()} />
      ) : !properties.length ? (
        <StateView icon={Building2} title="No properties yet" message="Add the first property for this owner to get started." />
      ) : (
        <div className="property-picker-grid">
          {properties.map((property) => {
            const cover = resolveAssetUrl(property.images?.find((image) => image.isCover)?.imageUrl ?? property.images?.[0]?.imageUrl);
            return (
              <article key={property.id} className="resource-card property-card property-card--pickable" role="button" tabIndex={0} onClick={() => openProperty(property)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openProperty(property); }}>
                <span className="resource-thumb">{cover ? <img src={cover} alt="" /> : <Building2 />}</span>
                <div className="resource-card__body">
                  <div className="resource-card__line1">
                    <h3>{property.name}</h3>
                    <span className={`status status--${property.status.toLowerCase()}`}>{property.status}</span>
                  </div>
                  <div className="resource-card__line2">
                    <span>{property.city}, {property.state}</span>
                    <span className="dot">•</span>
                    <span>{property.rooms?.length ?? 0} Room{(property.rooms?.length ?? 0) === 1 ? "" : "s"}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <footer className="owner-properties-dialog__footer">
        <Button variant="secondary" onClick={() => navigate(`/setup?ownerId=${ownerId}`)}><Plus size={17} /> Add property</Button>
      </footer>
    </ResourceDialog>
  );
}

type OwnerForm = { name: string; email: string; phone: string; businessName: string; status: "ACTIVE" | "INACTIVE"; password: string };

function OwnerDialog({ mode, owner, onClose }: { mode: "create" | "edit"; owner?: Owner; onClose: () => void }) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<OwnerForm>({
    defaultValues: {
      name: owner?.name ?? "",
      email: owner?.email ?? "",
      phone: owner?.phone ?? "",
      businessName: owner?.businessName ?? "",
      status: owner?.status ?? "ACTIVE",
      password: "",
    },
  });
  const mutation = useMutation({
    mutationFn: (data: OwnerForm) => api<Owner>(mode === "create" ? "/owners" : `/owners/${owner!.id}`, {
      method: mode === "create" ? "POST" : "PUT",
      body: cleanBody(data, mode === "edit" && !data.password ? ["password"] : []),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["owners"] });
      onClose();
    },
  });

  return (
    <ResourceDialog title={`${mode === "create" ? "Add" : "Edit"} owner`} eyebrow="Owner account" onClose={onClose}>
      <form noValidate onSubmit={handleSubmit((data) => mutation.mutate(data))}>
        <div className="property-form-grid">
          <label><span className="label-title">Owner name<Req /></span>
            <input {...register("name", { required: "Owner name is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
            <FieldError error={errors.name} />
          </label>
          <label><span className="label-title">Email<Req /></span>
            <input type="email" {...register("email", { required: "Email is required", pattern: { value: EMAIL_PATTERN, message: "Enter a valid email address" } })} />
            <FieldError error={errors.email} />
          </label>
          <label><span className="label-title">Phone<Req /></span>
            <PhoneField control={control} name="phone" error={errors.phone} required />
          </label>
          <label>Business name<input {...register("businessName")} /></label>
          <label>Status<select {...register("status")}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
          <label><span className="label-title">{mode === "create" ? "Temporary password" : "Reset password"}{mode === "create" && <Req />}</span>
            <PasswordInput placeholder={mode === "edit" ? "Leave blank to keep current password" : "Enter temporary password"} {...register("password", mode === "create"
              ? { required: "Password is required", minLength: { value: 8, message: "Use at least 8 characters" } }
              : { validate: (value) => !value || value.length >= 8 || "Use at least 8 characters" })} />
            <FieldError error={errors.password} />
          </label>
        </div>
        {mutation.error && <div className="form-error">{mutation.error.message}</div>}
        <DialogFooter onClose={onClose} loading={mutation.isPending} label={mode === "create" ? "Create owner" : "Save owner"} />
      </form>
    </ResourceDialog>
  );
}
