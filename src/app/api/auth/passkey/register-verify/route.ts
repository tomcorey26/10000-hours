import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getSessionUserId, setSessionCookie } from "@/lib/auth";
import { createUser, getUserByUsername } from "@/server/db/users";
import { createCredential } from "@/server/db/passkeys";
import { getChallenge, deleteChallenge } from "@/server/db/challenges";
import { rpID, rpOrigin } from "@/lib/passkey";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.username || !body?.attestation) {
    return NextResponse.json({ error: "Missing username or attestation" }, { status: 400 });
  }

  const username = body.username.toLowerCase();
  const stored = await getChallenge(username, "registration");

  if (!stored || stored.expiresAt < new Date()) {
    return NextResponse.json({ error: "Challenge not found or expired" }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.attestation,
      expectedChallenge: stored.challenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
    });
  } catch {
    await deleteChallenge(stored.id);
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  await deleteChallenge(stored.id);

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  let userId = await getSessionUserId();

  if (!userId) {
    const existing = await getUserByUsername(username);
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    const user = await createUser(username);
    userId = user.id;
  }

  await createCredential({
    id: credential.id,
    userId,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: body.attestation.response?.transports
      ? JSON.stringify(body.attestation.response.transports)
      : undefined,
    label: body.label,
  });

  await setSessionCookie(userId);
  return NextResponse.json({ verified: true });
}
