import { ReactNode } from "react";
import clsx from "clsx";

type HeadingLevel = "h1" | "h2" | "h3" | "h4";

interface HeadingProps {
  as?: HeadingLevel;
  children: ReactNode;
  className?: string;
  id?: string;
}

/**
 * 语义化标题:统一 text-balance 与 tracking-tight
 */
export function Heading({ as = "h2", children, className, id }: HeadingProps) {
  const Tag = as;
  const sizeClass = {
    h1: "text-4xl sm:text-5xl lg:text-6xl",
    h2: "text-3xl sm:text-4xl",
    h3: "text-2xl",
    h4: "text-xl",
  }[as];

  return (
    <Tag
      id={id}
      className={clsx(
        "font-semibold tracking-tight text-[var(--marketing-fg)] text-balance",
        sizeClass,
        className
      )}
    >
      {children}
    </Tag>
  );
}
