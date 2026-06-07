import { ReactNode } from "react";
import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";
import { Heading } from "@/components/marketing/primitives/Heading";
import { Text } from "@/components/marketing/primitives/Text";
import { Badge } from "@/components/marketing/primitives/Badge";

interface FeatureCard {
  icon: ReactNode;
  title: string;
  description: string;
  badge?: string;
}

interface FeatureGridProps {
  title: string;
  subtitle?: string;
  items: FeatureCard[];
}

/**
 * 特性卡片网格:6 张卡片,hover 上浮
 */
export default function FeatureGrid({ title, subtitle, items }: FeatureGridProps) {
  return (
    <Section aria-label={title}>
      <Container>
        <div className="max-w-2xl">
          <Heading as="h2">{title}</Heading>
          {subtitle && (
            <Text variant="muted" className="mt-4">
              {subtitle}
            </Text>
          )}
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.title}
              className="group relative flex flex-col rounded-xl border border-[var(--marketing-border)] bg-[var(--marketing-card)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/30"
            >
              <div className="flex items-start justify-between">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                  {item.icon}
                </div>
                {item.badge && <Badge variant="accent">{item.badge}</Badge>}
              </div>
              <h3 className="mt-5 text-base font-semibold text-[var(--marketing-fg)]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--marketing-muted)]">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
