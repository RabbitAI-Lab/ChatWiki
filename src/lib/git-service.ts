import git from "isomorphic-git";
import * as fs from "fs";
import * as path from "path";
import http from "isomorphic-git/http/node";
import type { RepositoryCredentials } from "./fs";
import { getDataRoot } from "./fs/core";
import { getBrandName } from "./auth/settings";

/**
 * 获取认证回调函数
 */
function getAuthCallback(credentials: RepositoryCredentials) {
  return async () => {
    if (credentials.type === "none") {
      return { username: "", password: "" };
    }

    if (credentials.type === "token") {
      // GitHub/GitLab Token 认证
      return {
        username: credentials.token || "",
        password: "x-oauth-basic",
      };
    }

    if (credentials.type === "username_password") {
      return {
        username: credentials.username || "",
        password: credentials.password || "",
      };
    }

    return { username: "", password: "" };
  };
}

/**
 * 克隆仓库
 */
export async function cloneRepository(
  url: string,
  localPath: string,
  credentials: RepositoryCredentials
): Promise<{ success: boolean; commitHash?: string; error?: string }> {
  try {
    // 确保父目录存在
    const parentDir = path.dirname(localPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // 如果目标目录已存在，先删除
    if (fs.existsSync(localPath)) {
      fs.rmSync(localPath, { recursive: true, force: true });
    }

    // 执行克隆
    await git.clone({
      fs,
      http,
      url,
      dir: localPath,
      depth: 1,
      onAuth: getAuthCallback(credentials),
      singleBranch: true,
    });

    // 获取克隆后的 commit hash
    const commitHash = await getLocalCommitHash(localPath);

    return { success: true, commitHash: commitHash || undefined };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * 获取远程仓库的最新 commit hash (不合并)
 */
export async function fetchRemote(
  localPath: string,
  credentials: RepositoryCredentials
): Promise<{ success: boolean; remoteHash?: string; error?: string }> {
  try {
    if (!fs.existsSync(localPath)) {
      return { success: false, error: "本地仓库不存在" };
    }

    // 执行 fetch (不合并)
    await git.fetch({
      fs,
      http,
      dir: localPath,
      onAuth: getAuthCallback(credentials),
      singleBranch: true,
    });

    // 获取远程 commit hash
    const remoteHash = await getRemoteCommitHash(localPath);

    return { success: true, remoteHash: remoteHash || undefined };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * 拉取并合并远程更新
 */
export async function pullRepository(
  localPath: string,
  credentials: RepositoryCredentials
): Promise<{ success: boolean; commitHash?: string; error?: string }> {
  try {
    if (!fs.existsSync(localPath)) {
      return { success: false, error: "本地仓库不存在" };
    }

    // 执行 pull
    await git.pull({
      fs,
      http,
      dir: localPath,
      onAuth: getAuthCallback(credentials),
      singleBranch: true,
      fastForward: true,
      author: { name: await getBrandName(), email: "docs@rabbitai-lab.com" },
    });

    // 获取 pull 后的 commit hash
    const commitHash = await getLocalCommitHash(localPath);

    return { success: true, commitHash: commitHash || undefined };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * 获取本地 HEAD commit hash
 */
export async function getLocalCommitHash(localPath: string): Promise<string | undefined> {
  try {
    if (!fs.existsSync(localPath)) {
      return undefined;
    }

    const oid = await git.resolveRef({ fs, dir: localPath, ref: "HEAD" });
    return oid;
  } catch {
    return undefined;
  }
}

/**
 * 获取远程跟踪分支的 HEAD commit hash
 */
export async function getRemoteCommitHash(localPath: string): Promise<string | undefined> {
  try {
    if (!fs.existsSync(localPath)) {
      return undefined;
    }

    // 尝试获取 refs/remotes/origin/HEAD
    const refs = await git.listBranches({ fs, dir: localPath, remote: "origin" });

    if (refs.length === 0) {
      return undefined;
    }

    // 获取第一个分支（通常是默认分支）的 commit
    const oid = await git.resolveRef({
      fs,
      dir: localPath,
      ref: `refs/remotes/origin/${refs[0]}`,
    });

    return oid;
  } catch {
    return undefined;
  }
}

/**
 * 检查同步状态
 */
export async function checkSyncStatus(
  localPath: string,
  credentials: RepositoryCredentials
): Promise<{
  status: "not_cloned" | "synced" | "behind" | "error";
  localHash?: string;
  remoteHash?: string;
  error?: string;
}> {
  try {
    // 检查本地目录是否存在
    if (!fs.existsSync(localPath)) {
      return { status: "not_cloned" };
    }

    // 检查 .git 目录
    const gitDir = path.join(localPath, ".git");
    if (!fs.existsSync(gitDir)) {
      return { status: "not_cloned" };
    }

    // 获取本地 commit hash
    const localHash = await getLocalCommitHash(localPath);

    if (!localHash) {
      return { status: "error", error: "无法获取本地 commit hash" };
    }

    // fetch 远程更新
    const fetchResult = await fetchRemote(localPath, credentials);

    if (!fetchResult.success) {
      return { status: "error", error: fetchResult.error };
    }

    const remoteHash = fetchResult.remoteHash;

    if (!remoteHash) {
      return { status: "synced", localHash }; // 无法获取远程 hash，假定已同步
    }

    // 比较 commit hash
    if (localHash === remoteHash) {
      return { status: "synced", localHash, remoteHash };
    } else {
      return { status: "behind", localHash, remoteHash };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { status: "error", error: errorMessage };
  }
}

/**
 * 删除本地仓库目录
 */
export function deleteLocalRepo(localPath: string): boolean {
  try {
    if (fs.existsSync(localPath)) {
      fs.rmSync(localPath, { recursive: true, force: true });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 将仓库名称转换为文件系统安全的目录名
 */
function sanitizeRepoName(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*]/g, "-") // 替换文件系统不安全字符
    .replace(/\s+/g, "-")            // 空格替换为连字符
    .replace(/-+/g, "-")             // 合并连续连字符
    .replace(/^-|-$/g, "")          // 去掉首尾连字符
    || "repo";                        // 空 fallback
}

/**
 * 获取仓库的本地存储路径
 * 优先使用 repoName 作为目录名（可读性好），
 * 若新路径不存在但旧路径（repoId）存在则自动重命名。
 */
export function getRepoLocalPath(
  projectDirSegments: string[],
  repoId: string,
  repoName?: string
): string {
  const reposDir = path.join(getDataRoot(), ...projectDirSegments, "repos");

  // 如果提供了 repoName，优先使用它作为目录名
  if (repoName) {
    const safeName = sanitizeRepoName(repoName);
    const nameBasedPath = path.join(reposDir, safeName);

    // 新路径已存在，直接返回
    if (fs.existsSync(nameBasedPath)) {
      return nameBasedPath;
    }

    // 检查旧路径（以 repoId 命名）是否存在，若存在则重命名
    const idBasedPath = path.join(reposDir, repoId);
    if (fs.existsSync(idBasedPath)) {
      try {
        fs.renameSync(idBasedPath, nameBasedPath);
      } catch {
        // 重命名失败（如目标名已被占用），回退到旧路径
        return idBasedPath;
      }
    }

    return nameBasedPath;
  }

  // 未提供 repoName，回退使用 repoId
  return path.join(reposDir, repoId);
}