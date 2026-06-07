interface LogoProps {
  className?: string;
}

/**
 * 营销站 logo - 抽象的"兔耳 + 文档"图形,与产品内部 🐰 emoji 区分。
 * 单色,跟随 currentColor。
 */
export default function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* 文档主体 */}
      <path
        d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* 兔耳:两道向右上倾斜的细线 */}
      <path
        d="M14 3v5h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* 文档内文线条 */}
      <path
        d="M7.5 12h7M7.5 15h7M7.5 18h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
