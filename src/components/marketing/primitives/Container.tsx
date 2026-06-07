import { ReactNode } from "react";
import clsx from "clsx";

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * 营销站通用容器:max-w-7xl + 响应式 padding
 */
export function Container({ children, className }: ContainerProps) {
  return (
    <div
      className={clsx(
        "mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10",
        className
      )}
    >
      {children}
    </div>
  );
}
