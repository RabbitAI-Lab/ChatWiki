# 本地字体目录

本目录存放通过 `next/font/local` 自托管的 Geist 字体文件，用于**消除构建期对 Google Fonts 的网络依赖**。

## 字体来源

| 字体 | 来源 | 协议 |
|---|---|---|
| Geist Sans | `@fontsource-variable/geist@5.2.9` | SIL Open Font License 1.1 |
| Geist Mono | `@fontsource-variable/geist-mono@5.2.8` | SIL Open Font License 1.1 |

## 文件说明

`Geist` 与 `Geist Mono` 均为**可变字体（Variable Font）**，单文件覆盖 100-900 字重。

```
fonts/
├── Geist/
│   ├── Geist-Latin-Variable.woff2         # 正体（拉丁）
│   └── Geist-Latin-Variable-Italic.woff2  # 斜体（拉丁）
└── GeistMono/
    ├── GeistMono-Latin-Variable.woff2         # 正体（拉丁）
    └── GeistMono-Latin-Variable-Italic.woff2  # 斜体（拉丁）
```

## 升级字体

```bash
# 查询最新版本
npm view @fontsource-variable/geist version
npm view @fontsource-variable/geist-mono version

# 下载新版本 woff2 文件（替换 URL 中的版本号）
curl -fsSL -o public/fonts/Geist/Geist-Latin-Variable.woff2 \
  "https://cdn.jsdelivr.net/npm/@fontsource-variable/geist@<新版本>/files/geist-latin-wght-normal.woff2"
curl -fsSL -o public/fonts/Geist/Geist-Latin-Variable-Italic.woff2 \
  "https://cdn.jsdelivr.net/npm/@fontsource-variable/geist@<新版本>/files/geist-latin-wght-italic.woff2"
curl -fsSL -o public/fonts/GeistMono/GeistMono-Latin-Variable.woff2 \
  "https://cdn.jsdelivr.net/npm/@fontsource-variable/geist-mono@<新版本>/files/geist-mono-latin-wght-normal.woff2"
curl -fsSL -o public/fonts/GeistMono/GeistMono-Latin-Variable-Italic.woff2 \
  "https://cdn.jsdelivr.net/npm/@fontsource-variable/geist-mono@<新版本>/files/geist-mono-latin-wght-italic.woff2"
```

## 添加其他字符子集

若需要支持中文 / 希腊文 / 越南文等，可下载对应子集并加入 `src/app/layout.tsx` 的 `localFont.src` 数组：

```ts
// 例：添加越南文子集
{
  path: "../../public/fonts/Geist/Geist-Vietnamese-Variable.woff2",
  weight: "100 900",
  style: "normal",
}
```

子集文件名参考 `@fontsource-variable/geist/files/` 目录。

## 引入方式

`src/app/layout.tsx`：

```ts
import localFont from "next/font/local";

const geistSans = localFont({
  src: [
    { path: "../../public/fonts/Geist/Geist-Latin-Variable.woff2", weight: "100 900", style: "normal" },
    { path: "../../public/fonts/Geist/Geist-Latin-Variable-Italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-geist-sans",
  display: "swap",
});
```
