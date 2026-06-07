import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Rabbit Docs - AI-native document workspace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// OG image 不能用 getBrandName()(会触发 sqlite),统一从环境变量读取并提供默认值
const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME ?? "Rabbit Docs";
const TAGLINE =
  process.env.NEXT_PUBLIC_BRAND_TAGLINE ??
  "AI-native document workspace. The whole project becomes Claude context, with the files you already have as the source of truth.";

/**
 * 营销站默认 OG 图片:深色背景 + Logo + 主标语
 * 在 (marketing) 路由组的根级生效,所有营销页面默认使用
 */
export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          background:
            "linear-gradient(135deg, #0a0a0a 0%, #0a0a0a 50%, #0c1936 100%)",
          padding: "80px",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "rgba(59, 130, 246, 0.15)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              width="32"
              height="32"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="1.5"
              strokeLinejoin="round"
            >
              <path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
              <path d="M14 3v5h5" />
              <path d="M7.5 12h7M7.5 15h7M7.5 18h4" />
            </svg>
          </div>
          <span style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em" }}>
            {BRAND}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 900 }}>
          <div
            style={{
              fontSize: 18,
              color: "#60a5fa",
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: 20,
            }}
          >
            Filesystem as Source of Truth
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "#fafafa",
            }}
          >
            Your filesystem is
            <br />
            <span style={{ color: "#60a5fa" }}>the prompt.</span>
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#a1a1aa",
              marginTop: 32,
              maxWidth: 720,
              lineHeight: 1.4,
            }}
          >
            {TAGLINE}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 16,
            color: "#71717a",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          <span>rabbitai-lab.com</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>v0.1</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
