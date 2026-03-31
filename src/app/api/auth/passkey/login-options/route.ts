import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getUserByUsername } from "@/server/db/users";
import { getCredentialsByUserId } from "@/server/db/passkeys";
import { storeChallenge } from "@/server/db/challenges";
import { rpID } from "@/lib/passkey";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const username = body.username.toLowerCase();
  const user = await getUserByUsername(username);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const credentials = await getCredentialsByUserId(user.id);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((c) => ({
      id: c.id,
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
    userVerification: "preferred",
  });

  await storeChallenge({
    username,
    userId: user.id,
    challenge: options.challenge,
    type: "authentication",
  });

  return NextResponse.json(options);
}
