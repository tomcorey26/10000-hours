import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUserByUsername, getChallenge, deleteChallenge, getCredentialById,
  updateCredentialCounter, setSessionCookie, verifyAuthenticationResponse,
} = vi.hoisted(() => ({
  getUserByUsername: vi.fn(),
  getChallenge: vi.fn(),
  deleteChallenge: vi.fn(),
  getCredentialById: vi.fn(),
  updateCredentialCounter: vi.fn(),
  setSessionCookie: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

vi.mock("@/server/db/users", () => ({ getUserByUsername }));
vi.mock("@/server/db/challenges", () => ({ getChallenge, deleteChallenge }));
vi.mock("@/server/db/passkeys", () => ({ getCredentialById, updateCredentialCounter }));
vi.mock("@/lib/auth", () => ({ setSessionCookie }));
vi.mock("@simplewebauthn/server", () => ({ verifyAuthenticationResponse }));
vi.mock("@simplewebauthn/server/helpers", () => ({
  isoBase64URL: { toBuffer: (s: string) => Buffer.from(s, "base64url") },
}));
vi.mock("@/lib/passkey", () => ({ rpID: "localhost", rpOrigin: "http://localhost:3000" }));

import { POST } from "./route";

describe("POST /api/auth/passkey/login-verify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 if no challenge found", async () => {
    getChallenge.mockReturnValue(undefined);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "testuser", assertion: { id: "cred1" } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("sets session on successful verification", async () => {
    getUserByUsername.mockReturnValue({ id: 1, username: "testuser" });
    getChallenge.mockReturnValue({ id: 1, challenge: "abc", userId: 1, expiresAt: new Date(Date.now() + 60000) });
    getCredentialById.mockReturnValue({
      id: "cred1", userId: 1, publicKey: "AQID", counter: 0,
      transports: '["internal"]',
    });
    verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 1 },
    });
    updateCredentialCounter.mockResolvedValue(undefined);
    deleteChallenge.mockResolvedValue(undefined);
    setSessionCookie.mockResolvedValue(undefined);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "testuser", assertion: { id: "cred1" } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(setSessionCookie).toHaveBeenCalledWith(1);
    expect(updateCredentialCounter).toHaveBeenCalledWith("cred1", 1);
  });
});
