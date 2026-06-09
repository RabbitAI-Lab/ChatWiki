"use client";

import { useEffect, useRef, useState } from "react";

interface DocsifyClientProps {
  projectName: string;
  projectId: string;
}

export default function DocsifyClient({ projectName, projectId }: DocsifyClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    // Set docsify config on window before loading script
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).$docsify = {
      name: projectName,
      nameLink: false,
      basePath: `/api/published-docs/${projectId}`,
      loadSidebar: "_sidebar.md",
      subMaxLevel: 3,
      auto2top: true,
      search: {
        paths: "auto",
        placeholder: "Type to search",
        noData: "No results",
        depth: 6,
      },
    };

    // Detect dark mode changes
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    dark.addEventListener("change", handler);

    // Load docsify CSS
    const themeLink = document.createElement("link");
    themeLink.rel = "stylesheet";
    themeLink.href = "/docsify/themes/vue.css";
    themeLink.id = "docsify-theme";
    document.head.appendChild(themeLink);

    // Load docsify JS
    const script = document.createElement("script");
    script.src = "/docsify/docsify.min.js";
    script.async = true;

    script.onload = () => {
      // Load search plugin after docsify
      const searchScript = document.createElement("script");
      searchScript.src = "/docsify/plugins/search.min.js";
      searchScript.async = true;
      document.body.appendChild(searchScript);
    };

    document.body.appendChild(script);

    return () => {
      dark.removeEventListener("change", handler);
      // Cleanup theme link
      const link = document.getElementById("docsify-theme");
      if (link) link.remove();
    };
  }, [projectName, projectId]);

  // Theme switching
  useEffect(() => {
    const link = document.getElementById("docsify-theme") as HTMLLinkElement | null;
    if (link) {
      link.href = isDark ? "/docsify/themes/dark.css" : "/docsify/themes/vue.css";
    }
  }, [isDark]);

  return (
    <div
      ref={containerRef}
      id="app"
      // Suppress hydration mismatch: docsify replaces inner content at runtime
      suppressHydrationWarning
    >
      Loading...
    </div>
  );
}
