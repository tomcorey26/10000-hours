import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

export function getUserByEmail(email: string) {
  return db.select().from(users).where(eq(users.email, email)).get();
}

export async function createUser(email: string, passwordHash: string) {
  const [user] = await db
    .insert(users)
    .values({ email, passwordHash })
    .returning();
  return user;
}

export function getUserById(userId: number) {
  return db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .get();
}
