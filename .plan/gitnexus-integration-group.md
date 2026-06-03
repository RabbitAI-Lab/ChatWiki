# Integration 中新增 GitNexus 分组

## Context

用户希望 ChatWiki 的项目级和工作空间级 `Integration` 标签中，在现有 `Repository` 分组之上新增一个 `GitNexus` 分组。该分组对每个**已克隆的代码库**独立调用 `npx -y gitnexus@latest analyze` 生成代码知识图谱（产物存到仓库本地 `.gitnexus/` 目录），并在 UI 中展示索引状态（不集成 gitnexus 自带的 web UI 浏览体验）。这与项目已有的 Repository / Sandbox 分组在结构、UI 风格、API 模式上完全对称。

`gitnexus` 工具的事实：

- `npx -y gitnexus@latest analyze` 是**非阻塞**命令：下载 → 索引 → 退出，产物存到当前目录的 `.gitnexus/` 子目录
- `gitnexus analyze --force` 强制重索引；`--skip-git` 跳过 git 仓库要求；`gitnexus clean` 删除索引
- 需要 Node.js ≥ 18；默认分配 8GB 堆（`--max-old-space-size=8192`）
- 必须运行在 git 仓库内（除非带 `--skip-git`）

## 目标

| 维度 | 内容 |
|---|---|
| **位置** | `ProjectInfoTab` 和 `WorkspaceInfoTab` 的 `Integration` 标签内，**Repository 之上**新增 `GitNexus` 分组 |
| **作用域** | 项目级 + 工作空间级（完全对称） |
| **行为** | 对每个已克隆的 Repository 独立运行 `gitnexus analyze`，生成 `.gitnexus/` 知识图谱 |
| **结果展示** | 仅显示状态徽章（Not indexed / Analyzing… / Indexed / Failed）和操作按钮（Analyze / Re-analyze / Clean / Cancel）。**不集成 web UI 跳转、不嵌入 iframe** |
| **命令选项** | UI 提供 `Force re-index` 和 `Skip git check` 两个 Checkbox（分别传 `--force` / `--skip-git`） |

## 关键设计

### 1. 类型层

**`src/lib/types.ts`** — 新增 GitNexus 状态类型，并在 `ProjectMeta` 加字段：

```ts
// ========== GitNexus 索引状态 ==========
export type GitNexusPhase = "idle" | "analyzing" | "cleaning" | "success" | "failed";

export interface GitNexusStatus {
  phase: GitNexusPhase;
  lastSuccessAt?: string;
  lastError?: string;
  indexExists: boolean;          // 物理状态：.gitnexus/ 是否存在
  lastFlags?: { force?: boolean; skipGit?: boolean };
}

export interface ProjectMeta {
  // ... 现有字段保持不变
  gitnexusStatuses?: Record<string /* repoId */, GitNexusStatus>;
}
```

`WorkspaceMeta = ProjectMeta`（已在 L161 别名），自动获得新字段。

**`src/lib/fs.ts`** — 追加 re-export：

```ts
export type {
  // ... 现有
  GitNexusStatus,
  GitNexusPhase,
} from "./types";
```

### 2. 共享后端服务（新建 `src/lib/gitnexus-service.ts`）

约 130 行。封装 `child_process.spawn` 启动 `npx gitnexus`，统一处理状态写回、并发控制、超时、错误捕获。供 project/workspace 两套路由复用。

关键点：

- **防重入**：用 `globalThis.__chatwiki_gitnexus_tasks__` Map 记录运行中的 `(dirSegments, repoId)` 任务，相同组合不可并发（key = `${dirSegments.join("/")}::${repoId}`）
- **路径**：cwd = `getRepoLocalPath(dirSegments, repoId)`，复用 `src/lib/git-service.ts` 现有函数
- **环境**：spawn 时 `env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" }`
- **超时**：analyze 5 分钟、clean 30 秒，到时 `child.kill("SIGKILL")`
- **取消**：cancel 函数发 `SIGTERM`，3 秒后升级为 `SIGKILL`
- **状态写回**：子进程退出后 `updateStatus(scope, dirSegments, repoId, { phase, lastSuccessAt, lastError, indexExists })` 写回 `.project.json` / `.workspace.json`
- **直接 import**：`import { readProjectMeta, writeProjectMeta, readWorkspaceMeta, writeWorkspaceMeta } from "./fs"`（无循环引用，fs.ts 只是 barrel）

公开 API：

```ts
export function runGitNexus(opts: {
  scope: "project" | "workspace";
  dirSegments: string[];
  repoId: string;
  command: "analyze" | "clean";
  force?: boolean;
  skipGit?: boolean;
}): { started: boolean; reason?: "already_running" | "repo_not_found"; status?: GitNexusStatus };

export function cancelGitNexus(scope: "project" | "workspace", dirSegments: string[], repoId: string): boolean;

export function isGitNexusRunning(dirSegments: string[], repoId: string): boolean;

export function refreshIndexExists(scope: "project" | "workspace", dirSegments: string[], repoId: string): boolean;
```

### 3. 后端 API（共 6 个新文件）

**项目级：**
- `src/app/api/fs/project-gitnexus/route.ts` — `GET ?dirSegments=` 返回 `{ statuses }`，每个 repo 触发一次 `refreshIndexExists` 校准物理状态
- `src/app/api/fs/project-gitnexus/analyze/route.ts` — `POST { dirSegments, repoId, force?, skipGit? }` 调 `runGitNexus` 启动 analyze，写 `logOperation`
- `src/app/api/fs/project-gitnexus/clean/route.ts` — `POST { dirSegments, repoId, action: "clean"|"cancel" }`

**工作空间级：** `src/app/api/fs/workspace-gitnexus/{route,analyze/route,clean/route}.ts` 镜像 3 个文件，区别仅：

- 元数据：`readWorkspaceMeta` / `writeWorkspaceMeta`
- `runGitNexus({ scope: "workspace", ... })`
- "Project not found" → "Workspace not found"

所有 6 个文件加 `export const dynamic = "force-dynamic"`（避免缓存）。错误约定：

- 仓库不存在 → 404
- 仓库未克隆（本地路径不存在）→ 400
- 任务已在运行 → 409 `{ error: "Analyze already running", status }`
- spawn 失败 → 500

### 4. UI 组件

**`src/components/project/GitNexusManager.tsx`**（约 220 行，"use client"）

Props：

```ts
interface GitNexusManagerProps {
  projectPath: string;                            // 逗号分隔
  repositories: Repository[];                     // 用来筛已克隆 + 名字
  statuses: Record<string, GitNexusStatus>;
  onStatusesChange: (s: Record<string, GitNexusStatus>) => void;
}
```

结构：

1. **说明栏**（蓝色背景）：`GitNexus builds a local knowledge graph from each cloned repository... To browse the graph, run 'gitnexus serve' in your terminal and visit http://localhost:4123.`
2. **全局选项栏**（两个 Ant Design `Checkbox`）：Force re-index / Skip git check（带 Tooltip 说明）
3. **仓库列表**（仅 `syncStatus === "synced" | "behind"` 的仓库）：
   - 左：网络/节点 SVG icon
   - 中：仓库名 + 状态徽章（4 种颜色）+ 成功时间 / 错误信息
   - 右：操作按钮组（`{Analyze | Re-analyze + Clean | Cancel}` 互斥切换）
4. **空状态**："No cloned repositories" + 副标题 "Clone a repository first to enable GitNexus indexing"
5. **轮询**：当 `statuses` 中存在 `phase in {analyzing, cleaning}` 时，启用 2 秒 `setInterval` GET `/api/fs/project-gitnexus` 拉取最新 `statuses`，直到所有 repo 都 `idle/success/failed` 后停掉

状态映射（用 `Record<GitNexusPhase, { text, color }>`）：

| phase | 徽章文本 | 颜色 | 按钮 |
|---|---|---|---|
| `idle` | Not indexed | 灰 | Analyze |
| `analyzing` | Analyzing… | 蓝 + spinner | Cancel |
| `cleaning` | Cleaning… | 蓝 + spinner | Cancel |
| `success` | Indexed | 绿 + 显示 lastSuccessAt | Re-analyze + Clean |
| `failed` | Failed | 红 + 显示 lastError | Analyze（重试） |

**关键交互**（用 Ant Design `Modal.confirm`，遵循项目"沙盒释放二次确认"规范）：

- **Cancel 按钮**：`Modal.confirm` 标题"Cancel analyze?"，`okButtonProps: { danger: true }`
- **Clean 按钮**：`Modal.confirm` 标题"Clean GitNexus index?"，内容"Delete .gitnexus/ inside <repo.name>?"
- 失败 / 启动错误用 `Modal.error`

**`src/components/workspace/WorkspaceGitNexusManager.tsx`**：与项目版 99% 相同，仅差异：

- API endpoint 前缀 `/api/fs/workspace-gitnexus/...`
- `dirSegments = workspacePath.split("/").filter(Boolean)`（与 `WorkspaceRepositoryManager` 保持一致）

### 5. 集成到 Integration Panel

**`src/components/project/IntegrationPanel.tsx`** — 4 处改动：

```ts
// ① import
import type { Repository, SandboxStatus, GitNexusStatus } from "@/lib/fs";
import GitNexusManager from "./GitNexusManager";

// ② Props 新增
interface IntegrationPanelProps {
  projectPath: string;
  repositories: Repository[];
  sandbox?: SandboxStatus;
  gitnexusStatuses: Record<string, GitNexusStatus>;
  onRepositoriesChange: (repos: Repository[]) => void;
  onSandboxChange: (sandbox: SandboxStatus) => void;
  onGitNexusStatusesChange: (s: Record<string, GitNexusStatus>) => void;
}

// ③ 在 INTEGRATION_GROUPS 数组里 repository 之前插入 gitnexus
const INTEGRATION_GROUPS: IntegrationGroup[] = [
  {
    key: "gitnexus",
    label: "GitNexus",
    icon: "M12 2a10 10 0 1 0 10 10M12 2a10 10 0 0 1 10 10M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07",
    description: "Index each cloned repository into a local code knowledge graph",
  },
  { key: "repository", label: "Repository", ... },
  { key: "sandbox", label: "Sandbox Request", ... },
];

// ④ 默认展开改为包含 gitnexus
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
  new Set(["gitnexus", "repository"])
);

// ⑤ 渲染分支加 gitnexus
{group.key === "gitnexus" && (
  <GitNexusManager
    projectPath={projectPath}
    repositories={repositories}
    statuses={gitnexusStatuses}
    onStatusesChange={onGitNexusStatusesChange}
  />
)}
```

**`src/components/workspace/WorkspaceIntegrationPanel.tsx`**：完全对称的 4 处改动，引用 `WorkspaceGitNexusManager`。

### 6. InfoTab 接线

**`src/components/project/ProjectInfoTab.tsx`** — 2 处改动：

```tsx
// ① import 增 GitNexusStatus
import type { Repository, SandboxStatus, ProjectMember, GitNexusStatus } from "@/lib/fs";

// ② 新增 state（在 members state 之后）
const [gitnexusStatuses, setGitnexusStatuses] = useState<Record<string, GitNexusStatus>>(
  projectMeta?.gitnexusStatuses || {}
);

// ③ 改 IntegrationPanel 调用（L193-201）
<IntegrationPanel
  projectPath={projectPath}
  repositories={repositories}
  sandbox={sandbox}
  gitnexusStatuses={gitnexusStatuses}                        // 新增
  onRepositoriesChange={setRepositories}
  onSandboxChange={setSandbox}
  onGitNexusStatusesChange={setGitnexusStatuses}             // 新增
/>
```

**`src/components/workspace/WorkspaceInfoTab.tsx`** — 同上对称改动。注意：该文件的 `WorkspaceMeta` 是本地 interface（L15-26），需要补一个 `gitnexusStatuses?: Record<string, GitNexusStatus>` 字段（page 端返回的 `WorkspaceMeta` 是从 `readWorkspaceMeta` 来的完整对象）。

### 7. 操作日志

复用 `category: "repository"`，不动 `LogCategory` enum。理由：GitNexus 本质是对仓库的索引操作，详情 `detail` 字段前缀 `"GitNexus analyze 仓库 xxx"` / `"GitNexus clean 仓库 xxx"` 区分。避免数据库 migration。

action 用 `update`（修改了仓库关联状态）。

## 关键文件清单

| 文件 | 类型 | 内容 |
|---|---|---|
| `src/lib/types.ts` | 修改 | 新增 `GitNexusStatus` / `GitNexusPhase`；`ProjectMeta` 加 `gitnexusStatuses?` |
| `src/lib/fs.ts` | 修改 | re-export 新类型 |
| `src/lib/gitnexus-service.ts` | **新建** | 共享 service：spawn 封装、并发、状态写回 |
| `src/app/api/fs/project-gitnexus/route.ts` | **新建** | GET 状态 |
| `src/app/api/fs/project-gitnexus/analyze/route.ts` | **新建** | POST analyze |
| `src/app/api/fs/project-gitnexus/clean/route.ts` | **新建** | POST clean / cancel |
| `src/app/api/fs/workspace-gitnexus/route.ts` | **新建** | 镜像 GET |
| `src/app/api/fs/workspace-gitnexus/analyze/route.ts` | **新建** | 镜像 POST analyze |
| `src/app/api/fs/workspace-gitnexus/clean/route.ts` | **新建** | 镜像 POST clean |
| `src/components/project/GitNexusManager.tsx` | **新建** | 主 UI |
| `src/components/workspace/WorkspaceGitNexusManager.tsx` | **新建** | 镜像 |
| `src/components/project/IntegrationPanel.tsx` | 修改 | `INTEGRATION_GROUPS` 插入 gitnexus + 渲染分支 + 默认展开 |
| `src/components/workspace/WorkspaceIntegrationPanel.tsx` | 修改 | 同上对称 |
| `src/components/project/ProjectInfoTab.tsx` | 修改 | state + prop 传递 |
| `src/components/workspace/WorkspaceInfoTab.tsx` | 修改 | state + prop 传递 + 本地 `WorkspaceMeta` 补字段 |

**不需修改：**
- `src/app/project/[...path]/page.tsx` / `src/app/workspace/[...path]/page.tsx`（meta 已含新字段）
- `src/lib/fs/project.ts` / `src/lib/fs/workspace.ts`
- `src/lib/operation-log.ts`（复用 `repository`）
- 数据库 schema（无新表、无新 enum）

## 验证

### 基本显示
1. `npm run dev`，打开 `/project/{projectId}` → 切到 **Integration** 标签
2. **预期**：`GitNexus` 分组在 `Repository` 上方，默认展开
3. **预期**：右上看到空状态 "No cloned repositories" + 蓝色说明栏

### 完整 analyze 流程
1. 切到 Repository 分组，添加一个 GitHub repo（如 `https://github.com/octocat/Hello-World`），点击 **Clone** 等到 `synced`
2. 回到 GitNexus 分组
3. **预期**：该 repo 出现在列表，phase = `idle`（Not indexed）
4. 勾选 `Force re-index`，点击 **Analyze**
5. **预期**：徽章变 `Analyzing…` + spinner；按钮变 `Cancel`；轮询每 2s 触发 GET
6. dev 进程终端能看到 `npx -y gitnexus@latest analyze --force` 启动
7. 等待完成（小型 repo 30s-2min）
8. **预期**：徽章变 `Indexed`（绿），下方显示 `Last indexed: <时间>`
9. **预期**：磁盘上 `<dataRoot>/personal/default/projects/{id}/repos/{repoId}/.gitnexus/` 目录存在
10. **预期**：Log 标签出现一条 `GitNexus analyze 仓库 xxx (force)`

### --skip-git 验证
1. 取消 force，勾选 `Skip git check`，点 Re-analyze
2. **预期**：日志显示命令为 `npx -y gitnexus@latest analyze --skip-git`

### clean 验证
1. 点 Clean → 弹 Modal 确认 → 点 Clean
2. **预期**：`.gitnexus/` 被删除，phase 回到 `Not indexed`，按钮恢复为 Analyze

### 并发 / 失败
1. 启动一次 analyze，立即再点 Analyze 同一 repo
2. **预期**：第二次返回 409，弹 Modal "Failed to start analyze: Analyze already running"
3. 5 分钟超时（可改小测试）：徽章变 `Failed`，鼠标悬停 lastError 显示 "Process killed by signal SIGKILL (timeout)"

### 工作空间镜像
对 `/workspace/{id}` 重复以上全部步骤，行为完全一致。

## 风险与注意

| 风险 | 缓解 |
|---|---|
| `npx` 首次下载 `gitnexus@latest` 1-3 分钟 | UI spinner + 2s 轮询；可在 README 提示 |
| 8GB 堆在低配机器 OOM | `NODE_OPTIONS: "--max-old-space-size=8192"` 显式设置 |
| Node.js < 18 无法运行 | spawn error 被 `child.on("error")` 捕获，phase = `failed` |
| dev HMR 产生 orphan 子进程 | 用 `globalThis` 注册表，HMR 后旧引用丢失；生产用 Docker 部署无此问题 |
| dev HMR 时 `gitnexus-service.ts` 重载，全局 Map 重置 | 接受这一限制（dev 模式重启 next dev 即可） |
| 路径安全 | `dirSegments` 走 `assertValidSegments` 阻挡 `..` 和 `\0`；`repoId` 必须是 `meta.repositories` 中存在的 UUID，路由已做 404 检查 |
| 取消后部分产物残留 | 5min 超时升级为 SIGKILL 兜底；用户可用 Clean 任务彻底删除 |
| 跨项目/工作空间并发 | 已有 per-repo 防重入，未限制全局并发数（按需扩展） |
| 操作日志 category | 复用 `repository` 而非新增 `gitnexus` enum，避免 schema migration |

## 实施顺序

1. 类型层（`src/lib/types.ts` + `src/lib/fs.ts`）
2. 共享 service（`src/lib/gitnexus-service.ts`）
3. 项目级 3 个 API 路由 + 手动跑 `npx gitnexus analyze` 验证产物
4. `GitNexusManager.tsx` + 接入 `IntegrationPanel.tsx` + `ProjectInfoTab.tsx`
5. 跑通项目级完整流程
6. 镜像工作空间 3 个 API + `WorkspaceGitNexusManager.tsx` + 接入 workspace 两文件
7. 跑通工作空间流程

预计 ~2-2.5 小时。
