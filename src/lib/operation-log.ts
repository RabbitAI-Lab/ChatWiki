import { operationLogs } from "@/db/schema";

type LogCategory = "repository" | "sandbox" | "skills" | "mcp" | "member";
type LogAction = "create" | "update" | "delete" | "enable" | "disable";

interface LogOperationParams {
  projectId: string;
  category: LogCategory;
  action: LogAction;
  detail: string;
  operator?: string;
  metadata?: Record<string, unknown>;
}

export function extractProjectId(dirSegments: string[]): string {
  return dirSegments[dirSegments.length - 1];
}

export async function logOperation(params: LogOperationParams): Promise<void> {
  try {
    const { db } = await import("@/db");
    await db.insert(operationLogs).values({
      projectId: params.projectId,
      category: params.category,
      action: params.action,
      detail: params.detail,
      operator: params.operator || "System",
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[operation-log] Failed to write log:", err);
  }
}
