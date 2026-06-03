/**
 * Workspace-specific symlink operations for linking/unlinking projects.
 */
import fs from "node:fs";
import path from "node:path";

import type { ProjectMeta } from "../types";
import { getDataRoot, getAccountSegments } from "./core";
import { readProjectMeta } from "./project";

/**
 * List projects linked to a workspace (via symlinks).
 * Returns ProjectMeta[] for each symlinked project.
 */
export function listWorkspaceProjects(type: "personal" | "enterprise", accountId: string, workspaceId: string, orgId?: string): ProjectMeta[] {
  const workspaceDir = path.join(getDataRoot(), ...getAccountSegments(type, accountId, orgId), "workspace", workspaceId);
  if (!fs.existsSync(workspaceDir)) return [];

  const entries = fs.readdirSync(workspaceDir, { withFileTypes: true });
  const result: ProjectMeta[] = [];

  for (const entry of entries) {
    if (entry.isDirectory() || fs.lstatSync(path.join(workspaceDir, entry.name)).isSymbolicLink()) {
      const projectId = entry.name;
      const projectMeta = readProjectMeta([...getAccountSegments(type, accountId, orgId), "projects", projectId]);
      if (projectMeta) {
        result.push(projectMeta);
      }
    }
  }
  return result;
}

/**
 * Link a project to a workspace by creating a symlink.
 * Symlink: workspace/{workspaceId}/{projectId} -> ../../projects/{projectId}/
 */
export function linkProjectToWorkspace(type: "personal" | "enterprise", accountId: string, workspaceId: string, projectId: string, orgId?: string): void {
  const accountSegs = getAccountSegments(type, accountId, orgId);
  const linkPath = path.join(getDataRoot(), ...accountSegs, "workspace", workspaceId, projectId);
  // Relative path from workspace dir to projects dir
  // workspace/{workspaceId}/{projectId} -> ../../projects/{projectId}/
  const targetPath = path.join("..", "..", "projects", projectId);

  if (fs.existsSync(linkPath)) {
    fs.unlinkSync(linkPath); // Remove existing link
  }
  fs.symlinkSync(targetPath, linkPath, "dir");
}

/**
 * Unlink a project from a workspace by removing the symlink.
 */
export function unlinkProjectFromWorkspace(type: "personal" | "enterprise", accountId: string, workspaceId: string, projectId: string, orgId?: string): void {
  const accountSegs = getAccountSegments(type, accountId, orgId);
  const linkPath = path.join(getDataRoot(), ...accountSegs, "workspace", workspaceId, projectId);

  if (fs.existsSync(linkPath)) {
    fs.unlinkSync(linkPath);
  }
}
