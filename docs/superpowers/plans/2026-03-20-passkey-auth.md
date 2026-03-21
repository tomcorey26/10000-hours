# Passkey-Only Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace password-based auth with passkey-only WebAuthn auth using `@simplewebauthn`.

**Architecture:** Username-based identity with WebAuthn passkeys for auth. Registration and login are two-step flows (get options → verify). JWT sessions remain unchanged — passkeys replace passwords as the way to earn a session.

**Tech Stack:** Next.js 16, `@simplewebauthn/server` + `@simplewebauthn/browser`, Drizzle ORM, libsql/SQLite, vitest

**Spec:** `docs/superpowers/specs/2026-03-20-passkey-auth-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/db/schema.ts` | Drizzle schema: modified users, new passkey_credentials + challenges tables |
| `src/lib/passkey.ts` | WebAuthn RP config constants |
| `src/lib/auth.ts` | JWT session helpers (password utils removed) |
| `src/server/db/users.ts` | User queries (username-based) |
| `src/server/db/passkeys.ts` | Credential CRUD queries |
| `src/server/db/challenges.ts` | Challenge store/retrieve/delete with lazy cleanup |
| `src/app/api/auth/passkey/register-options/route.ts` | Generate registration challenge |
| `src/app/api/auth/passkey/register-verify/route.ts` | Verify attestation, create user + credential |
| `src/app/api/auth/passkey/login-options/route.ts` | Generate authentication challenge |
| `src/app/api/auth/passkey/login-verify/route.ts` | Verify assertion |
| `src/app/api/auth/passkey/list/route.ts` | List user's credentials |
| `src/app/api/auth/passkey/[id]/route.ts` | Delete a credential |
| `src/app/api/auth/me/route.ts` | Return username instead of email |
| `src/hooks/use-auth.ts` | React Query hooks for passkey endpoints |
| `src/components/AuthForm.tsx` | Username + passkey signup/login UI |
| `src/app/account/page.tsx` | Passkey management UI |

---

### Task 1: Dependencies & Cleanup

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install new dependencies**

Run: `npm install @simplewebauthn/server @simplewebauthn/browser`

- [ ] **Step 2: Remove old dependencies**

Run: `npm uninstall bcryptjs @types/bcryptjs`

- [ ] **Step 3: Add env vars to `.env` (or `.env.local`)**

```
RP_ID=localhost
RP_ORIGIN=http://localhost:3000
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.local
git commit -m "feat: add simplewebauthn, remove bcryptjs"
```

---

### Task 2: Schema & Migration

**Files:**
- Modify: `src/db/schema.ts`
- Delete: all files in `drizzle/` (migrations + meta)

- [ ] **Step 1: Delete old migrations**

```bash
rm -rf drizzle/*
```

- [ ] **Step 2: Update schema — modify users table**

In `src/db/schema.ts`, replace the users table. Remove `email` and `passwordHash`, add `username`:

```ts
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

- [ ] **Step 3: Add passkey_credentials table**

```ts
export const passkeyCredentials = sqliteTable('passkey_credentials', {
  id: text('id').primaryKey(), // base64url credential ID
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  publicKey: text('public_key').notNull(), // base64url encoded
  counter: integer('counter').notNull().default(0),
  deviceType: text('device_type').notNull(), // "singleDevice" | "multiDevice"
  backedUp: integer('backed_up', { mode: 'boolean' }).notNull().default(false),
  transports: text('transports'), // JSON array string
  label: text('label'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
```

- [ ] **Step 4: Add challenges table**

```ts
export const challenges = sqliteTable('challenges', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  userId: integer('user_id'),
  challenge: text('challenge').notNull(),
  type: text('type').notNull(), // "registration" | "authentication"
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});
```

- [ ] **Step 5: Add relations for new tables**

```ts
export const passkeyCredentialsRelations = relations(passkeyCredentials, ({ one }) => ({
  user: one(users, { fields: [passkeyCredentials.userId], references: [users.id] }),
}));
```

Update `usersRelations` to include `passkeyCredentials: many(passkeyCredentials)`.

- [ ] **Step 6: Generate fresh migration and apply**

```bash
npm run db:generate
```

Delete the existing database file (find it via `TURSO_DATABASE_URL` in `.env`), then:

```bash
npm run db:migrate
```

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: update schema for passkey auth, fresh migration"
```

---

### Task 3: Passkey Config & Auth Cleanup

**Files:**
- Create: `src/lib/passkey.ts`
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Create passkey config**

Create `src/lib/passkey.ts`:

```ts
export const rpName = "10000 Hours";
export const rpID = process.env.RP_ID!;
export const rpOrigin = process.env.RP_ORIGIN!;
```

- [ ] **Step 2: Clean up auth.ts**

Remove `hashPassword`, `verifyPassword`, and the `bcryptjs` import from `src/lib/auth.ts`. Keep all JWT/session functions unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/lib/passkey.ts src/lib/auth.ts
git commit -m "feat: add passkey config, remove password utils from auth"
```

---

### Task 4: Database Query Layer

**Files:**
- Modify: `src/server/db/users.ts`
- Create: `src/server/db/passkeys.ts`
- Create: `src/server/db/challenges.ts`

- [ ] **Step 1: Write test for getUserByUsername**

Create `src/server/db/users.test.ts`. Use `vi.mock` pattern from existing route tests (mock `@/db`):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGet = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn(() => ({ returning: vi.fn(() => [{ id: 1, username: "testuser" }]) }));

vi.mock("@/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ get: mockGet }) }) }),
    insert: () => ({ values: mockValues }),
  },
}));

import { getUserByUsername } from "./users";

describe("getUserByUsername", () => {
  beforeEach(() => vi.clearAllMocks());

  it("queries by lowercase username", async () => {
    mockGet.mockReturnValue({ id: 1, username: "testuser" });
    const result = getUserByUsername("TestUser");
    expect(result).toEqual({ id: 1, username: "testuser" });
  });
});
```

Note: This is a thin wrapper over Drizzle — keep tests lightweight. The exact mock shape may need adjustment to match Drizzle's chained API. Focus on verifying the lowercase normalization.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/server/db/users.test.ts`
Expected: FAIL

- [ ] **Step 3: Update users.ts**

Replace `src/server/db/users.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export function getUserByUsername(username: string) {
  return db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .get();
}

export async function createUser(username: string) {
  const [user] = await db
    .insert(users)
    .values({ username: username.toLowerCase() })
    .returning();
  return user;
}

export function getUserById(userId: number) {
  return db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .get();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/server/db/users.test.ts`
Expected: PASS

- [ ] **Step 5: Create passkeys.ts**

Create `src/server/db/passkeys.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { passkeyCredentials } from "@/db/schema";

export async function createCredential(data: {
  id: string;
  userId: number;
  publicKey: string;
  counter: number;
  deviceType: string;
  backedUp: boolean;
  transports?: string;
  label?: string;
}) {
  await db.insert(passkeyCredentials).values(data);
}

export function getCredentialById(id: string) {
  return db
    .select()
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.id, id))
    .get();
}

export function getCredentialsByUserId(userId: number) {
  return db
    .select()
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.userId, userId))
    .all();
}

export async function updateCredentialCounter(id: string, counter: number) {
  await db
    .update(passkeyCredentials)
    .set({ counter })
    .where(eq(passkeyCredentials.id, id));
}

export async function deleteCredential(id: string) {
  await db
    .delete(passkeyCredentials)
    .where(eq(passkeyCredentials.id, id));
}

export async function countCredentialsByUserId(userId: number) {
  const creds = await db
    .select()
    .from(passkeyCredentials)
    .where(eq(passkeyCredentials.userId, userId))
    .all();
  return creds.length;
}
```

- [ ] **Step 6: Create challenges.ts**

Create `src/server/db/challenges.ts`:

```ts
import { eq, and, lt } from "drizzle-orm";
import { db } from "@/db";
import { challenges } from "@/db/schema";

export async function storeChallenge(data: {
  username: string;
  userId?: number;
  challenge: string;
  type: "registration" | "authentication";
}) {
  // Lazy cleanup: delete expired challenges
  await db.delete(challenges).where(lt(challenges.expiresAt, new Date()));

  // Delete old challenges for same username+type (handles retries)
  await db.delete(challenges).where(
    and(eq(challenges.username, data.username.toLowerCase()), eq(challenges.type, data.type))
  );

  await db.insert(challenges).values({
    ...data,
    username: data.username.toLowerCase(),
    expiresAt: new Date(Date.now() + 60_000), // 60s
  });
}

export function getChallenge(username: string, type: "registration" | "authentication") {
  return db
    .select()
    .from(challenges)
    .where(and(eq(challenges.username, username.toLowerCase()), eq(challenges.type, type)))
    .get();
}

export async function deleteChallenge(id: number) {
  await db.delete(challenges).where(eq(challenges.id, id));
}
```

- [ ] **Step 7: Commit**

```bash
git add src/server/db/users.ts src/server/db/users.test.ts src/server/db/passkeys.ts src/server/db/challenges.ts
git commit -m "feat: add passkey and challenge db queries, update user queries"
```

---

### Task 5: Registration API Routes

**Files:**
- Create: `src/app/api/auth/passkey/register-options/route.ts`
- Create: `src/app/api/auth/passkey/register-verify/route.ts`
- Create: `src/app/api/auth/passkey/register-options/route.test.ts`
- Create: `src/app/api/auth/passkey/register-verify/route.test.ts`

- [ ] **Step 1: Write test for register-options**

Create `src/app/api/auth/passkey/register-options/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserByUsername, getSessionUserId, storeChallenge, generateRegistrationOptions } = vi.hoisted(() => ({
  getUserByUsername: vi.fn(),
  getSessionUserId: vi.fn(),
  storeChallenge: vi.fn(),
  generateRegistrationOptions: vi.fn(),
}));

vi.mock("@/server/db/users", () => ({ getUserByUsername }));
vi.mock("@/lib/auth", () => ({ getSessionUserId }));
vi.mock("@/server/db/challenges", () => ({ storeChallenge }));
vi.mock("@simplewebauthn/server", () => ({ generateRegistrationOptions }));

import { POST } from "./route";

describe("POST /api/auth/passkey/register-options", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid username", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "ab" }), // too short
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 if username taken", async () => {
    getUserByUsername.mockReturnValue({ id: 1 });
    getSessionUserId.mockResolvedValue(null);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "taken_user" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns registration options for valid new username", async () => {
    getUserByUsername.mockReturnValue(undefined);
    getSessionUserId.mockResolvedValue(null);
    const mockOptions = { challenge: "abc123", rp: { name: "10000 Hours" } };
    generateRegistrationOptions.mockResolvedValue(mockOptions);
    storeChallenge.mockResolvedValue(undefined);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "new_user" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(mockOptions);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/app/api/auth/passkey/register-options/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement register-options route**

Create `src/app/api/auth/passkey/register-options/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getSessionUserId } from "@/lib/auth";
import { getUserByUsername, getUserById } from "@/server/db/users";
import { getCredentialsByUserId } from "@/server/db/passkeys";
import { storeChallenge } from "@/server/db/challenges";
import { rpName, rpID } from "@/lib/passkey";

const usernameSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const parsed = usernameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Username must be 3-30 characters, alphanumeric and underscores only" }, { status: 400 });
  }

  const username = parsed.data.username.toLowerCase();

  // Check if this is an authenticated "add passkey" flow
  const sessionUserId = await getSessionUserId();

  if (!sessionUserId) {
    // Signup flow: check username availability
    const existing = getUserByUsername(username);
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
  }

  // Get existing credentials to exclude (for "add passkey" flow)
  const existingCredentials = sessionUserId
    ? (await getCredentialsByUserId(sessionUserId)).map((c) => ({
        id: c.id,
        transports: c.transports ? JSON.parse(c.transports) : undefined,
      }))
    : [];

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: username,
    excludeCredentials: existingCredentials,
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await storeChallenge({
    username,
    userId: sessionUserId ?? undefined,
    challenge: options.challenge,
    type: "registration",
  });

  return NextResponse.json(options);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/app/api/auth/passkey/register-options/route.test.ts`
Expected: PASS

- [ ] **Step 5: Write test for register-verify**

Create `src/app/api/auth/passkey/register-verify/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getChallenge, deleteChallenge, getSessionUserId, createUser,
  createCredential, setSessionCookie, verifyRegistrationResponse,
  getUserByUsername,
} = vi.hoisted(() => ({
  getChallenge: vi.fn(),
  deleteChallenge: vi.fn(),
  getSessionUserId: vi.fn(),
  createUser: vi.fn(),
  createCredential: vi.fn(),
  setSessionCookie: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  getUserByUsername: vi.fn(),
}));

vi.mock("@/server/db/challenges", () => ({ getChallenge, deleteChallenge }));
vi.mock("@/lib/auth", () => ({ getSessionUserId, setSessionCookie }));
vi.mock("@/server/db/users", () => ({ createUser, getUserByUsername }));
vi.mock("@/server/db/passkeys", () => ({ createCredential }));
vi.mock("@simplewebauthn/server", () => ({ verifyRegistrationResponse }));
vi.mock("@simplewebauthn/server/helpers", () => ({
  isoBase64URL: { fromBuffer: (buf: Uint8Array) => Buffer.from(buf).toString("base64url") },
}));
vi.mock("@/lib/passkey", () => ({ rpID: "localhost", rpOrigin: "http://localhost:3000" }));

import { POST } from "./route";

describe("POST /api/auth/passkey/register-verify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 if no challenge found", async () => {
    getChallenge.mockReturnValue(undefined);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "testuser", attestation: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 if verification fails", async () => {
    getChallenge.mockReturnValue({ id: 1, challenge: "abc", expiresAt: new Date(Date.now() + 60000) });
    verifyRegistrationResponse.mockResolvedValue({ verified: false });
    deleteChallenge.mockResolvedValue(undefined);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "testuser", attestation: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates user and credential on successful signup verification", async () => {
    getSessionUserId.mockResolvedValue(null);
    getUserByUsername.mockReturnValue(undefined);
    getChallenge.mockReturnValue({ id: 1, challenge: "abc", expiresAt: new Date(Date.now() + 60000) });
    verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: { id: "cred-id", publicKey: new Uint8Array([1, 2, 3]), counter: 0 },
        credentialDeviceType: "multiDevice",
        credentialBackedUp: true,
      },
    });
    createUser.mockResolvedValue({ id: 1, username: "testuser" });
    createCredential.mockResolvedValue(undefined);
    deleteChallenge.mockResolvedValue(undefined);
    setSessionCookie.mockResolvedValue(undefined);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "testuser", attestation: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(createUser).toHaveBeenCalledWith("testuser");
    expect(createCredential).toHaveBeenCalled();
    expect(setSessionCookie).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test:unit -- src/app/api/auth/passkey/register-verify/route.test.ts`
Expected: FAIL

- [ ] **Step 7: Implement register-verify route**

Create `src/app/api/auth/passkey/register-verify/route.ts`:

```ts
import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getSessionUserId, setSessionCookie } from "@/lib/auth";
import { createUser, getUserByUsername } from "@/server/db/users";
import { createCredential } from "@/server/db/passkeys";
import { getChallenge, deleteChallenge } from "@/server/db/challenges";
import { rpID, rpOrigin } from "@/lib/passkey";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.username || !body?.attestation) {
    return NextResponse.json({ error: "Missing username or attestation" }, { status: 400 });
  }

  const username = body.username.toLowerCase();
  const stored = getChallenge(username, "registration");

  if (!stored || stored.expiresAt < new Date()) {
    return NextResponse.json({ error: "Challenge not found or expired" }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.attestation,
      expectedChallenge: stored.challenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
    });
  } catch {
    await deleteChallenge(stored.id);
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  await deleteChallenge(stored.id);

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  // Determine userId: existing session (add passkey) or create new user (signup)
  let userId = await getSessionUserId();

  if (!userId) {
    // Double-check username isn't taken (race condition guard)
    const existing = getUserByUsername(username);
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
    const user = await createUser(username);
    userId = user.id;
  }

  await createCredential({
    id: credential.id,
    userId,
    publicKey: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    transports: body.attestation.response?.transports
      ? JSON.stringify(body.attestation.response.transports)
      : undefined,
    label: body.label,
  });

  await setSessionCookie(userId);
  return NextResponse.json({ verified: true });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test:unit -- src/app/api/auth/passkey/register-verify/route.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/app/api/auth/passkey/register-options/ src/app/api/auth/passkey/register-verify/
git commit -m "feat: add passkey registration API routes with tests"
```

---

### Task 6: Login API Routes

**Files:**
- Create: `src/app/api/auth/passkey/login-options/route.ts`
- Create: `src/app/api/auth/passkey/login-verify/route.ts`
- Create: `src/app/api/auth/passkey/login-options/route.test.ts`
- Create: `src/app/api/auth/passkey/login-verify/route.test.ts`

- [ ] **Step 1: Write test for login-options**

Create `src/app/api/auth/passkey/login-options/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserByUsername, getCredentialsByUserId, storeChallenge, generateAuthenticationOptions } = vi.hoisted(() => ({
  getUserByUsername: vi.fn(),
  getCredentialsByUserId: vi.fn(),
  storeChallenge: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
}));

vi.mock("@/server/db/users", () => ({ getUserByUsername }));
vi.mock("@/server/db/passkeys", () => ({ getCredentialsByUserId }));
vi.mock("@/server/db/challenges", () => ({ storeChallenge }));
vi.mock("@simplewebauthn/server", () => ({ generateAuthenticationOptions }));

import { POST } from "./route";

describe("POST /api/auth/passkey/login-options", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 for unknown username", async () => {
    getUserByUsername.mockReturnValue(undefined);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "nobody" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns authentication options for valid user", async () => {
    getUserByUsername.mockReturnValue({ id: 1, username: "testuser" });
    getCredentialsByUserId.mockResolvedValue([{ id: "cred1", transports: '["internal"]' }]);
    const mockOptions = { challenge: "xyz" };
    generateAuthenticationOptions.mockResolvedValue(mockOptions);
    storeChallenge.mockResolvedValue(undefined);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "testuser" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(mockOptions);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/app/api/auth/passkey/login-options/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement login-options route**

Create `src/app/api/auth/passkey/login-options/route.ts`:

```ts
import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getUserByUsername } from "@/server/db/users";
import { getCredentialsByUserId } from "@/server/db/passkeys";
import { storeChallenge } from "@/server/db/challenges";
import { rpID } from "@/lib/passkey";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const username = body.username.toLowerCase();
  const user = getUserByUsername(username);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const credentials = await getCredentialsByUserId(user.id);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((c) => ({
      id: c.id,
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
    userVerification: "preferred",
  });

  await storeChallenge({
    username,
    userId: user.id,
    challenge: options.challenge,
    type: "authentication",
  });

  return NextResponse.json(options);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/app/api/auth/passkey/login-options/route.test.ts`
Expected: PASS

- [ ] **Step 5: Write test for login-verify**

Create `src/app/api/auth/passkey/login-verify/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUserByUsername, getChallenge, deleteChallenge, getCredentialById,
  updateCredentialCounter, setSessionCookie, verifyAuthenticationResponse,
} = vi.hoisted(() => ({
  getUserByUsername: vi.fn(),
  getChallenge: vi.fn(),
  deleteChallenge: vi.fn(),
  getCredentialById: vi.fn(),
  updateCredentialCounter: vi.fn(),
  setSessionCookie: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

vi.mock("@/server/db/users", () => ({ getUserByUsername }));
vi.mock("@/server/db/challenges", () => ({ getChallenge, deleteChallenge }));
vi.mock("@/server/db/passkeys", () => ({ getCredentialById, updateCredentialCounter }));
vi.mock("@/lib/auth", () => ({ setSessionCookie }));
vi.mock("@simplewebauthn/server", () => ({ verifyAuthenticationResponse }));
vi.mock("@simplewebauthn/server/helpers", () => ({
  isoBase64URL: { toBuffer: (s: string) => Buffer.from(s, "base64url") },
}));
vi.mock("@/lib/passkey", () => ({ rpID: "localhost", rpOrigin: "http://localhost:3000" }));

import { POST } from "./route";

describe("POST /api/auth/passkey/login-verify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 if no challenge found", async () => {
    getChallenge.mockReturnValue(undefined);
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "testuser", assertion: { id: "cred1" } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("sets session on successful verification", async () => {
    getUserByUsername.mockReturnValue({ id: 1, username: "testuser" });
    getChallenge.mockReturnValue({ id: 1, challenge: "abc", userId: 1, expiresAt: new Date(Date.now() + 60000) });
    getCredentialById.mockReturnValue({
      id: "cred1", userId: 1, publicKey: "AQID", counter: 0,
      transports: '["internal"]',
    });
    verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 1 },
    });
    updateCredentialCounter.mockResolvedValue(undefined);
    deleteChallenge.mockResolvedValue(undefined);
    setSessionCookie.mockResolvedValue(undefined);

    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ username: "testuser", assertion: { id: "cred1" } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(setSessionCookie).toHaveBeenCalledWith(1);
    expect(updateCredentialCounter).toHaveBeenCalledWith("cred1", 1);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test:unit -- src/app/api/auth/passkey/login-verify/route.test.ts`
Expected: FAIL

- [ ] **Step 7: Implement login-verify route**

Create `src/app/api/auth/passkey/login-verify/route.ts`:

```ts
import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { setSessionCookie } from "@/lib/auth";
import { getUserByUsername } from "@/server/db/users";
import { getCredentialById, updateCredentialCounter } from "@/server/db/passkeys";
import { getChallenge, deleteChallenge } from "@/server/db/challenges";
import { rpID, rpOrigin } from "@/lib/passkey";
import { isoBase64URL } from "@simplewebauthn/server/helpers";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.username || !body?.assertion) {
    return NextResponse.json({ error: "Missing username or assertion" }, { status: 400 });
  }

  const username = body.username.toLowerCase();
  const stored = getChallenge(username, "authentication");

  if (!stored || stored.expiresAt < new Date()) {
    return NextResponse.json({ error: "Challenge not found or expired" }, { status: 400 });
  }

  const credential = getCredentialById(body.assertion.id);
  if (!credential) {
    await deleteChallenge(stored.id);
    return NextResponse.json({ error: "Credential not found" }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.assertion,
      expectedChallenge: stored.challenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
      credential: {
        id: credential.id,
        publicKey: isoBase64URL.toBuffer(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ? JSON.parse(credential.transports) : undefined,
      },
    });
  } catch {
    await deleteChallenge(stored.id);
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  await deleteChallenge(stored.id);

  if (!verification.verified) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  await updateCredentialCounter(credential.id, verification.authenticationInfo.newCounter);
  await setSessionCookie(credential.userId);

  return NextResponse.json({ verified: true });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test:unit -- src/app/api/auth/passkey/login-verify/route.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/app/api/auth/passkey/login-options/ src/app/api/auth/passkey/login-verify/
git commit -m "feat: add passkey login API routes with tests"
```

---

### Task 7: Credential Management API Routes

**Files:**
- Create: `src/app/api/auth/passkey/list/route.ts`
- Create: `src/app/api/auth/passkey/[id]/route.ts`
- Create: `src/app/api/auth/passkey/[id]/route.test.ts`

- [ ] **Step 1: Implement list route**

Create `src/app/api/auth/passkey/list/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getCredentialsByUserId } from "@/server/db/passkeys";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credentials = await getCredentialsByUserId(userId);
  return NextResponse.json({
    credentials: credentials.map((c) => ({
      id: c.id,
      label: c.label,
      deviceType: c.deviceType,
      backedUp: c.backedUp,
      createdAt: c.createdAt,
    })),
  });
}
```

- [ ] **Step 2: Write test for list route**

Create `src/app/api/auth/passkey/list/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserId, getCredentialsByUserId } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getCredentialsByUserId: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSessionUserId }));
vi.mock("@/server/db/passkeys", () => ({ getCredentialsByUserId }));

import { GET } from "./route";

describe("GET /api/auth/passkey/list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 if not authenticated", async () => {
    getSessionUserId.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns credentials for authenticated user", async () => {
    getSessionUserId.mockResolvedValue(1);
    getCredentialsByUserId.mockResolvedValue([
      { id: "cred1", label: "MacBook", deviceType: "multiDevice", backedUp: true, createdAt: new Date() },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.credentials).toHaveLength(1);
    expect(data.credentials[0].id).toBe("cred1");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:unit -- src/app/api/auth/passkey/list/route.test.ts`
Expected: FAIL

- [ ] **Step 5: Write test for delete route**

Create `src/app/api/auth/passkey/[id]/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUserId, getCredentialById, deleteCredential, countCredentialsByUserId } = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  getCredentialById: vi.fn(),
  deleteCredential: vi.fn(),
  countCredentialsByUserId: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSessionUserId }));
vi.mock("@/server/db/passkeys", () => ({ getCredentialById, deleteCredential, countCredentialsByUserId }));

import { DELETE } from "./route";

describe("DELETE /api/auth/passkey/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 when deleting last credential", async () => {
    getSessionUserId.mockResolvedValue(1);
    getCredentialById.mockReturnValue({ id: "cred1", userId: 1 });
    countCredentialsByUserId.mockResolvedValue(1);

    const req = new Request("http://localhost");
    const res = await DELETE(req, { params: Promise.resolve({ id: "cred1" }) });
    expect(res.status).toBe(403);
    expect(deleteCredential).not.toHaveBeenCalled();
  });

  it("deletes credential when user has multiple", async () => {
    getSessionUserId.mockResolvedValue(1);
    getCredentialById.mockReturnValue({ id: "cred1", userId: 1 });
    countCredentialsByUserId.mockResolvedValue(2);
    deleteCredential.mockResolvedValue(undefined);

    const req = new Request("http://localhost");
    const res = await DELETE(req, { params: Promise.resolve({ id: "cred1" }) });
    expect(res.status).toBe(200);
    expect(deleteCredential).toHaveBeenCalledWith("cred1");
  });

  it("returns 404 for credential owned by another user", async () => {
    getSessionUserId.mockResolvedValue(1);
    getCredentialById.mockReturnValue({ id: "cred1", userId: 999 });

    const req = new Request("http://localhost");
    const res = await DELETE(req, { params: Promise.resolve({ id: "cred1" }) });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:unit -- src/app/api/auth/passkey/\\[id\\]/route.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement delete route**

Create `src/app/api/auth/passkey/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getCredentialById, deleteCredential, countCredentialsByUserId } from "@/server/db/passkeys";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const credential = getCredentialById(id);
  if (!credential || credential.userId !== userId) {
    return NextResponse.json({ error: "Credential not found" }, { status: 404 });
  }

  const count = await countCredentialsByUserId(userId);
  if (count <= 1) {
    return NextResponse.json({ error: "Cannot delete your only passkey" }, { status: 403 });
  }

  await deleteCredential(id);
  return NextResponse.json({ deleted: true });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test:unit -- src/app/api/auth/passkey/\\[id\\]/route.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/app/api/auth/passkey/list/ src/app/api/auth/passkey/\\[id\\]/
git commit -m "feat: add passkey list and delete API routes with tests"
```

---

### Task 8: Update /api/auth/me & Delete Old Routes

**Files:**
- Modify: `src/app/api/auth/me/route.ts`
- Delete: `src/app/api/auth/login/route.ts`
- Delete: `src/app/api/auth/signup/route.ts`

- [ ] **Step 1: Update me route**

The route itself doesn't need code changes — `getUserById` will return `username` after the schema update. The response shape changes automatically. Verify that `getUserById` in `src/server/db/users.ts` selects `username` (done in Task 4).

- [ ] **Step 2: Delete old auth routes**

```bash
rm src/app/api/auth/login/route.ts
rm src/app/api/auth/signup/route.ts
rmdir src/app/api/auth/login src/app/api/auth/signup
```

- [ ] **Step 3: Commit**

```bash
git add -A src/app/api/auth/login src/app/api/auth/signup
git commit -m "feat: delete old password-based auth routes"
```

---

### Task 9: Frontend — Auth Hooks

**Files:**
- Modify: `src/hooks/use-auth.ts`

- [ ] **Step 1: Update use-auth.ts**

Replace `src/hooks/use-auth.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';

type User = { id: number; username: string };

export function useAuth() {
  return useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return null;
      const data = await res.json();
      return data.user as User;
    },
    retry: false,
  });
}

export function usePasskeyRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ username, label }: { username: string; label?: string }) => {
      const options = await api<any>('/api/auth/passkey/register-options', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      const attestation = await startRegistration({ optionsJSON: options });
      return api('/api/auth/passkey/register-verify', {
        method: 'POST',
        body: JSON.stringify({ username, attestation, label }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth.me }),
  });
}

export function usePasskeyLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (username: string) => {
      const options = await api<any>('/api/auth/passkey/login-options', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      const assertion = await startAuthentication({ optionsJSON: options });
      return api('/api/auth/passkey/login-verify', {
        method: 'POST',
        body: JSON.stringify({ username, assertion }),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth.me }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.auth.me }),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/use-auth.ts
git commit -m "feat: update auth hooks for passkey flow"
```

---

### Task 10: Frontend — AuthForm Component

**Files:**
- Modify: `src/components/AuthForm.tsx`

- [ ] **Step 1: Rewrite AuthForm**

Replace `src/components/AuthForm.tsx` with a username-based passkey flow. Two modes: sign in and sign up. User enters username, then browser prompts for passkey.

```tsx
'use client';
'use no memo'; // react-hook-form uses mutable refs incompatible with React Compiler

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { usePasskeyLogin, usePasskeyRegister } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api';
import { useHaptics } from '@/hooks/use-haptics';

const usernameSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers, and underscores'),
});

type FormData = z.infer<typeof usernameSchema>;

export function AuthForm() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const { trigger } = useHaptics();

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: standardSchemaResolver(usernameSchema),
    mode: 'onBlur',
  });

  const login = usePasskeyLogin();
  const signup = usePasskeyRegister();

  function onSubmit(data: FormData) {
    clearErrors('root');
    if (isLogin) {
      login.mutate(data.username, {
        onSuccess: () => {
          trigger('success');
          router.push('/habits');
        },
        onError: (err) => {
          trigger('error');
          if (err instanceof ApiError) {
            setError('root', { message: err.message });
          } else {
            setError('root', { message: 'Something went wrong. Please try again.' });
          }
        },
      });
    } else {
      signup.mutate({ username: data.username }, {
        onSuccess: () => {
          trigger('success');
          router.push('/habits');
        },
        onError: (err) => {
          trigger('error');
          if (err instanceof ApiError) {
            if (err.status === 409) {
              setError('username', { message: 'This username is already taken' });
            } else {
              setError('root', { message: err.message });
            }
          } else {
            setError('root', { message: 'Something went wrong. Please try again.' });
          }
        },
      });
    }
  }

  const isPending = login.isPending || signup.isPending;

  function toggleMode() {
    trigger('selection');
    setIsLogin(!isLogin);
    reset();
  }

  return (
    <div className="min-h-screen flex items-start justify-center pt-[15vh] px-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? 'Sign in with your passkey'
              : 'Start tracking your 10,000 hours'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username webauthn"
                {...register('username')}
                aria-invalid={!!errors.username}
                aria-describedby={errors.username ? 'username-error' : undefined}
                className="bg-background"
              />
              {errors.username && (
                <p id="username-error" className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>
            {errors.root && (
              <div role="alert" className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{errors.root.message}</p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? '...' : isLogin ? 'Sign In' : 'Sign Up'}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button type="button" onClick={toggleMode} className="underline text-primary">
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AuthForm.tsx
git commit -m "feat: rewrite AuthForm for passkey auth"
```

---

### Task 11: Frontend — Account Page

**Files:**
- Modify: `src/app/(app)/account/page.tsx`

Note: This file exists inside the `(app)` route group which provides `Providers`, `TabNav`, header, and `LogoutButton`. Do NOT wrap in `<Providers>` or add a logout button.

- [ ] **Step 1: Rewrite account page**

Replace `src/app/(app)/account/page.tsx`:

```tsx
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth, usePasskeyRegister } from '@/hooks/use-auth';

type Credential = {
  id: string;
  label: string | null;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
};

export default function AccountPage() {
  const { data: user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['passkeys'],
    queryFn: () => api<{ credentials: Credential[] }>('/api/auth/passkey/list'),
  });

  const addPasskey = usePasskeyRegister();

  const deletePasskey = useMutation({
    mutationFn: (id: string) =>
      api(`/api/auth/passkey/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['passkeys'] }),
  });

  const credentials = data?.credentials ?? [];

  return (
    <div className="py-6 space-y-4">
      <h2 className="text-lg font-semibold">Account</h2>
      <p className="text-sm text-muted-foreground">Signed in as <span className="font-medium text-foreground">{user?.username}</span></p>
      <Card>
        <CardHeader>
          <CardTitle>Your Passkeys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {credentials.map((cred) => (
            <div key={cred.id} className="flex items-center justify-between border rounded-md p-3">
              <div>
                <p className="text-sm font-medium">
                  {cred.label || `Passkey ${cred.id.slice(0, 8)}...`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {cred.deviceType === 'multiDevice' ? 'Synced' : 'Device-bound'}
                  {cred.backedUp ? ' · Backed up' : ''}
                  {' · '}
                  {new Date(cred.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                disabled={credentials.length <= 1 || deletePasskey.isPending}
                onClick={() => deletePasskey.mutate(cred.id)}
              >
                Remove
              </Button>
            </div>
          ))}
          {!isLoading && credentials.length === 0 && (
            <p className="text-sm text-muted-foreground">No passkeys found.</p>
          )}
        </CardContent>
      </Card>
      <Button
        className="w-full"
        disabled={addPasskey.isPending}
        onClick={() => {
          if (user?.username) addPasskey.mutate({ username: user.username });
        }}
      >
        {addPasskey.isPending ? 'Adding...' : 'Add a Passkey'}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/account/page.tsx
git commit -m "feat: add account page with passkey management"
```

---

### Task 12: Fix Existing Tests & Run Full Suite

**Files:**
- Potentially modify any test that imports from old auth routes or references `email`/`password`

- [ ] **Step 1: Search for all files referencing old auth**

```bash
grep -r "email\|password\|login.*route\|signup.*route\|getUserByEmail" src/ -l
```

Fix any broken imports or references. Known files to check:
- `src/app/(app)/account/page.tsx` — already updated in Task 11
- Any test files referencing `email` or `password`

- [ ] **Step 2: Run full test suite**

```bash
npm run test:unit
```

Fix any failures.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Fix any lint errors.

- [ ] **Step 4: Build check**

```bash
npm run build
```

Fix any build errors.

- [ ] **Step 5: Commit fixes**

```bash
git add -A
git commit -m "fix: update tests and fix build for passkey auth"
```

---

### Task 13: Manual Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test signup flow**

1. Go to `http://localhost:3000/login`
2. Switch to "Sign up"
3. Enter a username
4. Complete the passkey prompt
5. Verify redirect to `/habits`

- [ ] **Step 3: Test login flow**

1. Sign out (or clear cookies)
2. Go to `/login`
3. Enter the same username
4. Complete the passkey prompt
5. Verify redirect to `/habits`

- [ ] **Step 4: Test account page**

1. Go to `/account`
2. Verify passkey is listed
3. Try "Add a Passkey"
4. Try removing a passkey (should be blocked if only one)
5. Add a second passkey, then remove one

- [ ] **Step 5: Commit any fixes from smoke testing**
