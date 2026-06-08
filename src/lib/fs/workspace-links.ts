/**
 * Workspace-project association functions.
 * Replaced symlink-based linking with DB queries.
 */
import type { ProjectMeta } from "../types";
import { readProjectMeta } from "./project";
import { db } from "@/db";
import { entityMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * List projects linked to a workspace (via DB member records).
 * Returns ProjectMeta[] for each linked project.
 */
export async function listWorkspaceProjects(_type: string, _accountId: string, workspaceId: string): Promise<ProjectMeta[]> {
  const memberRows = await db
    .select({ entityId: entityMembers.entityId })
    .from(entityMembers)
    .where(
      and(
        eq(entityMembers.entityId, workspaceId),
        eq(entityMembers.entityType, "workspace_project")
      )
    );

  const result: ProjectMeta[] = [];
  for (const row of memberRows) {
    const projectMeta = await readProjectMeta(["projects", row.entityId]);
    if (projectMeta) {
      result.push(projectMeta);
    }
  }
  return result;
}

/**
 * Link a project to a workspace by inserting a DB record.
 */
export async function linkProjectToWorkspace(_type: string, _accountId: string, workspaceId: string, projectId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.insert(entityMembers)
    .values({
      entityId: workspaceId,
      entityType: "workspace_project",
      memberId: projectId,
      userId: null,
      accountName: "",
      ownerId: workspaceId,
      addedAt: now,
      createdAt: now,
    })
    .onConflictDoNothing();
}

/**
 * Unlink a project from a workspace by removing the DB record.
 */
export async function unlinkProjectFromWorkspace(_type: string, _accountId: string, workspaceId: string, projectId: string): Promise<void> {
  await db.delete(entityMembers)
    .where(
      and(
        eq(entityMembers.entityId, workspaceId),
        eq(entityMembers.entityType, "workspace_project"),
        eq(entityMembers.memberId, projectId)
      )
    );
}
