import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import { clsx } from "clsx";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
};

export function Button({ className, variant = "primary", loading, children, disabled, ...props }: Props) {
  return (
    <button className={clsx("button", `button--${variant}`, className)} disabled={disabled || loading} {...props}>
      {loading && <LoaderCircle size={17} className="spin" />}
      {children}
    </button>
  );
}
