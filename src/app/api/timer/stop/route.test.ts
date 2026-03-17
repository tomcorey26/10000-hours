import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserId, buildSessionFromTimer, db } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  buildSessionFromTimer: vi.fn(),
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  getSessionUserId,
}));

vi.mock("@/lib/auto-stop-timer", () => ({
  buildSessionFromTimer,
}));

vi.mock("@/db", () => ({
  db,
}));

import { POST } from "./route";

describe("POST /api/timer/stop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.select.mockImplementation(() => {
      throw new Error("timer lookup should happen inside the transaction");
    });
  });

  it("reads the timer inside the transaction before inserting the session", async () => {
    const timer = {
      userId: 42,
      habitId: 7,
      startTime: new Date("2026-03-17T10:00:00.000Z"),
      targetDurationSeconds: null,
    };
    const session = {
      userId: 42,
      habitId: 7,
      startTime: timer.startTime,
      endTime: new Date("2026-03-17T10:30:00.000Z"),
      durationSeconds: 1800,
      timerMode: "stopwatch" as const,
    };

    const txSelectGet = vi.fn().mockResolvedValue(timer);
    const txInsertValues = vi.fn().mockResolvedValue(undefined);
    const txDeleteWhere = vi.fn().mockResolvedValue(undefined);
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ get: txSelectGet })),
        })),
      })),
      insert: vi.fn(() => ({ values: txInsertValues })),
      delete: vi.fn(() => ({ where: txDeleteWhere })),
    };

    getSessionUserId.mockResolvedValue(42);
    buildSessionFromTimer.mockReturnValue(session);
    db.transaction.mockImplementation(
      async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      durationSeconds: 1800,
      habitId: 7,
    });
    expect(db.select).not.toHaveBeenCalled();
    expect(tx.select).toHaveBeenCalledOnce();
    expect(buildSessionFromTimer).toHaveBeenCalledWith(timer, expect.any(Date));
    expect(tx.insert).toHaveBeenCalledOnce();
    expect(txInsertValues).toHaveBeenCalledWith(session);
    expect(tx.delete).toHaveBeenCalledOnce();
    expect(txDeleteWhere).toHaveBeenCalledOnce();
  });

  it("returns 404 without writing when no timer exists inside the transaction", async () => {
    const txInsertValues = vi.fn().mockResolvedValue(undefined);
    const txDeleteWhere = vi.fn().mockResolvedValue(undefined);
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ get: vi.fn().mockResolvedValue(null) })),
        })),
      })),
      insert: vi.fn(() => ({ values: txInsertValues })),
      delete: vi.fn(() => ({ where: txDeleteWhere })),
    };

    getSessionUserId.mockResolvedValue(42);
    db.transaction.mockImplementation(
      async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const response = await POST();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "No active timer",
    });
    expect(buildSessionFromTimer).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
    expect(txInsertValues).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
    expect(txDeleteWhere).not.toHaveBeenCalled();
  });
});
