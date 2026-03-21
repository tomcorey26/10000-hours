import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getCredentialById, deleteCredential, countCredentialsByUserId } from "@/server/db/passkeys";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const credential = await getCredentialById(id);
  if (!credential || credential.userId !== userId) {
    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }

  const count = await countCredentialsByUserId(userId);
  if (count <= 1) {
    return NextResponse.json({ error: "Cannot delete your only passkey" }, { status: 403 });
  }

  await deleteCredential(id);
  return NextResponse.json({ deleted: true });
}
