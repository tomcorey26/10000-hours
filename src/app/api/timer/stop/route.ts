import { NextResponse } from "next/server";
import { db } from "@/db";
import { activeTimers, timeSessions } from "@/db/schema";
import { getSessionUserId } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { buildSessionFromTimer } from "@/lib/auto-stop-timer";

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stoppedTimer = await db.transaction(async (tx) => {
    const timer = await tx
      .select()
      .from(activeTimers)
      .where(eq(activeTimers.userId, userId))
      .get();
    if (!timer) return null;

    const session = buildSessionFromTimer(timer, new Date());

    await tx.insert(timeSessions).values(session);
    await tx.delete(activeTimers).where(eq(activeTimers.userId, userId));

    return { durationSeconds: session.durationSeconds, habitId: timer.habitId };
  });

  if (!stoppedTimer)
    return NextResponse.json({ error: "No active timer" }, { status: 404 });

  return NextResponse.json(stoppedTimer);
}
