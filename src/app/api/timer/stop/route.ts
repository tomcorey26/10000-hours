import { NextResponse } from 'next/server';
import { db } from '@/db';
import { activeTimers, timeSessions } from '@/db/schema';
import { getSessionUserId } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import { buildSessionFromTimer } from '@/lib/auto-stop-timer';

export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const timer = await db.select().from(activeTimers).where(eq(activeTimers.userId, userId)).get();
  if (!timer) return NextResponse.json({ error: 'No active timer' }, { status: 404 });

  const session = buildSessionFromTimer(timer, new Date());

  await db.transaction(async (tx) => {
    await tx.insert(timeSessions).values(session);
    await tx.delete(activeTimers).where(eq(activeTimers.userId, userId));
  });

  return NextResponse.json({ durationSeconds: session.durationSeconds, habitId: timer.habitId });
}
