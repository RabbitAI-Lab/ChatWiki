"use client";

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const menuItems = [
  {
    href: "/admin/models",
    label: "Model Config",
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    href: "/admin/mcp",
    label: "MCP Config",
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2v4" />
        <path d="m6.8 15-3.5 2" />
        <path d="m20.7 17-3.5-2" />
        <path d="M6.8 9 3.3 7" />
        <path d="m20.7 7-3.5 2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="6" r="2" />
        <circle cx="6.8" cy="9" r="2" />
        <circle cx="17.2" cy="9" r="2" />
        <circle cx="6.8" cy="15" r="2" />
        <circle cx="17.2" cy="15" r="2" />
      </svg>
    ),
  },
  {
    href: "/admin/sandbox",
    label: "Sandbox Config",
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    href: "/admin/storage",
    label: "File Storage",
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/admin/system-prompts",
    label: "System Prompts",
    icon: (
      <svg
        className="w-4 h-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 20h9" />
        <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.855z" />
      </svg>
    ),
  },
];

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="w-[200px] h-full flex flex-col border-r border-gray-200 bg-white shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-800">System Admin</h2>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 px-2 py-2 space-y-1">
        {menuItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <div
              key={item.href}
              onClick={() => router.push(item.href)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer select-none text-gray-900",
                isActive && "bg-blue-50 font-medium",
                !isActive && "hover:bg-gray-50"
              )}
            >
              <span className={cn("text-blue-500")}>{item.icon}</span>
              {item.label}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
