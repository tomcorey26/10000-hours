import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getChallenge, deleteChallenge, getSessionUserId, createUser,
  createCredential, setSessionCookie, verifyRegistrationResponse,
  getUserByUsername,
} = vi.hoisted(() => ({
  getChallenge: vi.fn(),
  deleteChallenge: vi.fn(),
  getSessionUserId: vi.fn(),
  createUser: vi.fn(),
  createCredential: vi.fn(),
  setSessionCookie: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  getUserByUsername: vi.fn(),
}));

vi.mock("@/server/db/challenges", () => ({ getChallenge, deleteChallenge }));
vi.mock("@/lib/auth", () => ({ getSessionUserId, setSessionCookie }));
vi.mock("@/server/db/users", () => ({ createUser, getUserByUsername }));
vi.mock("@/server/db/passkeys", () => ({ createCredential }));
vi.mock("@simplewebauthn/server", () => ({ verifyRegistrationResponse }));
vi.mock("@simplewebauthn/server/helpers", () => ({
  isoBase64URL: { fromBuffer: (buf: Uint8Array) => Buffer.from(buf).toString("base64url") },
}));
vi.mock("@/lib/passkey", () => ({ rpID: "localhost", rpOrigin: "http://localhost:3000" }));

import { POST } from "./route";

describe("POST /api/auth/passkey/register-verify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 if no challenge found", async () => {
    getChallenge.mockReturnValue(undefined);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "testuser", attestation: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 if verification fails", async () => {
    getChallenge.mockReturnValue({ id: 1, challenge: "abc", expiresAt: new Date(Date.now() + 60000) });
    verifyRegistrationResponse.mockResolvedValue({ verified: false });
    deleteChallenge.mockResolvedValue(undefined);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "testuser", attestation: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates user and credential on successful signup verification", async () => {
    getSessionUserId.mockResolvedValue(null);
    getUserByUsername.mockReturnValue(undefined);
    getChallenge.mockReturnValue({ id: 1, challenge: "abc", expiresAt: new Date(Date.now() + 60000) });
    verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: { id: "cred-id", publicKey: new Uint8Array([1, 2, 3]), counter: 0 },
        credentialDeviceType: "multiDevice",
        credentialBackedUp: true,
      },
    });
    createUser.mockResolvedValue({ id: 1, username: "testuser" });
    createCredential.mockResolvedValue(undefined);
    deleteChallenge.mockResolvedValue(undefined);
    setSessionCookie.mockResolvedValue(undefined);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "testuser", attestation: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(createUser).toHaveBeenCalledWith("testuser");
    expect(createCredential).toHaveBeenCalled();
    expect(setSessionCookie).toHaveBeenCalledWith(1);
  });
});
