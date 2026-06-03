/**
 * GitNexus 共享服务
 *
 * 封装 npx -y gitnexus@latest 的子进程启动、并发控制、超时、状态写回。
 * 项目级和工作空间级 API 路由共用此 service。
 *
 * 设计：每个 project/workspace 目录视为一个扫描根（cwd = dirSegments 根），
 * 共享一个 GitNexusStatus。`--force` 与 `--skip-git` 由 API 强制传 true。
 */
import { spawn, ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { getDataRoot } from "./fs/core";
import {
  readProjectMeta,
  writeProjectMeta,
  readWorkspaceMeta,
  writeWorkspaceMeta,
} from "./fs";
import type { GitNexusPhase, GitNexusStatus } from "./types";

// ========== 进程注册表（globalThis 避免 dev HMR 时丢失） ==========

declare global {
  // eslint-disable-next-line no-var
  var __rabbitdocs_gitnexus_tasks__: Map<string, GitNexusTask> | undefined;
}

interface GitNexusTask {
  child: ChildProcess;
  scope: "project" | "workspace";
  dirSegments: string[];
  command: "analyze" | "clean";
}

const tasks: Map<string, GitNexusTask> =
  globalThis.__rabbitdocs_gitnexus_tasks__ ?? new Map();
globalThis.__rabbitdocs_gitnexus_tasks__ = tasks;

function taskKey(dirSegments: string[]): string {
  return dirSegments.join("/");
}

// ========== 配置常量 ==========

const ANALYZE_TIMEOUT_MS = 5 * 60 * 1000; // 5 分钟
const CLEAN_TIMEOUT_MS = 30 * 1000;       // 30 秒
const SIGTERM_GRACE_MS = 3 * 1000;         // SIGTERM 后 3s 升级为 SIGKILL

// ========== 公共 API ==========

export interface RunGitNexusOptions {
  scope: "project" | "workspace";
  dirSegments: string[];
  command: "analyze" | "clean";
  /** 是否传 --force 给 gitnexus analyze（默认 false） */
  force?: boolean;
  /** 是否传 --skip-git 给 gitnexus analyze（默认 false） */
  skipGit?: boolean;
}

export interface RunGitNexusResult {
  started: boolean;
  reason?: "already_running" | "path_not_found";
  status?: GitNexusStatus;
}

/**
 * 启动一个 GitNexus analyze 或 clean 任务。
 * - analyze 5 分钟超时；clean 30 秒超时；超时后 SIGKILL 兜底
 * - 同一 dirSegments 同时只允许一个任务在跑
 * - 启动时立即写 "analyzing" / "cleaning" 状态，结束回写 success / failed
 *
 * cwd = dataRoot / ...dirSegments（项目/工作空间根目录，不进入 repos 子目录）
 */
export function runGitNexus(opts: RunGitNexusOptions): RunGitNexusResult {
  const { scope, dirSegments, command, force, skipGit } = opts;
  const key = taskKey(dirSegments);

  // 1. 防重入
  if (tasks.has(key)) {
    const existing = tasks.get(key)!;
    const fallbackPhase: GitNexusPhase = existing.command === "analyze" ? "analyzing" : "cleaning";
    console.log(
      `[gitnexus] skip already_running: scope=${scope} dirSegments=${JSON.stringify(dirSegments)} existingCommand=${existing.command}`
    );
    return {
      started: false,
      reason: "already_running",
      status: readCurrentStatus(scope, dirSegments, fallbackPhase),
    };
  }

  // 2. 项目/工作空间根目录存在性检查
  const rootPath = path.join(getDataRoot(), ...dirSegments);
  console.log(
    `[gitnexus] resolve: scope=${scope} dirSegments=${JSON.stringify(dirSegments)} rootPath=${rootPath}`
  );
  if (!fs.existsSync(rootPath)) {
    console.log(`[gitnexus] skip path_not_found: rootPath=${rootPath}`);
    return {
      started: false,
      reason: "path_not_found",
    };
  }

  // 3. 立即写"进行中"状态
  const inProgressPhase: GitNexusPhase = command === "analyze" ? "analyzing" : "cleaning";
  const initialStatus: GitNexusStatus = {
    phase: inProgressPhase,
    indexExists: checkIndexExists(rootPath),
  };
  updateStatus(scope, dirSegments, initialStatus);

  // 4. spawn 子进程
  const args = ["-y", "gitnexus@latest", command];
  if (command === "analyze") {
    if (force) args.push("--force");
    if (skipGit) args.push("--skip-git");
  }

  console.log(`[gitnexus] start: scope=${scope} command=${command}`);
  console.log(`[gitnexus]   cmd  = npx ${args.join(" ")}`);
  console.log(`[gitnexus]   args = ${JSON.stringify(args)}`);
  console.log(`[gitnexus]   cwd  = ${rootPath}`);
  console.log(`[gitnexus]   dirSegments = ${JSON.stringify(dirSegments)}`);
  console.log(`[gitnexus]   flags = force=${!!force} skipGit=${!!skipGit}`);

  const child = spawn("npx", args, {
    cwd: rootPath,
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=8192`.trim(),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  console.log(`[gitnexus]   pid = ${child.pid}`);

  // 收集 stdout / stderr，exit 时打 tail 2000 字符
  let stdoutBuf = "";
  let stderrBuf = "";
  const tail = (s: string, n = 2000) =>
    s.length <= n ? s : `...<truncated ${s.length - n} chars>...\n${s.slice(-n)}`;
  child.stdout?.on("data", (chunk: Buffer | string) => {
    stdoutBuf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
  });
  child.stderr?.on("data", (chunk: Buffer | string) => {
    stderrBuf += typeof chunk === "string" ? chunk : chunk.toString("utf8");
  });

  const task: GitNexusTask = {
    child,
    scope,
    dirSegments,
    command,
  };
  tasks.set(key, task);

  // 5. 注册退出处理
  const timeout = command === "analyze" ? ANALYZE_TIMEOUT_MS : CLEAN_TIMEOUT_MS;
  let timedOut = false;
  let finalized = false;

  const timer = setTimeout(() => {
    timedOut = true;
    console.log(
      `[gitnexus] timeout: scope=${scope} command=${command} timeoutMs=${timeout} -> SIGTERM(+${SIGTERM_GRACE_MS}ms SIGKILL)`
    );
    escalateKill(child);
  }, timeout);

  const finalize = (phase: GitNexusPhase, lastError?: string) => {
    if (finalized) return;
    finalized = true;
    clearTimeout(timer);
    tasks.delete(key);
    console.log(
      `[gitnexus] finalize: scope=${scope} command=${command} phase=${phase}` +
        (lastError ? ` lastError=${JSON.stringify(lastError)}` : "")
    );
    console.log(`[gitnexus]   stdout (tail 2000):\n${tail(stdoutBuf)}`);
    console.log(`[gitnexus]   stderr (tail 2000):\n${tail(stderrBuf)}`);
    updateStatus(scope, dirSegments, {
      phase,
      indexExists: checkIndexExists(rootPath),
      ...(phase === "success" ? { lastSuccessAt: new Date().toISOString() } : {}),
      ...(lastError ? { lastError } : {}),
    });
  };

  child.on("error", (err) => {
    console.log(
      `[gitnexus] error: scope=${scope} command=${command} msg=${err.message || String(err)}`
    );
    finalize("failed", err.message || String(err));
  });

  child.on("exit", (code, signal) => {
    if (finalized) return;
    console.log(
      `[gitnexus] exit: scope=${scope} command=${command} code=${code} signal=${signal}` +
        (timedOut ? " (timedOut)" : "")
    );
    if (timedOut) {
      finalize("failed", `Process killed by signal ${signal || "SIGKILL"} (timeout)`);
      return;
    }
    if (code === 0) {
      finalize("success");
    } else {
      finalize("failed", `Exit code ${code}${signal ? ` (signal ${signal})` : ""}`);
    }
  });

  return {
    started: true,
    status: initialStatus,
  };
}

/**
 * 取消正在运行的 GitNexus 任务。SIGTERM + 3s 后升级为 SIGKILL。
 * 返回是否成功触发取消（任务在跑时返回 true）。
 */
export function cancelGitNexus(
  scope: "project" | "workspace",
  dirSegments: string[]
): boolean {
  const key = taskKey(dirSegments);
  const task = tasks.get(key);
  if (!task) return false;
  escalateKill(task.child);
  return true;
}

/**
 * 检查某个 project/workspace 的 GitNexus 任务是否在跑。
 */
export function isGitNexusRunning(dirSegments: string[]): boolean {
  return tasks.has(taskKey(dirSegments));
}

/**
 * 刷新某个 project/workspace 根的 indexExists 物理状态并写回 meta。
 * 返回最新值。
 */
export function refreshIndexExists(
  scope: "project" | "workspace",
  dirSegments: string[]
): boolean {
  const rootPath = path.join(getDataRoot(), ...dirSegments);
  const exists = checkIndexExists(rootPath);

  const meta =
    scope === "project" ? readProjectMeta(dirSegments) : readWorkspaceMeta(dirSegments);
  if (!meta) return exists;

  const current = meta.gitnexusStatus;
  if (!current) return exists;
  if (current.indexExists !== exists) {
    updateStatus(scope, dirSegments, { indexExists: exists });
  }
  return exists;
}

// ========== 内部工具 ==========

function checkIndexExists(localPath: string): boolean {
  try {
    return fs.existsSync(path.join(localPath, ".gitnexus"));
  } catch {
    return false;
  }
}

function readCurrentStatus(
  scope: "project" | "workspace",
  dirSegments: string[],
  fallbackPhase: GitNexusPhase
): GitNexusStatus {
  const meta =
    scope === "project" ? readProjectMeta(dirSegments) : readWorkspaceMeta(dirSegments);
  return meta?.gitnexusStatus || { phase: fallbackPhase, indexExists: false };
}

function updateStatus(
  scope: "project" | "workspace",
  dirSegments: string[],
  updates: Partial<GitNexusStatus>
): void {
  const meta =
    scope === "project" ? readProjectMeta(dirSegments) : readWorkspaceMeta(dirSegments);
  if (!meta) return;
  const current: GitNexusStatus = meta.gitnexusStatus || { phase: "idle", indexExists: false };
  meta.gitnexusStatus = { ...current, ...updates };
  if (scope === "project") {
    writeProjectMeta(meta, dirSegments);
  } else {
    writeWorkspaceMeta(meta, dirSegments);
  }
}

function escalateKill(child: ChildProcess): void {
  if (child.killed) return;
  try {
    child.kill("SIGTERM");
  } catch {
    /* noop */
  }
  setTimeout(() => {
    if (!child.killed) {
      try {
        child.kill("SIGKILL");
      } catch {
        /* noop */
      }
    }
  }, SIGTERM_GRACE_MS).unref();
}
