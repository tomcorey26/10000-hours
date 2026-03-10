// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  getTimerPreference,
  saveTimerPreference,
  type TimerPreference,
} from "./timer-preferences";

describe("timer-preferences", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getTimerPreference", () => {
    it("returns default stopwatch mode with 25 min when nothing stored", () => {
      const pref = getTimerPreference();
      expect(pref).toEqual({ mode: "stopwatch", durationMinutes: 25 });
    });

    it("returns stored preference from localStorage", () => {
      localStorage.setItem(
        "timer-mode-preference",
        JSON.stringify({ mode: "countdown", durationMinutes: 45 }),
      );
      const pref = getTimerPreference();
      expect(pref).toEqual({ mode: "countdown", durationMinutes: 45 });
    });

    it("returns default when localStorage contains invalid JSON", () => {
      localStorage.setItem("timer-mode-preference", "not-json");
      const pref = getTimerPreference();
      expect(pref).toEqual({ mode: "stopwatch", durationMinutes: 25 });
    });
  });

  describe("saveTimerPreference", () => {
    it("persists preference to localStorage", () => {
      saveTimerPreference({ mode: "countdown", durationMinutes: 30 });
      const stored = JSON.parse(
        localStorage.getItem("timer-mode-preference")!,
      );
      expect(stored).toEqual({ mode: "countdown", durationMinutes: 30 });
    });

    it("overwrites previous preference", () => {
      saveTimerPreference({ mode: "countdown", durationMinutes: 15 });
      saveTimerPreference({ mode: "stopwatch", durationMinutes: 25 });
      const stored = JSON.parse(
        localStorage.getItem("timer-mode-preference")!,
      );
      expect(stored).toEqual({ mode: "stopwatch", durationMinutes: 25 });
    });
  });
});
