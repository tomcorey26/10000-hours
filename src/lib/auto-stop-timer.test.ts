import { describe, expect, it } from "vitest";
import { buildSessionFromTimer } from "./auto-stop-timer";

describe("buildSessionFromTimer", () => {
  const baseTimer = {
    habitId: 1,
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

  it("returns correct session shape", () => {
    const now = new Date("2026-03-13T10:05:00Z");
    const result = buildSessionFromTimer(baseTimer, now);
    expect(result).toEqual({
      habitId: 1,
      startTime: baseTimer.startTime,
      endTime: now,
      durationSeconds: 300,
      timerMode: "countdown",
    });
  });
});
