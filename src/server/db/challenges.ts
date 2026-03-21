import { eq, and, lt } from "drizzle-orm";
import { db } from "@/db";
import { challenges } from "@/db/schema";

export async function storeChallenge(data: {
  username: string;
  userId?: number;
  challenge: string;
  type: "registration" | "authentication";
}) {
  // Lazy cleanup: delete expired challenges
  await db.delete(challenges).where(lt(challenges.expiresAt, new Date()));

  // Delete old challenges for same username+type (handles retries)
  await db.delete(challenges).where(
    and(eq(challenges.username, data.username.toLowerCase()), eq(challenges.type, data.type))
  );

  await db.insert(challenges).values({
    ...data,
    username: data.username.toLowerCase(),
    expiresAt: new Date(Date.now() + 60_000), // 60s
  });
}

export async function getChallenge(username: string, type: "registration" | "authentication") {
  return await db
    .select()
    .from(challenges)
    .where(and(eq(challenges.username, username.toLowerCase()), eq(challenges.type, type)))
    .get();
}

export async function deleteChallenge(id: number) {
  await db.delete(challenges).where(eq(challenges.id, id));
}
