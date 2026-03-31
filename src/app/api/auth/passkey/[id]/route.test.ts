import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserId, getCredentialById, deleteCredential, countCredentialsByUserId } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getCredentialById: vi.fn(),
  deleteCredential: vi.fn(),
  countCredentialsByUserId: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSessionUserId }));
vi.mock("@/server/db/passkeys", () => ({ getCredentialById, deleteCredential, countCredentialsByUserId }));

import { DELETE } from "./route";

describe("DELETE /api/auth/passkey/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when deleting last credential", async () => {
    getSessionUserId.mockResolvedValue(1);
    getCredentialById.mockReturnValue({ id: "cred1", userId: 1 });
    countCredentialsByUserId.mockResolvedValue(1);

    const req = new Request("http://localhost");
    const res = await DELETE(req, { params: Promise.resolve({ id: "cred1" }) });
    expect(res.status).toBe(403);
    expect(deleteCredential).not.toHaveBeenCalled();
  });

  it("deletes credential when user has multiple", async () => {
    getSessionUserId.mockResolvedValue(1);
    getCredentialById.mockReturnValue({ id: "cred1", userId: 1 });
    countCredentialsByUserId.mockResolvedValue(2);
    deleteCredential.mockResolvedValue(undefined);

    const req = new Request("http://localhost");
    const res = await DELETE(req, { params: Promise.resolve({ id: "cred1" }) });
    expect(res.status).toBe(200);
    expect(deleteCredential).toHaveBeenCalledWith("cred1");
  });

  it("returns 404 for credential owned by another user", async () => {
    getSessionUserId.mockResolvedValue(1);
    getCredentialById.mockReturnValue({ id: "cred1", userId: 999 });

    const req = new Request("http://localhost");
    const res = await DELETE(req, { params: Promise.resolve({ id: "cred1" }) });
    expect(res.status).toBe(404);
  });
});
