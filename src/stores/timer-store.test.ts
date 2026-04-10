import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTimerStore } from "./timer-store";

beforeEach(() => {
  useTimerStore.setState({
    activeTimer: null,
    view: { type: "habits_list" },
    displayTime: "00:00:00",
    isTimesUp: false,
  });
});

describe("timer store", () => {
  describe("openConfig", () => {
    it("sets view to timer_config with habit info", () => {
      useTimerStore.getState().openConfig(1, "Guitar");
      const state = useTimerStore.getState();
      expect(state.view).toEqual({
        type: "timer_config",
        habitId: 1,
        habitName: "Guitar",
      });
    });
  });

  describe("closeConfig", () => {
    it("sets view back to habits_list", () => {
      useTimerStore.getState().openConfig(1, "Guitar");
      useTimerStore.getState().closeConfig();
      expect(useTimerStore.getState().view).toEqual({ type: "habits_list" });
    });
  });

  describe("startTimer", () => {
    it("sets activeTimer and view to active_timer", () => {
      vi.spyOn(Date.prototype, "toISOString").mockReturnValue(
        "2026-04-06T12:00:00.000Z"
      );
      useTimerStore
        .getState()
        .startTimer({ habitId: 1, habitName: "Guitar" });
      const state = useTimerStore.getState();
      expect(state.activeTimer).toEqual({
        habitId: 1,
        habitName: "Guitar",
        startTime: "2026-04-06T12:00:00.000Z",
        targetDurationSeconds: null,
      });
      expect(state.view).toEqual({ type: "active_timer" });
      vi.restoreAllMocks();
    });

    it("sets targetDurationSeconds for countdown mode", () => {
      useTimerStore.getState().startTimer({
        habitId: 1,
        habitName: "Guitar",
        targetDurationSeconds: 300,
      });
      expect(useTimerStore.getState().activeTimer?.targetDurationSeconds).toBe(
        300
      );
    });
  });

  describe("stopTimer", () => {
    it("clears activeTimer and sets view to success", () => {
      useTimerStore
        .getState()
        .startTimer({ habitId: 1, habitName: "Guitar" });
      useTimerStore.getState().stopTimer(120);
      const state = useTimerStore.getState();
      expect(state.activeTimer).toBeNull();
      expect(state.view).toEqual({ type: "success", durationSeconds: 120 });
      expect(state.displayTime).toBe("00:00:00");
      expect(state.isTimesUp).toBe(false);
    });
  });

  describe("showHabits", () => {
    it("sets view to habits_list without clearing activeTimer", () => {
      useTimerStore
        .getState()
        .startTimer({ habitId: 1, habitName: "Guitar" });
      useTimerStore.getState().showHabits();
      const state = useTimerStore.getState();
      expect(state.view).toEqual({ type: "habits_list" });
      expect(state.activeTimer).not.toBeNull();
    });
  });

  describe("showActiveTimer", () => {
    it("sets view to active_timer when activeTimer exists", () => {
      useTimerStore
        .getState()
        .startTimer({ habitId: 1, habitName: "Guitar" });
      useTimerStore.getState().showHabits();
      expect(useTimerStore.getState().view).toEqual({ type: "habits_list" });

      useTimerStore.getState().showActiveTimer();
      expect(useTimerStore.getState().view).toEqual({ type: "active_timer" });
      expect(useTimerStore.getState().activeTimer).not.toBeNull();
    });

    it("does nothing when no activeTimer exists", () => {
      useTimerStore.getState().showActiveTimer();
      expect(useTimerStore.getState().view).toEqual({ type: "habits_list" });
    });
  });

  describe("dismissSuccess", () => {
    it("sets view back to habits_list", () => {
      useTimerStore
        .getState()
        .startTimer({ habitId: 1, habitName: "Guitar" });
      useTimerStore.getState().stopTimer(120);
      useTimerStore.getState().dismissSuccess();
      expect(useTimerStore.getState().view).toEqual({ type: "habits_list" });
    });
  });

  describe("resetTimer", () => {
    it("clears activeTimer and sets view to habits_list", () => {
      useTimerStore
        .getState()
        .startTimer({ habitId: 1, habitName: "Guitar" });
      useTimerStore.getState().resetTimer();
      const state = useTimerStore.getState();
      expect(state.activeTimer).toBeNull();
      expect(state.view).toEqual({ type: "habits_list" });
      expect(state.displayTime).toBe("00:00:00");
      expect(state.isTimesUp).toBe(false);
    });
  });

  describe("setDisplayTime", () => {
    it("updates displayTime and isTimesUp", () => {
      useTimerStore.getState().setDisplayTime("01:23:45", false);
      expect(useTimerStore.getState().displayTime).toBe("01:23:45");
      expect(useTimerStore.getState().isTimesUp).toBe(false);
    });

    it("sets isTimesUp to true", () => {
      useTimerStore.getState().setDisplayTime("00:00:00", true);
      expect(useTimerStore.getState().isTimesUp).toBe(true);
    });
  });

  describe("hydrate", () => {
    it("sets activeTimer and view to active_timer when given timer data", () => {
      useTimerStore.getState().hydrate({
        habitId: 1,
        habitName: "Guitar",
        startTime: "2026-04-06T12:00:00.000Z",
        targetDurationSeconds: null,
      });
      const state = useTimerStore.getState();
      expect(state.activeTimer).toEqual({
        habitId: 1,
        habitName: "Guitar",
        startTime: "2026-04-06T12:00:00.000Z",
        targetDurationSeconds: null,
      });
      expect(state.view).toEqual({ type: "active_timer" });
    });

    it("skips hydration if activeTimer already exists", () => {
      useTimerStore.getState().startTimer({
        habitId: 1,
        habitName: "Guitar",
      });
      const originalStartTime =
        useTimerStore.getState().activeTimer!.startTime;

      useTimerStore.getState().hydrate({
        habitId: 2,
        habitName: "Piano",
        startTime: "2026-04-06T13:00:00.000Z",
        targetDurationSeconds: null,
      });

      expect(useTimerStore.getState().activeTimer!.habitId).toBe(1);
      expect(useTimerStore.getState().activeTimer!.startTime).toBe(
        originalStartTime
      );
    });

    it("does nothing when given null", () => {
      useTimerStore.getState().hydrate(null);
      expect(useTimerStore.getState().activeTimer).toBeNull();
      expect(useTimerStore.getState().view).toEqual({ type: "habits_list" });
    });
  });
});
