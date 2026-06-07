import { ReactNode } from "react";
import clsx from "clsx";
import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";
import { Heading } from "@/components/marketing/primitives/Heading";
import { Text } from "@/components/marketing/primitives/Text";
import { Code } from "@/components/marketing/primitives/Code";

interface FeatureSplitProps {
  eyebrow: string;
  title: string;
  description: string;
  bullets?: string[];
  visual: ReactNode;
  reverse?: boolean;
  code?: string;
  codeLang?: string;
}

/**
 * 左文右视觉(可反转)的特性深讲
 */
export default function FeatureSplit({
  eyebrow,
  title,
  description,
  bullets,
  visual,
  reverse,
  code,
  codeLang,
}: FeatureSplitProps) {
  return (
    <Section>
      <Container>
        <div
          className={clsx(
            "grid grid-cols-1 gap-10 lg:gap-16 items-center",
            "lg:grid-cols-2"
          )}
        >
          <div className={clsx(reverse && "lg:order-2")}>
            <Text variant="mono" className="text-blue-500">
              {eyebrow}
            </Text>
            <Heading as="h3" className="mt-3 text-2xl sm:text-3xl">
              {title}
            </Heading>
            <Text variant="muted" className="mt-4">
              {description}
            </Text>
            {bullets && (
              <ul className="mt-6 space-y-2.5">
                {bullets.map((b) => (
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
            )}
            {code && (
              <pre className="mt-6 overflow-x-auto rounded-lg border border-[var(--marketing-border)] bg-zinc-950 p-4 text-[12px] leading-relaxed text-zinc-300">
                <code>
                  {codeLang && (
                    <span className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
                      {codeLang}
                    </span>
                  )}
                  {code}
                </code>
              </pre>
            )}
          </div>
          <div className={clsx(reverse && "lg:order-1")}>
            <div className="relative">{visual}</div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

// Re-export Code for convenience
export { Code };
