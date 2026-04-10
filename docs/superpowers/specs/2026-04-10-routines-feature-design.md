# Routines Feature Design

## Overview

Users can create, update, and delete routines — reusable templates composed of habit blocks with configurable sets, durations, and breaks. Routines are templates that can later be "started" as timed sessions (session runner is out of scope for this spec but informs component design).

## Design System

All new UI must follow the app's existing pseudo design system:
- **Components**: shadcn/ui (Card, Button, Input, AlertDialog, etc.)
- **Styling**: TailwindCSS 4, terracotta/cream theme (`bg-card`, `text-muted-foreground`, etc.)
- **Animations**: Framer Motion (AnimatePresence, layout animations for add/remove)
- **Icons**: lucide-react
- **Toasts**: sonner (top-center)
- **Haptics**: `useHaptics()` on interactive elements

## Data Model

### `routines` table

| Column    | Type      | Notes                           |
|-----------|-----------|---------------------------------|
| id        | INTEGER   | PK, autoincrement               |
| userId    | INTEGER   | FK → users.id, cascade delete   |
| name      | TEXT      | not null, 1-100 chars           |
| createdAt | TIMESTAMP | not null, default now            |
| updatedAt | TIMESTAMP | not null, default now, on update |

### `routineBlocks` table

| Column    | Type      | Notes                                                    |
|-----------|-----------|----------------------------------------------------------|
| id        | INTEGER   | PK, autoincrement                                        |
| routineId | INTEGER   | FK → routines.id, cascade delete                         |
| habitId   | INTEGER   | FK → habits.id, cascade delete                           |
| sortOrder | INTEGER   | not null, 0-indexed                                      |
| notes     | TEXT      | nullable, max 500 chars                                  |
| sets      | TEXT      | JSON string: `[{durationSeconds, breakSeconds}, ...]`    |
| createdAt | TIMESTAMP | not null, default now                                    |
| updatedAt | TIMESTAMP | not null, default now, on update                         |

**Sets JSON schema**: `Array<{durationSeconds: number, breakSeconds: number}>`
- `durationSeconds`: min 60 (1 min), max 7200 (2 hrs)
- `breakSeconds`: min 0, max 3600 (1 hr)

**Caps**:
- Max 20 blocks per routine
- Max 10 sets per block

**Cascade behavior**: Deleting a habit removes its blocks from routines. A routine with 0 blocks still exists but shows an empty state.

**Durations stored in seconds** (consistent with `timeSessions.durationSeconds`).

## API Routes & Server Functions

### Server functions (`/src/server/db/routines.ts`)

- `getRoutinesForUser(userId)` — all routines with blocks (joined with habit name), ordered by most recently updated
- `getRoutineById(routineId, userId)` — single routine with blocks, auth-checked
- `createRoutineForUser(userId, {name, blocks[]})` — insert routine + blocks in transaction
- `updateRoutineForUser(routineId, userId, {name, blocks[]})` — replace all blocks (delete old, insert new) in transaction
- `deleteRoutineForUser(routineId, userId)` — auth-checked delete, cascade handles blocks

### API routes

| Method | Route                | Purpose      |
|--------|----------------------|--------------|
| GET    | `/api/routines`      | List all      |
| POST   | `/api/routines`      | Create        |
| GET    | `/api/routines/[id]` | Get one       |
| PUT    | `/api/routines/[id]` | Full replace  |
| DELETE | `/api/routines/[id]` | Delete        |

### Zod validation (create/update)

- `name`: string, 1-100 chars, trimmed
- `blocks`: array, 1-20 items
  - `habitId`: number
  - `sortOrder`: number
  - `notes`: string, optional, max 500 chars
  - `sets`: array, 1-10 items
    - `durationSeconds`: number, min 60, max 7200
    - `breakSeconds`: number, min 0, max 3600

Auth check + 401 on every route. Zod parse + 400 on invalid input.

### React Query hooks (`/src/hooks/use-routines.ts`)

- `useRoutines(initialData?)` — useSuspenseQuery, list
- `useRoutine(id, initialData?)` — useSuspenseQuery, single
- `useCreateRoutine()` — mutation, invalidates list
- `useUpdateRoutine()` — mutation, invalidates list + single
- `useDeleteRoutine()` — mutation, invalidates list, optimistic removal with rollback

Query keys added to `/src/lib/query-keys.ts`:
```
routines: {
  all: ['routines'],
  detail: (id) => ['routines', id]
}
```

## Routing

| Route                  | Type        | Purpose                        |
|------------------------|-------------|--------------------------------|
| `/routines`            | Server page | List view                      |
| `/routines/[id]`       | Server page | Read-only detail view          |
| `/routines/new`        | Server page | Builder (create mode)          |
| `/routines/[id]/edit`  | Server page | Builder (edit mode)            |

Each page: auth check → server-side data fetch → pass to client component via Suspense.

## Zustand Builder Store

File: `/src/stores/routine-builder-store.ts`

### State

```
routineId: number | null          // null = create, set = edit
name: string
blocks: BuilderBlock[]
isDirty: boolean

BuilderBlock:
  clientId: string                // temp UUID for React keys
  habitId: number
  habitName: string
  notes: string | null
  sets: BuilderSet[]

BuilderSet:
  durationSeconds: number
  breakSeconds: number
```

### Actions

- `initEmpty()` — reset for create mode
- `initFromRoutine(routine)` — hydrate from existing routine for edit
- `setName(name)`
- `addBlock(block)` — appends, sets isDirty
- `removeBlock(clientId)` — removes, sets isDirty
- `updateBlockNotes(clientId, notes)`
- `addSet(clientId)` — adds set to block (up to 10)
- `removeSet(clientId, setIndex)`
- `updateSetDuration(clientId, setIndex, durationSeconds)`
- `updateSetBreak(clientId, setIndex, breakSeconds)`
- `moveBlock(fromIndex, toIndex)` — reorder
- `toPayload()` — converts to API request body

### Computed (derived in components)

- Total minutes: sum of all durationSeconds + breakSeconds across all blocks/sets
- Habit count: `blocks.length`

## Components

| Component              | File (new/update) | Purpose                                                            |
|------------------------|--------------------|--------------------------------------------------------------------|
| `RoutinesView`         | Update existing    | List of routine cards, delete/edit icons, "New Routine" button     |
| `RoutineDetailView`    | New                | Read-only expanded view, all blocks, future "Start Routine" button |
| `RoutineBuilder`       | New                | Builder for create/edit. Receives optional initial data for edit   |
| `RoutineBlockCard`     | New                | Habit block display. `mode: "readonly" \| "editable"`              |
| `HabitPicker`          | New                | Modal with searchable habit list + inline habit creation           |
| `HabitBlockConfigForm` | New                | Config form: sets, duration, break, notes. Sets defaults for block |
| `RoutineStickyHeader`  | New                | Sticky header: name input, stats, discard/save buttons             |

### Component reuse for future session runner

`RoutineBlockCard` accepts a `mode` prop. Future `"session"` mode will add checkmarks, active set highlighting, and timer integration without major refactoring.

## UI Flows

### Routine List Page (`/routines`)

- Preserve existing routine card design from `RoutinesView.tsx`
- Grid: 1-col mobile, 2-col desktop
- Each card: routine name, habit count, total duration, preview of habit names
- Top-right of each card: edit icon (→ `/routines/[id]/edit`) + delete icon (→ confirmation dialog)
- "New Routine" button at page top
- Empty state when no routines
- Framer Motion entry/exit animations on cards
- Optimistic delete with rollback on failure

### Routine Detail Page (`/routines/[id]`)

- Routine name as heading
- Total duration + habit count stats
- Ordered list of `RoutineBlockCard` in readonly mode
- Each block: habit name header, notes banner (cream/peach background, pencil icon, if notes exist), set rows (set number + duration), break rows
- **Break rows visually distinct**: muted background, smaller row height, pause icon, muted/italic text
- "Start Routine" button (disabled placeholder for now)
- Back navigation to list

### Builder View (`/routines/new`, `/routines/[id]/edit`)

**Sticky header**:
- Left: total minutes, number of habits
- Right: "Discard" button (ghost/outline), "Save Routine" button (primary)

**Below header**:
- Large text input for routine name, placeholder "Untitled Routine"
- List of `RoutineBlockCard` in editable mode:
  - Habit name header
  - Notes banner (editable)
  - Set rows with **inline-editable** duration and break per row
  - Each set's duration is independent (e.g., Set 1 = 25 min, Set 2 = 15 min)
  - Each set's break is independent and inline-editable
  - Break rows visually distinct (muted bg, smaller, pause icon)
  - Delete icon top-right of block
  - "+ Add a Set" at bottom of block (disabled at 10 sets)
- "Add Habits" button → opens HabitPicker

**Discard flow**: if `isDirty`, show AlertDialog confirmation. If confirmed or not dirty, navigate back to `/routines`.

**beforeunload**: register handler when `isDirty` to catch browser refresh/navigation.

**Save flow**: validate client-side (name not empty, at least 1 block), call create/update mutation, navigate to `/routines` on success, toast on error.

### Habit Picker Modal

- Search input at top (client-side filter)
- "Create new habit" inline input below search (name only, uses existing `useAddHabit` hook)
- Alphabetical list of all user's habits
- On tap → slides to HabitBlockConfigForm

### Habit Block Config Form

- Fields: Number of Sets (required), Duration per set in minutes (required), Break per set in minutes (required, can be 0), Notes (optional)
- These values set the **defaults** for all sets in the block. User edits individual sets inline after adding.
- "Add to Routine" button → adds block to builder store, closes modal
- "Cancel" → back to habit picker

## Edge Cases

- **Habit deleted while in routine**: cascade removes block. Routine with 0 blocks shows empty state prompting user to add habits.
- **Save with no blocks**: Save button disabled. Server enforces min 1 block.
- **Save with empty name**: Save button disabled. Server enforces 1-100 chars.
- **Duplicate habit blocks**: allowed — same habit can appear multiple times.
- **Browser refresh/navigate with unsaved changes**: `beforeunload` handler when `isDirty`.
- **Optimistic delete on list**: remove card immediately, rollback on API failure.
- **Caps enforced**: 20 blocks (disable "Add Habits" at limit), 10 sets per block (disable "+ Add a Set" at limit). Server-side Zod enforces both.
