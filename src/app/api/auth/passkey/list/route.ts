import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getCredentialsByUserId } from "@/server/db/passkeys";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credentials = await getCredentialsByUserId(userId);
  return NextResponse.json({
    credentials: credentials.map((c) => ({
      id: c.id,
      label: c.label,
      deviceType: c.deviceType,
      backedUp: c.backedUp,
      createdAt: c.createdAt,
    })),
  });
}
