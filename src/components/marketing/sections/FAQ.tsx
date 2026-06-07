"use client";

import { useState } from "react";
import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";
import { Heading } from "@/components/marketing/primitives/Heading";
import { Text } from "@/components/marketing/primitives/Text";
import { Plus } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  title: string;
  subtitle?: string;
  items: FAQItem[];
}

/**
 * 折叠问答:本地 state,一次只展开一项(可同时展开多)
 */
export default function FAQ({ title, subtitle, items }: FAQProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <Section>
      <Container>
        <div className="max-w-2xl mx-auto">
          <Heading as="h2" className="text-center">
            {title}
          </Heading>
          {subtitle && (
            <Text variant="muted" className="mt-3 text-center">
              {subtitle}
            </Text>
          )}
          <ul className="mt-10 space-y-2">
            {items.map((item, idx) => {
              const open = openIdx === idx;
              return (
                <li
                  key={idx}
                  className="rounded-lg border border-[var(--marketing-border)] bg-[var(--marketing-card)] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIdx(open ? null : idx)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--marketing-surface)]"
                  >
                    <span className="text-sm font-medium text-[var(--marketing-fg)]">
                      {item.question}
                    </span>
                    <Plus
                      className={`h-4 w-4 text-[var(--marketing-muted)] transition-transform duration-200 ${
                        open ? "rotate-45" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {open && (
                    <div className="px-5 pb-4 text-sm text-[var(--marketing-muted)] leading-relaxed">
                      {item.answer}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
