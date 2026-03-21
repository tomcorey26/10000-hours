import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import {
  createManualSessionForUser,
  getActiveTimerForUser,
  getSessionsForDateRange,
  getSessionsForUser,
} from "@/server/db/sessions";

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const habitId = searchParams.get("habitId");
  const range = searchParams.get("range") || "all";
  const date = searchParams.get("date") || undefined;
  const tzOffsetRaw = searchParams.get("tzOffset");
  const tzOffset = tzOffsetRaw !== null ? Number(tzOffsetRaw) : undefined;

  const result = await getSessionsForUser(userId, {
    habitId: habitId ?? undefined,
    range,
    date,
    tzOffset,
  });

  return NextResponse.json(result);
}

const logSessionSchema = z.object({
  habitId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  tzOffset: z.number().int(),
  durationMinutes: z.number().int().min(1).max(720),
});

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = logSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    habitId,
    date,
    startTime: startTimeStr,
    tzOffset,
    durationMinutes,
  } = parsed.data;

  const sessionDate = new Date(date + "T12:00:00");
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  if (sessionDate < sevenDaysAgo || sessionDate >= tomorrow) {
    return NextResponse.json(
      { error: "Date must be within the last 7 days" },
      { status: 400 },
    );
  }

  // Compute offset string from tzOffset (getTimezoneOffset returns positive for west)
  const offsetHours = Math.floor(Math.abs(tzOffset) / 60);
  const offsetMins = Math.abs(tzOffset) % 60;
  const offsetSign = tzOffset <= 0 ? "+" : "-";
  const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, "0")}:${String(offsetMins).padStart(2, "0")}`;

  const startTime = new Date(`${date}T${startTimeStr}:00${offsetStr}`);
  const durationSeconds = durationMinutes * 60;
  const endTime = new Date(startTime.getTime() + durationSeconds * 1000);

  // Midnight boundary check (using local HH:mm)
  const [startH, startM] = startTimeStr.split(":").map(Number);
  if (startH * 60 + startM + durationMinutes > 24 * 60) {
    return NextResponse.json(
      { error: "Session cannot extend past midnight" },
      { status: 400 },
    );
  }

  // Overlap check
  const dayStart = new Date(`${date}T00:00:00${offsetStr}`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const existingSessions = await getSessionsForDateRange(
    userId,
    dayStart,
    dayEnd,
  );
  for (const session of existingSessions) {
    // Skip midnight placeholder sessions
    if (
      session.timerMode === "manual" &&
      session.startTime.getUTCHours() === 0 &&
      session.startTime.getUTCMinutes() === 0 &&
      session.startTime.getUTCSeconds() === 0
    )
      continue;
    // Both are UTC Date objects, direct comparison is safe
    if (startTime < session.endTime && session.startTime < endTime) {
      return NextResponse.json(
        {
          error: `Overlaps with ${session.habitName}`,
          conflict: {
            habitName: session.habitName,
            startTime: session.startTime.toISOString(),
            endTime: session.endTime.toISOString(),
          },
        },
        { status: 409 },
      );
    }
  }

  // Active timer check — timer is unbounded (still running)
  const activeTimer = await getActiveTimerForUser(userId);
  if (activeTimer && activeTimer.startTime < endTime) {
    return NextResponse.json(
      {
        error: `Overlaps with active ${activeTimer.habitName} timer`,
        conflict: {
          habitName: activeTimer.habitName,
          startTime: activeTimer.startTime.toISOString(),
          endTime: null,
        },
      },
      { status: 409 },
    );
  }

  const session = await createManualSessionForUser({
    userId,
    habitId,
    startTime,
    endTime,
    durationSeconds,
  });

  if (!session)
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });

  return NextResponse.json({ session }, { status: 201 });
}
