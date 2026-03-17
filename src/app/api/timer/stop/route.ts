import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { stopActiveTimerForUser } from "@/server/db/timers";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stoppedTimer = await stopActiveTimerForUser(userId);

  if (!stoppedTimer)
    return NextResponse.json({ error: "No active timer" }, { status: 404 });

  return NextResponse.json(stoppedTimer);
}
