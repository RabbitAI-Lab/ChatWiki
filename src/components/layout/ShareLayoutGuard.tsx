"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const HIDDEN_PREFIXES = [
  "/share",
  "/login",
  "/register",
  "/setup",
  "/verify-email",
  "/cli-consent",
];

export default function ShareLayoutGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const sidebar = document.querySelector("[data-sidebar]");
    if (sidebar instanceof HTMLElement) {
      const shouldHide = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
      sidebar.style.display = shouldHide ? "none" : "";
    }
  }, [pathname]);

  return null;
}
