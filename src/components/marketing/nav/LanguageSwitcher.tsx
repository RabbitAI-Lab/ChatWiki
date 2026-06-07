"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Languages } from "lucide-react";

const SUPPORTED = [
  { code: "zh", label: "中文" },
  { code: "en", label: "EN" },
] as const;

/**
 * 营销站语言切换:写 NEXT_LOCALE cookie + 刷新页面
 * 与项目内 i18n/request.ts 复用同一个 cookie
 */
export default function LanguageSwitcher() {
  const router = useRouter();
  const current = useLocale();
  const [isPending, startTransition] = useTransition();

  const handleSwitch = (target: string) => {
    if (target === current) return;
    // 写入 cookie(默认 1 年) - 在用户事件中合法
    // eslint-disable-next-line react-hooks/immutability
    window.document.cookie = `NEXT_LOCALE=${target};path=/;max-age=31536000;samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-0.5 text-xs">
      <Languages className="h-3.5 w-3.5 ml-1 text-[var(--marketing-muted)]" aria-hidden="true" />
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
                ? "bg-[var(--marketing-bg)] text-[var(--marketing-fg)] shadow-sm"
                : "text-[var(--marketing-muted)] hover:text-[var(--marketing-fg)]",
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
