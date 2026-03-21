import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserId, getCredentialsByUserId } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getCredentialsByUserId: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSessionUserId }));
vi.mock("@/server/db/passkeys", () => ({ getCredentialsByUserId }));

import { GET } from "./route";

describe("GET /api/auth/passkey/list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 if not authenticated", async () => {
    getSessionUserId.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns credentials for authenticated user", async () => {
    getSessionUserId.mockResolvedValue(1);
    getCredentialsByUserId.mockResolvedValue([
      { id: "cred1", label: "MacBook", deviceType: "multiDevice", backedUp: true, createdAt: new Date() },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.credentials).toHaveLength(1);
    expect(data.credentials[0].id).toBe("cred1");
  });
});
