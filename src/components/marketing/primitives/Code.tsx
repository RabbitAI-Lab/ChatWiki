import clsx from "clsx";
import { ReactNode } from "react";

interface CodeProps {
  children: ReactNode;
  className?: string;
}

/**
 * 营销站 inline code:Geist Mono + 微弱背景
 */
export function Code({ children, className }: CodeProps) {
  return (
    <code
      className={clsx(
        "rounded bg-[var(--marketing-surface)] border border-[var(--marketing-border)] px-1.5 py-0.5 font-mono text-[0.9em] text-[var(--marketing-fg)]",
        className
      )}
    >
      {children}
    </code>
  );
}
