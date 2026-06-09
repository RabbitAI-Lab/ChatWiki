import { db } from "@/db";
import { entities } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { Metadata } from "next";
import type { PublishStatus } from "@/lib/types";
import DocsifyClient from "./DocsifyClient";

export const dynamic = "force-dynamic";

interface DocsPageProps {
  searchParams: Promise<{ projectId?: string }>;
}

async function getPublishedProject(projectId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: entities.name, publishStatus: entities.publishStatus })
    .from(entities)
    .where(and(eq(entities.id, projectId), eq(entities.type, "project")))
    .limit(1);

  if (!row?.publishStatus) return null;
  try {
    const status = JSON.parse(row.publishStatus) as PublishStatus;
    return status.enabled ? row.name : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ searchParams }: DocsPageProps): Promise<Metadata> {
  const { projectId } = await searchParams;
  if (!projectId) return { title: "Documents" };

  const name = await getPublishedProject(projectId);
  return { title: name ? `${name} - Docs` : "Not Found" };
}

export default async function DocsPage({ searchParams }: DocsPageProps) {
  const { projectId } = await searchParams;

  if (!projectId) {
    return (
      <div style={{
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#f9fafb",
      }}>
        <div style={{ textAlign: "center", color: "#6b7280" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Documents</h1>
          <p>No project specified.</p>
        </div>
      </div>
    );
  }

  const projectName = await getPublishedProject(projectId);

  if (!projectName) {
    return (
      <div style={{
        fontFamily: "system-ui, sans-serif",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#f9fafb",
      }}>
        <div style={{ textAlign: "center", color: "#6b7280" }}>
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>404</h1>
          <p>This documentation site does not exist or has not been published yet.</p>
        </div>
      </div>
    );
  }

  return <DocsifyClient projectName={projectName} projectId={projectId} />;
}
