"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Languages } from "lucide-react";

const SUPPORTED = [
  { code: "zh", label: "中文" },
  { code: "en", label: "EN" },
] as const;

export default function AuthLanguageSwitcher() {
  const router = useRouter();
  const current = useLocale();
  const [isPending, startTransition] = useTransition();

  const handleSwitch = (target: string) => {
    if (target === current) return;
    startTransition(() => {
      document.cookie = `NEXT_LOCALE=${target};path=/;max-age=31536000;samesite=lax`;
      router.refresh();
    });
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-md p-0.5 text-xs">
      <Languages className="h-3.5 w-3.5 ml-1 text-gray-400 dark:text-gray-500" aria-hidden="true" />
      {SUPPORTED.map((l) => {
        const active = l.code === current;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => handleSwitch(l.code)}
            disabled={isPending}
            aria-pressed={active}
            className={[
              "px-2 py-1 rounded font-mono transition-colors duration-150",
              active
                ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
              isPending ? "opacity-60 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
