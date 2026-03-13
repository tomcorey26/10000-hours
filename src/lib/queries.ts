import { db } from '@/db';
import { habits, timeSessions, activeTimers } from '@/db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { buildSessionFromTimer } from '@/lib/auto-stop-timer';

export type AutoStoppedSession = {
  habitName: string;
  durationSeconds: number;
};

/** Check for expired countdown timers and auto-record them. */
export async function autoStopExpiredCountdown(userId: number): Promise<AutoStoppedSession | null> {
  const timer = await db
    .select()
    .from(activeTimers)
    .where(eq(activeTimers.userId, userId))
    .get();

  if (!timer || timer.targetDurationSeconds === null) return null;

  const elapsed = Math.round((Date.now() - timer.startTime.getTime()) / 1000);
  if (elapsed < timer.targetDurationSeconds) return null;

  const session = buildSessionFromTimer(timer, new Date());

  const habit = await db
    .select({ name: habits.name })
    .from(habits)
    .where(eq(habits.id, timer.habitId))
    .get();

  await db.transaction(async (tx) => {
    await tx.insert(timeSessions).values(session);
    await tx.delete(activeTimers).where(eq(activeTimers.userId, userId));
  });

  return {
    habitName: habit?.name ?? "Unknown",
    durationSeconds: session.durationSeconds,
  };
}

export async function getHabitsForUser(userId: number) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const userHabits = await db.select().from(habits).where(eq(habits.userId, userId));

  return Promise.all(
    userHabits.map(async (habit) => {
      const [todayResult, totalResult, timer, streak] = await Promise.all([
        db
          .select({ total: sql<number>`COALESCE(SUM(${timeSessions.durationSeconds}), 0)` })
          .from(timeSessions)
          .where(and(eq(timeSessions.habitId, habit.id), gte(timeSessions.endTime, todayStart)))
          .get(),
        db
          .select({ total: sql<number>`COALESCE(SUM(${timeSessions.durationSeconds}), 0)` })
          .from(timeSessions)
          .where(eq(timeSessions.habitId, habit.id))
          .get(),
        db
          .select()
          .from(activeTimers)
          .where(eq(activeTimers.habitId, habit.id))
          .get(),
        computeStreak(habit.id),
      ]);

      return {
        ...habit,
        todaySeconds: todayResult?.total ?? 0,
        totalSeconds: totalResult?.total ?? 0,
        streak,
        activeTimer: timer
          ? { startTime: timer.startTime.toISOString(), targetDurationSeconds: timer.targetDurationSeconds ?? null }
          : null,
      };
    })
  );
}

async function computeStreak(habitId: number): Promise<number> {
  const rows = await db
    .select({ date: sql<string>`DATE(${timeSessions.endTime}, 'unixepoch', 'localtime')` })
    .from(timeSessions)
    .where(eq(timeSessions.habitId, habitId))
    .groupBy(sql`DATE(${timeSessions.endTime}, 'unixepoch', 'localtime')`)
    .orderBy(sql`DATE(${timeSessions.endTime}, 'unixepoch', 'localtime') DESC`);

  if (rows.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let expected = today;

  for (const row of rows) {
    const rowDate = new Date(row.date + 'T00:00:00');
    const diffDays = Math.round((expected.getTime() - rowDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      streak++;
      expected = new Date(expected.getTime() - 24 * 60 * 60 * 1000);
    } else if (diffDays === 1 && streak === 0) {
      streak++;
      expected = new Date(rowDate.getTime() - 24 * 60 * 60 * 1000);
    } else {
      break;
    }
  }

  return streak;
}

export async function getSessionsForUser(
  userId: number,
  filters: { habitId?: string; range?: string }
) {
  let dateFilter: Date | null = null;
  const now = new Date();
  if (filters.range === 'today') {
    dateFilter = new Date(now);
    dateFilter.setHours(0, 0, 0, 0);
  } else if (filters.range === 'week') {
    dateFilter = new Date(now);
    dateFilter.setDate(dateFilter.getDate() - 7);
    dateFilter.setHours(0, 0, 0, 0);
  } else if (filters.range === 'month') {
    dateFilter = new Date(now);
    dateFilter.setMonth(dateFilter.getMonth() - 1);
    dateFilter.setHours(0, 0, 0, 0);
  }

  const conditions = [eq(habits.userId, userId)];
  if (filters.habitId) conditions.push(eq(timeSessions.habitId, Number(filters.habitId)));
  if (dateFilter) conditions.push(gte(timeSessions.endTime, dateFilter));

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

  const totalSeconds = rows.reduce((sum, r) => sum + r.durationSeconds, 0);

  return {
    sessions: rows.map(r => ({
      ...r,
      startTime: r.startTime.toISOString(),
      endTime: r.endTime.toISOString(),
    })),
    totalSeconds,
  };
}

export async function getRankingsForUser(userId: number) {
  const totalSecondsExpr = sql<number>`sum(${timeSessions.durationSeconds})`;

  const rows = await db
    .select({
      habitId: habits.id,
      habitName: habits.name,
      totalSeconds: totalSecondsExpr.as('total_seconds'),
    })
    .from(timeSessions)
    .innerJoin(habits, eq(timeSessions.habitId, habits.id))
    .where(eq(habits.userId, userId))
    .groupBy(habits.id, habits.name)
    .orderBy(desc(totalSecondsExpr));

  return rows.map((row, i) => ({
    rank: i + 1,
    habitId: row.habitId,
    habitName: row.habitName,
    totalSeconds: row.totalSeconds,
  }));
}
