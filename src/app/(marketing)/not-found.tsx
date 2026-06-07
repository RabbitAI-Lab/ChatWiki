import Link from "next/link";
import MarketingShell from "@/components/marketing/nav/MarketingShell";
import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";
import { Heading } from "@/components/marketing/primitives/Heading";
import { Text } from "@/components/marketing/primitives/Text";
import { Button } from "@/components/marketing/primitives/Button";

export const metadata = {
  title: "404 - Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <MarketingShell>
      <Section className="py-32">
        <Container>
          <div className="max-w-2xl mx-auto text-center">
            <Text variant="mono" className="text-blue-500">
              404
            </Text>
            <Heading as="h1" className="mt-3">
              这页没找到。
            </Heading>
            <Text variant="lead" className="mt-5">
              可能链接拼错了,或者页面已经被搬走。回到首页或探索功能页面。
            </Text>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button href="/" size="lg">
                回到首页
              </Button>
              <Button href="/features" variant="secondary" size="lg">
                查看功能
              </Button>
            </div>
            <p className="mt-10 font-mono text-xs text-[var(--marketing-muted)]">
              {"// or maybe you're looking for one of these:"}
            </p>
            <ul className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
              <li>
                <Link
                  href="/pricing"
                  className="text-[var(--marketing-muted)] hover:text-[var(--marketing-fg)] transition-colors"
                >
                  套餐
                </Link>
              </li>
              <li>
                <Link
                  href="/use-cases"
                  className="text-[var(--marketing-muted)] hover:text-[var(--marketing-fg)] transition-colors"
                >
                  应用场景
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="text-[var(--marketing-muted)] hover:text-[var(--marketing-fg)] transition-colors"
                >
                  关于
                </Link>
              </li>
            </ul>
          </div>
        </Container>
      </Section>
    </MarketingShell>
  );
}
