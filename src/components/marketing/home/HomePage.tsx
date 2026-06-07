import { getTranslations } from "next-intl/server";
import {
  FolderTree,
  FileCode2,
  Boxes,
  Brain,
  Terminal,
  ScrollText,
  KeyRound,
  BarChart3,
} from "lucide-react";
import Hero from "@/components/marketing/hero/Hero";
import ValueProps from "@/components/marketing/sections/ValueProps";
import FeatureGrid from "@/components/marketing/sections/FeatureGrid";
import FeatureSplit from "@/components/marketing/sections/FeatureSplit";
import TrustBand from "@/components/marketing/sections/TrustBand";
import Testimonial from "@/components/marketing/sections/Testimonial";
import CTASection from "@/components/marketing/sections/CTASection";
import HeroVisual from "@/components/marketing/hero/HeroVisual";

export default async function HomePage() {
  const t = await getTranslations("marketing.home");

  return (
    <main id="main">
        <Hero
          eyebrow={t("hero.eyebrow")}
          title={t("hero.title")}
          highlight={t("hero.highlight")}
          subtitle={t("hero.subtitle")}
          ctaPrimary={t("hero.ctaPrimary")}
          ctaSecondary={t("hero.ctaSecondary")}
        />

        <ValueProps
          title={t("valueProps.title")}
          items={[
            {
              icon: <FolderTree className="h-5 w-5" />,
              label: t("valueProps.context.label"),
              title: t("valueProps.context.title"),
              description: t("valueProps.context.description"),
            },
            {
              icon: <FileCode2 className="h-5 w-5" />,
              label: t("valueProps.truth.label"),
              title: t("valueProps.truth.title"),
              description: t("valueProps.truth.description"),
            },
            {
              icon: <Boxes className="h-5 w-5" />,
              label: t("valueProps.action.label"),
              title: t("valueProps.action.title"),
              description: t("valueProps.action.description"),
            },
          ]}
        />

        <FeatureGrid
          title={t("features.title")}
          subtitle={t("features.subtitle")}
          items={[
            {
              icon: <Brain className="h-5 w-5" />,
              title: t("features.thinking.title"),
              description: t("features.thinking.description"),
              badge: "Core",
            },
            {
              icon: <Terminal className="h-5 w-5" />,
              title: t("features.mcp.title"),
              description: t("features.mcp.description"),
            },
            {
              icon: <Boxes className="h-5 w-5" />,
              title: t("features.sandbox.title"),
              description: t("features.sandbox.description"),
              badge: "Beta",
            },
            {
              icon: <ScrollText className="h-5 w-5" />,
              title: t("features.chatToDoc.title"),
              description: t("features.chatToDoc.description"),
            },
            {
              icon: <KeyRound className="h-5 w-5" />,
              title: t("features.passkey.title"),
              description: t("features.passkey.description"),
            },
            {
              icon: <BarChart3 className="h-5 w-5" />,
              title: t("features.usage.title"),
              description: t("features.usage.description"),
            },
          ]}
        />

        <FeatureSplit
          eyebrow={t("split.truth.eyebrow")}
          title={t("split.truth.title")}
          description={t("split.truth.description")}
          bullets={[
            t("split.truth.bullet1"),
            t("split.truth.bullet2"),
            t("split.truth.bullet3"),
          ]}
          code={`# .project.json (auto-generated, source of truth)
{
  "name": "rabbitdocs",
  "root": "/Users/you/projects/rabbitdocs",
  "git": { "remote": "git@github.com:you/rabbitdocs" },
  "agent": { "model": "claude-sonnet-4", "extendedThinking": true }
}`}
          codeLang=".project.json"
          visual={<HeroVisual />}
        />

        <FeatureSplit
          reverse
          eyebrow={t("split.thinking.eyebrow")}
          title={t("split.thinking.title")}
          description={t("split.thinking.description")}
          bullets={[
            t("split.thinking.bullet1"),
            t("split.thinking.bullet2"),
            t("split.thinking.bullet3"),
          ]}
          code={`> How should I structure the auth middleware?

<thinking>
The user wants advice on auth middleware structure.
Let me check their existing codebase patterns first...
- They use Next.js 16 middleware
- They have proxy.ts already
- jose is already a dependency
</thinking>

I see you're using proxy.ts. Here's a minimal
auth wrapper that validates the JWT and forwards
user context to your route handlers...`}
          codeLang="chat · thinking visible"
          visual={
            <div className="rounded-xl border border-[var(--marketing-border)] bg-[var(--marketing-card)] overflow-hidden">
              <div className="border-b border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-4 py-2.5 font-mono text-[11px] text-[var(--marketing-muted)]">
                claude · extended thinking
              </div>
              <div className="p-5 space-y-3 font-mono text-[12.5px]">
                <div className="flex items-start gap-2 text-[var(--marketing-fg)]">
                  <span className="text-[var(--marketing-muted)]">›</span>
                  <span>How should I structure the auth middleware?</span>
                </div>
                <div className="rounded-md border border-dashed border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-3 text-[var(--marketing-muted)]">
                  <span className="text-blue-500">▸ thinking</span>
                  <br />
                  The user wants advice on auth middleware structure.
                  Let me check their existing codebase patterns first...
                </div>
                <div className="flex items-start gap-2 text-[var(--marketing-fg)]">
                  <span className="text-emerald-500">✓</span>
                  <span>
                    I see you&apos;re using <code className="rounded bg-blue-500/10 px-1 text-blue-500">proxy.ts</code>.
                    Here&apos;s a minimal auth wrapper...
                  </span>
                </div>
              </div>
            </div>
          }
        />

        <TrustBand
          title={t("trust.title")}
          stats={[
            { value: t("trust.stat1.value"), label: t("trust.stat1.label") },
            { value: t("trust.stat2.value"), label: t("trust.stat2.label") },
            { value: t("trust.stat3.value"), label: t("trust.stat3.label") },
          ]}
        />

        <Testimonial
          items={[
            {
              quote: t("testimonial1.quote"),
              author: t("testimonial1.author"),
              role: t("testimonial1.role"),
              initials: t("testimonial1.initials"),
            },
            {
              quote: t("testimonial2.quote"),
              author: t("testimonial2.author"),
              role: t("testimonial2.role"),
              initials: t("testimonial2.initials"),
            },
            {
              quote: t("testimonial3.quote"),
              author: t("testimonial3.author"),
              role: t("testimonial3.role"),
              initials: t("testimonial3.initials"),
            },
          ]}
        />

        <CTASection
          title={t("cta.title")}
          subtitle={t("cta.subtitle")}
          ctaPrimary={t("cta.primary")}
          ctaSecondary={t("cta.secondary")}
        />
      </main>
  );
}
