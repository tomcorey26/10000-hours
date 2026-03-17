import { describe, expect, it } from "vitest";
import { parseAutoStoppedSearchParams } from "@/lib/auto-stop-search-params";

describe("parseAutoStoppedSearchParams", () => {
  const habits = [{ name: "Piano" }, { name: "Coding" }];

  it("returns toast data for a matching habit and numeric duration", () => {
    expect(
      parseAutoStoppedSearchParams(
        { autoStopped: "Piano", duration: "1500" },
        habits,
      ),
    ).toEqual({ habitName: "Piano", durationSeconds: 1500 });
  });

  it("returns null when the habit name is not one of the user habits", () => {
    expect(
      parseAutoStoppedSearchParams(
        { autoStopped: "Unknown", duration: "1500" },
        habits,
      ),
    ).toBeNull();
  });

  it("returns null when the duration is not numeric", () => {
    expect(
      parseAutoStoppedSearchParams(
        { autoStopped: "Piano", duration: "abc" },
        habits,
      ),
    ).toBeNull();
  });

  it("returns null when the duration contains non-digit characters", () => {
    expect(
      parseAutoStoppedSearchParams(
        { autoStopped: "Piano", duration: "1500seconds" },
        habits,
      ),
    ).toBeNull();
  });
});
