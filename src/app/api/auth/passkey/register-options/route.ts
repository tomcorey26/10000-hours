import { NextResponse } from "next/server";
import { z } from "zod";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getSessionUserId } from "@/lib/auth";
import { getUserByUsername } from "@/server/db/users";
import { getCredentialsByUserId } from "@/server/db/passkeys";
import { storeChallenge } from "@/server/db/challenges";
import { rpName, rpID } from "@/lib/passkey";

const usernameSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = usernameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Username must be 3-30 characters, alphanumeric and underscores only" }, { status: 400 });
  }

  const username = parsed.data.username.toLowerCase();
  const sessionUserId = await getSessionUserId();

  if (!sessionUserId) {
    const existing = await getUserByUsername(username);
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
  }

  const existingCredentials = sessionUserId
    ? (await getCredentialsByUserId(sessionUserId)).map((c) => ({
        id: c.id,
        transports: c.transports ? JSON.parse(c.transports) : undefined,
      }))
    : [];

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: username,
    excludeCredentials: existingCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await storeChallenge({
    username,
    userId: sessionUserId ?? undefined,
    challenge: options.challenge,
    type: "registration",
  });

  return NextResponse.json(options);
}
