import { ReactNode } from "react";
import clsx from "clsx";

type TextVariant = "default" | "lead" | "muted" | "small" | "mono";

interface TextProps {
  children: ReactNode;
  variant?: TextVariant;
  className?: string;
  as?: "p" | "span" | "div";
}

const variantClass: Record<TextVariant, string> = {
  default: "text-base text-[var(--marketing-fg)]",
  lead: "text-lg sm:text-xl text-[var(--marketing-fg)] text-pretty leading-relaxed",
  muted: "text-sm sm:text-base text-[var(--marketing-muted)] leading-relaxed",
  small: "text-xs text-[var(--marketing-muted)]",
  mono: "text-xs font-mono text-[var(--marketing-muted)] uppercase tracking-wider",
};

/**
 * 通用文本原子:支持 default / lead / muted / small / mono 变体
 */
export function Text({
  children,
  variant = "default",
  className,
  as: Tag = "p",
}: TextProps) {
  return (
    <Tag className={clsx(variantClass[variant], className)}>{children}</Tag>
  );
}
