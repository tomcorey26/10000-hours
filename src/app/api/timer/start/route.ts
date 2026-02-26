import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { activeTimers, habits, timeSessions } from '@/db/schema';
import { getSessionUserId } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';

const startSchema = z.object({
  habitId: z.number().int().positive(),
  targetDurationSeconds: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid habitId' }, { status: 400 });

  const { habitId, targetDurationSeconds } = parsed.data;

  // Verify habit belongs to user
  const habit = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
    .get();
  if (!habit) return NextResponse.json({ error: 'Habit not found' }, { status: 404 });

  // Stop any existing timer and start new one in a transaction
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(activeTimers).where(eq(activeTimers.userId, userId)).get();
    if (existing) {
      const now = new Date();
      const durationSeconds = Math.round((now.getTime() - existing.startTime.getTime()) / 1000);
      await tx.insert(timeSessions).values({
        habitId: existing.habitId,
        startTime: existing.startTime,
        endTime: now,
        durationSeconds,
      });
      await tx.delete(activeTimers).where(eq(activeTimers.userId, userId));
    }
    const now = new Date();
    await tx.insert(activeTimers).values({
      habitId,
      userId,
      startTime: now,
      targetDurationSeconds: targetDurationSeconds ?? null,
    });
  });

  return NextResponse.json({
    startTime: new Date().toISOString(),
    habitId,
    targetDurationSeconds: targetDurationSeconds ?? null,
  });
}
