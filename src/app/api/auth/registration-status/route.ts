import { NextResponse } from "next/server";
import {
  isOpenRegistration,
  isInviteCodeRequired,
  getGeneralRegistrationKey,
} from "@/lib/auth/settings";

export async function GET() {
  const generalKey = await getGeneralRegistrationKey();
  return NextResponse.json({
    openRegistration: await isOpenRegistration(),
    requireInviteCode: await isInviteCodeRequired(),
    generalKeyEnabled: !!generalKey && generalKey.length > 0,
  });
}
