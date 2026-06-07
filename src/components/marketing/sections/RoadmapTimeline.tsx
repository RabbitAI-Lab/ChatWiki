import { Container } from "@/components/marketing/primitives/Container";
import { Section } from "@/components/marketing/primitives/Section";
import { Heading } from "@/components/marketing/primitives/Heading";
import { Text } from "@/components/marketing/primitives/Text";

export interface TimelineItem {
  date: string;
  title: string;
  description: string;
  status: "shipped" | "in-progress" | "planned";
}

interface RoadmapTimelineProps {
  title: string;
  items: TimelineItem[];
}

const statusStyle = {
  shipped: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  "in-progress": "bg-blue-500/10 text-blue-500 border-blue-500/30",
  planned: "bg-zinc-500/10 text-zinc-500 border-zinc-500/30",
} as const;

const statusLabel = {
  shipped: "已发布",
  "in-progress": "进行中",
  planned: "计划中",
} as const;

/**
 * 路线图时间线:垂直排列,左侧 status 徽章 + 日期,右侧标题/描述
 */
export default function RoadmapTimeline({ title, items }: RoadmapTimelineProps) {
  return (
    <Section>
      <Container>
        <Heading as="h2">{title}</Heading>
        <ol className="mt-10 space-y-6">
          {items.map((it, idx) => (
            <li
              key={`${it.title}-${idx}`}
              className="relative pl-8 sm:pl-32"
            >
              <span
                className={`absolute left-0 top-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider sm:left-0 ${
                  statusStyle[it.status]
                }`}
              >
                {statusLabel[it.status]}
              </span>
              <span className="absolute left-0 top-7 hidden font-mono text-xs text-[var(--marketing-muted)] sm:block sm:translate-x-0">
                {it.date}
              </span>
              <div>
                <span className="font-mono text-xs text-[var(--marketing-muted)] sm:hidden">
                  {it.date}
                </span>
                <h3 className="mt-1 text-base font-semibold text-[var(--marketing-fg)] sm:mt-0">
                  {it.title}
                </h3>
                <Text variant="muted" className="mt-1.5">
                  {it.description}
                </Text>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
