import { ReactNode } from "react";
import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";
import { Heading } from "@/components/marketing/primitives/Heading";
import { Text } from "@/components/marketing/primitives/Text";

interface UseCase {
  icon: ReactNode;
  title: string;
  description: string;
  highlights: string[];
}

interface UseCaseCardsProps {
  title: string;
  items: UseCase[];
}

/**
 * 4 张角色场景卡:左 icon,右文案 + 重点列表
 */
export default function UseCaseCards({ title, items }: UseCaseCardsProps) {
  return (
    <Section>
      <Container>
        <Heading as="h2" className="max-w-2xl">
          {title}
        </Heading>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          {items.map((uc) => (
            <article
              key={uc.title}
              className="group relative overflow-hidden rounded-xl border border-[var(--marketing-border)] bg-[var(--marketing-card)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-blue-500/30"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                {uc.icon}
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[var(--marketing-fg)]">
                {uc.title}
              </h3>
              <Text variant="muted" className="mt-2">
                {uc.description}
              </Text>
              <ul className="mt-5 space-y-2 border-t border-[var(--marketing-border)] pt-4">
                {uc.highlights.map((h) => (
                  <li
                    key={h}
                    className="flex items-start gap-2 text-sm text-[var(--marketing-fg)]"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-1 w-1 rounded-full bg-blue-500 flex-shrink-0"
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Container>
    </Section>
  );
}
