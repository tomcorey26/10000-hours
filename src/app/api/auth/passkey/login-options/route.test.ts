import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserByUsername, getCredentialsByUserId, storeChallenge, generateAuthenticationOptions } = vi.hoisted(() => ({
  getUserByUsername: vi.fn(),
  getCredentialsByUserId: vi.fn(),
  storeChallenge: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
}));

vi.mock("@/server/db/users", () => ({ getUserByUsername }));
vi.mock("@/server/db/passkeys", () => ({ getCredentialsByUserId }));
vi.mock("@/server/db/challenges", () => ({ storeChallenge }));
vi.mock("@simplewebauthn/server", () => ({ generateAuthenticationOptions }));

import { POST } from "./route";

describe("POST /api/auth/passkey/login-options", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for unknown username", async () => {
    getUserByUsername.mockReturnValue(undefined);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "nobody" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns authentication options for valid user", async () => {
    getUserByUsername.mockReturnValue({ id: 1, username: "testuser" });
    getCredentialsByUserId.mockResolvedValue([{ id: "cred1", transports: '["internal"]' }]);
    const mockOptions = { challenge: "xyz" };
    generateAuthenticationOptions.mockResolvedValue(mockOptions);
    storeChallenge.mockResolvedValue(undefined);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "testuser" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(mockOptions);
  });
});
