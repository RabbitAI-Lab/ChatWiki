import { ReactNode } from "react";
import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";
import { Heading } from "@/components/marketing/primitives/Heading";

interface ValueProp {
  icon: ReactNode;
  label: string;
  title: string;
  description: string;
}

interface ValuePropsProps {
  title: string;
  items: ValueProp[];
}

/**
 * 三联价值主张:每项左侧小图标(Geist Mono 蓝)+ 标签 + 标题 + 描述
 */
export default function ValueProps({ title, items }: ValuePropsProps) {
  return (
    <Section aria-labelledby="value-props-title">
      <Container>
        <Heading as="h2" id="value-props-title" className="text-3xl sm:text-4xl">
          {title}
        </Heading>
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="group relative overflow-hidden rounded-xl border border-[var(--marketing-border)] bg-[var(--marketing-card)] p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 font-mono text-sm">
                {item.icon}
              </div>
              <p className="mt-5 font-mono text-xs uppercase tracking-wider text-[var(--marketing-muted)]">
                {item.label}
              </p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--marketing-fg)]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--marketing-muted)]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
