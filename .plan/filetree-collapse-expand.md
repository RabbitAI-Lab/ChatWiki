# FileTree 文件夹折叠/展开改造

## Context

当前 `src/components/ui/FileTree.tsx` 和 `src/components/chat/SaveToDocumentModal.tsx` 中的文件树**没有实现文件夹的折叠/展开**：

- 文件夹永远完全展开（递归无脑渲染所有子节点）
- 文件夹行没有 `onClick` 行为
- 没有 chevron 三角箭头图标
- 节点多时无法收起，UI 显得拥挤、滚动卡顿

**改造目标**：

1. 文件夹行可点击切换展开/折叠
2. 默认全部折叠（`expandedPaths` 初始为空 `Set`）
3. 折叠态用 `chevron-right`、展开态用 `chevron-down`（实现：`polyline` 路径 + `rotate-90`）
4. 操作按钮（新建文件夹/文档/删除）点击不触发展开
5. 改造范围：`FileTree.tsx`（主组件）+ `SaveToDocumentModal.tsx`（独立实现的简化树）
6. 状态不持久化，组件内部 `useState<Set<string>>`

## 涉及文件

| 文件 | 角色 | 改动量 |
|---|---|---|
| `src/components/ui/FileTree.tsx` | 主文件树组件 | 核心改动（387 行） |
| `src/components/chat/SaveToDocumentModal.tsx` | "保存到文档"弹窗中的简化树 | 独立改造（278 行） |

父组件（`ProjectWorkspace.tsx`、`ChatPageContent.tsx`、`NewChatWorkspace.tsx`）**不需要改动**，因为状态在 FileTree 内部自管。

---

## 实施步骤

### 步骤 1：修改 `src/components/ui/FileTree.tsx`

#### 1.1 顶层 `FileTree` 函数体新增 `expandedPaths` 状态

在第 354 行 `useState<string | null>(null)` 之后新增：

```tsx
const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

const toggleExpand = (path: string) => {
  setExpandedPaths((prev) => {
    const next = new Set(prev);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    return next;
  });
};
```

#### 1.2 扩展 `FileTreeNode` 函数签名

在第 66-78 行新增两个参数 `expandedPaths`、`onToggleExpand`：

```tsx
function FileTreeNode({
  node,
  level,
  props,
  confirmDeletePath,
  setConfirmDeletePath,
  expandedPaths,
  onToggleExpand,
}: {
  node: TreeNode;
  level: number;
  props: FileTreeProps;
  confirmDeletePath: string | null;
  setConfirmDeletePath: (path: string | null) => void;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
}) {
```

#### 1.3 修改文件夹行（directory 分支，第 83-216 行）

**a) 在文件夹图标前（第 99 行 `<svg>` 之前）插入 chevron 按钮**：

```tsx
<button
  onClick={(e) => {
    e.stopPropagation();
    if (!isRenaming) onToggleExpand(node.path);
  }}
  className="shrink-0 p-0.5 -ml-1.5 text-gray-400 hover:text-gray-600"
  aria-label={expandedPaths.has(node.path) ? "Collapse" : "Expand"}
  tabIndex={-1}
>
  <svg
    className={`w-3 h-3 transition-transform duration-150 ${
      expandedPaths.has(node.path) ? "rotate-90" : ""
    }`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
</button>
```

**注意**：Feather `chevron-right` 路径 `M9 18l6-6-6-6` 等价于 polyline `9 18 15 12 9 6`（一个 `>` 形状）。展开时通过 `rotate-90` 旋转变成 `v` 形状（chevron-down）。

**b) 给文件夹行 `<div>`（第 86-98 行）添加 `onClick`，并修改 `cursor-default` → `cursor-pointer`**：

```tsx
<div
  className={`flex items-center gap-1.5 w-full px-2 py-1 text-sm transition-colors select-none ${
    isEditable
      ? "text-gray-500 hover:bg-gray-100 cursor-pointer group"
      : "text-gray-500 cursor-pointer"
  }`}
  onClick={() => {
    if (!isRenaming) onToggleExpand(node.path);
  }}
  onDoubleClick={() => {
    if (isEditable && !isRenaming && props.onStartRename) {
      props.onStartRename(node.path);
    }
  }}
  style={{ paddingLeft: `${8 + level * 14}px` }}
>
```

**关键说明**：
- 操作按钮（新建文件夹/文档/删除）原有的 `e.stopPropagation()` 阻止了冒泡，所以**不会触发行 onClick** → 无需额外 `preventDefault` 逻辑
- 嵌套的删除确认弹窗的"确认"/"取消"按钮也已有 `e.stopPropagation()`，不会触发
- 重命名时（`isRenaming`）的 `onClick` 守卫，避免重命名输入框被点击意外收起
- 双击重命名依然通过 `onDoubleClick` 触发（行内双击事件）

**c) 修改 children 渲染条件（第 203-214 行）**：

```tsx
{node.children &&
  node.children.length > 0 &&
  expandedPaths.has(node.path) &&
  node.children.map((child) => (
    <FileTreeNode
      key={child.path}
      node={child}
      level={level + 1}
      props={props}
      confirmDeletePath={confirmDeletePath}
      setConfirmDeletePath={setConfirmDeletePath}
      expandedPaths={expandedPaths}
      onToggleExpand={onToggleExpand}
    />
  ))}
```

#### 1.4 更新 FileTree 顶层递归调用（第 372-380 行）

```tsx
{tree.map((node) => (
  <FileTreeNode
    key={node.path}
    node={node}
    level={0}
    props={props}
    confirmDeletePath={confirmDeletePath}
    setConfirmDeletePath={setConfirmDeletePath}
    expandedPaths={expandedPaths}
    onToggleExpand={toggleExpand}
  />
))}
```

> **paddingLeft 决策说明**：保持现状 `8 + level * 14` 不变。chevron 直接放在 padding 内的最左侧（用 `-ml-1.5` 略微向左溢出使其更靠近左边距），文件夹图标顺延到 `8 + L*14 + 12 + 6 = 26 + L*14` 处。这与 VSCode Explorer / macOS Finder 的视觉风格一致：目录图标相对文件图标略向右偏移，视觉重心更稳。

---

### 步骤 2：修改 `src/components/chat/SaveToDocumentModal.tsx`

#### 2.1 新增 `expandedPaths` 状态

在第 28-34 行 state 之后新增：

```tsx
const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

const toggleDirExpand = (path: string) => {
  setExpandedPaths((prev) => {
    const next = new Set(prev);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    return next;
  });
};
```

#### 2.2 重写 `renderTree` 函数（第 115-163 行）

**关键差异**：在 SaveToDocumentModal 中，点击文件夹行的语义是"**选中保存目录**"（保留现有行为），而 chevron 按钮负责"**展开/折叠**"——两个交互分离。

```tsx
const renderTree = (nodes: TreeNode[], level: number = 0): React.ReactNode => {
  return nodes.map((node) => {
    const isExpanded = expandedPaths.has(node.path);
    return (
      <div key={node.path}>
        {node.type === "directory" ? (
          <div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleDirClick(node)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleDirClick(node);
                }
              }}
              className={`flex items-center gap-1.5 w-full px-2 py-1 text-xs transition-colors cursor-pointer select-none ${
                selectedDir === node.path
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
              style={{ paddingLeft: `${8 + level * 14}px` }}
            >
              {/* Chevron: 折叠 = chevron-right, 展开 = rotate-90 → chevron-down */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleDirExpand(node.path);
                }}
                className="shrink-0 p-0.5 -ml-1.5 text-gray-400 hover:text-gray-600"
                aria-label={isExpanded ? "Collapse" : "Expand"}
                tabIndex={-1}
              >
                <svg
                  className={`w-3 h-3 transition-transform duration-150 ${
                    isExpanded ? "rotate-90" : ""
                  }`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <svg
                className="w-3.5 h-3.5 shrink-0 text-amber-400"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
              </svg>
              <span className="truncate">{node.name}</span>
            </div>
            {isExpanded && node.children && node.children.length > 0 &&
              renderTree(node.children, level + 1)}
          </div>
        ) : (
          <div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleFileClick(node)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleFileClick(node);
                }
              }}
              className={`flex items-center gap-1.5 w-full px-2 py-1 text-xs transition-colors cursor-pointer select-none ${
                overwriteTarget?.path === node.path
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
              style={{ paddingLeft: `${8 + level * 14}px` }}
            >
              <svg
                className="w-3.5 h-3.5 shrink-0 text-blue-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="truncate flex-1">{node.name}</span>
            </div>
          </div>
        )}
      </div>
    );
  });
};
```

---

## 关键设计决策总结

| 维度 | FileTree.tsx | SaveToDocumentModal.tsx |
|---|---|---|
| 默认状态 | 全部折叠 | 全部折叠 |
| 状态管理位置 | 组件内 `useState<Set<string>>` | 组件内 `useState<Set<string>>` |
| 持久化 | 不持久化（页面刷新后重置） | 不持久化（每次打开弹窗重置） |
| 点击文件夹行 | 切换展开/折叠 | **选中**为保存目录（保留原行为） |
| 点击 chevron | 切换展开/折叠 | 切换展开/折叠 |
| 操作按钮影响 | 不会冒泡触发（已有 `stopPropagation`） | N/A（无操作按钮） |
| chevron 视觉 | `>` 折叠态 / `v` 展开态（rotate-90） | 同左 |
| chevron 位置 | padding 内最左侧 | padding 内最左侧 |

---

## 验证步骤

### 1. 启动开发服务器

```bash
cd /Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki
npm run dev
```

### 2. 验证场景清单

#### 场景 A：项目页文件树（`/project/[...path]`）
- [ ] 首次进入页面，所有文件夹都是**折叠状态**
- [ ] 文件夹名前显示 `>` 形状的 chevron
- [ ] **点击文件夹任意位置**（除操作按钮外）→ 展开，chevron 旋转 90° 变成 `v`
- [ ] 再次点击 → 折叠，chevron 旋转回 `>`
- [ ] **鼠标悬停**显示「新建文件夹」「新建文档」「删除」三个按钮
- [ ] 点击「新建文件夹」按钮 → **不触发**展开/折叠
- [ ] 点击「删除」按钮 → 弹出确认弹窗，**不触发**展开/折叠
- [ ] **双击**文件夹名 → 进入重命名（不触发展开）
- [ ] 进入重命名后**单击行** → **不**触发展开（被 `isRenaming` 守卫）

#### 场景 B：聊天页文件树（`/chat/[id]`，需关联 project）
- [ ] 同上所有场景

#### 场景 C：新建聊天工作空间（`/chat/new`）
- [ ] 切换到某个项目后，左侧文件树行为同上

#### 场景 D：保存到文档弹窗
- [ ] 打开弹窗，文件树默认全部折叠
- [ ] 点击文件夹名 → 选中为保存目录（背景变蓝、文字变粗）
- [ ] 点击文件夹名 **不会**展开/折叠
- [ ] 点击 chevron 按钮 → 展开/折叠（与选中互不影响）
- [ ] 点击文件 → 标记为覆盖目标，文件名填入输入框

### 3. 视觉对齐检查

- [ ] 同一层的文件图标位置 ≈ 同一层目录的 chevron 位置（左对齐）
- [ ] chevron 在 hover 状态显示为深灰（`text-gray-600`）
- [ ] chevron 旋转动画流畅（150ms transition）

### 4. 边界情况

- [ ] 空文件夹（`node.children` 为空或 `length === 0`）→ 不渲染 chevron（条件渲染处理）
- [ ] 树为空（`tree.length === 0`）→ 显示 `emptyText`
- [ ] 深层级（level 5+）的文件夹依然可以正常折叠

---

## 风险与回滚

- **风险 1**：chevron 位置导致文件/目录图标错位 → 已用 `gap-1.5` 统一样式
- **风险 2**：重命名时点击行意外折叠 → 用 `!isRenaming` 守卫
- **风险 3**：操作按钮意外触发行 onClick → 操作按钮已 `e.stopPropagation()`
- **回滚**：两个文件的改动是局部的，可通过 git 单文件 revert 快速回退
