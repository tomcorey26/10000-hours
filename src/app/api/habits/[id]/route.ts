import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { deleteHabitForUser } from "@/server/db/habits";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const habitId = parseInt(id, 10);
  if (isNaN(habitId))
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const deletedHabit = await deleteHabitForUser(habitId, userId);
  if (!deletedHabit) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
