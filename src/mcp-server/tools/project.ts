import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  listProjects,
  createProject,
  deleteProject,
  readProjectMeta,
  writeProjectMeta,
} from "@/lib/fs";

export function registerProjectTools(server: McpServer) {
  server.registerTool(
    "list_projects",
    {
      description: "列出所有项目",
      inputSchema: z.object({
        accountId: z.string().describe("账号 ID"),
      }),
    },
    async ({ accountId }) => {
      const projects = listProjects(accountId);
      return {
        content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
      };
    }
  );

  server.registerTool(
    "create_project",
    {
      description: "创建新项目",
      inputSchema: z.object({
        accountId: z.string().describe("账号 ID"),
        name: z.string().describe("项目名称"),
      }),
    },
    async ({ accountId, name }) => {
      const meta = createProject(accountId, name);
      return {
        content: [{ type: "text", text: JSON.stringify(meta, null, 2) }],
      };
    }
  );

  server.registerTool(
    "get_project",
    {
      description: "获取项目详情",
      inputSchema: z.object({
        projectId: z.string().describe("项目 ID"),
      }),
    },
    async ({ projectId }) => {
      const dirSegments = ["projects", projectId];
      const meta = await readProjectMeta(dirSegments);
      if (!meta) {
        return {
          content: [{ type: "text", text: "Project not found" }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(meta, null, 2) }],
      };
    }
  );

  server.registerTool(
    "update_project",
    {
      description: "更新项目（名称/描述/排序）",
      inputSchema: z.object({
        projectId: z.string().describe("项目 ID"),
        name: z.string().optional().describe("新项目名称"),
        description: z.string().optional().describe("项目描述"),
        sortOrder: z.number().optional().describe("排序值（越小越靠前）"),
      }),
    },
    async ({ projectId, name, description, sortOrder }) => {
      const dirSegments = ["projects", projectId];
      const meta = await readProjectMeta(dirSegments);
      if (!meta) {
        return {
          content: [{ type: "text", text: "Project not found" }],
          isError: true,
        };
      }
      if (name !== undefined) meta.name = name;
      if (description !== undefined) meta.description = description;
      if (sortOrder !== undefined) meta.sortOrder = sortOrder;
      writeProjectMeta(meta, dirSegments);
      return {
        content: [{ type: "text", text: JSON.stringify(meta, null, 2) }],
      };
    }
  );

  server.registerTool(
    "delete_project",
    {
      description: "删除项目（递归删除所有内容）",
      inputSchema: z.object({
        projectId: z.string().describe("项目 ID"),
      }),
    },
    async ({ projectId }) => {
      deleteProject(projectId);
      return {
        content: [
          { type: "text", text: `Project deleted: ${projectId}` },
        ],
      };
    }
  );
}
