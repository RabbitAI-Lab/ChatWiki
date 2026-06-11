import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { db } from "@/db";
import { todos } from "@/db/schema";
import { eq, desc, asc, and, sql } from "drizzle-orm";
import { getMcpUserId } from "../context";

const TITLE_MAX = 100;
const DESC_MAX = 100;

function requireAuth(): string | { content: { type: "text"; text: string }[]; isError: true } {
  const userId = getMcpUserId();
  if (!userId) {
    return {
      content: [{ type: "text" as const, text: "Authentication required: no userId in MCP context" }],
      isError: true,
    };
  }
  return userId;
}

export function registerTodoTools(server: McpServer) {
  // ── list_todos ──
  server.registerTool(
    "list_todos",
    {
      description:
        "List all todo items for the current user, ordered by user-specified order, then by creation time descending.",
      inputSchema: z.object({}),
    },
    async () => {
      const auth = requireAuth();
      if (typeof auth !== "string") return auth;

      const rows = await db
        .select()
        .from(todos)
        .where(eq(todos.userId, auth))
        .orderBy(asc(todos.sortOrder), desc(todos.createdAt));
      return {
        content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      };
    }
  );

  // ── create_todo ──
  server.registerTool(
    "create_todo",
    {
      description: "Create a new todo item for the current user.",
      inputSchema: z.object({
        title: z
          .string()
          .min(1)
          .max(TITLE_MAX)
          .describe("Todo title (required, max 100 characters)"),
        description: z
          .string()
          .max(DESC_MAX)
          .optional()
          .describe("Todo description (optional, max 100 characters)"),
      }),
    },
    async ({ title, description }) => {
      const auth = requireAuth();
      if (typeof auth !== "string") return auth;

      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return {
          content: [{ type: "text", text: "Title must not be empty" }],
          isError: true,
        };
      }

      const desc = (description || "").trim();
      const now = new Date().toISOString();

      // Calculate next sortOrder for pending todos
      const maxResult = await db
        .select({ maxOrder: sql<number>`COALESCE(MAX(${todos.sortOrder}), -1)` })
        .from(todos)
        .where(and(eq(todos.userId, auth), eq(todos.completed, false)));
      const nextOrder = (maxResult[0]?.maxOrder ?? -1) + 1;

      const result = await db
        .insert(todos)
        .values({
          userId: auth,
          title: trimmedTitle,
          description: desc,
          completed: false,
          sortOrder: nextOrder,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: todos.id });

      const [newTodo] = await db
        .select()
        .from(todos)
        .where(eq(todos.id, result[0].id));

      return {
        content: [{ type: "text", text: JSON.stringify(newTodo, null, 2) }],
      };
    }
  );

  // ── update_todo ──
  server.registerTool(
    "update_todo",
    {
      description:
        "Update an existing todo item. You can change the title, description, or completion status.",
      inputSchema: z.object({
        id: z.number().describe("Todo item ID"),
        title: z
          .string()
          .min(1)
          .max(TITLE_MAX)
          .optional()
          .describe("New title (max 100 characters)"),
        description: z
          .string()
          .max(DESC_MAX)
          .optional()
          .describe("New description (max 100 characters)"),
        completed: z
          .boolean()
          .optional()
          .describe("Completion status: true = done, false = pending"),
      }),
    },
    async ({ id, title, description, completed }) => {
      const auth = requireAuth();
      if (typeof auth !== "string") return auth;

      const [existing] = await db.select().from(todos).where(eq(todos.id, id));
      if (!existing) {
        return {
          content: [{ type: "text", text: `Todo not found: id=${id}` }],
          isError: true,
        };
      }
      if (existing.userId !== auth) {
        return {
          content: [{ type: "text", text: "Forbidden: todo does not belong to current user" }],
          isError: true,
        };
      }

      if (title === undefined && description === undefined && completed === undefined) {
        return {
          content: [{ type: "text", text: "At least one field (title, description, or completed) must be provided" }],
          isError: true,
        };
      }

      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (title !== undefined) {
        const trimmed = title.trim();
        if (!trimmed) {
          return {
            content: [{ type: "text", text: "Title must not be empty" }],
            isError: true,
          };
        }
        updates.title = trimmed;
      }
      if (description !== undefined) {
        updates.description = description.trim();
      }
      if (completed !== undefined) {
        const newCompleted = completed;
        if (newCompleted !== existing.completed) {
          const targetCompleted = newCompleted;
          const maxResult = await db
            .select({ maxOrder: sql<number>`COALESCE(MAX(${todos.sortOrder}), -1)` })
            .from(todos)
            .where(and(eq(todos.userId, auth), eq(todos.completed, targetCompleted)));
          updates.sortOrder = (maxResult[0]?.maxOrder ?? -1) + 1;
        }
        updates.completed = completed;
      }

      await db.update(todos).set(updates).where(eq(todos.id, id));
      const [updated] = await db.select().from(todos).where(eq(todos.id, id));

      return {
        content: [{ type: "text", text: JSON.stringify(updated, null, 2) }],
      };
    }
  );

  // ── delete_todo ──
  server.registerTool(
    "delete_todo",
    {
      description: "Delete a todo item by ID. Only the owner can delete their own todos.",
      inputSchema: z.object({
        id: z.number().describe("Todo item ID to delete"),
      }),
    },
    async ({ id }) => {
      const auth = requireAuth();
      if (typeof auth !== "string") return auth;

      const [existing] = await db.select().from(todos).where(eq(todos.id, id));
      if (!existing) {
        return {
          content: [{ type: "text", text: `Todo not found: id=${id}` }],
          isError: true,
        };
      }
      if (existing.userId !== auth) {
        return {
          content: [{ type: "text", text: "Forbidden: todo does not belong to current user" }],
          isError: true,
        };
      }

      await db.delete(todos).where(eq(todos.id, id));
      return {
        content: [{ type: "text", text: `Todo deleted: id=${id}` }],
      };
    }
  );
}
