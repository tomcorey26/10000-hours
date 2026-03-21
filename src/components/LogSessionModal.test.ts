import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDateOptions, getDefaultStartTime } from "./LogSessionModal";

describe("getDateOptions", () => {
  beforeEach(() => {
    // Freeze time to a fixed local date: 2026-03-08, at 01:00 local time
    // This is intentionally early in the day so that UTC could be a different date
    // (simulating a UTC+X timezone where the bug would manifest)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T01:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 7 options", () => {
    expect(getDateOptions()).toHaveLength(7);
  });

  it("labels Today, Yesterday correctly", () => {
    const options = getDateOptions();
    expect(options[0].label).toBe("Today");
    expect(options[1].label).toBe("Yesterday");
  });

  it("values match local dates, not UTC dates", () => {
    const options = getDateOptions();
    expect(options[0].value).toBe("2026-03-08");
    expect(options[1].value).toBe("2026-03-07");
    expect(options[2].value).toBe("2026-03-06");
    expect(options[3].value).toBe("2026-03-05");
    expect(options[4].value).toBe("2026-03-04");
    expect(options[5].value).toBe("2026-03-03");
    expect(options[6].value).toBe("2026-03-02");
  });

  it("label and value refer to the same local date", () => {
    const options = getDateOptions();
    // For i>=2, the label shows the weekday/month/day of the local date
    // The value should encode the same local date
    for (const opt of options.slice(2)) {
      const [year, month, day] = opt.value.split("-").map(Number);
      const d = new Date(year, month - 1, day);
      const expectedLabel = d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      expect(opt.label).toBe(expectedLabel);
    }
  });
});

describe("getDefaultStartTime", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("rounds down to nearest 15 minutes", () => {
    vi.setSystemTime(new Date("2026-03-19T14:37:00"));
    expect(getDefaultStartTime()).toBe("14:30");
  });

  it("returns exact time when already on 15-min boundary", () => {
    vi.setSystemTime(new Date("2026-03-19T09:15:00"));
    expect(getDefaultStartTime()).toBe("09:15");
  });

  it("pads single-digit hours", () => {
    vi.setSystemTime(new Date("2026-03-19T08:05:00"));
    expect(getDefaultStartTime()).toBe("08:00");
  });
});
