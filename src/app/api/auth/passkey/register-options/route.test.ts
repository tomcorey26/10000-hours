import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserByUsername, getSessionUserId, storeChallenge, generateRegistrationOptions } = vi.hoisted(() => ({
  getUserByUsername: vi.fn(),
  getSessionUserId: vi.fn(),
  storeChallenge: vi.fn(),
  generateRegistrationOptions: vi.fn(),
}));

vi.mock("@/server/db/users", () => ({ getUserByUsername }));
vi.mock("@/lib/auth", () => ({ getSessionUserId }));
vi.mock("@/server/db/challenges", () => ({ storeChallenge }));
vi.mock("@simplewebauthn/server", () => ({ generateRegistrationOptions }));
vi.mock("@/server/db/passkeys", () => ({ getCredentialsByUserId: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/passkey", () => ({ rpName: "10000 Hours", rpID: "localhost" }));

import { POST } from "./route";

describe("POST /api/auth/passkey/register-options", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid username", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "ab" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 if username taken", async () => {
    getUserByUsername.mockReturnValue({ id: 1 });
    getSessionUserId.mockResolvedValue(null);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "taken_user" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns registration options for valid new username", async () => {
    getUserByUsername.mockReturnValue(undefined);
    getSessionUserId.mockResolvedValue(null);
    const mockOptions = { challenge: "abc123", rp: { name: "10000 Hours" } };
    generateRegistrationOptions.mockResolvedValue(mockOptions);
    storeChallenge.mockResolvedValue(undefined);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "new_user" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(mockOptions);
  });
});
