import Link from "next/link";
import { useTranslations } from "next-intl";
import Logo from "@/components/marketing/Logo";

interface MarketingFooterProps {
  locale: string;
}

/**
 * 营销站底部 footer:产品链接 / 资源 / 公司 / 社交
 * 注:即便不依赖客户端 hooks,这里也保持 server component;
 * locale 通过 prop 注入避免在 client 端再调一次。
 */
export default function MarketingFooter({ locale }: MarketingFooterProps) {
  const t = useTranslations("marketing.footer");
  const year = new Date().getFullYear();

  const groups = [
    {
      title: t("product"),
      links: [
        { href: "/features", label: t("productFeatures") },
        { href: "/pricing", label: t("productPricing") },
        { href: "/use-cases", label: t("productUseCases") },
      ],
    },
    {
      title: t("resources"),
      links: [
        { href: "/docs", label: t("resourcesApp") },
        { href: "https://github.com/rabbitai-lab", label: t("resourcesGithub"), external: true },
        { href: "mailto:mail@xujialiang.net", label: t("resourcesContact"), external: true },
      ],
    },
  ];

  return (
    <footer
      aria-label={t("ariaLabel")}
      className="mt-24 border-t border-[var(--marketing-border)] bg-[var(--marketing-bg)]"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link
              href="/home"
              className="flex items-center gap-2 text-sm font-semibold tracking-tight"
            >
              <Logo className="h-6 w-6" />
              <span>{t("brand")}</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm text-[var(--marketing-muted)]">
              {t("tagline")}
            </p>
          </div>

          {groups.map((g) => (
            <div key={g.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--marketing-fg)]">
                {g.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {g.links.map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <a
                        href={l.href}
                        className="text-sm text-[var(--marketing-muted)] hover:text-[var(--marketing-fg)] transition-colors"
                        target={l.href.startsWith("http") ? "_blank" : undefined}
                        rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        href={l.href}
                        className="text-sm text-[var(--marketing-muted)] hover:text-[var(--marketing-fg)] transition-colors"
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[var(--marketing-border)] pt-6 md:flex-row">
          <p className="text-xs text-[var(--marketing-muted)]">
            © {year} {t("brand")}. {t("rights")}
          </p>
          <p className="text-xs text-[var(--marketing-muted)]">
            {t("poweredBy")}{" "}
            <a
              href="https://github.com/rabbitai-lab"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--marketing-fg)] transition-colors"
            >
              RabbitAI-Lab
            </a>
          </p>
          <p className="text-xs text-[var(--marketing-muted)] font-mono">
            {locale.toUpperCase()} · v0.1
          </p>
        </div>
      </div>
    </footer>
  );
}
