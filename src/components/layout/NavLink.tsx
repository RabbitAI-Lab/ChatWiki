"use client";

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

export default function NavLink({ href, icon, children }: NavLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const isActive = pathname === href || pathname.startsWith(href + "/");

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
      {icon}
      {!collapsed && children}
    </div>
  );
}
