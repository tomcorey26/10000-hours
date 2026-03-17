import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserId, stopActiveTimerForUser } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  stopActiveTimerForUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUserId,
}));

vi.mock("@/server/db/timers", () => ({
  stopActiveTimerForUser,
}));

import { POST } from "./route";

describe("POST /api/timer/stop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the stopped timer payload from the db module", async () => {
    getSessionUserId.mockResolvedValue(42);
    stopActiveTimerForUser.mockResolvedValue({
      durationSeconds: 1800,
      habitId: 7,
    });

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      durationSeconds: 1800,
      habitId: 7,
    });
    expect(stopActiveTimerForUser).toHaveBeenCalledWith(42);
  });

  it("returns 404 when the db module reports no active timer", async () => {
    getSessionUserId.mockResolvedValue(42);
    stopActiveTimerForUser.mockResolvedValue(null);

    const response = await POST();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "No active timer",
    });
    expect(stopActiveTimerForUser).toHaveBeenCalledWith(42);
  });
});
