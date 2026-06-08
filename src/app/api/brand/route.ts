import { NextResponse } from "next/server";
import { getBrandName } from "@/lib/auth/settings";

export async function GET() {
  return NextResponse.json({ brandName: await getBrandName() });
}
