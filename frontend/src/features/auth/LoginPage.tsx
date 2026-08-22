import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Building2, KeyRound, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAppStore } from "@/store/app-store";
import type { User } from "@/types/domain";
import { Button } from "@/components/ui/Button";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Req } from "@/components/resource/dialog-kit";

interface LoginValues { email: string; password: string }

export function LoginPage() {
  const setSession = useAppStore((state) => state.setSession);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({
    defaultValues: { email: "", password: "" },
  });
  const login = useMutation({
    mutationFn: (values: LoginValues) => api<{ token: string; user: User }>("/auth/login", { method: "POST", body: values }),
    onSuccess: ({ token, user }) => setSession(token, user),
  });

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="brand brand--light"><span className="brand__mark"><Building2 /></span><span>Darshan</span></div>
        <div className="login-visual__content">
          <span className="eyebrow eyebrow--light"><Sparkles size={14} /> Property operations, elevated</span>
          <h1>Hospitality<br />in perfect rhythm.</h1>
          <p>One beautifully focused workspace for every booking, room, guest and property.</p>
          <div className="trust-row"><ShieldCheck /><span><strong>Secure by design</strong><small>Enterprise-grade access</small></span></div>
        </div>
        <div className="login-orbit login-orbit--one" /><div className="login-orbit login-orbit--two" />
      </section>
      <section className="login-panel">
        <div className="login-form-wrap">
          <div className="brand brand--mobile"><span className="brand__mark"><Building2 /></span><span>Darshan</span></div>
          <span className="eyebrow">Welcome back</span>
          <h2>Sign in to your workspace</h2>
          <p className="muted">Manage your property with clarity and confidence.</p>
          <form onSubmit={handleSubmit((values) => login.mutate(values))}>
            <label><span className="label-title">Email address<Req /></span><div className="input-wrap"><Mail size={18} /><input type="email" placeholder="you@company.com" {...register("email", { required: "Email is required" })} /></div></label>
            {errors.email && <small className="error-text">{errors.email.message}</small>}
            <label><span className="label-title">Password<Req /></span><div className="input-wrap"><KeyRound size={18} /><PasswordInput placeholder="Enter your password" {...register("password", { required: "Password is required" })} /></div></label>
            {errors.password && <small className="error-text">{errors.password.message}</small>}
            {login.error && <div className="form-error">{login.error.message}</div>}
            <Button type="submit" loading={login.isPending}>Enter workspace <ArrowRight size={18} /></Button>
          </form>
          <p className="login-help">Need access? Contact your property administrator.</p>
        </div>
      </section>
    </main>
  );
}
