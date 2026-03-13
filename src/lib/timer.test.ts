import { describe, expect, it } from "vitest";
import { computeSessionDuration } from "./timer";

describe("computeSessionDuration", () => {
  it("returns elapsed time for stopwatch mode", () => {
    expect(computeSessionDuration(120, null)).toBe(120);
  });

  it("returns elapsed time when countdown not yet finished", () => {
    expect(computeSessionDuration(180, 300)).toBe(180);
  });

  it("caps at target duration when elapsed exceeds countdown", () => {
    expect(computeSessionDuration(900, 300)).toBe(300);
  });

  it("returns exact target when elapsed equals countdown", () => {
    expect(computeSessionDuration(300, 300)).toBe(300);
  });
});
