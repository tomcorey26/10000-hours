// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTimerStore } from "@/stores/timer-store";
import type { ReactNode } from "react";

// Mock dependencies
vi.mock("@/lib/api", () => ({
  api: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/habits"),
}));

vi.mock("@/lib/timer", () => ({
  isCountdownComplete: vi.fn(() => false),
}));

import { api } from "@/lib/api";
import { toast } from "sonner";
import { usePathname } from "next/navigation";
import { isCountdownComplete } from "@/lib/timer";
import { TimerSync } from "./TimerSync";

const mockedApi = vi.mocked(api);
const mockedPathname = vi.mocked(usePathname);
const mockedIsCountdownComplete = vi.mocked(isCountdownComplete);

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  useTimerStore.setState({
    activeTimer: null,
    view: { type: "habits_list" },
    timerViewMounted: false,
  });
  vi.clearAllMocks();
  mockedPathname.mockReturnValue("/habits");

  // Stub Notification API for jsdom
  vi.stubGlobal("Notification", { permission: "denied" });
});

describe("TimerSync", () => {
  describe("hydration", () => {
    it("hydrates zustand when server has an active timer", async () => {
      mockedApi.mockResolvedValueOnce({
        habits: [
          {
            id: 1,
            name: "Guitar",
            todaySeconds: 0,
            totalSeconds: 0,
            streak: 0,
            activeTimer: {
              startTime: "2026-04-09T12:00:00.000Z",
              targetDurationSeconds: null,
            },
          },
        ],
        autoStopped: null,
      });

      renderHook(() => TimerSync(), { wrapper: createWrapper() });

      await waitFor(() => {
        const state = useTimerStore.getState();
        expect(state.activeTimer).toEqual({
          habitId: 1,
          habitName: "Guitar",
          startTime: "2026-04-09T12:00:00.000Z",
          targetDurationSeconds: null,
        });
      });
    });

    it("does not hydrate when no active timer in response", async () => {
      mockedApi.mockResolvedValueOnce({
        habits: [
          { id: 1, name: "Guitar", todaySeconds: 0, totalSeconds: 0, streak: 0, activeTimer: null },
        ],
        autoStopped: null,
      });

      renderHook(() => TimerSync(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockedApi).toHaveBeenCalled();
      });
      expect(useTimerStore.getState().activeTimer).toBeNull();
    });
  });

  describe("server auto-stop toast", () => {
    it("shows toast when autoStopped is present in response", async () => {
      mockedApi.mockResolvedValueOnce({
        habits: [
          { id: 1, name: "Guitar", todaySeconds: 0, totalSeconds: 0, streak: 0, activeTimer: null },
        ],
        autoStopped: { habitName: "Guitar", durationSeconds: 300 },
      });

      useTimerStore.setState({
        activeTimer: {
          habitId: 1,
          habitName: "Guitar",
          startTime: "2026-04-09T12:00:00.000Z",
          targetDurationSeconds: 300,
        },
      });

      renderHook(() => TimerSync(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining("Guitar session was auto-recorded"),
        );
      });
      expect(useTimerStore.getState().activeTimer).toBeNull();
    });
  });

  describe("dismiss success on nav", () => {
    it("dismisses success view when navigating away from /habits", async () => {
      mockedApi.mockResolvedValueOnce({
        habits: [],
        autoStopped: null,
      });

      useTimerStore.setState({
        view: { type: "success", durationSeconds: 120 },
      });
      mockedPathname.mockReturnValue("/sessions");

      renderHook(() => TimerSync(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(useTimerStore.getState().view).toEqual({ type: "habits_list" });
      });
    });
  });

  describe("client-side countdown polling", () => {
    it("calls POST /api/timer/stop and shows a toast when countdown is complete", async () => {
      // First call: habits query; subsequent: POST /api/timer/stop
      mockedApi.mockImplementation((url: string) => {
        if (url === "/api/habits")
          return Promise.resolve({ habits: [], autoStopped: null });
        if (url === "/api/timer/stop")
          return Promise.resolve({ durationSeconds: 600 });
        return Promise.resolve({});
      });

      mockedIsCountdownComplete.mockReturnValue(true);

      useTimerStore.setState({
        activeTimer: {
          habitId: 1,
          habitName: "Guitar",
          startTime: "2026-04-09T12:00:00.000Z",
          targetDurationSeconds: 600,
        },
        timerViewMounted: false,
      });

      renderHook(() => TimerSync(), { wrapper: createWrapper() });

      await waitFor(
        () => {
          expect(mockedApi).toHaveBeenCalledWith("/api/timer/stop", {
            method: "POST",
          });
          expect(toast.success).toHaveBeenCalledWith(
            expect.stringContaining("Guitar session was recorded"),
          );
        },
        { timeout: 3000 },
      );

      expect(useTimerStore.getState().activeTimer).toBeNull();
    });

    it("does NOT poll when timerViewMounted is true", async () => {
      mockedApi.mockImplementation(() =>
        Promise.resolve({ habits: [], autoStopped: null }),
      );
      mockedIsCountdownComplete.mockReturnValue(true);

      useTimerStore.setState({
        activeTimer: {
          habitId: 1,
          habitName: "Guitar",
          startTime: "2026-04-09T12:00:00.000Z",
          targetDurationSeconds: 600,
        },
        timerViewMounted: true,
      });

      renderHook(() => TimerSync(), { wrapper: createWrapper() });

      // Wait for habits query to settle
      await waitFor(() => {
        expect(mockedApi).toHaveBeenCalledWith("/api/habits");
      });

      // Should never have called stop
      expect(mockedApi).not.toHaveBeenCalledWith("/api/timer/stop", {
        method: "POST",
      });
    });

    it("resets the timer on API failure", async () => {
      mockedApi.mockImplementation((url: string) => {
        if (url === "/api/habits")
          return Promise.resolve({ habits: [], autoStopped: null });
        if (url === "/api/timer/stop")
          return Promise.reject(new Error("Network error"));
        return Promise.resolve({});
      });

      mockedIsCountdownComplete.mockReturnValue(true);

      useTimerStore.setState({
        activeTimer: {
          habitId: 1,
          habitName: "Guitar",
          startTime: "2026-04-09T12:00:00.000Z",
          targetDurationSeconds: 600,
        },
        timerViewMounted: false,
      });

      renderHook(() => TimerSync(), { wrapper: createWrapper() });

      await waitFor(
        () => {
          expect(useTimerStore.getState().activeTimer).toBeNull();
        },
        { timeout: 3000 },
      );

      expect(toast.success).not.toHaveBeenCalled();
    });
  });
});
