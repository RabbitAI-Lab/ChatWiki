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
export function listWorkspaceProjects(_type: string, _accountId: string, workspaceId: string): ProjectMeta[] {
  const memberRows = db
    .select({ entityId: entityMembers.entityId })
    .from(entityMembers)
    .where(
      and(
        eq(entityMembers.entityId, workspaceId),
        eq(entityMembers.entityType, "workspace_project")
      )
    )
    .all();

  const result: ProjectMeta[] = [];
  for (const row of memberRows) {
    const projectMeta = readProjectMeta(["projects", row.entityId]);
    if (projectMeta) {
      result.push(projectMeta);
    }
  }
  return result;
}

/**
 * Link a project to a workspace by inserting a DB record.
 */
export function linkProjectToWorkspace(_type: string, _accountId: string, workspaceId: string, projectId: string): void {
  const now = new Date().toISOString();
  db.insert(entityMembers)
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
    .onConflictDoNothing()
    .run();
}

/**
 * Unlink a project from a workspace by removing the DB record.
 */
export function unlinkProjectFromWorkspace(_type: string, _accountId: string, workspaceId: string, projectId: string): void {
  db.delete(entityMembers)
    .where(
      and(
        eq(entityMembers.entityId, workspaceId),
        eq(entityMembers.entityType, "workspace_project"),
        eq(entityMembers.memberId, projectId)
      )
    )
    .run();
}
