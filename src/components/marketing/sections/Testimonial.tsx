import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";

interface TestimonialItem {
  quote: string;
  author: string;
  role: string;
  initials: string;
}

interface TestimonialProps {
  items: TestimonialItem[];
}

/**
 * 用户引言:3 卡片或 1 卡片
 */
export default function Testimonial({ items }: TestimonialProps) {
  return (
    <Section>
      <Container>
        <div
          className={
            items.length === 1
              ? "max-w-3xl mx-auto"
              : "grid grid-cols-1 gap-6 md:grid-cols-3"
          }
        >
          {items.map((t, idx) => (
            <figure
              key={idx}
              className="rounded-xl border border-[var(--marketing-border)] bg-[var(--marketing-card)] p-6"
            >
              <blockquote className="text-sm leading-relaxed text-[var(--marketing-fg)]">
                <span aria-hidden="true" className="text-blue-500 text-2xl leading-none">
                  “
                </span>
                {t.quote}
                <span aria-hidden="true" className="text-blue-500 text-2xl leading-none">
                  ”
                </span>
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-500/20 flex items-center justify-center text-xs font-mono text-blue-500">
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--marketing-fg)]">
                    {t.author}
                  </p>
                  <p className="text-xs text-[var(--marketing-muted)]">{t.role}</p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </Section>
  );
}
