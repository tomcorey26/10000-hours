import { NextResponse } from 'next/server';
import { db } from '@/db';
import { activeTimers, timeSessions } from '@/db/schema';
import { getSessionUserId } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const timer = await db.select().from(activeTimers).where(eq(activeTimers.userId, userId)).get();
  if (!timer) return NextResponse.json({ error: 'No active timer' }, { status: 404 });

  const now = new Date();
  const durationSeconds = Math.round((now.getTime() - timer.startTime.getTime()) / 1000);

  await db.insert(timeSessions).values({
    habitId: timer.habitId,
    startTime: timer.startTime,
    endTime: now,
    durationSeconds,
  });

  await db.delete(activeTimers).where(eq(activeTimers.userId, userId));

  return NextResponse.json({ durationSeconds, habitId: timer.habitId });
}
