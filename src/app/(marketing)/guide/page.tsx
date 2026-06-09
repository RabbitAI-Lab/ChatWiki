import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import CTASection from "@/components/marketing/sections/CTASection";
import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";
import { Heading } from "@/components/marketing/primitives/Heading";
import { Text } from "@/components/marketing/primitives/Text";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.guide.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

/**
 * 使用指南页：纯 server component，与 about 页保持同一模式
 * FAQ 使用原生 <details>/<summary>，无需 client JS
 */
export default async function GuidePage() {
  const t = await getTranslations("marketing.guide");

  const faqItems = t.raw("faq.items") as Array<{ q: string; a: string }>;

  const sectionLinks = [
    { id: "signup", label: t("sections.signup.title") },
    { id: "chat", label: t("sections.chat.title") },
    { id: "projects", label: t("sections.projects.title") },
    { id: "workspaces", label: t("sections.workspaces.title") },
    { id: "sharing", label: t("sections.sharing.title") },
    { id: "account", label: t("sections.account.title") },
    { id: "faq", label: t("faq.title") },
  ];

  const signupSteps = t.raw("sections.signup.steps") as Record<string, string>;

  return (
    <main id="main">
      {/* Hero */}
      <Section className="pt-20 sm:pt-28 pb-12">
        <Container>
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-3 py-1 text-xs font-mono text-[var(--marketing-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              {t("hero.eyebrow")}
            </span>
            <Heading as="h1" className="mt-6">
              {t("hero.title")}
            </Heading>
            <Text variant="lead" className="mt-5">
              {t("hero.subtitle")}
            </Text>
          </div>
        </Container>
      </Section>

      {/* Body: sidebar TOC + content */}
      <Section className="border-t border-[var(--marketing-border)] pt-0">
        <Container>
          <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
            {/* Sticky sidebar TOC */}
            <aside className="hidden lg:block lg:w-56 flex-shrink-0">
              <nav
                aria-label={t("toc")}
                className="sticky top-24 space-y-1"
              >
                <p className="text-xs font-mono uppercase tracking-wider text-[var(--marketing-muted)] mb-3">
                  {t("toc")}
                </p>
                {sectionLinks.map((link) => (
                  <a
                    key={link.id}
                    href={`#${link.id}`}
                    className="block rounded-md px-3 py-1.5 text-sm text-[var(--marketing-muted)] transition-colors hover:bg-[var(--marketing-surface)] hover:text-[var(--marketing-fg)]"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </aside>

            {/* Main content */}
            <div className="min-w-0 max-w-3xl space-y-16">
              {/* Signup */}
              <section id="signup" aria-labelledby="signup-heading">
                <Text variant="mono" className="text-blue-500">
                  01
                </Text>
                <Heading as="h2" id="signup-heading" className="mt-3 text-2xl sm:text-3xl">
                  {t("sections.signup.title")}
                </Heading>
                <ol className="mt-6 space-y-4">
                  {Object.values(signupSteps).map((step, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-4 text-sm text-[var(--marketing-fg)] leading-relaxed"
                    >
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-xs font-medium text-blue-500">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
                <Text variant="muted" className="mt-5">
                  {t("sections.signup.passkey")}
                </Text>
              </section>

              {/* Chat */}
              <section id="chat" aria-labelledby="chat-heading">
                <Text variant="mono" className="text-blue-500">
                  02
                </Text>
                <Heading as="h2" id="chat-heading" className="mt-3 text-2xl sm:text-3xl">
                  {t("sections.chat.title")}
                </Heading>
                <Text variant="lead" className="mt-4">
                  {t("sections.chat.subtitle")}
                </Text>

                <div className="mt-8 space-y-8">
                  {(["start", "thinking", "actions"] as const).map((key) => (
                    <div key={key}>
                      <h3 className="text-lg font-medium text-[var(--marketing-fg)]">
                        {t(`sections.chat.${key}.title`)}
                      </h3>
                      <Text variant="muted" className="mt-2">
                        {t(`sections.chat.${key}.desc`)}
                      </Text>
                    </div>
                  ))}
                </div>
              </section>

              {/* Projects */}
              <section id="projects" aria-labelledby="projects-heading">
                <Text variant="mono" className="text-blue-500">
                  03
                </Text>
                <Heading as="h2" id="projects-heading" className="mt-3 text-2xl sm:text-3xl">
                  {t("sections.projects.title")}
                </Heading>
                <Text variant="lead" className="mt-4">
                  {t("sections.projects.subtitle")}
                </Text>
                <ul className="mt-6 space-y-3">
                  {[
                    t("sections.projects.create"),
                    t("sections.projects.files"),
                    t("sections.projects.save"),
                  ].map((text) => (
                    <li
                      key={text}
                      className="flex items-start gap-3 text-sm text-[var(--marketing-fg)] leading-relaxed"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500"
                      >
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6.5l2.5 2.5L10 3" />
                        </svg>
                      </span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-[var(--marketing-fg)]">
                    {t("sections.projects.templates.title")}
                  </h3>
                  <Text variant="muted" className="mt-2">
                    {t("sections.projects.templates.desc")}
                  </Text>
                </div>
              </section>

              {/* Workspaces */}
              <section id="workspaces" aria-labelledby="workspaces-heading">
                <Text variant="mono" className="text-blue-500">
                  04
                </Text>
                <Heading as="h2" id="workspaces-heading" className="mt-3 text-2xl sm:text-3xl">
                  {t("sections.workspaces.title")}
                </Heading>
                <Text variant="muted" className="mt-4 leading-relaxed">
                  {t("sections.workspaces.desc")}
                </Text>
              </section>

              {/* Sharing */}
              <section id="sharing" aria-labelledby="sharing-heading">
                <Text variant="mono" className="text-blue-500">
                  05
                </Text>
                <Heading as="h2" id="sharing-heading" className="mt-3 text-2xl sm:text-3xl">
                  {t("sections.sharing.title")}
                </Heading>
                <ul className="mt-6 space-y-3">
                  {[
                    t("sections.sharing.docs"),
                    t("sections.sharing.chat"),
                    t("sections.sharing.revoke"),
                  ].map((text) => (
                    <li
                      key={text}
                      className="flex items-start gap-3 text-sm text-[var(--marketing-fg)] leading-relaxed"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500"
                      >
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 6.5l2.5 2.5L10 3" />
                        </svg>
                      </span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Account */}
              <section id="account" aria-labelledby="account-heading">
                <Text variant="mono" className="text-blue-500">
                  06
                </Text>
                <Heading as="h2" id="account-heading" className="mt-3 text-2xl sm:text-3xl">
                  {t("sections.account.title")}
                </Heading>
                <div className="mt-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-[var(--marketing-fg)]">
                      {t("sections.account.profile")}
                    </h3>
                  </div>
                  {(["models", "billing"] as const).map((key) => (
                    <div key={key}>
                      <h3 className="text-lg font-medium text-[var(--marketing-fg)]">
                        {t(`sections.account.${key}.title`)}
                      </h3>
                      <Text variant="muted" className="mt-2">
                        {t(`sections.account.${key}.desc`)}
                      </Text>
                    </div>
                  ))}
                </div>
              </section>

              {/* FAQ */}
              <section id="faq" aria-labelledby="faq-heading" className="border-t border-[var(--marketing-border)] pt-16">
                <Heading as="h2" id="faq-heading" className="text-2xl sm:text-3xl">
                  {t("faq.title")}
                </Heading>
                <dl className="mt-8 divide-y divide-[var(--marketing-border)]">
                  {faqItems.map((item, i) => (
                    <details key={i} className="group py-5">
                      <summary className="flex cursor-pointer items-center justify-between text-[15px] font-medium text-[var(--marketing-fg)] list-none [&::-webkit-details-marker]:hidden">
                        <span>{item.q}</span>
                        <span
                          aria-hidden="true"
                          className="ml-4 flex-shrink-0 text-[var(--marketing-muted)] transition-transform duration-200 group-open:rotate-45"
                        >
                          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M8 3v10M3 8h10" />
                          </svg>
                        </span>
                      </summary>
                      <Text variant="muted" className="mt-3 leading-relaxed">
                        {item.a}
                      </Text>
                    </details>
                  ))}
                </dl>
              </section>
            </div>
          </div>
        </Container>
      </Section>

      {/* CTA */}
      <CTASection
        title={t("cta.title")}
        subtitle={t("cta.subtitle")}
        ctaPrimary={t("cta.primary")}
        ctaSecondary={t("cta.secondary")}
      />
    </main>
  );
}
