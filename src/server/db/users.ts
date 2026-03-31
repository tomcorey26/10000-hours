import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function getUserByUsername(username: string) {
  return await db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .get();
}

export async function createUser(username: string) {
  const [user] = await db
    .insert(users)
    .values({ username: username.toLowerCase() })
    .returning();
  return user;
}

export async function getUserById(userId: number) {
  return await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .get();
}
