# 10,000 Hours - Architecture

A habit tracking app for logging practice time toward skill mastery (the "10,000-hour rule").

## Tech Stack

| Layer        | Tech                                      |
| ------------ | ----------------------------------------- |
| Framework    | Next.js 16 (App Router, SSR)              |
| Frontend     | React 19, TypeScript, TailwindCSS 4       |
| Components   | shadcn/ui (Radix primitives)              |
| Data Layer   | TanStack React Query v5                   |
| Forms        | React Hook Form + Zod                     |
| Database     | Turso (cloud SQLite) via LibSQL           |
| ORM          | Drizzle                                   |
| Auth         | Custom JWT (jose) + bcryptjs, HTTP-only cookies |
| Testing      | Vitest (unit), Playwright (E2E)           |

## Directory Map

```
src/
├── app/
│   ├── api/                 # API routes (serverless)
│   │   ├── auth/            # login, signup, logout, me
│   │   ├── habits/          # CRUD + [id] delete
│   │   ├── timer/           # start, stop
│   │   ├── sessions/        # list (filtered) + manual log
│   │   └── rankings/        # habits ranked by total time
│   ├── (app)/               # Protected pages (shared layout w/ tab nav)
│   │   ├── dashboard/       # Habit cards, start timer, log session
│   │   ├── sessions/        # Session history + calendar view
│   │   └── rankings/        # Leaderboard of habits by time
│   ├── (timer)/             # Full-screen timer (separate layout, no nav)
│   │   └── timer/
│   ├── login/               # Auth page (login/signup toggle)
│   └── middleware.ts        # JWT verification, route protection
├── components/
│   ├── ui/                  # shadcn primitives (button, card, input, etc.)
│   ├── Dashboard.tsx        # Main view: habit cards + modals
│   ├── HabitCard.tsx        # Single habit w/ live timer, actions
│   ├── TimerView.tsx        # Countdown/stopwatch + success screen
│   ├── AuthForm.tsx         # Login/signup form
│   ├── SessionsView.tsx     # Filtered session list + calendar toggle
│   ├── CalendarView.tsx     # Calendar heatmap of sessions
│   ├── RankingsView.tsx     # Ranked habits display
│   ├── StartTimerModal.tsx  # Pick stopwatch vs countdown
│   ├── LogSessionModal.tsx  # Manual session entry
│   ├── AddHabitForm.tsx     # Create new habit
│   ├── TabNav.tsx           # Bottom nav (Skills | Sessions | Rankings)
│   └── Providers.tsx        # React Query provider wrapper
├── hooks/
│   ├── use-habits.ts        # useHabits, useAddHabit, useDeleteHabit
│   ├── use-auth.ts          # useAuth, useLogin, useSignup, useLogout
│   ├── use-sessions.ts      # useSessions, useLogSession
│   ├── use-rankings.ts      # useRankings
│   └── use-haptics.ts       # Mobile vibration wrapper
├── lib/
│   ├── auth.ts              # JWT create/verify, cookie helpers
│   ├── api.ts               # Fetch wrapper w/ error handling
│   ├── queries.ts           # All DB queries (habits, sessions, streaks, rankings)
│   ├── format.ts            # Time formatting (HH:MM:SS, etc.)
│   ├── types.ts             # Shared TypeScript types
│   ├── query-keys.ts        # React Query key factory
│   └── congrats-messages.ts # Random success messages
└── db/
    ├── index.ts             # Drizzle client init (Turso connection)
    └── schema.ts            # Table definitions + relations
```

## Database Schema

```
users
├── id (PK)
├── email (unique)
├── passwordHash
└── createdAt

habits
├── id (PK)
├── userId → users.id
├── name
└── createdAt

timeSessions
├── id (PK)
├── habitId → habits.id
├── startTime
├── endTime
├── durationSeconds
└── timerMode ('stopwatch' | 'countdown' | 'manual')

activeTimers
├── id (PK)
├── habitId → habits.id
├── userId → users.id (unique — one timer per user)
├── startTime
└── targetDurationSeconds (null for stopwatch)
```

## Auth Flow

1. User hits a protected route → middleware checks `session` cookie for valid JWT
2. No valid session → redirect to `/login`
3. Login/signup → API hashes password (bcrypt, 10 rounds), creates JWT (30-day expiry), sets HTTP-only cookie
4. All subsequent API calls → `getSession()` extracts + verifies JWT from cookie
5. Logout → cookie cleared, React Query cache invalidated

## Data Flow (React Query)

All server state goes through TanStack React Query hooks:

```
Component → useHabits() → GET /api/habits → queries.ts → Drizzle → Turso
              ↑
         cache (30s stale time)
              ↑
    useStartTimer() → POST /api/timer/start → invalidates ['habits']
```

**Pattern:** Every mutation hook invalidates related query keys on success, triggering automatic refetch.

Query keys are centralized in `lib/query-keys.ts` for consistency.

## API Routes

| Method | Route                | What it does                                    |
| ------ | -------------------- | ----------------------------------------------- |
| POST   | /api/auth/signup     | Create account (email + password)               |
| POST   | /api/auth/login      | Authenticate, return JWT cookie                 |
| GET    | /api/auth/me         | Get current user from JWT                       |
| POST   | /api/auth/logout     | Clear session cookie                            |
| GET    | /api/habits          | All habits w/ today's total, streak, active timer |
| POST   | /api/habits          | Create new habit                                |
| DELETE | /api/habits/[id]     | Delete habit + cascade sessions                 |
| POST   | /api/timer/start     | Start timer (auto-saves previous if switching)  |
| POST   | /api/timer/stop      | Stop timer, save session                        |
| GET    | /api/sessions        | Sessions filtered by habit + date range         |
| POST   | /api/sessions        | Manually log a session (last 7 days only)       |
| GET    | /api/rankings        | Habits ranked by total logged time              |

## Page Structure

```
/login              → AuthForm (public)
/dashboard          → Dashboard with HabitCards, modals (protected)
/timer              → Full-screen TimerView (protected, separate layout)
/sessions           → SessionsView with filters + calendar (protected)
/rankings           → RankingsView with medals (protected)
```

Protected pages share a layout with `TabNav` (bottom navigation) and `LogoutButton`. The timer page uses its own minimal layout (no nav, full screen).

## Key Flows

**Start a timer:**
Dashboard → tap habit → StartTimerModal (pick mode) → POST /api/timer/start → redirect to /timer → live countdown/stopwatch → stop → session saved → success screen with fanfare

**Switch habits mid-timer:**
Start new timer → API transaction auto-saves current session → starts new timer

**Log manually:**
Dashboard → tap "Log" on habit → LogSessionModal → pick date + duration → POST /api/sessions

**Streaks:**
Computed server-side in `queries.ts` — counts consecutive days with at least one session, working backwards from today.

## Environment Variables

```
DATABASE_URL          # SQLite database connection (e.g. file:local.db)
JWT_SECRET            # Secret for signing JWTs
```
