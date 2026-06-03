# 修复代码库 clone 目录缺少 `data/` 根目录层级

## Context

用户反馈：在项目/工作区中新增代码库并执行 Clone 后，仓库被 clone 到了工作目录（`process.cwd()`）下的 `personal/.../repos/{repoId}` 路径中，**少了一层 `data/` 目录**。预期路径应为 `<dataRoot>/personal/{accountId}/projects|workspace/{id}/repos/{repoId}`，其中 `<dataRoot>` 默认就是 `process.cwd()/data`，与项目其他文件系统（`.project.json`、`.workspace.json`、`.mcp.json`、文档）的位置保持一致。

## 根因分析

`getRepoLocalPath` 函数（[src/lib/git-service.ts:257-264](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/lib/git-service.ts#L257-L264)）在拼接路径时没有调用 `getDataRoot()`，只用了 `dirSegments.join("/")`，导致 `data/` 这一层缺失。

当前错误实现：
```ts
export function getRepoLocalPath(
  projectDirSegments: string[],
  repoId: string
): string {
  // data/personal/{accountId}/projects/{projectId}/repos/{repoId}
  const baseDir = projectDirSegments.join("/");
  return path.join(baseDir, "repos", repoId);
}
```

对比项目内其他同样基于 `dirSegments` 读取/写入文件的实现，均使用 `getDataRoot()` 作为前缀，例如：
- [src/lib/fs/meta-crud.ts:46](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/lib/fs/meta-crud.ts#L46) `readMetaFile`：`path.join(getDataRoot(), ...dirSegments, fileName)`
- [src/lib/fs/meta-crud.ts:58](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/lib/fs/meta-crud.ts#L58) `writeMetaFile`：`path.join(getDataRoot(), ...dirSegments, fileName)`
- [src/lib/fs/meta-crud.ts:242](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/lib/fs/meta-crud.ts#L242) `createMcpConfigCrud.read`：`path.join(getDataRoot(), ...dirSegments, ".mcp.json")`
- [src/lib/fs/core.ts:45](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/lib/fs/core.ts#L45) `buildPath`：`path.join(getDataRoot(), ...withMd)`

只有 `getRepoLocalPath` 是个例外，遗漏了 `getDataRoot()`。这导致：
- clone/pull 时仓库落在 `process.cwd()/personal/.../repos/{repoId}`（缺 `data/`）
- `checkSyncStatus` 同样找不到目录，一直返回 `not_cloned`
- 删除仓库时也找不到目录

## 修复方案

修改 [src/lib/git-service.ts](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/lib/git-service.ts) 中 `getRepoLocalPath` 函数，使其在拼接路径时调用 `getDataRoot()`，与其他文件路径操作保持一致。

### 1) 新增 import

在文件顶部（现有的 `@/lib/fs` 类型 import 旁）新增：
```ts
import { getDataRoot } from "./fs/core";
```

### 2) 修改 `getRepoLocalPath`

将现有实现：
```ts
export function getRepoLocalPath(
  projectDirSegments: string[],
  repoId: string
): string {
  // data/personal/{accountId}/projects/{projectId}/repos/{repoId}
  const baseDir = projectDirSegments.join("/");
  return path.join(baseDir, "repos", repoId);
}
```

替换为：
```ts
export function getRepoLocalPath(
  projectDirSegments: string[],
  repoId: string
): string {
  // data/personal/{accountId}/projects/{projectId}/repos/{repoId}
  return path.join(getDataRoot(), ...projectDirSegments, "repos", repoId);
}
```

## 涉及/影响范围

- 唯一被改动的文件：[src/lib/git-service.ts](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/lib/git-service.ts)
- 调用 `getRepoLocalPath` 的 4 处（无需改动，自动获得正确路径）：
  - [src/app/api/fs/project-repositories/sync/route.ts:38, 80](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/app/api/fs/project-repositories/sync/route.ts#L38)
  - [src/app/api/fs/workspace-repositories/sync/route.ts:38, 80](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/app/api/fs/workspace-repositories/sync/route.ts#L38)
  - [src/app/api/fs/project-repositories/check-status/route.ts:31](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/app/api/fs/project-repositories/check-status/route.ts#L31)
  - [src/app/api/fs/workspace-repositories/check-status/route.ts:31](file:///Users/xujialiang/Desktop/Dev/RabbitAI-Lab/ChatWiki/src/app/api/fs/workspace-repositories/check-status/route.ts#L31)
- 数据清理：用户在错误路径（`process.cwd()/personal/.../repos/{repoId}`）下可能已有部分残留目录，需要在修复后手动删除；本任务不自动迁移旧数据。

## 验证

1. 启动开发服务器（`pnpm dev` 或 `npm run dev`）。
2. 打开任一项目页 `/project/...`，进入 "代码库" 标签。
3. 新增一个公开测试仓库（如 `https://github.com/octocat/Hello-World`），点击 Clone。
4. 验证：
   - 终端/文件浏览器确认仓库出现在 `data/personal/default/projects/{projectId}/repos/{repoId}/`，**而非** `personal/default/projects/{projectId}/repos/{repoId}/`。
   - UI 中该仓库 `syncStatus` 变为 `synced`（说明 `checkSyncStatus` 用对了路径）。
5. 点击 Pull 验证后续 pull 流程仍能正常找到目录。
6. 同样在工作区 (`/workspace/...`) 中重复步骤 2-4，验证 `entityDir: "workspace"`（单数）的路径同样正确。
7. 删除测试仓库，确认不会因找不到目录报错。
8. （可选）若发现 `personal/...` 残留目录，手动 `rm -rf personal/ workspace/`（或 `data/workspace/`）做清理。
