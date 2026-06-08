import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { getSetting, setSetting } from "@/lib/auth/settings";

export async function GET(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  return NextResponse.json({
    enabled: (await getSetting("passkey_enabled")) === "true",
    rpId: (await getSetting("passkey_rp_id")) || "",
    rpName: (await getSetting("passkey_rp_name")) || "RabbitDocs",
    userVerification: (await getSetting("passkey_user_verification")) || "preferred",
  });
}

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  rpId: z.string().optional(),
  rpName: z.string().optional(),
  userVerification: z.enum(["required", "preferred", "discouraged"]).optional(),
});

export async function PUT(req: NextRequest) {
  const authResult = await requireAdmin(req);
  if (authResult instanceof NextResponse) return authResult;

  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  if (parsed.data.enabled !== undefined) {
    await setSetting("passkey_enabled", parsed.data.enabled ? "true" : "false");
  }
  if (parsed.data.rpId !== undefined) {
    await setSetting("passkey_rp_id", parsed.data.rpId);
  }
  if (parsed.data.rpName !== undefined) {
    await setSetting("passkey_rp_name", parsed.data.rpName);
  }
  if (parsed.data.userVerification !== undefined) {
    await setSetting("passkey_user_verification", parsed.data.userVerification);
  }

  return NextResponse.json({ success: true });
}
