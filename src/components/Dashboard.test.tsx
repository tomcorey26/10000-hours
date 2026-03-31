// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockMutate = vi.fn();
const mockMutateAsync = vi.fn();
vi.mock("@/hooks/use-habits", () => ({
  useHabits: (initial: unknown) => ({ data: initial }),
  useAddHabit: () => ({ mutateAsync: mockMutateAsync }),
  useDeleteHabit: () => ({ mutate: mockMutate }),
  useStartTimer: () => ({ mutate: mockMutate }),
}));

import { Dashboard } from "./Dashboard";
import type { Habit } from "@/lib/types";

function makeHabit(
  overrides: Partial<Habit> & { id: number; name: string },
): Habit {
  return {
    todaySeconds: 0,
    totalSeconds: 0,
    streak: 0,
    activeTimer: null,
    ...overrides,
  };
}

describe("Dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders habits in the order they are passed (newest first)", () => {
    const habits = [
      makeHabit({ id: 3, name: "Piano" }),
      makeHabit({ id: 2, name: "Guitar" }),
      makeHabit({ id: 1, name: "Drawing" }),
    ];

    render(<Dashboard initialHabits={habits} />);

    const cards = screen.getAllByText(/Piano|Guitar|Drawing/);
    expect(cards[0]).toHaveTextContent("Piano");
    expect(cards[1]).toHaveTextContent("Guitar");
    expect(cards[2]).toHaveTextContent("Drawing");
  });

  it("renders empty state when no habits exist", () => {
    render(<Dashboard initialHabits={[]} />);

    expect(
      screen.getByText("Start by adding your first habit"),
    ).toBeInTheDocument();
  });

  it("shows active habit separately with clickable wrapper", () => {
    const habits = [
      makeHabit({
        id: 1,
        name: "Active Habit",
        activeTimer: {
          startTime: new Date().toISOString(),
          targetDurationSeconds: null,
        },
      }),
      makeHabit({ id: 2, name: "Inactive Habit" }),
    ];

    render(<Dashboard initialHabits={habits} />);

    expect(screen.getByText("Active Habit")).toBeInTheDocument();
    expect(screen.getByText("Inactive Habit")).toBeInTheDocument();
  });

  it("navigates to /timer when clicking active habit card", async () => {
    const user = userEvent.setup();
    const habits = [
      makeHabit({
        id: 1,
        name: "Active Habit",
        activeTimer: {
          startTime: new Date().toISOString(),
          targetDurationSeconds: null,
        },
      }),
    ];

    render(<Dashboard initialHabits={habits} />);

    const activeCard = screen.getByTestId("active-habit-card");
    await user.click(activeCard);

    expect(mockPush).toHaveBeenCalledWith("/timer");
  });
});
