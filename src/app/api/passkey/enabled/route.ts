import { NextResponse } from "next/server";
import { getSetting } from "@/lib/auth/settings";

export async function GET() {
  const enabled = (await getSetting("passkey_enabled")) === "true";
  return NextResponse.json({ enabled });
}
