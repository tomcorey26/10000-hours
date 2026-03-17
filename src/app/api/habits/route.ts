import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { habits } from '@/db/schema';
import { getSessionUserId } from '@/lib/auth';
import { getHabitsForUser, autoStopExpiredCountdown } from '@/lib/queries';

const createHabitSchema = z.object({
  name: z.string().min(1).max(100),
});

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const autoStopped = await autoStopExpiredCountdown(userId);
  const habitsWithStats = await getHabitsForUser(userId);
  return NextResponse.json({ habits: habitsWithStats, autoStopped });
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
