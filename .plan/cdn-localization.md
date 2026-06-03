# 第三方 CDN 资源本地化方案

## Context

用户希望了解 ChatWiki 项目中是否存在引用第三方 CDN（字体 / CSS / JS / 图标等）的代码，并要求给出本地化方案。

经过对 `src/`、`public/`、`next.config.ts`、`package.json` 等位置的全量扫描后发现：

- 项目**运行时浏览器并不直接访问任何第三方 CDN 资源**（CSS / JS / 图标均通过 npm 安装，字体由 Next.js 在构建时自托管）。
- 唯一涉及第三方 CDN 的位置是 `src/app/layout.tsx` 中通过 `next/font/google` 引入的 **Geist Sans** 和 **Geist Mono** 字体，对应 CDN 为 `fonts.googleapis.com` / `fonts.gstatic.com`。
- `next/font/google` 在 `next build` 阶段从 Google 拉取字体并自托管到 `.next/static/media/`，**用户访问页面时浏览器不会再请求 Google**。
- 唯一的网络依赖发生在**构建期**——离线或内网环境下 `next build` 会失败。

本计划的目标：

1. 完整列出项目内第三方 CDN 资源，便于审计
2. 给出将构建期外部网络依赖彻底切除的本地化方案（替换为 `next/font/local`）

---

## CDN 资源清单

### 1. 字体（构建期自托管，运行时无 CDN 请求）

| 项 | 引入方式 | 对应 CDN | 引用位置 | 当前用途 | 状态 |
|---|---|---|---|---|---|
| Geist Sans | `next/font/google` | `fonts.googleapis.com` / `fonts.gstatic.com` | `src/app/layout.tsx:3, 10-13` | 提供 `--font-geist-sans` CSS 变量 | **构建时自托管** |
| Geist Mono | `next/font/google` | 同上 | `src/app/layout.tsx:3, 15-18` | 提供 `--font-geist-mono` CSS 变量 | **构建时自托管** |

### 2. CSS 库 / 框架

- **无**。
  - `globals.css` 仅 `@import "tailwindcss";`（npm 包）
  - UI 框架 `antd@^6.4.3` 来自 npm
  - 无任何 `<link rel="stylesheet" href="https://...">` 或 `@import url('https://...')`

### 3. JavaScript 库

- **无**。所有 JS 依赖（`react@19.2.4`、`next@16.2.6`、`antd`、`@monaco-editor/react`、`monaco-editor`、`cherry-markdown`、`isomorphic-git` 等）均通过 `package.json` 安装。
- 无任何 `<script src="https://...">` 标签或动态注入外部脚本的代码。

### 4. 图标库

- **无**。项目使用 `@ant-design/icons@^6.2.5`（npm 包），所有图标通过 npm 安装。

### 5. 图片 / 其他

- `public/` 目录下仅有 5 个本地 SVG（`file.svg`、`globe.svg`、`next.svg`、`vercel.svg`、`window.svg`），无外部图片
- `next.config.ts` 中**未配置** `images.domains` / `remotePatterns`
- `src/lib/model-constants.ts` 中出现的 `https://open.bigmodel.cn/...`、`https://api.deepseek.com/...` 等均为 **LLM 模型 API 端点**（用户在 `ModelConfigModal` 中自行配置），不属于 CDN 资源
- `src/components/mcp/types.ts`、`src/components/workspace/WorkspaceMcpPanel.tsx` 中的 `https://open.bigmodel.cn/api/mcp-broker/...` 是 MCP 服务地址（非资源 CDN），由用户配置
- `src/mcp-server/index.ts`、`src/db/seed.ts` 中的 `http://127.0.0.1:4001/mcp` 是本地回环地址，非外部 CDN
- 若干输入框 placeholder 文本中出现的 `https://github.com/org/repo.git`、`https://example.com/mcp` 等仅为占位提示，不触发任何网络请求

### 6. 特殊说明：`vendor/` 目录

`vendor/huashu-3f410cf/` 等目录中的演示文件（HTML 模板、参考资料）虽然包含 `https://fonts.googleapis.com`、`https://unpkg.com/lucide`、`https://unpkg.com/react@18.3.1/...` 等引用，但**这些文件不参与应用构建与运行**，仅作为内部 Claude skills 的素材。如需启用其中模板，建议按需切换到本地资源。

---

## 本地化方案

### 目标

消除构建期的 Google Fonts 网络依赖，使 `next build` 可以在**离线 / 内网环境**下执行。

### 步骤

#### Task 1：下载并放置字体文件

从 [Google Fonts - Geist](https://fonts.google.com/specimen/Geist) 与 [Google Fonts - Geist Mono](https://fonts.google.com/specimen/Geist+Mono) 下载字体的 woff2 文件到项目内静态资源目录。

- 推荐目录：`public/fonts/Geist/` 与 `public/fonts/GeistMono/`
- 至少包含 Regular（400）、Medium（500）、SemiBold（600）、Bold（700）四个字重
- 推荐使用 **可变字体（Variable Font）单文件**方案，文件更少、覆盖更全
- 确认 `.gitignore` 未忽略 `public/fonts/`（默认不会）

#### Task 2：替换字体引入方式

修改 `src/app/layout.tsx`：

```ts
// 旧
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 新
import localFont from "next/font/local";

const geistSans = localFont({
  src: [
    { path: "../public/fonts/Geist/Geist-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/Geist/Geist-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/Geist/Geist-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../public/fonts/Geist/Geist-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: [
    { path: "../public/fonts/GeistMono/GeistMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/GeistMono/GeistMono-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/GeistMono/GeistMono-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-geist-mono",
  display: "swap",
});
```

> 若使用可变字体，可简化为 `src: "../public/fonts/Geist/Geist-Variable.woff2"`，无需 `weight` 数组。

#### Task 3：可选 - 添加 README 说明

在 `public/fonts/` 下添加简短说明（可选），记录字体来源、版本、License（Geist 采用 SIL Open Font License），便于后续维护。

---

## 关键文件

| 路径 | 操作 |
|---|---|
| `src/app/layout.tsx` | 修改字体引入方式（`next/font/google` → `next/font/local`） |
| `public/fonts/Geist/*.woff2` | 新增 Geist Sans 字体文件 |
| `public/fonts/GeistMono/*.woff2` | 新增 Geist Mono 字体文件 |
| `.gitignore` | 确认字体文件不被忽略 |

---

## 验证

按以下步骤端到端验证本地化效果：

1. **离线构建测试**
   - 断开网络（或关闭代理）
   - 执行 `npm run build`
   - 预期：构建成功，无 `fonts.googleapis.com` / `fonts.gstatic.com` 网络请求报错

2. **运行时无 CDN 请求**
   - 启动 `npm run dev` 或 `npm run start:docker`
   - 打开浏览器开发者工具 → Network 面板，刷新页面
   - 预期：所有请求均为本机域，**无** `fonts.googleapis.com` / `fonts.gstatic.com` 请求

3. **字体渲染验证**
   - 开发者工具 → Elements → 检查 `<html>` 元素的 `class` 是否包含 `__variable_xxx` 等 hash 类名（`next/font/local` 生成）
   - 开发者工具 → Computed → 选中 `<body>` 或任意文字元素，确认 `font-family` 包含 Geist Sans / Geist Mono
   - 视觉回归：所有页面字体显示与本地化前一致

4. **Docker 构建测试**
   - 执行 `npm run docker:build`
   - 预期：在受限网络环境（容器内）构建成功

5. **类型检查 & Lint**
   - 执行 `npm run lint`
   - 预期：无新增告警

---

## 备注

- 如果**仅需满足"运行时浏览器不请求 CDN"**的诉求，当前 `next/font/google` 配置已达成目标，**无需修改**。
- 本方案主要面向**离线 / 内网构建**场景，将构建期外部网络依赖也一并消除。
- `vendor/` 目录中的演示文件因不参与应用运行，**不在本次本地化范围内**；如未来需要将其页面接入应用，应单独评估。
