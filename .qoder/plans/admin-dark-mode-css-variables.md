# Admin 页面 Dark 模式 CSS 变量统一迁移

## Context

Admin 布局外层容器已正确使用 `dark:bg-[var(--main-bg)]`，但 9 个 Admin 页面组件内部使用了硬编码的 Tailwind zinc/gray dark 颜色（如 `dark:bg-zinc-800`=`#27272a`、`dark:bg-zinc-900`=`#18181b`）。即使用户在外观设置中配置了 `--main-bg: #09090b`，这些页面仍然显示固定的灰色背景，无法响应主题配置。

## 替换策略

所有替换仅修改 `dark:` 前缀的类，亮色模式完全不动：

| 当前值 | 替换为 | dark 默认值 |
|--------|--------|------------|
| `dark:bg-zinc-900` | `dark:bg-[var(--main-bg)]` | `#09090b` |
| `dark:bg-zinc-800` | `dark:bg-[var(--popup-bg)]` | `#18181b` |
| `dark:bg-zinc-800/50` | `dark:bg-[var(--popup-header-bg)]` | `rgba(24,24,27,0.5)` |
| `dark:border-zinc-700` | `dark:border-[var(--sidebar-border)]` | `#27272a` |

## 文件修改清单

### 1. GeneralSettingsPageClient.tsx
- L66 header: `dark:bg-zinc-900` → `dark:bg-[var(--main-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`
- L87 card: `dark:bg-zinc-800` → `dark:bg-[var(--popup-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`
- L108 preview: `dark:bg-zinc-800` → `dark:bg-[var(--popup-bg)]`

### 2. AppearanceSettingsPageClient.tsx
- L85 row border: `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`
- L112 section card: `dark:bg-zinc-800` → `dark:bg-[var(--popup-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`
- L113 section header: `dark:bg-zinc-800/50` → `dark:bg-[var(--popup-header-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`
- L127 page header: `dark:bg-zinc-900` → `dark:bg-[var(--main-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`
- L161 note: `dark:bg-zinc-800` → `dark:bg-[var(--popup-bg)]`

### 3. McpPageClient.tsx
- L106 header: `dark:bg-zinc-900` → `dark:bg-[var(--main-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`
- L132 card: `dark:bg-zinc-800` → `dark:bg-[var(--popup-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`
- L139 code preview: `dark:bg-zinc-800` → `dark:bg-[var(--popup-bg)]`

### 4. ModelsPageClient.tsx
- L273 header: `dark:bg-zinc-900` → `dark:bg-[var(--main-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`

### 5. PlansPageClient.tsx
- L341 header: `dark:bg-zinc-900` → `dark:bg-[var(--main-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`
- L437 price row: `dark:bg-zinc-800` → `dark:bg-[var(--popup-bg)]`

### 6. SystemPromptsPageClient.tsx
- L196 header: `dark:bg-zinc-900` → `dark:bg-[var(--main-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`

### 7. DatabasePageClient.tsx
- L264 header: `dark:bg-zinc-900` → `dark:bg-[var(--main-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`

### 8. StoragePageClient.tsx
- L80 header: `dark:bg-zinc-900` → `dark:bg-[var(--main-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`
- L100 card: `dark:bg-zinc-800` → `dark:bg-[var(--popup-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`

### 9. SandboxPageClient.tsx
- L64 header: `dark:bg-zinc-900` → `dark:bg-[var(--main-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`
- L84 card: `dark:bg-zinc-800` → `dark:bg-[var(--popup-bg)]`, `dark:border-zinc-700` → `dark:border-[var(--sidebar-border)]`

## 验证

1. 切换到 dark 模式，访问 `/admin/general`，确认表单卡片背景使用 CSS 变量（不再是灰色）
2. 访问 `/admin/appearance`，修改 `mainBg` 颜色，保存后返回 `/admin/general`，确认背景跟随变化
3. 在 light 模式下访问所有 Admin 页面，确认无视觉变化
4. 依次访问其余 7 个 Admin 页面（mcp、models、plans、system-prompts、database、storage、sandbox），确认 dark 模式下样式正常
