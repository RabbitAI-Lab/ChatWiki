import path from "node:path";
import { getDataRoot } from "@/lib/fs/core";

/**
 * 将相对路径字符串解析为路径段数组
 */
export function parsePath(filePath: string): string[] {
  return filePath.split("/").filter(Boolean);
}

/**
 * 构建完整的文件系统路径（用于调试/日志）
 */
export function resolvePath(segments: string[]): string {
  return path.join(getDataRoot(), ...segments);
}
