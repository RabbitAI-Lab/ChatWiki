# 新账号空项目时优化提示文案

## Context
新用户注册后首次进入系统，此时没有任何项目，但右侧面板仍然显示"请先在左侧选择一个项目"，这显然不合理——没有项目可选。应该改为引导用户创建新项目。

## 修改方案

### 1. 修改右侧空状态面板（区分有/无项目两种状态）
**文件**: `src/components/chat/NewChatWorkspace.tsx` (第 533-553 行)

当前：`!selectedProjectId` 时一律显示 `pleaseSelectProject`。

改为：
- `projects.length === 0` → 显示"暂无项目"引导文案 + **新建项目按钮**
- `projects.length > 0` → 保持原样"请先在左侧选择一个项目"

### 2. 添加 `handleCreateProject` 方法
**文件**: `src/components/chat/NewChatWorkspace.tsx`

在组件中新增方法（参考 `ProjectsPanel.tsx` 第 91-104 行的逻辑）：
```ts
const handleCreateProject = useCallback(async () => {
  const tp = useTranslations("projects"); // 需要在组件顶部声明
  const name = computeDefaultName(projects, tp);
  const res = await authFetch("/api/fs/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "personal", accountId: user?.id, name }),
  });
  if (!res.ok) return;
  const meta = await res.json();
  // 刷新项目列表
  setProjects(prev => [...prev, meta]);
  // 自动选中新项目
  handleSelectProjectRef.current(meta);
}, [authFetch, user?.id, projects]);
```

### 3. 添加 i18n 翻译键
**文件**: `messages/zh.json` 和 `messages/en.json`

在 `newChatWorkspace` 下新增：
- `noProjectHint`: zh "还没有项目，创建一个开始吧" / en "No projects yet, create one to get started"
- `createFirstProject`: zh "新建项目" / en "Create Project"

### 4. 新建项目空状态 UI
替换原来的聊天气泡图标 + 箭头引导，改为：
- 文件夹+加号图标
- `noProjectHint` 文案
- 新建项目按钮（蓝色主按钮样式）

## 涉及文件
1. `src/components/chat/NewChatWorkspace.tsx` — 空状态 UI + 创建项目逻辑
2. `messages/zh.json` — 中文翻译
3. `messages/en.json` — 英文翻译

## 验证方式
1. 新账号登录 → 进入聊天页 → 确认右侧显示"暂无项目"引导和新建按钮
2. 点击新建按钮 → 确认项目创建成功、自动选中并显示文件树
3. 已有项目的账号 → 确认仍显示"请先在左侧选择一个项目"
