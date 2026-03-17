import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { habits, timeSessions } from "@/db/schema";

export async function getRankingsForUser(userId: number) {
  const totalSecondsExpr = sql<number>`sum(${timeSessions.durationSeconds})`;

  const rows = await db
    .select({
      habitId: habits.id,
      habitName: habits.name,
      totalSeconds: totalSecondsExpr.as("total_seconds"),
    })
    .from(timeSessions)
    .innerJoin(habits, eq(timeSessions.habitId, habits.id))
    .where(eq(habits.userId, userId))
    .groupBy(habits.id, habits.name)
    .orderBy(desc(totalSecondsExpr));

  return rows.map((row, index) => ({
    rank: index + 1,
    habitId: row.habitId,
    habitName: row.habitName,
    totalSeconds: row.totalSeconds,
  }));
}
