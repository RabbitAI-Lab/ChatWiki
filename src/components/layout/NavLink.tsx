"use client";

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";
import Badge from "@/components/ui/Badge";

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  badgeCount?: number;
}

export default function NavLink({ href, icon, children, badgeCount }: NavLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const isActive = pathname === href || pathname.startsWith(href + "/");
  const showBadge = badgeCount !== undefined && badgeCount > 0;

  return (
    <div
      onClick={() => router.push(href)}
      title={collapsed ? String(children) : undefined}
      className={cn(
        "flex items-center gap-2 w-full py-1.5 text-sm rounded-lg transition-colors cursor-pointer select-none",
        collapsed ? "px-0 justify-center" : "px-3",
        isActive
          ? "bg-gray-100 text-gray-900 font-medium"
          : "text-gray-900 hover:bg-gray-100"
      )}
    >
      <span className="relative inline-flex">
        {icon}
        {collapsed && showBadge && (
          <Badge variant="dot" className="absolute -top-1 -right-1" />
        )}
      </span>
      {!collapsed && (
        <>
          <span className="flex-1">{children}</span>
          {showBadge && <Badge variant="count" count={badgeCount} />}
        </>
      )}
    </div>
  );
}
