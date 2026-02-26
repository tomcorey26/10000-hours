import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { activeTimers, habits, timeSessions } from '@/db/schema';
import { getSessionUserId } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

const startSchema = z.object({
  habitId: z.number().int().positive(),
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid habitId' }, { status: 400 });

  const { habitId } = parsed.data;

  // Verify habit belongs to user
  const habit = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .get();
  if (!habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 });

  // Stop any existing timer first
  const existing = await db.select().from(activeTimers).where(eq(activeTimers.userId, userId)).get();
  if (existing) {
    const now = new Date();
    const durationSeconds = Math.round((now.getTime() - existing.startTime.getTime()) / 1000);
    await db.insert(timeSessions).values({
      habitId: existing.habitId,
      startTime: existing.startTime,
      endTime: now,
      durationSeconds,
    });
    await db.delete(activeTimers).where(eq(activeTimers.userId, userId));
  }

  // Start new timer
  const now = new Date();
  await db.insert(activeTimers).values({ habitId, userId, startTime: now });

  return NextResponse.json({ startTime: now.toISOString(), habitId });
}
