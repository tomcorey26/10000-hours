import { and, desc, eq, gte, lt } from "drizzle-orm";

import { db } from "@/db";
import { activeTimers, habits, timeSessions } from "@/db/schema";
import type { Session } from "@/lib/types";

type SessionFilters = {
  habitId?: string;
  range?: string;
  date?: string;
  tzOffset?: number;
};

type ManualSessionInput = {
  userId: number;
  habitId: number;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
};

export async function getSessionsForUser(
  userId: number,
  filters: SessionFilters,
): Promise<{ sessions: Session[]; totalSeconds: number }> {
  const conditions = [eq(habits.userId, userId)];
  if (filters.habitId)
    conditions.push(eq(timeSessions.habitId, Number(filters.habitId)));

  if (filters.date && filters.tzOffset !== undefined) {
    const offsetMs = filters.tzOffset * 60 * 1000;
    const dayStart = new Date(filters.date + "T00:00:00");
    dayStart.setTime(dayStart.getTime() + offsetMs);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    conditions.push(gte(timeSessions.startTime, dayStart));
    conditions.push(lt(timeSessions.startTime, dayEnd));
  } else {
    const dateFilter = getDateFilter(filters.range);
    if (dateFilter) conditions.push(gte(timeSessions.endTime, dateFilter));
  }

  const rows = await db
    .select({
      id: timeSessions.id,
      habitName: habits.name,
      habitId: timeSessions.habitId,
      startTime: timeSessions.startTime,
      endTime: timeSessions.endTime,
      durationSeconds: timeSessions.durationSeconds,
      timerMode: timeSessions.timerMode,
    })
    .from(timeSessions)
    .innerJoin(habits, eq(timeSessions.habitId, habits.id))
    .where(and(...conditions))
    .orderBy(desc(timeSessions.endTime));

  const totalSeconds = rows.reduce((sum, row) => sum + row.durationSeconds, 0);

  return {
    sessions: rows.map((row) => ({
      ...row,
      startTime: row.startTime.toISOString(),
      endTime: row.endTime.toISOString(),
    })),
    totalSeconds,
  };
}

export async function createManualSessionForUser({
  userId,
  habitId,
  startTime,
  endTime,
  durationSeconds,
}: ManualSessionInput) {
  const habit = await db
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .get();

  if (!habit) return null;

  const [session] = await db
    .insert(timeSessions)
    .values({
      habitId,
      userId,
      startTime,
      endTime,
      durationSeconds,
      timerMode: "manual",
    })
    .returning();

  return session;
}

export async function deleteSessionForUser(
  sessionId: number,
  userId: number,
) {
  const [deleted] = await db
    .delete(timeSessions)
    .where(
      and(eq(timeSessions.id, sessionId), eq(timeSessions.userId, userId)),
    )
    .returning();

  return deleted ?? null;
}

export async function getSessionsForDateRange(
  userId: number,
  dayStart: Date,
  dayEnd: Date,
): Promise<
  {
    startTime: Date;
    endTime: Date;
    durationSeconds: number;
    timerMode: string;
    habitName: string;
  }[]
> {
  return db
    .select({
      startTime: timeSessions.startTime,
      endTime: timeSessions.endTime,
      durationSeconds: timeSessions.durationSeconds,
      timerMode: timeSessions.timerMode,
      habitName: habits.name,
    })
    .from(timeSessions)
    .innerJoin(habits, eq(timeSessions.habitId, habits.id))
    .where(
      and(
        eq(timeSessions.userId, userId),
        gte(timeSessions.startTime, dayStart),
        lt(timeSessions.startTime, dayEnd),
      ),
    );
}

export async function getActiveTimerForUser(
  userId: number,
): Promise<{ startTime: Date; habitName: string } | null> {
  const row = await db
    .select({ startTime: activeTimers.startTime, habitName: habits.name })
    .from(activeTimers)
    .innerJoin(habits, eq(activeTimers.habitId, habits.id))
    .where(eq(activeTimers.userId, userId))
    .get();
  return row ?? null;
}

function getDateFilter(range?: string): Date | null {
  const now = new Date();

  if (range === "today") {
    const dateFilter = new Date(now);
    dateFilter.setHours(0, 0, 0, 0);
    return dateFilter;
  }

  if (range === "week") {
    const dateFilter = new Date(now);
    dateFilter.setDate(dateFilter.getDate() - 7);
    dateFilter.setHours(0, 0, 0, 0);
    return dateFilter;
  }

  if (range === "month") {
    const dateFilter = new Date(now);
    dateFilter.setMonth(dateFilter.getMonth() - 1);
    dateFilter.setHours(0, 0, 0, 0);
    return dateFilter;
  }

  return null;
}
