import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import RoadmapTimeline, {
  type TimelineItem,
} from "@/components/marketing/sections/RoadmapTimeline";
import CTASection from "@/components/marketing/sections/CTASection";
import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";
import { Heading } from "@/components/marketing/primitives/Heading";
import { Text } from "@/components/marketing/primitives/Text";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.about.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function AboutPage() {
  const t = await getTranslations("marketing.about");

  const timeline: TimelineItem[] = (
    t.raw("roadmap.items") as Array<{
      date: string;
      title: string;
      description: string;
      status: "shipped" | "in-progress" | "planned";
    }>
  );

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

      {/* Mission */}
      <Section className="border-t border-[var(--marketing-border)]">
        <Container>
          <div className="max-w-3xl">
            <Text variant="mono" className="text-blue-500">
              {t("mission.label")}
            </Text>
            <Heading as="h2" className="mt-3 text-3xl sm:text-4xl">
              {t("mission.title")}
            </Heading>
            <Text variant="lead" className="mt-5">
              {t("mission.description")}
            </Text>
            <ul className="mt-8 space-y-3">
              {(t.raw("mission.bullets") as string[]).map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 text-sm text-[var(--marketing-fg)]"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500"
                  >
                    <svg
                      viewBox="0 0 12 12"
                      className="h-2.5 w-2.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 6.5l2.5 2.5L10 3" />
                    </svg>
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      {/* Roadmap */}
      <RoadmapTimeline title={t("roadmap.title")} items={timeline} />

      {/* Contact */}
      <Section className="border-t border-[var(--marketing-border)]">
        <Container>
          <div className="max-w-3xl">
            <Text variant="mono" className="text-blue-500">
              {t("contact.label")}
            </Text>
            <Heading as="h2" className="mt-3 text-3xl">
              {t("contact.title")}
            </Heading>
            <Text variant="lead" className="mt-5">
              {t("contact.description")}
            </Text>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                t.raw("contact.channels") as Array<{
                  label: string;
                  value: string;
                  href: string;
                }>
              ).map((c) => (
                <a
                  key={c.label}
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="group flex items-center justify-between rounded-lg border border-[var(--marketing-border)] bg-[var(--marketing-card)] px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/30"
                >
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--marketing-muted)]">
                      {c.label}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--marketing-fg)]">
                      {c.value}
                    </p>
                  </div>
                  <span
                    aria-hidden="true"
                    className="text-[var(--marketing-muted)] transition-transform group-hover:translate-x-1 group-hover:text-blue-500"
                  >
                    →
                  </span>
                </a>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      <CTASection
        title={t("cta.title")}
        subtitle={t("cta.subtitle")}
        ctaPrimary={t("cta.primary")}
        ctaSecondary={t("cta.secondary")}
      />
    </main>
  );
}
