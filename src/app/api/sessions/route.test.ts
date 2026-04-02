import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSessionUserId: vi.fn().mockResolvedValue(1),
}));

vi.mock("@/server/db/sessions", () => ({
  createManualSessionForUser: vi.fn().mockResolvedValue({ id: 1 }),
  getSessionsForUser: vi.fn(),
}));

describe("POST /api/sessions", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns 403 when FEATURE_LOG_SESSION is not enabled", async () => {
    vi.stubEnv("FEATURE_LOG_SESSION", "false");
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId: 1, date: "2026-04-01", durationMinutes: 30 }),
    });
    const response = await POST(request as any);
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Feature not available");
  });

  it("allows POST when FEATURE_LOG_SESSION is enabled", async () => {
    vi.stubEnv("FEATURE_LOG_SESSION", "true");
    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitId: 1, date: "2026-04-01", durationMinutes: 30 }),
    });
    const response = await POST(request as any);
    expect(response.status).not.toBe(403);
  });
});
