import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { createDir, deleteDir, renameDir, getDataRoot } from "@/lib/fs";

// POST /api/fs/directory - create a directory
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { path: dirPath } = body;
  if (!dirPath || typeof dirPath !== "string") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const segments = dirPath.split("/").filter(Boolean);
  createDir(segments);
  return NextResponse.json({ success: true, path: dirPath });
}

// PATCH /api/fs/directory - rename a directory
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { path: dirPath, newName } = body;
  if (!dirPath || !newName || typeof dirPath !== "string" || typeof newName !== "string") {
    return NextResponse.json({ error: "path and newName are required" }, { status: 400 });
  }

  const segments = dirPath.split("/").filter(Boolean);
  const newPath = path.join(getDataRoot(), ...segments.slice(0, -1), newName);
  if (fs.existsSync(newPath)) {
    return NextResponse.json({ error: "A folder with this name already exists" }, { status: 409 });
  }

  renameDir(newName, ...segments);
  return NextResponse.json({ success: true });
}

// DELETE /api/fs/directory - delete a directory
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { path: dirPath } = body;
  if (!dirPath || typeof dirPath !== "string") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const segments = dirPath.split("/").filter(Boolean);
  deleteDir(segments);
  return NextResponse.json({ success: true });
}
