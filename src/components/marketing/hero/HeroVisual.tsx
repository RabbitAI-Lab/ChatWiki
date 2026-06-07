/**
 * 终端窗口占位:深色背景 + 8 行伪命令交互,Geist Mono 字体,蓝色光标闪烁。
 * 用于 hero 区域的产品"截图感"占位,无真实截图素材时使用。
 */
export default function HeroVisual() {
  return (
    <div className="relative">
      {/* 外部微光 */}
      <div
        aria-hidden="true"
        className="absolute -inset-4 -z-10 rounded-2xl bg-blue-500/10 blur-2xl"
      />

      <div className="rounded-xl bg-zinc-950 shadow-2xl shadow-blue-500/10 ring-1 ring-white/10 overflow-hidden">
        {/* 窗口 chrome */}
        <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          <span className="ml-3 font-mono text-[11px] text-zinc-500">
            ~/projects/rabbitdocs
          </span>
        </div>

        {/* 终端内容 */}
        <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-zinc-300">
          <code>
            <span className="text-zinc-500">$</span>{" "}
            <span className="text-zinc-100">rabbitdocs init</span>
            {"\n"}
            <span className="text-zinc-500">→</span>{" "}
            <span className="text-blue-400">scanning</span> 247 files in{" "}
            <span className="text-zinc-100">/docs</span> + 1 git repo
            {"\n"}
            <span className="text-zinc-500">→</span>{" "}
            <span className="text-blue-400">indexing</span> code graph via
            GitNexus
            {"\n"}
            <span className="text-zinc-500">→</span>{" "}
            <span className="text-emerald-400">ready</span> · claude-sonnet-4
            attached
            {"\n\n"}
            <span className="text-zinc-500">$</span>{" "}
            <span className="text-zinc-100">rabbitdocs ask</span>{" "}
            <span className="text-amber-300">
              &quot;Create a README from /docs&quot;
            </span>
            {"\n"}
            <span className="text-zinc-500">claude ▌</span>{" "}
            <span className="text-blue-400 animate-pulse">thinking</span>
            {"\n"}
            <span className="text-zinc-500">→</span>{" "}
            <span className="text-zinc-300">
              read 12 files · 1,847 tokens · 1.2s
            </span>
            {"\n"}
            <span className="text-zinc-500">→</span>{" "}
            <span className="text-emerald-400">wrote</span>{" "}
            <span className="text-zinc-100">/README.md</span> (3 sections, 412
            words)
          </code>
        </pre>
      </div>

      {/* 角标:GitNexus */}
      <div className="absolute -bottom-3 -right-3 rounded-md border border-zinc-800 bg-zinc-950/90 px-2.5 py-1 font-mono text-[10px] text-zinc-500 shadow-lg">
        powered by Claude Agent SDK
      </div>
    </div>
  );
}
