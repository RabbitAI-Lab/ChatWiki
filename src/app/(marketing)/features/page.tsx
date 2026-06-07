import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  Brain,
  GitBranch,
  ScrollText,
  FileCode2,
  Plug,
  ListChecks,
  Users,
  Share2,
  KeyRound,
  BarChart3,
  FolderTree,
  Boxes,
} from "lucide-react";
import { getBrandName } from "@/lib/auth/settings";
import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";
import { Heading } from "@/components/marketing/primitives/Heading";
import { Text } from "@/components/marketing/primitives/Text";
import { Badge } from "@/components/marketing/primitives/Badge";
import CTASection from "@/components/marketing/sections/CTASection";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.features.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function FeaturesPage() {
  const t = await getTranslations("marketing.features");
  const brandName = getBrandName();

  return (
    <main id="main">
      {/* Hero */}
      <Section className="pt-20 sm:pt-28 pb-12">
        <Container>
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-3 py-1 text-xs font-mono text-[var(--marketing-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              {t("eyebrow")}
            </span>
            <Heading as="h1" className="mt-6">
              {t("title")}
            </Heading>
            <Text variant="lead" className="mt-5">
              {t("subtitle", { brand: brandName })}
            </Text>
          </div>
        </Container>
      </Section>

      {/* 章节 01 - Context */}
      <Chapter
        index="01"
        title={t("chapters.context.title")}
        subtitle={t("chapters.context.subtitle")}
        items={[
          {
            icon: <FolderTree className="h-5 w-5" />,
            title: t("chapters.context.items.context.title"),
            description: t("chapters.context.items.context.description"),
          },
          {
            icon: <Brain className="h-5 w-5" />,
            title: t("chapters.context.items.thinking.title"),
            description: t("chapters.context.items.thinking.description"),
            badge: "Core",
          },
          {
            icon: <BarChart3 className="h-5 w-5" />,
            title: t("chapters.context.items.usage.title"),
            description: t("chapters.context.items.usage.description"),
          },
        ]}
      />

      {/* 章节 02 - Truth */}
      <Chapter
        index="02"
        title={t("chapters.truth.title")}
        subtitle={t("chapters.truth.subtitle")}
        items={[
          {
            icon: <FileCode2 className="h-5 w-5" />,
            title: t("chapters.truth.items.fs.title"),
            description: t("chapters.truth.items.fs.description"),
          },
          {
            icon: <GitBranch className="h-5 w-5" />,
            title: t("chapters.truth.items.git.title"),
            description: t("chapters.truth.items.git.description"),
          },
          {
            icon: <ScrollText className="h-5 w-5" />,
            title: t("chapters.truth.items.chatToDoc.title"),
            description: t("chapters.truth.items.chatToDoc.description"),
          },
        ]}
      />

      {/* 章节 03 - Tools */}
      <Chapter
        index="03"
        title={t("chapters.tools.title")}
        subtitle={t("chapters.tools.subtitle")}
        items={[
          {
            icon: <Plug className="h-5 w-5" />,
            title: t("chapters.tools.items.mcp.title"),
            description: t("chapters.tools.items.mcp.description"),
          },
          {
            icon: <Boxes className="h-5 w-5" />,
            title: t("chapters.tools.items.sandbox.title"),
            description: t("chapters.tools.items.sandbox.description"),
            badge: "Beta",
          },
          {
            icon: <ListChecks className="h-5 w-5" />,
            title: t("chapters.tools.items.audit.title"),
            description: t("chapters.tools.items.audit.description"),
          },
        ]}
      />

      {/* 章节 04 - Collaboration */}
      <Chapter
        index="04"
        title={t("chapters.collab.title")}
        subtitle={t("chapters.collab.subtitle")}
        items={[
          {
            icon: <Users className="h-5 w-5" />,
            title: t("chapters.collab.items.workspace.title"),
            description: t("chapters.collab.items.workspace.description"),
          },
          {
            icon: <Share2 className="h-5 w-5" />,
            title: t("chapters.collab.items.share.title"),
            description: t("chapters.collab.items.share.description"),
          },
          {
            icon: <KeyRound className="h-5 w-5" />,
            title: t("chapters.collab.items.passkey.title"),
            description: t("chapters.collab.items.passkey.description"),
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

interface ChapterProps {
  index: string;
  title: string;
  subtitle: string;
  items: Array<{
    icon: React.ReactNode;
    title: string;
    description: string;
    badge?: string;
  }>;
}

function Chapter({ index, title, subtitle, items }: ChapterProps) {
  return (
    <Section className="border-t border-[var(--marketing-border)]">
      <Container>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Text variant="mono" className="text-blue-500">
              Chapter {index}
            </Text>
            <Heading as="h2" className="mt-2 text-2xl sm:text-3xl">
              {title}
            </Heading>
            <Text variant="muted" className="mt-3">
              {subtitle}
            </Text>
          </div>
          <div className="lg:col-span-8 space-y-4">
            {items.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-[var(--marketing-border)] bg-[var(--marketing-card)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/30"
              >
                <div className="flex items-start gap-4">
                  <div className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-[var(--marketing-fg)]">
                        {item.title}
                      </h3>
                      {item.badge && (
                        <Badge variant="accent">{item.badge}</Badge>
                      )}
                    </div>
                    <Text variant="muted" className="mt-1.5">
                      {item.description}
                    </Text>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
