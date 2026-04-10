import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSessionUserId: vi.fn(),
}));

const mockGetRoutinesForUser = vi.fn();
const mockCreateRoutineForUser = vi.fn();

vi.mock("@/server/db/routines", () => ({
  getRoutinesForUser: (...args: any[]) => mockGetRoutinesForUser(...args),
  createRoutineForUser: (...args: any[]) => mockCreateRoutineForUser(...args),
}));

import { getSessionUserId } from "@/lib/auth";

describe("GET /api/routines", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(null);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns routines for authenticated user", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(1);
    mockGetRoutinesForUser.mockResolvedValue([{ id: 1, name: "Morning", blocks: [] }]);
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.routines).toHaveLength(1);
    expect(data.routines[0].name).toBe("Morning");
  });
});

describe("POST /api/routines", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(null);
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", blocks: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing name", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(1);
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", blocks: [{ habitId: 1, sortOrder: 0, sets: [{ durationSeconds: 60, breakSeconds: 0 }] }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty blocks array", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(1);
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", blocks: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates routine with valid data", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(1);
    const mockRoutine = { id: 1, name: "Morning", blocks: [], createdAt: "2026-04-10T00:00:00.000Z", updatedAt: "2026-04-10T00:00:00.000Z" };
    mockCreateRoutineForUser.mockResolvedValue(mockRoutine);
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Morning",
        blocks: [{ habitId: 1, sortOrder: 0, notes: null, sets: [{ durationSeconds: 1500, breakSeconds: 300 }] }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.routine.name).toBe("Morning");
  });
});
