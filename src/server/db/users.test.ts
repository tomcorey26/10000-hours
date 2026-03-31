import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockValues = vi.fn(() => ({ returning: vi.fn(() => [{ id: 1, username: "testuser" }]) }));

vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ get: mockGet }) }) }),
    insert: () => ({ values: mockValues }),
  },
}));

import { getUserByUsername } from "./users";

describe("getUserByUsername", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries by lowercase username", async () => {
    mockGet.mockResolvedValue({ id: 1, username: "testuser" });
    const result = await getUserByUsername("TestUser");
    expect(result).toEqual({ id: 1, username: "testuser" });
  });
});
