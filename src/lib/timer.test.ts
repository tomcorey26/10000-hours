import { describe, expect, it } from "vitest";
import { buildSessionFromTimer } from "./timer";

describe("buildSessionFromTimer", () => {
  const baseTimer = {
    habitId: 1,
    userId: 42,
    startTime: new Date("2026-03-13T10:00:00Z"),
    targetDurationSeconds: 300,
  };

  it("caps countdown duration at target", () => {
    const now = new Date("2026-03-13T10:15:00Z");
    const result = buildSessionFromTimer(baseTimer, now);
    expect(result.durationSeconds).toBe(300);
    expect(result.timerMode).toBe("countdown");
  });

  it("uses actual elapsed for stopwatch", () => {
    const now = new Date("2026-03-13T10:15:00Z");
    const result = buildSessionFromTimer(
      { ...baseTimer, targetDurationSeconds: null },
      now
    );
    expect(result.durationSeconds).toBe(900);
    expect(result.timerMode).toBe("stopwatch");
  });

  it("records target duration when sub-second timing causes elapsed to round down", () => {
    const timer = {
      ...baseTimer,
      targetDurationSeconds: 10,
    };
    // 9.4s elapsed — Math.round(9.4) = 9, but countdown should credit full 10s
    // This simulates clock skew or sub-second timing where the client
    // detected completion but the server computes slightly less elapsed time
    const now = new Date("2026-03-13T10:00:09.400Z");
    const result = buildSessionFromTimer(timer, now);
    expect(result.durationSeconds).toBe(10);
  });

  it("returns correct session shape", () => {
    const now = new Date("2026-03-13T10:05:00Z");
    const result = buildSessionFromTimer(baseTimer, now);
    expect(result).toEqual({
      habitId: 1,
      userId: 42,
      startTime: baseTimer.startTime,
      endTime: now,
      durationSeconds: 300,
      timerMode: "countdown",
    });
  });
});
