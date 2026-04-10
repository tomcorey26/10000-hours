import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { getRoutinesForUser, createRoutineForUser } from "@/server/db/routines";

const setSchema = z.object({
  durationSeconds: z.number().min(60).max(7200),
  breakSeconds: z.number().min(0).max(3600),
});

const blockSchema = z.object({
  habitId: z.number(),
  sortOrder: z.number(),
  notes: z.string().max(500).nullable().optional().transform((v) => v ?? null),
  sets: z.array(setSchema).min(1).max(10),
});

const createRoutineSchema = z.object({
  name: z.string().trim().min(1).max(100),
  blocks: z.array(blockSchema).min(1).max(20),
});

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const routines = await getRoutinesForUser(userId);
  return NextResponse.json({ routines });
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createRoutineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid routine data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const routine = await createRoutineForUser(userId, parsed.data);
  return NextResponse.json({ routine }, { status: 201 });
}
