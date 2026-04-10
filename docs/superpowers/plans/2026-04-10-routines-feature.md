# Routines Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Users can create, update, and delete routines composed of habit blocks with configurable sets, durations, and breaks.

**Architecture:** URL-driven views (`/routines`, `/routines/[id]`, `/routines/new`, `/routines/[id]/edit`) with a Zustand builder store for in-progress edits and React Query for server state. Data stored in `routines` + `routineBlocks` tables (sets as JSON column).

**Tech Stack:** Next.js App Router, Drizzle ORM (libSQL/Turso), Zustand, TanStack React Query v5, shadcn/ui, TailwindCSS 4, Framer Motion, Zod, Vitest

**Spec:** `docs/superpowers/specs/2026-04-10-routines-feature-design.md`

---

## File Structure

### New files
- `src/db/schema.ts` (modify) — add `routines` and `routineBlocks` tables + relations
- `src/lib/types.ts` (modify) — add Routine types
- `src/lib/query-keys.ts` (modify) — add routines query keys
- `src/server/db/routines.ts` — DB queries for routines CRUD
- `src/app/api/routines/route.ts` — GET (list) + POST (create)
- `src/app/api/routines/[id]/route.ts` — GET (one) + PUT (update) + DELETE
- `src/hooks/use-routines.ts` — React Query hooks
- `src/stores/routine-builder-store.ts` — Zustand store for builder
- `src/components/RoutinesView.tsx` (rewrite) — list page with real data
- `src/components/RoutineDetailView.tsx` — read-only detail page
- `src/components/RoutineBuilder.tsx` — create/edit builder
- `src/components/RoutineBlockCard.tsx` — habit block display (readonly + editable modes)
- `src/components/RoutineStickyHeader.tsx` — sticky header for builder
- `src/components/HabitPicker.tsx` — modal with searchable habit list + inline create
- `src/components/HabitBlockConfigForm.tsx` — config form for adding a habit block
- `src/app/(app)/routines/page.tsx` (modify) — fetch routines server-side
- `src/app/(app)/routines/[id]/page.tsx` — detail page
- `src/app/(app)/routines/new/page.tsx` — create page
- `src/app/(app)/routines/[id]/edit/page.tsx` — edit page

### Test files
- `src/stores/routine-builder-store.test.ts`
- `src/app/api/routines/route.test.ts`
- `src/app/api/routines/[id]/route.test.ts`
- `src/components/RoutineBlockCard.test.tsx`
- `src/components/RoutineBuilder.test.tsx`
- `src/components/HabitPicker.test.tsx`

---

## Task 1: Database Schema — Add routines and routineBlocks tables

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add routines table to schema**

Add after the `activeTimers` table definition in `src/db/schema.ts`:

```typescript
export const routines = sqliteTable('routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const routineBlocks = sqliteTable('routine_blocks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routineId: integer('routine_id').notNull().references(() => routines.id, { onDelete: 'cascade' }),
  habitId: integer('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull(),
  notes: text('notes'),
  sets: text('sets').notNull(), // JSON: [{durationSeconds, breakSeconds}]
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

- [ ] **Step 2: Add relations**

Add after the existing `activeTimersRelations`:

```typescript
export const routinesRelations = relations(routines, ({ one, many }) => ({
  user: one(users, { fields: [routines.userId], references: [users.id] }),
  blocks: many(routineBlocks),
}));

export const routineBlocksRelations = relations(routineBlocks, ({ one }) => ({
  routine: one(routines, { fields: [routineBlocks.routineId], references: [routines.id] }),
  habit: one(habits, { fields: [routineBlocks.habitId], references: [habits.id] }),
}));
```

Also update `usersRelations` to include routines:

```typescript
export const usersRelations = relations(users, ({ many }) => ({
  habits: many(habits),
  activeTimers: many(activeTimers),
  routines: many(routines),
}));
```

And update `habitsRelations` to include routineBlocks:

```typescript
export const habitsRelations = relations(habits, ({ one, many }) => ({
  user: one(users, { fields: [habits.userId], references: [users.id] }),
  timeSessions: many(timeSessions),
  activeTimers: many(activeTimers),
  routineBlocks: many(routineBlocks),
}));
```

- [ ] **Step 3: Generate and apply migration**

Run: `npx drizzle-kit generate`
Expected: New migration SQL file created in `drizzle/` directory

Run: `npx drizzle-kit push`
Expected: Schema pushed to database

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: add routines and routineBlocks tables to schema"
```

---

## Task 2: Types and Query Keys

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/query-keys.ts`

- [ ] **Step 1: Add routine types to types.ts**

Add at the end of `src/lib/types.ts`:

```typescript
export type RoutineSet = {
  durationSeconds: number;
  breakSeconds: number;
};

export type RoutineBlock = {
  id: number;
  habitId: number;
  habitName: string;
  sortOrder: number;
  notes: string | null;
  sets: RoutineSet[];
};

export type Routine = {
  id: number;
  name: string;
  blocks: RoutineBlock[];
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 2: Add query keys**

In `src/lib/query-keys.ts`, add to the `queryKeys` object:

```typescript
routines: {
  all: ['routines'] as const,
  detail: (id: number) => ['routines', id] as const,
},
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/query-keys.ts
git commit -m "feat: add routine types and query keys"
```

---

## Task 3: Server DB Functions

**Files:**
- Create: `src/server/db/routines.ts`

- [ ] **Step 1: Write the failing test for getRoutinesForUser**

Create `src/server/db/routines.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock drizzle db
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
    insert: (...args: any[]) => mockInsert(...args),
    delete: (...args: any[]) => mockDelete(...args),
    update: (...args: any[]) => mockUpdate(...args),
    transaction: (fn: any) => mockTransaction(fn),
  },
}));

vi.mock("@/db/schema", () => ({
  routines: { id: "id", userId: "user_id", name: "name", updatedAt: "updated_at" },
  routineBlocks: { id: "id", routineId: "routine_id", habitId: "habit_id", sortOrder: "sort_order", notes: "notes", sets: "sets" },
  habits: { id: "id", name: "name" },
}));

describe("routines db", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("module exports expected functions", async () => {
    const mod = await import("./routines");
    expect(mod.getRoutinesForUser).toBeDefined();
    expect(mod.getRoutineById).toBeDefined();
    expect(mod.createRoutineForUser).toBeDefined();
    expect(mod.updateRoutineForUser).toBeDefined();
    expect(mod.deleteRoutineForUser).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/db/routines.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement routines DB functions**

Create `src/server/db/routines.ts`:

```typescript
import { and, eq, desc } from "drizzle-orm";

import { db } from "@/db";
import { routines, routineBlocks, habits } from "@/db/schema";
import type { Routine, RoutineBlock, RoutineSet } from "@/lib/types";

function parseBlocks(
  rawBlocks: {
    id: number;
    habitId: number;
    habitName: string;
    sortOrder: number;
    notes: string | null;
    sets: string;
  }[]
): RoutineBlock[] {
  return rawBlocks
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((b) => ({
      id: b.id,
      habitId: b.habitId,
      habitName: b.habitName,
      sortOrder: b.sortOrder,
      notes: b.notes,
      sets: JSON.parse(b.sets) as RoutineSet[],
    }));
}

export async function getRoutinesForUser(userId: number): Promise<Routine[]> {
  const userRoutines = await db
    .select({ id: routines.id, name: routines.name, createdAt: routines.createdAt, updatedAt: routines.updatedAt })
    .from(routines)
    .where(eq(routines.userId, userId))
    .orderBy(desc(routines.updatedAt));

  return Promise.all(
    userRoutines.map(async (routine) => {
      const blocks = await db
        .select({
          id: routineBlocks.id,
          habitId: routineBlocks.habitId,
          habitName: habits.name,
          sortOrder: routineBlocks.sortOrder,
          notes: routineBlocks.notes,
          sets: routineBlocks.sets,
        })
        .from(routineBlocks)
        .innerJoin(habits, eq(routineBlocks.habitId, habits.id))
        .where(eq(routineBlocks.routineId, routine.id));

      return {
        id: routine.id,
        name: routine.name,
        blocks: parseBlocks(blocks),
        createdAt: routine.createdAt.toISOString(),
        updatedAt: routine.updatedAt.toISOString(),
      };
    })
  );
}

export async function getRoutineById(
  routineId: number,
  userId: number
): Promise<Routine | null> {
  const routine = await db
    .select({ id: routines.id, name: routines.name, createdAt: routines.createdAt, updatedAt: routines.updatedAt })
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
    .get();

  if (!routine) return null;

  const blocks = await db
    .select({
      id: routineBlocks.id,
      habitId: routineBlocks.habitId,
      habitName: habits.name,
      sortOrder: routineBlocks.sortOrder,
      notes: routineBlocks.notes,
      sets: routineBlocks.sets,
    })
    .from(routineBlocks)
    .innerJoin(habits, eq(routineBlocks.habitId, habits.id))
    .where(eq(routineBlocks.routineId, routine.id));

  return {
    id: routine.id,
    name: routine.name,
    blocks: parseBlocks(blocks),
    createdAt: routine.createdAt.toISOString(),
    updatedAt: routine.updatedAt.toISOString(),
  };
}

export async function createRoutineForUser(
  userId: number,
  data: {
    name: string;
    blocks: { habitId: number; sortOrder: number; notes: string | null; sets: RoutineSet[] }[];
  }
): Promise<Routine> {
  const [routine] = await db
    .insert(routines)
    .values({ userId, name: data.name })
    .returning();

  const blockRows = await Promise.all(
    data.blocks.map(async (block) => {
      const [row] = await db
        .insert(routineBlocks)
        .values({
          routineId: routine.id,
          habitId: block.habitId,
          sortOrder: block.sortOrder,
          notes: block.notes,
          sets: JSON.stringify(block.sets),
        })
        .returning();
      const habit = await db
        .select({ name: habits.name })
        .from(habits)
        .where(eq(habits.id, block.habitId))
        .get();
      return {
        id: row.id,
        habitId: row.habitId,
        habitName: habit!.name,
        sortOrder: row.sortOrder,
        notes: row.notes,
        sets: block.sets,
      };
    })
  );

  return {
    id: routine.id,
    name: routine.name,
    blocks: blockRows.sort((a, b) => a.sortOrder - b.sortOrder),
    createdAt: routine.createdAt.toISOString(),
    updatedAt: routine.updatedAt.toISOString(),
  };
}

export async function updateRoutineForUser(
  routineId: number,
  userId: number,
  data: {
    name: string;
    blocks: { habitId: number; sortOrder: number; notes: string | null; sets: RoutineSet[] }[];
  }
): Promise<Routine | null> {
  const existing = await db
    .select()
    .from(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
    .get();

  if (!existing) return null;

  const now = new Date();

  await db
    .update(routines)
    .set({ name: data.name, updatedAt: now })
    .where(eq(routines.id, routineId));

  // Delete old blocks and insert new ones
  await db.delete(routineBlocks).where(eq(routineBlocks.routineId, routineId));

  const blockRows = await Promise.all(
    data.blocks.map(async (block) => {
      const [row] = await db
        .insert(routineBlocks)
        .values({
          routineId,
          habitId: block.habitId,
          sortOrder: block.sortOrder,
          notes: block.notes,
          sets: JSON.stringify(block.sets),
        })
        .returning();
      const habit = await db
        .select({ name: habits.name })
        .from(habits)
        .where(eq(habits.id, block.habitId))
        .get();
      return {
        id: row.id,
        habitId: row.habitId,
        habitName: habit!.name,
        sortOrder: row.sortOrder,
        notes: row.notes,
        sets: block.sets,
      };
    })
  );

  return {
    id: routineId,
    name: data.name,
    blocks: blockRows.sort((a, b) => a.sortOrder - b.sortOrder),
    createdAt: existing.createdAt.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export async function deleteRoutineForUser(
  routineId: number,
  userId: number
): Promise<boolean> {
  const [deleted] = await db
    .delete(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
    .returning();

  return !!deleted;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/db/routines.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/db/routines.ts src/server/db/routines.test.ts
git commit -m "feat: add routines DB query functions"
```

---

## Task 4: API Routes — List and Create

**Files:**
- Create: `src/app/api/routines/route.ts`
- Create: `src/app/api/routines/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/routines/route.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/routines/route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the route**

Create `src/app/api/routines/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import { getRoutinesForUser, createRoutineForUser } from "@/server/db/routines";

const setSchema = z.object({
  durationSeconds: z.number().min(60).max(7200),
  breakSeconds: z.number().min(0).max(3600),
});

const blockSchema = z.object({
  habitId: z.number(),
  sortOrder: z.number(),
  notes: z.string().max(500).nullable().optional().transform((v) => v ?? null),
  sets: z.array(setSchema).min(1).max(10),
});

const createRoutineSchema = z.object({
  name: z.string().trim().min(1).max(100),
  blocks: z.array(blockSchema).min(1).max(20),
});

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const routines = await getRoutinesForUser(userId);
  return NextResponse.json({ routines });
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createRoutineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid routine data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const routine = await createRoutineForUser(userId, parsed.data);
  return NextResponse.json({ routine }, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/routines/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/routines/route.ts src/app/api/routines/route.test.ts
git commit -m "feat: add GET and POST /api/routines routes"
```

---

## Task 5: API Routes — Get, Update, Delete single routine

**Files:**
- Create: `src/app/api/routines/[id]/route.ts`
- Create: `src/app/api/routines/[id]/route.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/app/api/routines/[id]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  getSessionUserId: vi.fn(),
}));

const mockGetRoutineById = vi.fn();
const mockUpdateRoutineForUser = vi.fn();
const mockDeleteRoutineForUser = vi.fn();

vi.mock("@/server/db/routines", () => ({
  getRoutineById: (...args: any[]) => mockGetRoutineById(...args),
  updateRoutineForUser: (...args: any[]) => mockUpdateRoutineForUser(...args),
  deleteRoutineForUser: (...args: any[]) => mockDeleteRoutineForUser(...args),
}));

import { getSessionUserId } from "@/lib/auth";

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe("GET /api/routines/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(null);
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/routines/1");
    const res = await GET(req, makeParams("1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when routine not found", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(1);
    mockGetRoutineById.mockResolvedValue(null);
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/routines/999");
    const res = await GET(req, makeParams("999"));
    expect(res.status).toBe(404);
  });

  it("returns routine when found", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(1);
    mockGetRoutineById.mockResolvedValue({ id: 1, name: "Morning", blocks: [] });
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/routines/1");
    const res = await GET(req, makeParams("1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.routine.name).toBe("Morning");
  });
});

describe("DELETE /api/routines/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(null);
    const { DELETE } = await import("./route");
    const req = new Request("http://localhost/api/routines/1", { method: "DELETE" });
    const res = await DELETE(req, makeParams("1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when routine not found", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(1);
    mockDeleteRoutineForUser.mockResolvedValue(false);
    const { DELETE } = await import("./route");
    const req = new Request("http://localhost/api/routines/999", { method: "DELETE" });
    const res = await DELETE(req, makeParams("999"));
    expect(res.status).toBe(404);
  });

  it("deletes routine successfully", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(1);
    mockDeleteRoutineForUser.mockResolvedValue(true);
    const { DELETE } = await import("./route");
    const req = new Request("http://localhost/api/routines/1", { method: "DELETE" });
    const res = await DELETE(req, makeParams("1"));
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/routines/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(null);
    const { PUT } = await import("./route");
    const req = new Request("http://localhost/api/routines/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated", blocks: [] }),
    });
    const res = await PUT(req, makeParams("1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid data", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(1);
    const { PUT } = await import("./route");
    const req = new Request("http://localhost/api/routines/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", blocks: [] }),
    });
    const res = await PUT(req, makeParams("1"));
    expect(res.status).toBe(400);
  });

  it("updates routine successfully", async () => {
    vi.mocked(getSessionUserId).mockResolvedValue(1);
    const updated = { id: 1, name: "Updated", blocks: [], createdAt: "2026-04-10T00:00:00.000Z", updatedAt: "2026-04-10T00:00:00.000Z" };
    mockUpdateRoutineForUser.mockResolvedValue(updated);
    const { PUT } = await import("./route");
    const req = new Request("http://localhost/api/routines/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Updated",
        blocks: [{ habitId: 1, sortOrder: 0, notes: null, sets: [{ durationSeconds: 1500, breakSeconds: 300 }] }],
      }),
    });
    const res = await PUT(req, makeParams("1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.routine.name).toBe("Updated");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/api/routines/[id]/route.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the route**

Create `src/app/api/routines/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId } from "@/lib/auth";
import {
  getRoutineById,
  updateRoutineForUser,
  deleteRoutineForUser,
} from "@/server/db/routines";

const setSchema = z.object({
  durationSeconds: z.number().min(60).max(7200),
  breakSeconds: z.number().min(0).max(3600),
});

const blockSchema = z.object({
  habitId: z.number(),
  sortOrder: z.number(),
  notes: z.string().max(500).nullable().optional().transform((v) => v ?? null),
  sets: z.array(setSchema).min(1).max(10),
});

const updateRoutineSchema = z.object({
  name: z.string().trim().min(1).max(100),
  blocks: z.array(blockSchema).min(1).max(20),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const routine = await getRoutineById(Number(id), userId);
  if (!routine)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ routine });
}

export async function PUT(request: Request, context: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateRoutineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid routine data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await context.params;
  const routine = await updateRoutineForUser(Number(id), userId, parsed.data);
  if (!routine)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ routine });
}

export async function DELETE(request: Request, context: RouteContext) {
  const userId = await getSessionUserId();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const deleted = await deleteRoutineForUser(Number(id), userId);
  if (!deleted)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/routines/[id]/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/routines/\[id\]/route.ts src/app/api/routines/\[id\]/route.test.ts
git commit -m "feat: add GET, PUT, DELETE /api/routines/[id] routes"
```

---

## Task 6: React Query Hooks

**Files:**
- Create: `src/hooks/use-routines.ts`

- [ ] **Step 1: Implement hooks**

Create `src/hooks/use-routines.ts`:

```typescript
import {
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { Routine, RoutineSet } from "@/lib/types";

type CreateRoutineInput = {
  name: string;
  blocks: {
    habitId: number;
    sortOrder: number;
    notes: string | null;
    sets: RoutineSet[];
  }[];
};

type UpdateRoutineInput = CreateRoutineInput & { id: number };

export function useRoutines(initialData?: Routine[]) {
  return useSuspenseQuery({
    queryKey: queryKeys.routines.all,
    queryFn: () => api<{ routines: Routine[] }>("/api/routines"),
    select: (data) => data.routines,
    ...(initialData ? { initialData: { routines: initialData } } : {}),
  });
}

export function useRoutine(id: number, initialData?: Routine) {
  return useSuspenseQuery({
    queryKey: queryKeys.routines.detail(id),
    queryFn: () => api<{ routine: Routine }>(`/api/routines/${id}`),
    select: (data) => data.routine,
    ...(initialData ? { initialData: { routine: initialData } } : {}),
  });
}

export function useCreateRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRoutineInput) =>
      api<{ routine: Routine }>("/api/routines", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.all }),
  });
}

export function useUpdateRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateRoutineInput) =>
      api<{ routine: Routine }>(`/api/routines/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.routines.detail(variables.id),
      });
    },
  });
}

export function useDeleteRoutine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api(`/api/routines/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.routines.all }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-routines.ts
git commit -m "feat: add React Query hooks for routines"
```

---

## Task 7: Zustand Builder Store

**Files:**
- Create: `src/stores/routine-builder-store.ts`
- Create: `src/stores/routine-builder-store.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/stores/routine-builder-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useRoutineBuilderStore } from "./routine-builder-store";

beforeEach(() => {
  useRoutineBuilderStore.getState().initEmpty();
});

describe("routine builder store", () => {
  describe("initEmpty", () => {
    it("resets to empty state", () => {
      const state = useRoutineBuilderStore.getState();
      expect(state.routineId).toBeNull();
      expect(state.name).toBe("");
      expect(state.blocks).toEqual([]);
      expect(state.isDirty).toBe(false);
    });
  });

  describe("setName", () => {
    it("sets routine name and marks dirty", () => {
      useRoutineBuilderStore.getState().setName("Morning");
      const state = useRoutineBuilderStore.getState();
      expect(state.name).toBe("Morning");
      expect(state.isDirty).toBe(true);
    });
  });

  describe("addBlock", () => {
    it("adds a block and marks dirty", () => {
      useRoutineBuilderStore.getState().addBlock({
        habitId: 1,
        habitName: "Guitar",
        notes: null,
        sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
      });
      const state = useRoutineBuilderStore.getState();
      expect(state.blocks).toHaveLength(1);
      expect(state.blocks[0].habitId).toBe(1);
      expect(state.blocks[0].habitName).toBe("Guitar");
      expect(state.blocks[0].clientId).toBeTruthy();
      expect(state.isDirty).toBe(true);
    });
  });

  describe("removeBlock", () => {
    it("removes a block by clientId", () => {
      useRoutineBuilderStore.getState().addBlock({
        habitId: 1,
        habitName: "Guitar",
        notes: null,
        sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
      });
      const clientId = useRoutineBuilderStore.getState().blocks[0].clientId;
      useRoutineBuilderStore.getState().removeBlock(clientId);
      expect(useRoutineBuilderStore.getState().blocks).toHaveLength(0);
    });
  });

  describe("updateBlockNotes", () => {
    it("updates notes for a block", () => {
      useRoutineBuilderStore.getState().addBlock({
        habitId: 1,
        habitName: "Guitar",
        notes: null,
        sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
      });
      const clientId = useRoutineBuilderStore.getState().blocks[0].clientId;
      useRoutineBuilderStore.getState().updateBlockNotes(clientId, "Focus on scales");
      expect(useRoutineBuilderStore.getState().blocks[0].notes).toBe("Focus on scales");
    });
  });

  describe("addSet", () => {
    it("adds a set to a block", () => {
      useRoutineBuilderStore.getState().addBlock({
        habitId: 1,
        habitName: "Guitar",
        notes: null,
        sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
      });
      const clientId = useRoutineBuilderStore.getState().blocks[0].clientId;
      useRoutineBuilderStore.getState().addSet(clientId);
      const sets = useRoutineBuilderStore.getState().blocks[0].sets;
      expect(sets).toHaveLength(2);
      // New set copies duration/break from the last set
      expect(sets[1].durationSeconds).toBe(1500);
      expect(sets[1].breakSeconds).toBe(300);
    });

    it("does not add beyond 10 sets", () => {
      useRoutineBuilderStore.getState().addBlock({
        habitId: 1,
        habitName: "Guitar",
        notes: null,
        sets: Array.from({ length: 10 }, () => ({ durationSeconds: 1500, breakSeconds: 300 })),
      });
      const clientId = useRoutineBuilderStore.getState().blocks[0].clientId;
      useRoutineBuilderStore.getState().addSet(clientId);
      expect(useRoutineBuilderStore.getState().blocks[0].sets).toHaveLength(10);
    });
  });

  describe("removeSet", () => {
    it("removes a set by index", () => {
      useRoutineBuilderStore.getState().addBlock({
        habitId: 1,
        habitName: "Guitar",
        notes: null,
        sets: [
          { durationSeconds: 1500, breakSeconds: 300 },
          { durationSeconds: 900, breakSeconds: 300 },
        ],
      });
      const clientId = useRoutineBuilderStore.getState().blocks[0].clientId;
      useRoutineBuilderStore.getState().removeSet(clientId, 0);
      const sets = useRoutineBuilderStore.getState().blocks[0].sets;
      expect(sets).toHaveLength(1);
      expect(sets[0].durationSeconds).toBe(900);
    });

    it("does not remove the last set", () => {
      useRoutineBuilderStore.getState().addBlock({
        habitId: 1,
        habitName: "Guitar",
        notes: null,
        sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
      });
      const clientId = useRoutineBuilderStore.getState().blocks[0].clientId;
      useRoutineBuilderStore.getState().removeSet(clientId, 0);
      expect(useRoutineBuilderStore.getState().blocks[0].sets).toHaveLength(1);
    });
  });

  describe("updateSetDuration", () => {
    it("updates duration for a specific set", () => {
      useRoutineBuilderStore.getState().addBlock({
        habitId: 1,
        habitName: "Guitar",
        notes: null,
        sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
      });
      const clientId = useRoutineBuilderStore.getState().blocks[0].clientId;
      useRoutineBuilderStore.getState().updateSetDuration(clientId, 0, 900);
      expect(useRoutineBuilderStore.getState().blocks[0].sets[0].durationSeconds).toBe(900);
    });
  });

  describe("updateSetBreak", () => {
    it("updates break for a specific set", () => {
      useRoutineBuilderStore.getState().addBlock({
        habitId: 1,
        habitName: "Guitar",
        notes: null,
        sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
      });
      const clientId = useRoutineBuilderStore.getState().blocks[0].clientId;
      useRoutineBuilderStore.getState().updateSetBreak(clientId, 0, 600);
      expect(useRoutineBuilderStore.getState().blocks[0].sets[0].breakSeconds).toBe(600);
    });
  });

  describe("moveBlock", () => {
    it("reorders blocks", () => {
      useRoutineBuilderStore.getState().addBlock({
        habitId: 1, habitName: "Guitar", notes: null,
        sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
      });
      useRoutineBuilderStore.getState().addBlock({
        habitId: 2, habitName: "Reading", notes: null,
        sets: [{ durationSeconds: 900, breakSeconds: 0 }],
      });
      useRoutineBuilderStore.getState().moveBlock(1, 0);
      const blocks = useRoutineBuilderStore.getState().blocks;
      expect(blocks[0].habitName).toBe("Reading");
      expect(blocks[1].habitName).toBe("Guitar");
    });
  });

  describe("initFromRoutine", () => {
    it("hydrates from existing routine", () => {
      useRoutineBuilderStore.getState().initFromRoutine({
        id: 5,
        name: "Evening",
        blocks: [
          {
            id: 10,
            habitId: 1,
            habitName: "Guitar",
            sortOrder: 0,
            notes: "Scales",
            sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
          },
        ],
        createdAt: "2026-04-10T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
      });
      const state = useRoutineBuilderStore.getState();
      expect(state.routineId).toBe(5);
      expect(state.name).toBe("Evening");
      expect(state.blocks).toHaveLength(1);
      expect(state.blocks[0].habitName).toBe("Guitar");
      expect(state.blocks[0].notes).toBe("Scales");
      expect(state.isDirty).toBe(false);
    });
  });

  describe("toPayload", () => {
    it("converts store state to API payload", () => {
      useRoutineBuilderStore.getState().setName("Morning");
      useRoutineBuilderStore.getState().addBlock({
        habitId: 1,
        habitName: "Guitar",
        notes: "Scales",
        sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
      });
      const payload = useRoutineBuilderStore.getState().toPayload();
      expect(payload).toEqual({
        name: "Morning",
        blocks: [
          {
            habitId: 1,
            sortOrder: 0,
            notes: "Scales",
            sets: [{ durationSeconds: 1500, breakSeconds: 300 }],
          },
        ],
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/stores/routine-builder-store.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the store**

Create `src/stores/routine-builder-store.ts`:

```typescript
import { create } from "zustand";
import type { Routine, RoutineSet } from "@/lib/types";

export type BuilderSet = RoutineSet;

export type BuilderBlock = {
  clientId: string;
  habitId: number;
  habitName: string;
  notes: string | null;
  sets: BuilderSet[];
};

type AddBlockInput = {
  habitId: number;
  habitName: string;
  notes: string | null;
  sets: BuilderSet[];
};

type RoutineBuilderState = {
  routineId: number | null;
  name: string;
  blocks: BuilderBlock[];
  isDirty: boolean;

  initEmpty: () => void;
  initFromRoutine: (routine: Routine) => void;
  setName: (name: string) => void;
  addBlock: (input: AddBlockInput) => void;
  removeBlock: (clientId: string) => void;
  updateBlockNotes: (clientId: string, notes: string) => void;
  addSet: (clientId: string) => void;
  removeSet: (clientId: string, setIndex: number) => void;
  updateSetDuration: (clientId: string, setIndex: number, durationSeconds: number) => void;
  updateSetBreak: (clientId: string, setIndex: number, breakSeconds: number) => void;
  moveBlock: (fromIndex: number, toIndex: number) => void;
  toPayload: () => {
    name: string;
    blocks: { habitId: number; sortOrder: number; notes: string | null; sets: RoutineSet[] }[];
  };
};

function generateId(): string {
  return crypto.randomUUID();
}

function updateBlock(
  blocks: BuilderBlock[],
  clientId: string,
  updater: (block: BuilderBlock) => BuilderBlock
): BuilderBlock[] {
  return blocks.map((b) => (b.clientId === clientId ? updater(b) : b));
}

export const useRoutineBuilderStore = create<RoutineBuilderState>((set, get) => ({
  routineId: null,
  name: "",
  blocks: [],
  isDirty: false,

  initEmpty: () =>
    set({ routineId: null, name: "", blocks: [], isDirty: false }),

  initFromRoutine: (routine: Routine) =>
    set({
      routineId: routine.id,
      name: routine.name,
      blocks: routine.blocks.map((b) => ({
        clientId: generateId(),
        habitId: b.habitId,
        habitName: b.habitName,
        notes: b.notes,
        sets: [...b.sets],
      })),
      isDirty: false,
    }),

  setName: (name: string) => set({ name, isDirty: true }),

  addBlock: (input: AddBlockInput) =>
    set((state) => ({
      blocks: [
        ...state.blocks,
        { clientId: generateId(), ...input },
      ],
      isDirty: true,
    })),

  removeBlock: (clientId: string) =>
    set((state) => ({
      blocks: state.blocks.filter((b) => b.clientId !== clientId),
      isDirty: true,
    })),

  updateBlockNotes: (clientId: string, notes: string) =>
    set((state) => ({
      blocks: updateBlock(state.blocks, clientId, (b) => ({ ...b, notes })),
      isDirty: true,
    })),

  addSet: (clientId: string) =>
    set((state) => ({
      blocks: updateBlock(state.blocks, clientId, (b) => {
        if (b.sets.length >= 10) return b;
        const lastSet = b.sets[b.sets.length - 1];
        return {
          ...b,
          sets: [
            ...b.sets,
            { durationSeconds: lastSet.durationSeconds, breakSeconds: lastSet.breakSeconds },
          ],
        };
      }),
      isDirty: true,
    })),

  removeSet: (clientId: string, setIndex: number) =>
    set((state) => ({
      blocks: updateBlock(state.blocks, clientId, (b) => {
        if (b.sets.length <= 1) return b;
        return { ...b, sets: b.sets.filter((_, i) => i !== setIndex) };
      }),
      isDirty: true,
    })),

  updateSetDuration: (clientId: string, setIndex: number, durationSeconds: number) =>
    set((state) => ({
      blocks: updateBlock(state.blocks, clientId, (b) => ({
        ...b,
        sets: b.sets.map((s, i) => (i === setIndex ? { ...s, durationSeconds } : s)),
      })),
      isDirty: true,
    })),

  updateSetBreak: (clientId: string, setIndex: number, breakSeconds: number) =>
    set((state) => ({
      blocks: updateBlock(state.blocks, clientId, (b) => ({
        ...b,
        sets: b.sets.map((s, i) => (i === setIndex ? { ...s, breakSeconds } : s)),
      })),
      isDirty: true,
    })),

  moveBlock: (fromIndex: number, toIndex: number) =>
    set((state) => {
      const blocks = [...state.blocks];
      const [moved] = blocks.splice(fromIndex, 1);
      blocks.splice(toIndex, 0, moved);
      return { blocks, isDirty: true };
    }),

  toPayload: () => {
    const { name, blocks } = get();
    return {
      name,
      blocks: blocks.map((b, i) => ({
        habitId: b.habitId,
        sortOrder: i,
        notes: b.notes,
        sets: b.sets.map((s) => ({
          durationSeconds: s.durationSeconds,
          breakSeconds: s.breakSeconds,
        })),
      })),
    };
  },
}));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/stores/routine-builder-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/routine-builder-store.ts src/stores/routine-builder-store.test.ts
git commit -m "feat: add Zustand builder store for routines"
```

---

## Task 8: RoutineBlockCard Component

**Files:**
- Create: `src/components/RoutineBlockCard.tsx`
- Create: `src/components/RoutineBlockCard.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/RoutineBlockCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoutineBlockCard } from "./RoutineBlockCard";

const baseBlock = {
  clientId: "test-1",
  habitId: 1,
  habitName: "Guitar",
  notes: "Focus on scales",
  sets: [
    { durationSeconds: 1500, breakSeconds: 300 },
    { durationSeconds: 900, breakSeconds: 0 },
  ],
};

describe("RoutineBlockCard", () => {
  describe("readonly mode", () => {
    it("renders habit name and notes", () => {
      render(<RoutineBlockCard block={baseBlock} mode="readonly" />);
      expect(screen.getByText("Guitar")).toBeInTheDocument();
      expect(screen.getByText("Focus on scales")).toBeInTheDocument();
    });

    it("renders set rows with durations", () => {
      render(<RoutineBlockCard block={baseBlock} mode="readonly" />);
      expect(screen.getByText("25 min")).toBeInTheDocument();
      expect(screen.getByText("15 min")).toBeInTheDocument();
    });

    it("renders break rows when break > 0", () => {
      render(<RoutineBlockCard block={baseBlock} mode="readonly" />);
      expect(screen.getByText("5 min break")).toBeInTheDocument();
    });

    it("does not render break row when break is 0", () => {
      render(<RoutineBlockCard block={baseBlock} mode="readonly" />);
      const breakRows = screen.getAllByText(/break/i);
      // Only 1 break row (for set 1 with 300s break), not for set 2 with 0s
      expect(breakRows).toHaveLength(1);
    });

    it("does not show delete button or add set in readonly", () => {
      render(<RoutineBlockCard block={baseBlock} mode="readonly" />);
      expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
      expect(screen.queryByText(/add a set/i)).not.toBeInTheDocument();
    });
  });

  describe("editable mode", () => {
    it("shows delete block button", () => {
      render(
        <RoutineBlockCard
          block={baseBlock}
          mode="editable"
          onRemoveBlock={vi.fn()}
          onAddSet={vi.fn()}
          onRemoveSet={vi.fn()}
          onUpdateDuration={vi.fn()}
          onUpdateBreak={vi.fn()}
          onUpdateNotes={vi.fn()}
        />
      );
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });

    it("shows add a set button", () => {
      render(
        <RoutineBlockCard
          block={baseBlock}
          mode="editable"
          onRemoveBlock={vi.fn()}
          onAddSet={vi.fn()}
          onRemoveSet={vi.fn()}
          onUpdateDuration={vi.fn()}
          onUpdateBreak={vi.fn()}
          onUpdateNotes={vi.fn()}
        />
      );
      expect(screen.getByText(/add a set/i)).toBeInTheDocument();
    });

    it("calls onRemoveBlock when delete clicked", async () => {
      const onRemoveBlock = vi.fn();
      render(
        <RoutineBlockCard
          block={baseBlock}
          mode="editable"
          onRemoveBlock={onRemoveBlock}
          onAddSet={vi.fn()}
          onRemoveSet={vi.fn()}
          onUpdateDuration={vi.fn()}
          onUpdateBreak={vi.fn()}
          onUpdateNotes={vi.fn()}
        />
      );
      await userEvent.click(screen.getByRole("button", { name: /delete/i }));
      expect(onRemoveBlock).toHaveBeenCalledWith("test-1");
    });

    it("calls onAddSet when add set clicked", async () => {
      const onAddSet = vi.fn();
      render(
        <RoutineBlockCard
          block={baseBlock}
          mode="editable"
          onRemoveBlock={vi.fn()}
          onAddSet={onAddSet}
          onRemoveSet={vi.fn()}
          onUpdateDuration={vi.fn()}
          onUpdateBreak={vi.fn()}
          onUpdateNotes={vi.fn()}
        />
      );
      await userEvent.click(screen.getByText(/add a set/i));
      expect(onAddSet).toHaveBeenCalledWith("test-1");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/RoutineBlockCard.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement RoutineBlockCard**

Create `src/components/RoutineBlockCard.tsx`:

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Pause, NotebookPen, Plus } from "lucide-react";
import type { BuilderBlock } from "@/stores/routine-builder-store";

type ReadonlyProps = {
  block: BuilderBlock;
  mode: "readonly";
};

type EditableProps = {
  block: BuilderBlock;
  mode: "editable";
  onRemoveBlock: (clientId: string) => void;
  onAddSet: (clientId: string) => void;
  onRemoveSet: (clientId: string, setIndex: number) => void;
  onUpdateDuration: (clientId: string, setIndex: number, durationSeconds: number) => void;
  onUpdateBreak: (clientId: string, setIndex: number, breakSeconds: number) => void;
  onUpdateNotes: (clientId: string, notes: string) => void;
};

type Props = ReadonlyProps | EditableProps;

function formatMinutes(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

export function RoutineBlockCard(props: Props) {
  const { block, mode } = props;
  const isEditable = mode === "editable";
  const maxSets = block.sets.length >= 10;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-foreground">{block.habitName}</h3>
        {isEditable && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => props.onRemoveBlock(block.clientId)}
            aria-label="Delete block"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Notes banner */}
      {block.notes && !isEditable && (
        <div className="mx-4 mb-2 rounded-lg bg-primary/10 px-3 py-2 flex items-center gap-2">
          <NotebookPen className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs text-foreground">{block.notes}</span>
        </div>
      )}
      {isEditable && (
        <div className="mx-4 mb-2">
          <Input
            placeholder="Add notes..."
            value={block.notes ?? ""}
            onChange={(e) => props.onUpdateNotes(block.clientId, e.target.value)}
            className="text-xs h-8 bg-primary/5"
          />
        </div>
      )}

      {/* Set rows */}
      <div className="px-4 pb-2">
        {/* Column headers */}
        <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wide mb-1 px-1">
          <span>Set</span>
          <span>Duration</span>
          <span>Break</span>
          <span />
        </div>

        {block.sets.map((s, i) => (
          <div key={i}>
            {/* Set row */}
            <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 items-center py-1.5 px-1">
              <span className="text-xs font-mono text-muted-foreground">{i + 1}</span>
              {isEditable ? (
                <>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={Math.round(s.durationSeconds / 60)}
                    onChange={(e) => {
                      const mins = Number(e.target.value);
                      if (mins >= 1 && mins <= 120) {
                        props.onUpdateDuration(block.clientId, i, mins * 60);
                      }
                    }}
                    className="h-7 text-xs"
                    aria-label={`Set ${i + 1} duration`}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={Math.round(s.breakSeconds / 60)}
                    onChange={(e) => {
                      const mins = Number(e.target.value);
                      if (mins >= 0 && mins <= 60) {
                        props.onUpdateBreak(block.clientId, i, mins * 60);
                      }
                    }}
                    className="h-7 text-xs"
                    aria-label={`Set ${i + 1} break`}
                  />
                  {block.sets.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => props.onRemoveSet(block.clientId, i)}
                      aria-label={`Remove set ${i + 1}`}
                      className="h-6 w-6"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  ) : (
                    <span />
                  )}
                </>
              ) : (
                <>
                  <span className="text-sm text-foreground">{formatMinutes(s.durationSeconds)}</span>
                  {s.breakSeconds > 0 ? (
                    <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                      <Pause className="h-3 w-3" />
                      {formatMinutes(s.breakSeconds)} break
                    </span>
                  ) : (
                    <span />
                  )}
                  <span />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add set button */}
      {isEditable && (
        <button
          onClick={() => props.onAddSet(block.clientId)}
          disabled={maxSets}
          className="w-full py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-t border-border disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-3 w-3 inline mr-1" />
          Add a Set
        </button>
      )}
    </Card>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/RoutineBlockCard.test.tsx`
Expected: PASS — may need minor adjustments based on exact rendering

- [ ] **Step 5: Commit**

```bash
git add src/components/RoutineBlockCard.tsx src/components/RoutineBlockCard.test.tsx
git commit -m "feat: add RoutineBlockCard component with readonly and editable modes"
```

---

## Task 9: HabitPicker and HabitBlockConfigForm Components

**Files:**
- Create: `src/components/HabitPicker.tsx`
- Create: `src/components/HabitBlockConfigForm.tsx`
- Create: `src/components/HabitPicker.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/HabitPicker.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HabitPicker } from "./HabitPicker";

const mockHabits = [
  { id: 1, name: "Guitar", todaySeconds: 0, totalSeconds: 0, streak: 0, activeTimer: null },
  { id: 2, name: "Reading", todaySeconds: 0, totalSeconds: 0, streak: 0, activeTimer: null },
  { id: 3, name: "Coding", todaySeconds: 0, totalSeconds: 0, streak: 0, activeTimer: null },
];

describe("HabitPicker", () => {
  it("renders habits in alphabetical order", () => {
    render(
      <HabitPicker
        habits={mockHabits}
        onSelectHabit={vi.fn()}
        onClose={vi.fn()}
        onCreateHabit={vi.fn()}
      />
    );
    const items = screen.getAllByRole("button", { name: /Coding|Guitar|Reading/i });
    expect(items[0]).toHaveTextContent("Coding");
    expect(items[1]).toHaveTextContent("Guitar");
    expect(items[2]).toHaveTextContent("Reading");
  });

  it("filters habits by search", async () => {
    render(
      <HabitPicker
        habits={mockHabits}
        onSelectHabit={vi.fn()}
        onClose={vi.fn()}
        onCreateHabit={vi.fn()}
      />
    );
    await userEvent.type(screen.getByPlaceholderText(/search/i), "gui");
    expect(screen.getByText("Guitar")).toBeInTheDocument();
    expect(screen.queryByText("Reading")).not.toBeInTheDocument();
    expect(screen.queryByText("Coding")).not.toBeInTheDocument();
  });

  it("calls onSelectHabit when habit clicked", async () => {
    const onSelectHabit = vi.fn();
    render(
      <HabitPicker
        habits={mockHabits}
        onSelectHabit={onSelectHabit}
        onClose={vi.fn()}
        onCreateHabit={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Guitar/i }));
    expect(onSelectHabit).toHaveBeenCalledWith({ id: 1, name: "Guitar" });
  });

  it("shows empty state when no habits exist", () => {
    render(
      <HabitPicker
        habits={[]}
        onSelectHabit={vi.fn()}
        onClose={vi.fn()}
        onCreateHabit={vi.fn()}
      />
    );
    expect(screen.getByText(/no habits/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/HabitPicker.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement HabitPicker**

Create `src/components/HabitPicker.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, X } from "lucide-react";
import type { Habit } from "@/lib/types";

type HabitPickerProps = {
  habits: Habit[];
  onSelectHabit: (habit: { id: number; name: string }) => void;
  onClose: () => void;
  onCreateHabit: (name: string) => Promise<void>;
};

export function HabitPicker({
  habits,
  onSelectHabit,
  onClose,
  onCreateHabit,
}: HabitPickerProps) {
  const [search, setSearch] = useState("");
  const [newHabitName, setNewHabitName] = useState("");
  const [creating, setCreating] = useState(false);

  const sorted = [...habits].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const filtered = sorted.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreateHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!newHabitName.trim()) return;
    setCreating(true);
    await onCreateHabit(newHabitName.trim());
    setNewHabitName("");
    setCreating(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Select Habit</h3>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search habits..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Create new habit */}
      <form onSubmit={handleCreateHabit} className="px-4 pb-3 flex gap-2">
        <Input
          placeholder="Create new habit..."
          value={newHabitName}
          onChange={(e) => setNewHabitName(e.target.value)}
          className="h-8 text-sm flex-1"
          maxLength={30}
        />
        <Button type="submit" size="sm" disabled={creating || !newHabitName.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </form>

      {/* Habit list */}
      <div className="flex-1 overflow-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-8">
            {habits.length === 0
              ? "No habits yet. Create one above."
              : "No habits match your search."}
          </p>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((habit) => (
              <button
                key={habit.id}
                onClick={() => onSelectHabit({ id: habit.id, name: habit.name })}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
                aria-label={habit.name}
              >
                {habit.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement HabitBlockConfigForm**

Create `src/components/HabitBlockConfigForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

type HabitBlockConfigFormProps = {
  habitName: string;
  onAdd: (config: {
    sets: number;
    durationMinutes: number;
    breakMinutes: number;
    notes: string | null;
  }) => void;
  onBack: () => void;
};

export function HabitBlockConfigForm({
  habitName,
  onAdd,
  onBack,
}: HabitBlockConfigFormProps) {
  const [sets, setSets] = useState(3);
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({
      sets,
      durationMinutes,
      breakMinutes,
      notes: notes.trim() || null,
    });
  }

  const isValid = sets >= 1 && sets <= 10 && durationMinutes >= 1 && durationMinutes <= 120 && breakMinutes >= 0 && breakMinutes <= 60;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold">{habitName}</h3>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col px-4 py-4 gap-4">
        <div>
          <Label htmlFor="notes" className="text-xs">Notes</Label>
          <textarea
            id="notes"
            placeholder="Any specific topics or resources to focus on?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y min-h-[60px] focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="sets" className="text-xs">Number of Sets*</Label>
            <Input
              id="sets"
              type="number"
              min={1}
              max={10}
              value={sets}
              onChange={(e) => setSets(Number(e.target.value))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="duration" className="text-xs">Duration (minutes)*</Label>
            <Input
              id="duration"
              type="number"
              min={1}
              max={120}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="mt-1"
            />
          </div>
        </div>

        <div className="w-1/2">
          <Label htmlFor="break" className="text-xs">Break (minutes)*</Label>
          <Input
            id="break"
            type="number"
            min={0}
            max={60}
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(Number(e.target.value))}
            className="mt-1"
          />
        </div>

        <div className="mt-auto flex gap-2 pt-4">
          <Button type="submit" disabled={!isValid}>
            Add to Routine
          </Button>
          <Button type="button" variant="ghost" onClick={onBack}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/HabitPicker.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/HabitPicker.tsx src/components/HabitBlockConfigForm.tsx src/components/HabitPicker.test.tsx
git commit -m "feat: add HabitPicker and HabitBlockConfigForm components"
```

---

## Task 10: RoutineStickyHeader Component

**Files:**
- Create: `src/components/RoutineStickyHeader.tsx`

- [ ] **Step 1: Implement RoutineStickyHeader**

Create `src/components/RoutineStickyHeader.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Clock, Layers } from "lucide-react";

type RoutineStickyHeaderProps = {
  totalMinutes: number;
  habitCount: number;
  onDiscard: () => void;
  onSave: () => void;
  isSaving: boolean;
  canSave: boolean;
};

export function RoutineStickyHeader({
  totalMinutes,
  habitCount,
  onDiscard,
  onSave,
  isSaving,
  canSave,
}: RoutineStickyHeaderProps) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {timeDisplay}
          </span>
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" />
            {habitCount} {habitCount === 1 ? "habit" : "habits"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDiscard}>
            Discard
          </Button>
          <Button size="sm" onClick={onSave} disabled={!canSave || isSaving}>
            {isSaving ? "Saving..." : "Save Routine"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RoutineStickyHeader.tsx
git commit -m "feat: add RoutineStickyHeader component"
```

---

## Task 11: RoutineBuilder Component

**Files:**
- Create: `src/components/RoutineBuilder.tsx`
- Create: `src/components/RoutineBuilder.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/components/RoutineBuilder.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRoutineBuilderStore } from "@/stores/routine-builder-store";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock hooks
vi.mock("@/hooks/use-habits", () => ({
  useHabits: () => ({
    data: [
      { id: 1, name: "Guitar", todaySeconds: 0, totalSeconds: 0, streak: 0, activeTimer: null },
    ],
  }),
}));

vi.mock("@/hooks/use-routines", () => ({
  useCreateRoutine: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
  useUpdateRoutine: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}));

vi.mock("@/hooks/use-haptics", () => ({
  useHaptics: () => ({ trigger: vi.fn() }),
}));

// Need to mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { RoutineBuilder } from "./RoutineBuilder";

describe("RoutineBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRoutineBuilderStore.getState().initEmpty();
  });

  it("renders name input with placeholder", () => {
    render(<RoutineBuilder mode="create" />);
    expect(screen.getByPlaceholderText(/untitled routine/i)).toBeInTheDocument();
  });

  it("renders add habits button", () => {
    render(<RoutineBuilder mode="create" />);
    expect(screen.getByText(/add habits/i)).toBeInTheDocument();
  });

  it("renders sticky header with stats", () => {
    render(<RoutineBuilder mode="create" />);
    expect(screen.getByText("0m")).toBeInTheDocument();
    expect(screen.getByText(/0 habits/i)).toBeInTheDocument();
  });

  it("renders discard and save buttons", () => {
    render(<RoutineBuilder mode="create" />);
    expect(screen.getByText(/discard/i)).toBeInTheDocument();
    expect(screen.getByText(/save routine/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/RoutineBuilder.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement RoutineBuilder**

Create `src/components/RoutineBuilder.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RoutineStickyHeader } from "@/components/RoutineStickyHeader";
import { RoutineBlockCard } from "@/components/RoutineBlockCard";
import { HabitPicker } from "@/components/HabitPicker";
import { HabitBlockConfigForm } from "@/components/HabitBlockConfigForm";
import { useRoutineBuilderStore } from "@/stores/routine-builder-store";
import { useHabits } from "@/hooks/use-habits";
import { useAddHabit } from "@/hooks/use-habits";
import { useCreateRoutine, useUpdateRoutine } from "@/hooks/use-routines";
import { useHaptics } from "@/hooks/use-haptics";

type PickerView =
  | { type: "closed" }
  | { type: "list" }
  | { type: "config"; habitId: number; habitName: string };

type RoutineBuilderProps = {
  mode: "create" | "edit";
};

export function RoutineBuilder({ mode }: RoutineBuilderProps) {
  const router = useRouter();
  const { trigger } = useHaptics();
  const { data: habits } = useHabits();
  const addHabit = useAddHabit();
  const createRoutine = useCreateRoutine();
  const updateRoutine = useUpdateRoutine();

  const {
    routineId,
    name,
    blocks,
    isDirty,
    setName,
    addBlock,
    removeBlock,
    updateBlockNotes,
    addSet,
    removeSet,
    updateSetDuration,
    updateSetBreak,
    toPayload,
  } = useRoutineBuilderStore();

  const [pickerView, setPickerView] = useState<PickerView>({ type: "closed" });
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const isSaving = createRoutine.isPending || updateRoutine.isPending;
  const canSave = name.trim().length > 0 && blocks.length > 0;

  const totalMinutes = useMemo(() => {
    let total = 0;
    for (const block of blocks) {
      for (const s of block.sets) {
        total += s.durationSeconds + s.breakSeconds;
      }
    }
    return Math.round(total / 60);
  }, [blocks]);

  // beforeunload handler
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleDiscard = useCallback(() => {
    if (isDirty) {
      setShowDiscardDialog(true);
    } else {
      router.push("/routines");
    }
  }, [isDirty, router]);

  const handleConfirmDiscard = useCallback(() => {
    setShowDiscardDialog(false);
    router.push("/routines");
  }, [router]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    try {
      const payload = toPayload();
      if (mode === "create") {
        await createRoutine.mutateAsync(payload);
        toast.success("Routine created");
      } else {
        await updateRoutine.mutateAsync({ id: routineId!, ...payload });
        toast.success("Routine updated");
      }
      trigger("success");
      router.push("/routines");
    } catch {
      toast.error("Failed to save routine");
    }
  }, [canSave, mode, routineId, toPayload, createRoutine, updateRoutine, trigger, router]);

  const handleSelectHabit = useCallback(
    (habit: { id: number; name: string }) => {
      setPickerView({ type: "config", habitId: habit.id, habitName: habit.name });
    },
    []
  );

  const handleAddBlock = useCallback(
    (config: {
      sets: number;
      durationMinutes: number;
      breakMinutes: number;
      notes: string | null;
    }) => {
      if (pickerView.type !== "config") return;
      addBlock({
        habitId: pickerView.habitId,
        habitName: pickerView.habitName,
        notes: config.notes,
        sets: Array.from({ length: config.sets }, () => ({
          durationSeconds: config.durationMinutes * 60,
          breakSeconds: config.breakMinutes * 60,
        })),
      });
      trigger("success");
      setPickerView({ type: "closed" });
    },
    [pickerView, addBlock, trigger]
  );

  const handleCreateHabit = useCallback(
    async (habitName: string) => {
      await addHabit.mutateAsync(habitName);
    },
    [addHabit]
  );

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <RoutineStickyHeader
        totalMinutes={totalMinutes}
        habitCount={blocks.length}
        onDiscard={handleDiscard}
        onSave={handleSave}
        isSaving={isSaving}
        canSave={canSave}
      />

      <div className="flex-1 py-4 space-y-4">
        {/* Routine name */}
        <Input
          placeholder="Untitled Routine"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="text-lg font-semibold h-12 border-none shadow-none focus-visible:ring-0 px-0 placeholder:text-muted-foreground/50"
        />

        {/* Habit blocks */}
        <AnimatePresence initial={false}>
          {blocks.map((block) => (
            <motion.div
              key={block.clientId}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <RoutineBlockCard
                block={block}
                mode="editable"
                onRemoveBlock={removeBlock}
                onAddSet={addSet}
                onRemoveSet={removeSet}
                onUpdateDuration={updateSetDuration}
                onUpdateBreak={updateSetBreak}
                onUpdateNotes={updateBlockNotes}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add habits button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setPickerView({ type: "list" })}
          disabled={blocks.length >= 20}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Habits
        </Button>
      </div>

      {/* Habit picker modal */}
      {pickerView.type !== "closed" && (
        <div className="fixed inset-0 z-50 bg-background">
          {pickerView.type === "list" ? (
            <HabitPicker
              habits={habits}
              onSelectHabit={handleSelectHabit}
              onClose={() => setPickerView({ type: "closed" })}
              onCreateHabit={handleCreateHabit}
            />
          ) : (
            <HabitBlockConfigForm
              habitName={pickerView.habitName}
              onAdd={handleAddBlock}
              onBack={() => setPickerView({ type: "list" })}
            />
          )}
        </div>
      )}

      {/* Discard confirmation */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleConfirmDiscard}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/RoutineBuilder.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/RoutineBuilder.tsx src/components/RoutineBuilder.test.tsx
git commit -m "feat: add RoutineBuilder component with picker modal and discard flow"
```

---

## Task 12: RoutinesView Rewrite (List Page)

**Files:**
- Rewrite: `src/components/RoutinesView.tsx`

- [ ] **Step 1: Rewrite RoutinesView**

Rewrite `src/components/RoutinesView.tsx`:

```tsx
"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRoutines, useDeleteRoutine } from "@/hooks/use-routines";
import { useHaptics } from "@/hooks/use-haptics";
import type { Routine } from "@/lib/types";

const ROW_COLORS = [
  "bg-primary/20",
  "bg-primary/30",
  "bg-primary/10",
  "bg-primary/15",
  "bg-primary/25",
];

function RoutineCard({ routine }: { routine: Routine }) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteRoutine = useDeleteRoutine();
  const { trigger } = useHaptics();

  const totalSeconds = routine.blocks.reduce(
    (acc, block) =>
      acc + block.sets.reduce((s, set) => s + set.durationSeconds + set.breakSeconds, 0),
    0
  );
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  async function handleDelete() {
    try {
      await deleteRoutine.mutateAsync(routine.id);
      trigger("success");
      toast.success("Routine deleted");
    } catch {
      toast.error("Failed to delete routine");
    }
  }

  return (
    <>
      <Link href={`/routines/${routine.id}`}>
        <Card className="p-5 hover:shadow-md transition-shadow cursor-pointer relative group">
          {/* Action icons */}
          <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Link
              href={`/routines/${routine.id}/edit`}
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" size="icon-sm" aria-label="Edit routine">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete routine"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <p className="text-sm font-semibold text-foreground mb-4">
            {routine.name}
          </p>
          <div className="space-y-3">
            {routine.blocks.map((block, i) => (
              <div
                key={block.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${ROW_COLORS[i % ROW_COLORS.length]}`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/40 flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {block.habitName}
                  </span>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {block.sets.length} {block.sets.length === 1 ? "set" : "sets"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="text-sm font-mono font-semibold text-foreground">
              {timeDisplay}
            </span>
          </div>
        </Card>
      </Link>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete routine?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{routine.name}&rdquo;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function RoutinesView({ initialRoutines }: { initialRoutines?: Routine[] }) {
  const { data: routines } = useRoutines(initialRoutines);

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Your Routines</h2>
        <Link href="/routines/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Routine
          </Button>
        </Link>
      </div>
      {routines.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">
          No routines yet. Create your first practice routine.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence initial={false}>
            {routines.map((routine) => (
              <motion.div
                key={routine.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <RoutineCard routine={routine} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RoutinesView.tsx
git commit -m "feat: rewrite RoutinesView with real data, delete confirmation, and edit/delete icons"
```

---

## Task 13: RoutineDetailView Component

**Files:**
- Create: `src/components/RoutineDetailView.tsx`

- [ ] **Step 1: Implement RoutineDetailView**

Create `src/components/RoutineDetailView.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ArrowLeft, Clock, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoutineBlockCard } from "@/components/RoutineBlockCard";
import { useRoutine } from "@/hooks/use-routines";
import type { Routine } from "@/lib/types";

export function RoutineDetailView({
  routineId,
  initialRoutine,
}: {
  routineId: number;
  initialRoutine?: Routine;
}) {
  const { data: routine } = useRoutine(routineId, initialRoutine);

  const totalSeconds = routine.blocks.reduce(
    (acc, block) =>
      acc + block.sets.reduce((s, set) => s + set.durationSeconds + set.breakSeconds, 0),
    0
  );
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <div className="py-4">
      {/* Back link */}
      <Link href="/routines" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Routines
      </Link>

      {/* Header */}
      <h2 className="text-lg font-semibold mb-2">{routine.name}</h2>
      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-6">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {timeDisplay}
        </span>
        <span className="flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" />
          {routine.blocks.length} {routine.blocks.length === 1 ? "habit" : "habits"}
        </span>
      </div>

      {/* Blocks */}
      <div className="space-y-3">
        {routine.blocks.map((block) => (
          <RoutineBlockCard
            key={block.id}
            block={{ clientId: String(block.id), ...block }}
            mode="readonly"
          />
        ))}
      </div>

      {routine.blocks.length === 0 && (
        <p className="text-center text-muted-foreground py-12">
          This routine has no habits. Edit it to add some.
        </p>
      )}

      {/* Start Routine button — placeholder for future */}
      <div className="mt-6">
        <Button className="w-full" disabled>
          Start Routine (Coming Soon)
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/RoutineDetailView.tsx
git commit -m "feat: add RoutineDetailView component"
```

---

## Task 14: Page Routes

**Files:**
- Modify: `src/app/(app)/routines/page.tsx`
- Create: `src/app/(app)/routines/[id]/page.tsx`
- Create: `src/app/(app)/routines/new/page.tsx`
- Create: `src/app/(app)/routines/[id]/edit/page.tsx`

- [ ] **Step 1: Update routines list page**

Rewrite `src/app/(app)/routines/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUserId } from "@/lib/auth";
import { getRoutinesForUser } from "@/server/db/routines";
import { RoutinesView } from "@/components/RoutinesView";
import { Spinner } from "@/components/Spinner";

export default async function RoutinesPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const routines = await getRoutinesForUser(userId);

  return (
    <Suspense fallback={<Spinner />}>
      <RoutinesView initialRoutines={routines} />
    </Suspense>
  );
}
```

- [ ] **Step 2: Create detail page**

Create `src/app/(app)/routines/[id]/page.tsx`:

```tsx
import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { getSessionUserId } from "@/lib/auth";
import { getRoutineById } from "@/server/db/routines";
import { RoutineDetailView } from "@/components/RoutineDetailView";
import { Spinner } from "@/components/Spinner";

export default async function RoutineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  const routine = await getRoutineById(Number(id), userId);
  if (!routine) notFound();

  return (
    <Suspense fallback={<Spinner />}>
      <RoutineDetailView routineId={routine.id} initialRoutine={routine} />
    </Suspense>
  );
}
```

- [ ] **Step 3: Create new routine page**

Create `src/app/(app)/routines/new/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUserId } from "@/lib/auth";
import { getHabitsForUser } from "@/server/db/habits";
import { Spinner } from "@/components/Spinner";
import { RoutineBuilderPage } from "@/components/RoutineBuilderPage";

export default async function NewRoutinePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  return (
    <Suspense fallback={<Spinner />}>
      <RoutineBuilderPage mode="create" />
    </Suspense>
  );
}
```

- [ ] **Step 4: Create edit routine page**

Create `src/app/(app)/routines/[id]/edit/page.tsx`:

```tsx
import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { getSessionUserId } from "@/lib/auth";
import { getRoutineById } from "@/server/db/routines";
import { Spinner } from "@/components/Spinner";
import { RoutineBuilderPage } from "@/components/RoutineBuilderPage";

export default async function EditRoutinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const { id } = await params;
  const routine = await getRoutineById(Number(id), userId);
  if (!routine) notFound();

  return (
    <Suspense fallback={<Spinner />}>
      <RoutineBuilderPage mode="edit" routine={routine} />
    </Suspense>
  );
}
```

- [ ] **Step 5: Create RoutineBuilderPage wrapper**

This client component initializes the Zustand store and renders the builder. Create `src/components/RoutineBuilderPage.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRoutineBuilderStore } from "@/stores/routine-builder-store";
import { RoutineBuilder } from "@/components/RoutineBuilder";
import type { Routine } from "@/lib/types";

type Props =
  | { mode: "create"; routine?: never }
  | { mode: "edit"; routine: Routine };

export function RoutineBuilderPage({ mode, routine }: Props) {
  const { initEmpty, initFromRoutine } = useRoutineBuilderStore();

  useEffect(() => {
    if (mode === "create") {
      initEmpty();
    } else {
      initFromRoutine(routine);
    }
  }, [mode, routine, initEmpty, initFromRoutine]);

  return <RoutineBuilder mode={mode} />;
}
```

- [ ] **Step 6: Verify build**

Run: `npx next build`
Expected: Build succeeds with no errors (or only pre-existing warnings)

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/routines/ src/components/RoutineBuilderPage.tsx
git commit -m "feat: add routines page routes (list, detail, new, edit)"
```

---

## Task 15: Integration Testing and Polish

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run the dev server and manually test**

Run: `npx next dev`

Manual test checklist:
1. Navigate to `/routines` — should show empty state with "New Routine" button
2. Click "New Routine" — should go to `/routines/new` with builder
3. Type a routine name
4. Click "Add Habits" — should open habit picker
5. Select a habit — should show config form
6. Fill in sets/duration/break/notes and click "Add to Routine"
7. Verify habit block appears with correct data
8. Edit a duration inline
9. Add another set via "+ Add a Set"
10. Click "Save Routine" — should redirect to `/routines` with new card
11. Click on routine card — should show detail view
12. Click edit icon — should open builder with pre-populated data
13. Make a change and save
14. Click delete icon — should show confirmation, then delete

- [ ] **Step 3: Fix any issues found during manual testing**

Address any styling, behavior, or data issues discovered.

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix: address issues found during integration testing"
```

---

## Task 16: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run build**

Run: `npx next build`
Expected: Build succeeds

- [ ] **Step 3: Commit if needed**

Only if there are uncommitted fixes from the verification step.
