// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useTimerStore } from "@/stores/timer-store";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/sessions",
}));

vi.mock("@/hooks/use-haptics", () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));

import { MiniTimerBar } from "./MiniTimerBar";

describe("MiniTimerBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTimerStore.setState({
      activeTimer: null,
      view: { type: "habits_list" },
      displayTime: "00:00:00",
    });
  });

  it("renders nothing when no active timer", () => {
    const { container } = render(<MiniTimerBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders timer info when active timer exists", () => {
    useTimerStore.setState({
      activeTimer: {
        habitId: 1,
        habitName: "Guitar",
        startTime: new Date().toISOString(),
        targetDurationSeconds: null,
      },
      displayTime: "00:05:30",
      view: { type: "active_timer" },
    });

    render(<MiniTimerBar />);
    expect(screen.getByText("Guitar")).toBeInTheDocument();
    expect(screen.getByText("00:05:30")).toBeInTheDocument();
  });
});
