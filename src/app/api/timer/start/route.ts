import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { startTimerForUser } from "@/server/db/timers";

const startSchema = z.object({
  habitId: z.number().int().positive(),
  targetDurationSeconds: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = startSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid habitId" }, { status: 400 });

  const { habitId, targetDurationSeconds } = parsed.data;

  const timer = await startTimerForUser({
    userId,
    habitId,
    targetDurationSeconds,
  });
  if (!timer)
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });

  return NextResponse.json(timer);
}
