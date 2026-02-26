import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { timeSessions, habits } from '@/db/schema';
import { getSessionUserId } from '@/lib/auth';
import { eq, and, gte, desc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const habitId = searchParams.get('habitId');
  const range = searchParams.get('range') || 'all';

  // Build date filter
  let dateFilter: Date | null = null;
  const now = new Date();
  if (range === 'today') {
    dateFilter = new Date(now);
    dateFilter.setHours(0, 0, 0, 0);
  } else if (range === 'week') {
    dateFilter = new Date(now);
    dateFilter.setDate(dateFilter.getDate() - 7);
    dateFilter.setHours(0, 0, 0, 0);
  } else if (range === 'month') {
    dateFilter = new Date(now);
    dateFilter.setMonth(dateFilter.getMonth() - 1);
    dateFilter.setHours(0, 0, 0, 0);
  }

  const conditions = [eq(habits.userId, userId)];
  if (habitId) conditions.push(eq(timeSessions.habitId, Number(habitId)));
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

  return NextResponse.json({
    sessions: rows.map(r => ({
      ...r,
      startTime: r.startTime.toISOString(),
      endTime: r.endTime.toISOString(),
    })),
    totalSeconds,
  });
}
