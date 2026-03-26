import { and, count, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { habits, timeSessions } from "@/db/schema";
import type { Session } from "@/lib/types";

type SessionFilters = {
  habitId?: string;
  range?: string;
  page?: number;
  pageSize?: number;
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
): Promise<{
  sessions: Session[];
  totalSeconds: number;
  totalCount: number;
  hasNextPage: boolean;
  page: number;
}> {
  const { page = 1, pageSize = 20 } = filters;
  const dateFilter = getDateFilter(filters.range);

  const conditions = [eq(habits.userId, userId)];
  if (filters.habitId)
    conditions.push(eq(timeSessions.habitId, Number(filters.habitId)));
  if (dateFilter) conditions.push(gte(timeSessions.endTime, dateFilter));

  const [stats] = await db
    .select({
      totalCount: count(),
      totalSeconds: sql<number>`coalesce(sum(${timeSessions.durationSeconds}), 0)`,
    })
    .from(timeSessions)
    .innerJoin(habits, eq(timeSessions.habitId, habits.id))
    .where(and(...conditions));

  const totalCount = stats?.totalCount ?? 0;
  const totalSeconds = stats?.totalSeconds ?? 0;

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
    .orderBy(desc(timeSessions.endTime))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    sessions: rows.map((row) => ({
      ...row,
      startTime: row.startTime.toISOString(),
      endTime: row.endTime.toISOString(),
    })),
    totalSeconds,
    totalCount,
    hasNextPage: page * pageSize < totalCount,
    page,
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
