# McpPanel.tsx 重构

## Context

`src/components/project/McpPanel.tsx` 当前 723 行,单文件承载过多职责:数据获取与缓存、乐观更新 + 失败回滚、增删改查、列表渲染、3 个 Modal(Edit JSON / API Key / Add MCP)、系统 MCP 保护、稳定顺序追踪、zhipu-style URL 重建、表单解析等全部内联在一个组件里,可读性与可维护性较差,后续无论是迭代 UI 还是为 `WorkspaceMcpPanel` 复用都要付出额外成本。

本次重构目标:把 `McpPanel` 拆为**纯装配 wrapper + 自定义 Hook + 多个职责单一的子组件 + 共享类型/工具**,行为完全保持不变(API 调用、UI 文案、列表顺序、disabled 灰显、zhipu URL 重建规则等),为后续 `WorkspaceMcpPanel` 复用共享层预留接口。

> 范围严格限定:`McpPanel.tsx` 一文件的重构。`WorkspaceMcpPanel.tsx`、`ProjectInfoTab.tsx`、`/api/fs/project-mcp/route.ts`、`src/lib/fs.ts` 一律不动。

## 目标

- 提取自定义 Hook `useMcpConfig`,封装所有状态、网络、CRUD 逻辑
- 拆出 5 个子组件:列表项、3 个 Modal、Toolbar
- 抽出 `types.ts` / `utils.ts` 共享类型与纯函数
- `McpPanel.tsx` 收缩为 ~80 行的纯装配 wrapper
- 行为完全保持不变(没有任何功能增减、UI 调整、文案改动)

## 目录结构

```
src/components/mcp/                                ← 新建
├── types.ts                # McpJson / McpServerEntry / McpServerType + 常量
├── utils.ts                # 纯函数:parseLineMap、buildEntryFromFormValues 等
├── use-mcp-config.ts       # 核心 Hook
├── mcp-list-item.tsx       # 单条 server 渲染
├── edit-mcp-modal.tsx      # Edit JSON Modal
├── api-key-mcp-modal.tsx   # API Key Modal
├── add-mcp-modal.tsx       # Add MCP Form Modal
├── mcp-toolbar.tsx         # 顶部 toolbar(计数 + Add 按钮)
└── index.ts (可选)         # 集中 re-export
```

```
src/components/project/
└── McpPanel.tsx            # 由 723 行 → ~80 行的 wrapper
```

## 关键文件设计

### 1. `src/components/mcp/types.ts`

纯声明,无运行时代码:

- `McpServerType = "stdio" | "http" | "sse"`
- `McpServerEntry`(type / command / args / url / env / headers)
- `McpJson { mcpServers; disabled?; _apiKeys }`
- `SYSTEM_MCP_NAMES: ReadonlySet<string> = new Set(["gitnexus", "zhipu-web-search-sse"])`
- `NAME_PATTERN = /^[a-zA-Z0-9_\-]+$/`
- `MCP_BASE_URL = "https://open.bigmodel.cn/api/mcp-broker/proxy/web-search/mcp?Authorization="`

### 2. `src/components/mcp/utils.ts`

纯函数,无 React 依赖:

| 函数 | 职责 |
|------|------|
| `emptyMcpJson()` | 返回 `{ mcpServers: {}, disabled: {}, _apiKeys: {} }` |
| `isSystemMcp(name)` | `SYSTEM_MCP_NAMES.has(name)` |
| `describeServer(entry)` | 生成 `command args` / 脱敏 URL(保留 `Authorization=[^&]+` → `Authorization=***`) |
| `inferType(entry)` | 从 entry 推断 stdio/http/sse,规则不变 |
| `hasAuthorization(entry)` | `!!entry.url?.includes("Authorization=")`,决定是否显示 KeyOutlined |
| `parseLineMap(text, sep)` | 通用多行解析(`sep="="` 解析 env,`sep=":"` 解析 headers) |
| `buildEntryFromFormValues(values)` | Form values → `McpServerEntry`(包含 stdio/http+sse 分支 + env/headers 解析) |

### 3. `src/components/mcp/use-mcp-config.ts` ← **核心**

签名:
```ts
interface UseMcpConfigParams {
  dirSegments: string[];
  apiBase: string; // e.g. "/api/fs/project-mcp";由调用方注入,便于后续 workspace 复用
}

interface UseMcpConfigResult {
  mcpJson: McpJson; loading: boolean; saving: boolean;
  addOpen: boolean; setAddOpen: (b: boolean) => void;
  editTarget: string | null; setEditTarget: (n: string | null) => void;
  editText: string; setEditText: (s: string) => void;
  keyTarget: string | null; setKeyTarget: (n: string | null) => void;
  keyInput: string; setKeyInput: (s: string) => void;
  addForm: FormInstance;
  allEntries: Array<{ name: string; entry: McpServerEntry; isEnabled: boolean }>;
  enabledCount: number; totalCount: number;
  actions: {
    handleToggle: (name: string, checked: boolean) => Promise<void>;
    openEdit: (name: string) => void;
    handleSaveEdit: () => Promise<void>;
    handleSaveKey: () => Promise<void>;
    handleDelete: (name: string) => Promise<void>;
    openAdd: () => void;
    handleAdd: () => Promise<void>;
  };
}

export function useMcpConfig(params: UseMcpConfigParams): UseMcpConfigResult;
```

**内部状态**:mcpJson / loading / saving / 三组 modal 状态 / `addForm` / `entryOrderRef`(必须在 hook 内,跨重渲染稳定)/ `App.useApp()` 取 `message`。

**核心行为**(逐条对齐 `McpPanel.tsx` 现有逻辑,行为完全保持):

- `fetchConfig` — GET `${apiBase}?dirSegments=${dirSegments.join(",")}`,规范化三张 map,`setLoading(false)`。
- `writeBack(next, successMsg?)` — 立即 `setMcpJson(next)` → PUT `${apiBase}`,body `{ dirSegments, mcpJson: { mcpServers, disabled: next.disabled || {}, _apiKeys } }` → 成功:用返回的 `data.mcpJson` 校准 + `message.success`;失败:`message.error` + `await fetchConfig()` 回滚。
- `handleToggle(name, checked)` — `checked=true` 从 `disabled` 移回 `mcpServers`,若 `_apiKeys[name]` 存在则重建 zhipu URL;`checked=false` 反向(URL 维持原样)。
- `openEdit(name)` / `handleSaveEdit()` — 双向查找 entry;`JSON.parse` 失败弹 `"Invalid JSON format"`;写入 `mcpServers` 同时从 `disabled` 删除(编辑隐含启用)。
- `handleSaveKey()` — `keyInput.trim()` 非空校验(`"Please enter API Key"`),重建 zhipu url,强制启用,`_apiKeys` 更新。
- `handleDelete(name)` — 三张 map 都删除,`"Deleted"`。
- `openAdd()` / `handleAdd()` — resetForm + setFieldsValue({ type: "stdio", args: "" });validateFields → 重名检查(`"MCP \"<name>\" 已存在"`)→ `buildEntryFromFormValues` → writeBack(`"MCP added"`)。
- `allEntries` — 完整照搬现有 IIFE 逻辑(`entryOrderRef` 累积新 key → 剔除已删 key → 稳定顺序构造),用 `useMemo` 依赖 `mcpJson`。

### 4. `mcp-list-item.tsx`

```ts
interface McpListItemProps {
  name: string; entry: McpServerEntry; isEnabled: boolean;
  saving: boolean; apiKey?: string;
  onToggle: (name: string, checked: boolean) => void;
  onEditKey: (name: string) => void;
  onEdit: (name: string) => void;
  onDelete: (name: string) => void;
}
```

要点:
- Switch `size="small"` `loading={saving}`
- 容器 className:`isEnabled ? "border-gray-200 hover:border-gray-300" : "border-gray-100 bg-gray-50 opacity-60"`
- Tag 颜色:`stdio=blue, sse=purple, http=green`;`!isEnabled` 时额外 `default` 色 Disabled Tag
- 描述行 `font-mono text-xs text-gray-400 truncate`,`title={describeServer(entry)}`
- `KeyOutlined` 仅 `hasAuthorization(entry)` 时显示
- `EditOutlined` 始终显示,`isSystemMcp(name)` 时切到 `text-gray-300 cursor-not-allowed`(点击仍触发,保留原行为)
- `DeleteOutlined + Popconfirm` 仅 `!isSystemMcp(name)` 时渲染:`title={\`Delete "${name}"?\`}`, `description="This will also remove its saved API Key."`, `okText="Delete"`, `cancelText="Cancel"`, `okButtonProps={{ danger: true }}`

### 5. `edit-mcp-modal.tsx`

Props: `{ open; name; json; saving; onChange; onOk; onCancel }`。标题 `name ? \`Edit "${name}"\` : "Edit MCP"`, `okText="Save"`, `cancelText="Cancel"`, `confirmLoading={saving}`, `width={560}`, `Input.TextArea rows={12} className="font-mono text-sm"`。

### 6. `api-key-mcp-modal.tsx`

Props: `{ open; name; value; saving; onChange; onOk; onCancel }`。标题 `name ? \`API Key for "${name}"\` : "API Key"`, 内容 = 提示段(`The key will be stored in <code>_apiKeys</code> and prepended to the server URL as <code>?Authorization=&lt;key&gt;</code>.`) + `Input.Password placeholder="Enter API Key" autoFocus`。

### 7. `add-mcp-modal.tsx`

Props: `{ open; saving; form; onOk; onCancel }`。`destroyOnHidden` + `width={560}`。内部 `Form form={form} layout="vertical" className="mt-2"`:
- `name` 字段:`required` + `pattern: NAME_PATTERN`
- `type` 字段:三选项,`onChange` 切换时清空无关字段
- `Form.Item shouldUpdate` 内根据 `type` 渲染 stdio 分支(command/args/env)或 http+sse 分支(url/headers);`Input.TextArea className="font-mono text-sm" rows={3}`

### 8. `mcp-toolbar.tsx`

Props: `{ enabledCount; totalCount; onAdd }`。渲染原 JSX 中 `<div className="flex items-center justify-between">` 段(包含 `PlusOutlined` Add MCP 按钮)。**tip 蓝色提示框保留在 wrapper 内**。

### 9. `src/components/project/McpPanel.tsx`(wrapper,~80 行)

```tsx
"use client";
import { useMcpConfig } from "@/components/mcp/use-mcp-config";
import McpListItem from "@/components/mcp/mcp-list-item";
import EditMcpModal from "@/components/mcp/edit-mcp-modal";
import ApiKeyMcpModal from "@/components/mcp/api-key-mcp-modal";
import AddMcpModal from "@/components/mcp/add-mcp-modal";
import McpToolbar from "@/components/mcp/mcp-toolbar";

export default function McpPanel({ projectPath }: { projectPath: string }) {
  const dirSegments = projectPath.split(",");
  const {
    mcpJson, loading, saving,
    addOpen, setAddOpen,
    editTarget, editText, setEditText,
    keyTarget, keyInput, setKeyInput,
    addForm,
    allEntries, enabledCount, totalCount,
    actions,
  } = useMcpConfig({ dirSegments, apiBase: "/api/fs/project-mcp" });

  if (loading) { return /* spinner */ }

  return (
    <div className="space-y-3">
      {/* 蓝色 tip 提示框(文案照搬) */}
      <McpToolbar enabledCount={enabledCount} totalCount={totalCount} onAdd={actions.openAdd} />
      {allEntries.length === 0 ? (
        <div>No MCP servers yet. Click &quot;Add MCP&quot; to create one.</div>
      ) : (
        <div className="space-y-2">
          {allEntries.map(({ name, entry, isEnabled }) => (
            <McpListItem
              key={name}
              name={name} entry={entry} isEnabled={isEnabled} saving={saving}
              apiKey={mcpJson._apiKeys[name]}
              onToggle={actions.handleToggle}
              onEditKey={(n) => { setKeyTarget(n); setKeyInput(mcpJson._apiKeys[n] || ""); }}
              onEdit={actions.openEdit}
              onDelete={actions.handleDelete}
            />
          ))}
        </div>
      )}
      <EditMcpModal
        open={!!editTarget} name={editTarget} json={editText} saving={saving}
        onChange={setEditText} onOk={actions.handleSaveEdit}
        onCancel={() => setEditTarget(null)}
      />
      <ApiKeyMcpModal
        open={!!keyTarget} name={keyTarget} value={keyInput} saving={saving}
        onChange={setKeyInput} onOk={actions.handleSaveKey}
        onCancel={() => { setKeyTarget(null); setKeyInput(""); }}
      />
      <AddMcpModal
        open={addOpen} saving={saving} form={addForm}
        onOk={actions.handleAdd} onCancel={() => setAddOpen(false)}
      />
    </div>
  );
}
```

## 涉及文件

**新建(8 个,全部位于 `src/components/mcp/`)**:
- `src/components/mcp/types.ts`
- `src/components/mcp/utils.ts`
- `src/components/mcp/use-mcp-config.ts`
- `src/components/mcp/mcp-list-item.tsx`
- `src/components/mcp/edit-mcp-modal.tsx`
- `src/components/mcp/api-key-mcp-modal.tsx`
- `src/components/mcp/add-mcp-modal.tsx`
- `src/components/mcp/mcp-toolbar.tsx`

可选: `src/components/mcp/index.ts`(re-export 集中)

**收缩为 wrapper**:
- `src/components/project/McpPanel.tsx`(由 723 行 → ~80 行)

**明确不动**:
- `src/components/project/ProjectInfoTab.tsx`
- `src/components/workspace/WorkspaceMcpPanel.tsx`
- `src/app/api/fs/project-mcp/route.ts`
- `src/lib/fs.ts`

## 关键约束

- **行为完全保持不变**:UI 文案、API 调用、disabled 灰显、zhipu URL 重建、稳定顺序、optimistic update + 失败回滚、表单 rules/placeholder 全部 1:1 保留
- **`entryOrderRef` 必须放 hook 内**,不能挪到 wrapper 或子组件,否则 toggle 时列表顺序会被破坏
- **`apiBase` 由 wrapper 注入**,hook 不写死路径,为后续 workspace 复用预留接口
- **代码注释与 UI 文案一律英文**(项目规范 memory:`UI文本英文硬编码规范`)
- **Ant Design 6 兼容**:`destroyOnHidden`(不用 `destroyOnClose`)、`App.useApp()`(不用静态 `message`)
- **新建子组件文件顶部加 `"use client"`**(Next.js 16 App Router 要求)
- **`AddMcpModal` 的 `form` 实例从 hook 透传**,不在 `AddMcpModal` 内再 `Form.useForm()`,否则与 hook 内的 `openAdd` reset/setFieldsValue 失联

## 验证

### 编译/类型
1. `npx tsc --noEmit`(项目无 `typecheck` script,使用 `package-lock.json` 故走 npm 体系)
2. `npm run lint` 0 错误

### 浏览器行为(在 `/project/.../info` 页面 MCP tab)

| # | 场景 | 预期 |
|---|------|------|
| 1 | 首次进入 MCP tab | loading spinner → list 渲染 |
| 2 | 空状态 | "No MCP servers yet. Click 'Add MCP' to create one." |
| 3 | 启用条目 Switch → 关闭 | 移到 disabled 区域,行变灰,显示 Disabled Tag,**顺序不变**;toast `"Disabled"` |
| 4 | 禁用条目 Switch → 开启 | 移回 enabled 区域;若该 server 有 `_apiKeys` 则 url 自动加 Authorization;toast `"Enabled"` |
| 5 | KeyOutlined 点击 | 打开 API Key Modal,显示当前 key;保存后 toast `"API Key saved"`,url 含 `Authorization=<key>` |
| 6 | EditOutlined 点击(非系统 MCP) | 打开 Edit JSON Modal,文本预填 entry;JSON 损坏则 toast `"Invalid JSON format"`;保存后 toast `"Saved"` |
| 7 | EditOutlined 点击(系统 MCP `gitnexus` / `zhipu-web-search-sse`) | 视觉灰显(`text-gray-300 cursor-not-allowed`),点击仍可打开(保留原行为) |
| 8 | Add MCP | 弹窗打开,type 切换时字段正确切换;env 文本支持 `KEY=VAL` 多行;headers 文本支持 `Key: Value` 多行;提交后 toast `"MCP added"` |
| 9 | Add MCP 重名 | 弹 `MCP "<name>" 已存在` 错误,不做写入 |
| 10 | 系统 MCP 的 Delete 图标 | 完全不渲染 |
| 11 | 非系统 MCP 的 Delete | Popconfirm `Delete "<name>"?` + `This will also remove its saved API Key.`;确认后 toast `"Deleted"` |
| 12 | 失败回滚 | 触发 PUT 失败,`message.error(\`保存失败: ...\`)` + refetch 回滚 |
| 13 | 稳定顺序 | 连续 toggle 同一条目,其他条目相对顺序保持不变 |
| 14 | Switch 视觉 | `size="small"`,`loading={saving}` 在写回过程中显示 |
| 15 | Tag 颜色 | `stdio` 蓝、`sse` 紫、`http` 绿;禁用条目额外 `default` 色 Disabled Tag |
| 16 | Modal 细节 | Edit/Key/Add 三 Modal 的 `width=560`(Edit/Add)、`destroyOnHidden`(Add)、`Input.TextArea className="font-mono text-sm"`、`Input.Password autoFocus`(Key)、Form `layout="vertical"` 全部保留 |

## 风险与回滚

- 风险点:`entryOrderRef` 跨重渲染稳定性、`App.useApp()` 上下文依赖、`Form.useForm` 实例归属
- 缓解:严格对齐原文件行为(逐函数迁移),子组件 props 显式,行为清单逐条对照
- 回滚:`git checkout src/components/project/McpPanel.tsx` + `rm -rf src/components/mcp/` 即可恢复(零迁移成本,因为原文件未被引用方改动)
