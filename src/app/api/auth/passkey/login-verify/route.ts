import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { setSessionCookie } from "@/lib/auth";
import { getCredentialById, updateCredentialCounter } from "@/server/db/passkeys";
import { getChallenge, deleteChallenge } from "@/server/db/challenges";
import { rpID, rpOrigin } from "@/lib/passkey";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.username || !body?.assertion) {
    return NextResponse.json({ error: "Missing username or assertion" }, { status: 400 });
  }

  const username = body.username.toLowerCase();
  const stored = await getChallenge(username, "authentication");

  if (!stored || stored.expiresAt < new Date()) {
    return NextResponse.json({ error: "Challenge not found or expired" }, { status: 400 });
  }

  const credential = await getCredentialById(body.assertion.id);
  if (!credential) {
    await deleteChallenge(stored.id);
    return NextResponse.json({ error: "Credential not found" }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.assertion,
      expectedChallenge: stored.challenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
      credential: {
        id: credential.id,
        publicKey: isoBase64URL.toBuffer(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ? JSON.parse(credential.transports) : undefined,
      },
    });
  } catch {
    await deleteChallenge(stored.id);
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  await deleteChallenge(stored.id);

  if (!verification.verified) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  await updateCredentialCounter(credential.id, verification.authenticationInfo.newCounter);
  await setSessionCookie(credential.userId);

  return NextResponse.json({ verified: true });
}
