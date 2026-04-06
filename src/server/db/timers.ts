import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { activeTimers, habits, timeSessions } from "@/db/schema";
import { buildSessionFromTimer } from "@/lib/timer";
import type { AutoStoppedSession } from "@/lib/types";

type StartTimerInput = {
  userId: number;
  habitId: number;
  targetDurationSeconds?: number;
  startTime?: Date;
};

export async function startTimerForUser(input: StartTimerInput) {
  const { userId, habitId, targetDurationSeconds } = input;
  return db.transaction(async (tx) => {
    const habit = await tx
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId)))
      .get();

    if (!habit) return null;

    const existingTimer = await tx
      .select()
      .from(activeTimers)
      .where(eq(activeTimers.userId, userId))
      .get();

    if (existingTimer) {
      const session = buildSessionFromTimer(existingTimer, new Date());
      await tx.insert(timeSessions).values(session);
      await tx.delete(activeTimers).where(eq(activeTimers.userId, userId));
    }

    const startTime = input.startTime ?? new Date();
    await tx.insert(activeTimers).values({
      habitId,
      userId,
      startTime,
      targetDurationSeconds: targetDurationSeconds ?? null,
    });

    return {
      startTime: startTime.toISOString(),
      habitId,
      targetDurationSeconds: targetDurationSeconds ?? null,
    };
  });
}

export async function stopActiveTimerForUser(userId: number) {
  return db.transaction(async (tx) => {
    const timer = await tx
      .select()
      .from(activeTimers)
      .where(eq(activeTimers.userId, userId))
      .get();

    if (!timer) return null;

    const session = buildSessionFromTimer(timer, new Date());

    await tx.insert(timeSessions).values(session);
    await tx.delete(activeTimers).where(eq(activeTimers.userId, userId));

    return { durationSeconds: session.durationSeconds, habitId: timer.habitId };
  });
}

export async function autoStopExpiredCountdown(
  userId: number,
): Promise<AutoStoppedSession | null> {
  return db.transaction(async (tx) => {
    const timer = await tx
      .select()
      .from(activeTimers)
      .where(eq(activeTimers.userId, userId))
      .get();

    if (!timer || timer.targetDurationSeconds === null) return null;

    const elapsed = Math.round((Date.now() - timer.startTime.getTime()) / 1000);
    if (elapsed < timer.targetDurationSeconds) return null;

    const session = buildSessionFromTimer(timer, new Date());

    const habit = await tx
      .select({ name: habits.name })
      .from(habits)
      .where(eq(habits.id, timer.habitId))
      .get();

    await tx.insert(timeSessions).values(session);
    await tx.delete(activeTimers).where(eq(activeTimers.userId, userId));

    return {
      habitName: habit?.name ?? "Unknown",
      durationSeconds: session.durationSeconds,
    };
  });
}
