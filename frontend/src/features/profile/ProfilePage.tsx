import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Camera, KeyRound, LogOut, Save, UserRound } from "lucide-react";
import { api, resolveAssetUrl, uploadImages } from "@/lib/api-client";
import { queryClient } from "@/lib/query-client";
import { useAppStore } from "@/store/app-store";
import { initials } from "@/lib/format";
import type { User } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { FieldError, Req, cleanBody } from "@/components/resource/dialog-kit";

type ProfileForm = { name: string; businessName: string };
type PasswordForm = { currentPassword: string; newPassword: string; confirmPassword: string };

export function ProfilePage() {
  const setUser = useAppStore((state) => state.setUser);
  const clearSession = useAppStore((state) => state.clearSession);
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => api<User>("/auth/me") });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const [saved, setSaved] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileForm>({ defaultValues: { name: "", businessName: "" } });
  const passwordForm = useForm<PasswordForm>({ defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });

  useEffect(() => {
    if (!me.data) return;
    reset({ name: me.data.name, businessName: me.data.businessName ?? "" });
    setAvatarUrl(me.data.avatarUrl ?? null);
  }, [me.data, reset]);

  const avatarUpload = useMutation({
    mutationFn: (file: File) => uploadImages([file]),
    onSuccess: (result) => {
      setAvatarError("");
      setAvatarUrl(result.urls[0]);
    },
    onError: (error: Error) => setAvatarError(error.message),
  });

  const saveProfile = useMutation({
    mutationFn: (data: ProfileForm) => api<User>("/auth/profile", { method: "PATCH", body: cleanBody({ ...data, avatarUrl }) }),
    onSuccess: async (updated) => {
      setUser({ ...me.data!, ...updated });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const changePassword = useMutation({
    mutationFn: (data: PasswordForm) => api<{ message: string }>("/auth/change-password", {
      method: "PATCH",
      body: { currentPassword: data.currentPassword, newPassword: data.newPassword },
    }),
    onSuccess: () => {
      passwordForm.reset();
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    },
  });

  if (me.isLoading) return <main className="page"><LoadingGrid /></main>;
  if (me.isError || !me.data) return <main className="page"><StateView title="Couldn't load your profile" message="Check the backend connection and try once more." action={() => void me.refetch()} /></main>;

  const handleAvatarPick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) avatarUpload.mutate(file);
  };

  return (
    <main className="page profile-page">
      <section className="resource-head">
        <span className="eyebrow"><UserRound size={14} /> My profile</span>
      </section>

      <form className="settings-form profile-card" noValidate onSubmit={handleSubmit((data) => saveProfile.mutate(data))}>
        <div className="profile-photo-row">
          <div className="profile-photo">
            {avatarUrl ? <img src={resolveAssetUrl(avatarUrl)} alt="" /> : <span>{initials(me.data.name)}</span>}
          </div>
          <div className="profile-photo-actions">
            <Button type="button" variant="secondary" loading={avatarUpload.isPending} onClick={() => fileInputRef.current?.click()}>
              <Camera size={16} /> {avatarUrl ? "Change photo" : "Upload photo"}
            </Button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={(event) => { handleAvatarPick(event.target.files); event.target.value = ""; }} />
            {avatarError && <small className="error-text">{avatarError}</small>}
          </div>
        </div>

        <div className="property-form-grid">
          <label><span className="label-title">Full name<Req /></span>
            <input {...register("name", { required: "Name is required", minLength: { value: 2, message: "Enter at least 2 characters" } })} />
            <FieldError error={errors.name} />
          </label>
          <label>Email address
            <input value={me.data.email} disabled readOnly />
          </label>
          <label>Mobile number
            <input value={me.data.phone || "Not set"} disabled readOnly />
          </label>
          <label>Business name (optional)
            <input {...register("businessName")} placeholder="e.g. Darshan Stays" />
          </label>
        </div>

        {saveProfile.error && <div className="form-error">{saveProfile.error.message}</div>}
        <footer className="settings-form__footer">
          {saved && <span className="settings-saved">Saved</span>}
          <Button type="submit" loading={saveProfile.isPending}><Save size={17} /> Save changes</Button>
        </footer>
      </form>

      <form className="settings-form profile-card" noValidate onSubmit={passwordForm.handleSubmit((data) => changePassword.mutate(data))}>
        <div className="profile-card__head"><KeyRound size={18} /><div><strong>Change password</strong><small>Use at least 8 characters. You'll stay signed in on this device.</small></div></div>
        <div className="property-form-grid">
          <label className="property-form-grid__wide"><span className="label-title">Current password<Req /></span>
            <PasswordInput placeholder="Enter current password" {...passwordForm.register("currentPassword", { required: "Current password is required" })} />
            <FieldError error={passwordForm.formState.errors.currentPassword} />
          </label>
          <label><span className="label-title">New password<Req /></span>
            <PasswordInput placeholder="Enter new password" {...passwordForm.register("newPassword", { required: "New password is required", minLength: { value: 8, message: "Use at least 8 characters" } })} />
            <FieldError error={passwordForm.formState.errors.newPassword} />
          </label>
          <label><span className="label-title">Confirm new password<Req /></span>
            <PasswordInput placeholder="Confirm new password" {...passwordForm.register("confirmPassword", {
              required: "Confirm your new password",
              validate: (value) => value === passwordForm.watch("newPassword") || "Passwords do not match",
            })} />
            <FieldError error={passwordForm.formState.errors.confirmPassword} />
          </label>
        </div>
        {changePassword.error && <div className="form-error">{changePassword.error.message}</div>}
        <footer className="settings-form__footer">
          {passwordSaved && <span className="settings-saved">Password updated</span>}
          <Button type="submit" variant="secondary" loading={changePassword.isPending}><KeyRound size={17} /> Update password</Button>
        </footer>
      </form>

      <div className="profile-card profile-card--danger">
        <div><strong>Sign out </strong><small>End your session on this device.</small></div>
        <Button type="button" variant="ghost" onClick={clearSession}><LogOut size={17} /> Sign out</Button>
      </div>
    </main>
  );
}
