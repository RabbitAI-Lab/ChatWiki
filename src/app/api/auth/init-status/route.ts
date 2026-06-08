import { NextResponse } from "next/server";
import { isInitialized } from "@/lib/auth/settings";

export async function GET() {
  return NextResponse.json({ initialized: await isInitialized() });
}
