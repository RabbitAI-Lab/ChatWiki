import { ReactNode } from "react";
import clsx from "clsx";

interface BadgeProps {
  children: ReactNode;
  variant?: "default" | "accent" | "success";
  className?: string;
}

const variantClass = {
  default:
    "border-[var(--marketing-border)] bg-[var(--marketing-surface)] text-[var(--marketing-muted)]",
  accent: "border-blue-500/30 bg-blue-500/10 text-blue-500",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
} as const;

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-mono font-medium",
        variantClass[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
