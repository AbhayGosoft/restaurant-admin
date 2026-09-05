import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import { initials } from "@/lib/format";
import type { AdminUser } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { LoadingGrid, StateView } from "@/components/ui/StateView";
import { FieldError, Req } from "@/components/resource/dialog-kit";

type PasswordForm = { currentPassword: string; newPassword: string; confirmPassword: string };

export function ProfilePage() {
  const clearSession = useAppStore((state) => state.clearSession);
  const me = useQuery({ queryKey: ["admin-auth", "me"], queryFn: () => api<AdminUser>("/admin/auth/me") });
  const [passwordSaved, setPasswordSaved] = useState(false);
  const passwordForm = useForm<PasswordForm>({ defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });

  const changePassword = useMutation({
    mutationFn: (data: PasswordForm) => api("/admin/auth/change-password", {
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

  return (
    <main className="page profile-page">
      <section className="resource-head">
        <span className="eyebrow"><UserRound size={14} /> My profile</span>
      </section>

      <div className="settings-form profile-card">
        <div className="profile-photo-row">
          <div className="profile-photo"><span>{initials(me.data.name)}</span></div>
          <div>
            <strong>{me.data.name}</strong>
            <div className="muted">{me.data.email}</div>
            {me.data.role === "SUPERADMIN" && <span className="badge"><ShieldCheck size={12} /> SuperAdmin</span>}
          </div>
        </div>
      </div>

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
