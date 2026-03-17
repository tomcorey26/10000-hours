import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getRankingsForUser } from "@/server/db/rankings";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rankings = await getRankingsForUser(userId);
  return NextResponse.json({ rankings });
}
