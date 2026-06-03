import { NextResponse } from "next/server";
import {
  isOpenRegistration,
  isInviteCodeRequired,
  getGeneralRegistrationKey,
} from "@/lib/auth/settings";

export async function GET() {
  const generalKey = getGeneralRegistrationKey();
  return NextResponse.json({
    openRegistration: isOpenRegistration(),
    requireInviteCode: isInviteCodeRequired(),
    generalKeyEnabled: !!generalKey && generalKey.length > 0,
  });
}
