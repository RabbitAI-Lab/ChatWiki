# 项目设置Tab实现计划

## Context
项目信息页（ProjectInfoTab）有6个子Tab（activity, integration, skills, mcp, members, log），用户需要在最后增加一个"设置"子Tab，支持编辑项目标题/描述，以及危险区域（删除项目、转移Owner）。

## 涉及文件

| 文件 | 操作 |
|------|------|
| `src/components/project/ProjectSettingsPanel.tsx` | **新建** - 设置面板组件 |
| `src/components/project/ProjectInfoTab.tsx` | 修改 - 增加 settings subtab |
| `src/app/api/fs/projects/route.ts` | 修改 - PATCH支持description，DELETE增加Owner权限校验 |
| `src/components/project/ProjectEditorArea.tsx` | 修改 - 传递 onProjectUpdate 回调 |
| `src/components/chat/ChatPageContent.tsx` | 修改 - 传递 onProjectUpdate 回调 |
| `messages/zh.json` | 修改 - 增加 i18n |
| `messages/en.json` | 修改 - 增加 i18n |

## 实施步骤

### Task 1: API变更 — `src/app/api/fs/projects/route.ts`
- PATCH handler: 解构新增 `description` 字段，`if (description !== undefined) meta.description = description`
- DELETE handler: 增加 Owner 权限校验，读取 meta 检查 `meta.ownerId !== auth.id` 则返回 403
- 新增 API i18n: `api.onlyOwnerCanDelete`

### Task 2: 新建 `ProjectSettingsPanel.tsx`
组件Props:
```ts
projectId, projectName, projectMeta, members, ownerId, ownerName,
onProjectUpdate, onOwnerTransfer, onProjectDelete
```
UI结构:
- **基本信息区域**: 标题Input + 描述Textarea + 保存按钮（仅在变更时可点击）
- **危险区域**（仅Owner可见，红色边框容器）:
  - 转让Owner: Select选择成员 + 转让按钮 + Modal.confirm
  - 删除项目: 红色按钮 + Modal要求输入项目名称确认

### Task 3: 修改 `ProjectInfoTab.tsx`
- SubTab类型增加 `"settings"`
- SUB_TAB_KEYS数组末尾追加 `"settings"`
- import ProjectSettingsPanel
- 增加 onProjectUpdate 可选prop
- 在sub-tab content区域追加 settings panel渲染
- 设置面板的 onProjectDelete 回调调用 `router.push("/")`

### Task 4: 修改父组件传递回调
- `ProjectEditorArea.tsx`: 增加 onProjectUpdate prop，转发到 ProjectInfoTab
- `ChatPageContent.tsx`: 同上
- 回调逻辑：更新父组件中的 projectName 状态（使TabBar同步更新）

### Task 5: i18n
- `project.tabs.settings`: "设置" / "Settings"
- `project.settings.*`: 完整文案（约20个key）
- `api.onlyOwnerCanDelete`: 权限错误提示

## 验证
1. 进入项目 → 项目信息Tab → 切换到"设置"子Tab
2. 修改标题/描述 → 保存 → TabBar标题同步更新
3. 非Owner用户：看不到危险区域
4. Owner用户：能看到转移Owner和删除按钮
5. 删除：输入名称确认 → 跳转首页
6. 中英文切换正常
