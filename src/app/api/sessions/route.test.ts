import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSessionUserId,
  getSessionsForUser,
  createManualSessionForUser,
  getSessionsForDateRange,
  getActiveTimerForUser,
} = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getSessionsForUser: vi.fn(),
  createManualSessionForUser: vi.fn(),
  getSessionsForDateRange: vi.fn(),
  getActiveTimerForUser: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSessionUserId,
}));

vi.mock("@/server/db/sessions", () => ({
  getSessionsForUser,
  createManualSessionForUser,
  getSessionsForDateRange,
  getActiveTimerForUser,
}));

import { GET, POST } from "./route";
import { NextRequest } from "next/server";

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/sessions");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionsForUser.mockResolvedValue({ sessions: [], totalSeconds: 0 });
  });

  it("returns 401 when not authenticated", async () => {
    getSessionUserId.mockResolvedValue(null);

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
    });
  });

  it("passes date and tzOffset to getSessionsForUser", async () => {
    getSessionUserId.mockResolvedValue(42);

    await GET(makeRequest({ date: "2026-03-19", tzOffset: "240" }));

    expect(getSessionsForUser).toHaveBeenCalledWith(42, {
      habitId: undefined,
      range: "all",
      date: "2026-03-19",
      tzOffset: 240,
    });
  });

  it("passes range and habitId without date", async () => {
    getSessionUserId.mockResolvedValue(42);

    await GET(makeRequest({ range: "week", habitId: "5" }));

    expect(getSessionsForUser).toHaveBeenCalledWith(42, {
      habitId: "5",
      range: "week",
      date: undefined,
      tzOffset: undefined,
    });
  });
});

describe("POST /api/sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-19T12:00:00Z"));
    getSessionUserId.mockResolvedValue(42);
    getSessionsForDateRange.mockResolvedValue([]);
    getActiveTimerForUser.mockResolvedValue(null);
    createManualSessionForUser.mockResolvedValue({
      id: 1,
      habitId: 1,
      userId: 42,
      durationSeconds: 5400,
      timerMode: "manual",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 400 when startTime is missing", async () => {
    const response = await POST(
      makePostRequest({
        habitId: 1,
        date: "2026-03-19",
        tzOffset: 0,
        durationMinutes: 60,
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid input");
  });

  it("returns 400 when duration exceeds 720", async () => {
    const response = await POST(
      makePostRequest({
        habitId: 1,
        date: "2026-03-19",
        startTime: "10:00",
        tzOffset: 0,
        durationMinutes: 721,
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid input");
  });

  it("returns 400 when duration < 1", async () => {
    const response = await POST(
      makePostRequest({
        habitId: 1,
        date: "2026-03-19",
        startTime: "10:00",
        tzOffset: 0,
        durationMinutes: 0,
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid input");
  });

  it("returns 400 when session extends past midnight", async () => {
    const response = await POST(
      makePostRequest({
        habitId: 1,
        date: "2026-03-19",
        startTime: "23:00",
        tzOffset: 0,
        durationMinutes: 120,
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Session cannot extend past midnight");
  });

  it("returns 409 when overlapping with existing session", async () => {
    getSessionsForDateRange.mockResolvedValue([
      {
        startTime: new Date("2026-03-19T10:00:00Z"),
        endTime: new Date("2026-03-19T11:00:00Z"),
        durationSeconds: 3600,
        timerMode: "stopwatch",
        habitName: "Piano",
      },
    ]);

    const response = await POST(
      makePostRequest({
        habitId: 1,
        date: "2026-03-19",
        startTime: "10:30",
        tzOffset: 0,
        durationMinutes: 60,
      }),
    );

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe("Overlaps with Piano");
  });

  it("returns 409 when overlapping with active timer", async () => {
    getActiveTimerForUser.mockResolvedValue({
      startTime: new Date("2026-03-19T13:00:00Z"),
      habitName: "Guitar",
    });

    const response = await POST(
      makePostRequest({
        habitId: 1,
        date: "2026-03-19",
        startTime: "12:00",
        tzOffset: 0,
        durationMinutes: 120,
      }),
    );

    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe("Overlaps with active Guitar timer");
  });

  it("returns 201 when session ends before active timer starts", async () => {
    getActiveTimerForUser.mockResolvedValue({
      startTime: new Date("2026-03-19T15:00:00Z"),
      habitName: "Guitar",
    });

    const response = await POST(
      makePostRequest({
        habitId: 1,
        date: "2026-03-19",
        startTime: "10:00",
        tzOffset: 0,
        durationMinutes: 60,
      }),
    );

    expect(response.status).toBe(201);
  });

  it("creates session with correct startTime/endTime/durationSeconds (tzOffset: 0)", async () => {
    const response = await POST(
      makePostRequest({
        habitId: 1,
        date: "2026-03-19",
        startTime: "14:00",
        tzOffset: 0,
        durationMinutes: 90,
      }),
    );

    expect(response.status).toBe(201);
    expect(createManualSessionForUser).toHaveBeenCalledWith({
      userId: 42,
      habitId: 1,
      startTime: new Date("2026-03-19T14:00:00.000Z"),
      endTime: new Date("2026-03-19T15:30:00.000Z"),
      durationSeconds: 5400,
    });
  });

  it("correctly applies tzOffset (tzOffset: 240 means UTC-4, so 14:00 local = 18:00 UTC)", async () => {
    const response = await POST(
      makePostRequest({
        habitId: 1,
        date: "2026-03-19",
        startTime: "14:00",
        tzOffset: 240,
        durationMinutes: 60,
      }),
    );

    expect(response.status).toBe(201);
    expect(createManualSessionForUser).toHaveBeenCalledWith({
      userId: 42,
      habitId: 1,
      startTime: new Date("2026-03-19T18:00:00.000Z"),
      endTime: new Date("2026-03-19T19:00:00.000Z"),
      durationSeconds: 3600,
    });
  });
});
