import { NextRequest, NextResponse } from "next/server";
import { readDocument, writeDocument, deleteDocument, renameDocument, buildPath } from "@/lib/fs";
import fs from "fs";
import { db } from "@/db";
import { documentActivities } from "@/db/schema";

function parseDocumentMeta(segments: string[]) {
  // segments: ["personal", "default", "projects", "{projectId}", "docs", ...pathParts]
  if (segments.length >= 6 && segments[3] && segments[4] === "docs") {
    const projectId = segments[3];
    const docSegments = segments.slice(5);
    const documentPath = docSegments.join("/");
    const documentTitle = docSegments[docSegments.length - 1]?.replace(/\.md$/, "") || "";
    return { projectId, documentPath, documentTitle };
  }
  return null;
}

// GET /api/fs/document?path=personal/default/my-project/doc-title
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get("path") || "";

  if (!filePath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const segments = filePath.split("/").filter(Boolean);
  const content = readDocument(...segments);

  if (content === null) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ content });
}

// POST /api/fs/document - create/update document
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { path: filePath, content } = body;

  if (!filePath || content === undefined) {
    return NextResponse.json({ error: "path and content are required" }, { status: 400 });
  }

  const segments = filePath.split("/").filter(Boolean);
  const meta = parseDocumentMeta(segments);

  if (meta) {
    const existing = readDocument(...segments);
    writeDocument(content, ...segments);
    db.insert(documentActivities).values({
      projectId: meta.projectId,
      documentPath: meta.documentPath,
      documentTitle: meta.documentTitle,
      action: existing !== null ? "update" : "create",
      createdAt: new Date().toISOString(),
    }).run();
  } else {
    writeDocument(content, ...segments);
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/fs/document - delete document
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { path: filePath } = body;

  if (!filePath) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const segments = filePath.split("/").filter(Boolean);
  const meta = parseDocumentMeta(segments);

  deleteDocument(...segments);

  if (meta) {
    db.insert(documentActivities).values({
      projectId: meta.projectId,
      documentPath: meta.documentPath,
      documentTitle: meta.documentTitle,
      action: "delete",
      createdAt: new Date().toISOString(),
    }).run();
  }

  return NextResponse.json({ success: true });
}

// PATCH /api/fs/document - rename document
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { path: filePath, newTitle } = body;

  if (!filePath || !newTitle) {
    return NextResponse.json({ error: "path and newTitle are required" }, { status: 400 });
  }

  const segments = filePath.split("/").filter(Boolean);
  const newPath = buildPath(...segments.slice(0, -1), newTitle);
  if (fs.existsSync(newPath)) {
    return NextResponse.json({ error: "A file with this name already exists" }, { status: 409 });
  }

  const meta = parseDocumentMeta(segments);

  if (meta) {
    const oldTitle = meta.documentTitle;
    renameDocument(newTitle, ...segments);
    db.insert(documentActivities).values({
      projectId: meta.projectId,
      documentPath: meta.documentPath.replace(/\/[^/]*$/, "/" + newTitle),
      documentTitle: newTitle,
      action: "rename",
      oldTitle,
      createdAt: new Date().toISOString(),
    }).run();
  } else {
    renameDocument(newTitle, ...segments);
  }

  return NextResponse.json({ success: true });
}
