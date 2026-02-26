import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { habits, timeSessions, activeTimers } from '@/db/schema';
import { getSessionUserId } from '@/lib/auth';
import { eq, and, gte, sql } from 'drizzle-orm';

const createHabitSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const userHabits = await db.select().from(habits).where(eq(habits.userId, userId));

  const habitsWithStats = await Promise.all(
    userHabits.map(async (habit) => {
      const [todayResult, timer, streak] = await Promise.all([
        db
          .select({ total: sql<number>`COALESCE(SUM(${timeSessions.durationSeconds}), 0)` })
          .from(timeSessions)
          .where(and(eq(timeSessions.habitId, habit.id), gte(timeSessions.endTime, todayStart)))
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
        streak,
        activeTimer: timer
          ? { startTime: timer.startTime.toISOString(), targetDurationSeconds: timer.targetDurationSeconds ?? null }
          : null,
      };
    })
  );

  return NextResponse.json({ habits: habitsWithStats });
}

async function computeStreak(habitId: number): Promise<number> {
  // Drizzle stores mode:'timestamp' integers as seconds (unix epoch).
  // Use 'unixepoch' directly without dividing by 1000.
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
      // Yesterday counts as start of streak if no activity today yet
      streak++;
      expected = new Date(rowDate.getTime() - 24 * 60 * 60 * 1000);
    } else {
      break;
    }
  }

  return streak;
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = createHabitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Name is required (max 100 chars)' }, { status: 400 });
  }

  const result = await db.insert(habits).values({ userId, name: parsed.data.name }).returning();
  return NextResponse.json({ habit: result[0] }, { status: 201 });
}
