import { eq } from "drizzle-orm";
import { db } from "@/db";
import { passkeyCredentials } from "@/db/schema";

export async function createCredential(data: {
  id: string;
  userId: number;
  publicKey: string;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports?: string;
  label?: string;
}) {
  await db.insert(passkeyCredentials).values(data);
}

export async function getCredentialById(id: string) {
  return await db
    .select()
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.id, id))
    .get();
}

export async function getCredentialsByUserId(userId: number) {
  return await db
    .select()
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.userId, userId))
    .all();
}

export async function updateCredentialCounter(id: string, counter: number) {
  await db
    .update(passkeyCredentials)
    .set({ counter })
    .where(eq(passkeyCredentials.id, id));
}

export async function deleteCredential(id: string) {
  await db
    .delete(passkeyCredentials)
    .where(eq(passkeyCredentials.id, id));
}

export async function countCredentialsByUserId(userId: number) {
  const creds = await db
    .select()
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.userId, userId))
    .all();
  return creds.length;
}
