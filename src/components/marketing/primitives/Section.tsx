import { ReactNode } from "react";
import clsx from "clsx";

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
}

/**
 * 营销站统一节奏的 section:上下 padding 走 CSS 变量
 */
export function Section({ children, className, ...rest }: SectionProps) {
  return (
    <section
      {...rest}
      className={clsx("py-16 sm:py-20 lg:py-24", className)}
    >
      {children}
    </section>
  );
}
