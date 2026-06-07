import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";

interface Stat {
  value: string;
  label: string;
}

interface TrustBandProps {
  title: string;
  stats: Stat[];
}

/**
 * 数字带:三栏统计(用户/项目/可用性)
 */
export default function TrustBand({ title, stats }: TrustBandProps) {
  return (
    <Section className="py-12 sm:py-16">
      <Container>
        <p className="text-center text-xs font-mono uppercase tracking-wider text-[var(--marketing-muted)]">
          {title}
        </p>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl sm:text-4xl font-mono font-semibold text-[var(--marketing-fg)]">
                {s.value}
              </p>
              <p className="mt-1 text-sm text-[var(--marketing-muted)]">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}
