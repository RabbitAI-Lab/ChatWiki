import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Code2, Users, PenLine, Cpu } from "lucide-react";
import UseCaseCards from "@/components/marketing/sections/UseCaseCard";
import CTASection from "@/components/marketing/sections/CTASection";
import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";
import { Heading } from "@/components/marketing/primitives/Heading";
import { Text } from "@/components/marketing/primitives/Text";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.useCases.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function UseCasesPage() {
  const t = await getTranslations("marketing.useCases");

  const items = [
    {
      icon: <Code2 className="h-5 w-5" />,
      title: t("personas.solo.title"),
      description: t("personas.solo.description"),
      highlights: t.raw("personas.solo.highlights") as string[],
    },
    {
      icon: <Users className="h-5 w-5" />,
      title: t("personas.team.title"),
      description: t("personas.team.description"),
      highlights: t.raw("personas.team.highlights") as string[],
    },
    {
      icon: <PenLine className="h-5 w-5" />,
      title: t("personas.writer.title"),
      description: t("personas.writer.description"),
      highlights: t.raw("personas.writer.highlights") as string[],
    },
    {
      icon: <Cpu className="h-5 w-5" />,
      title: t("personas.ai.title"),
      description: t("personas.ai.description"),
      highlights: t.raw("personas.ai.highlights") as string[],
    },
  ];

  return (
    <main id="main">
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
              {t("subtitle")}
            </Text>
          </div>
        </Container>
      </Section>

      <UseCaseCards title={t("cardsTitle")} items={items} />

      <CTASection
        title={t("cta.title")}
        subtitle={t("cta.subtitle")}
        ctaPrimary={t("cta.primary")}
        ctaSecondary={t("cta.secondary")}
      />
    </main>
  );
}
