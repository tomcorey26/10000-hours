# Passkey-Only Authentication Design

Replace password-based auth with passkey-only (WebAuthn) auth using `@simplewebauthn/server` and `@simplewebauthn/browser`. Clean cut — no migration from existing password accounts.

## Decisions

- **Passkey-only** — no passwords, no email, no forgot-password flow
- **Username as identifier** — unique, used to look up credentials at login
- **Username validation** — 3-30 chars, alphanumeric + underscore, stored lowercase for case-insensitive lookup
- **Multiple passkeys per user** (Option B) — users register backup passkeys for recovery
- **Passkey sync** (Option D) — iCloud Keychain, Google Password Manager, 1Password handle cross-device access naturally
- **Library: `@simplewebauthn`** — wraps raw WebAuthn, handles CBOR/attestation complexity
- **Migration:** delete all existing migrations in `drizzle/`, update schema, run `db:generate` for a single fresh migration, wipe database, run `db:migrate`

## Data Model

### Users table (modified)

Remove `email` and `passwordHash`. Add `username`.

```
users
  id            integer  PK autoincrement
  username      text     not null, unique
  createdAt     integer  timestamp
```

### New: passkey_credentials table

```
passkey_credentials
  id            text     PK (base64url credential ID from WebAuthn)
  userId        integer  FK → users.id, cascade delete
  publicKey     text     base64url-encoded public key
  counter       integer  default 0 (replay protection)
  deviceType    text     "singleDevice" | "multiDevice"
  backedUp      integer  boolean (0/1)
  transports    text     JSON array (JSON.stringify on write, JSON.parse on read)
  label         text     optional user-provided name ("MacBook Pro", "iPhone")
  createdAt     integer  timestamp
```

One user → many credentials.

### New: challenges table

```
challenges
  id            integer  PK autoincrement
  username      text     not null (lookup key for registration, before user exists)
  userId        integer  nullable (set for authenticated flows like "add passkey")
  challenge     text     not null
  type          text     "registration" | "authentication"
  expiresAt     integer  timestamp
```

Short-lived (60s). Cleanup: lazily delete expired rows on each new challenge insert.

## Auth Flows

### Registration (Sign Up)

1. User enters username
2. `POST /api/auth/passkey/register-options` with `{ username }` → server checks username availability, generates WebAuthn registration options, stores challenge keyed by username (user row NOT created yet)
3. Client calls `startRegistration()` from `@simplewebauthn/browser` → browser biometric prompt
4. `POST /api/auth/passkey/register-verify` with `{ username, attestation }` → server verifies attestation, creates user row, stores credential, sets JWT session cookie

User row is created in `register-verify` (not `register-options`) to avoid orphan rows if the user cancels the biometric prompt.

### Login (Sign In)

1. User enters username
2. `POST /api/auth/passkey/login-options` with `{ username }` → server looks up user + credentials, generates authentication options, stores challenge keyed by username
3. Client calls `startAuthentication()` → browser biometric prompt
4. `POST /api/auth/passkey/login-verify` with assertion response → server verifies, updates counter, sets JWT session cookie

### Adding a Passkey (Account Page)

Uses `register-options` / `register-verify` with an authenticated session. When a valid session exists, the endpoint skips username availability check and uses the session userId. The challenge is stored with `userId` set. On verify, it stores the credential against the existing user instead of creating a new one.

## API Routes

### New

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/passkey/register-options` | Generate registration challenge (unauthenticated: signup, authenticated: add passkey) |
| POST | `/api/auth/passkey/register-verify` | Verify attestation, create credential (+ user if signup), set session |
| POST | `/api/auth/passkey/login-options` | Generate authentication challenge |
| POST | `/api/auth/passkey/login-verify` | Verify assertion, set session |
| GET | `/api/auth/passkey/list` | List user's credentials (authenticated) |
| DELETE | `/api/auth/passkey/[id]` | Delete a credential (reject if last one) |

### Deleted

- `POST /api/auth/login`
- `POST /api/auth/signup`

### Modified

- `GET /api/auth/me` — return `username` instead of `email`

### Unchanged

- `POST /api/auth/logout`
- Middleware (`src/middleware.ts`)
- JWT session layer

## File Changes

### New files

- `src/lib/passkey.ts` — WebAuthn RP config (RP_ID, RP_ORIGIN, RP name)
- `src/server/db/passkeys.ts` — credential CRUD queries
- `src/server/db/challenges.ts` — challenge store/retrieve/delete (with lazy expiry cleanup)
- `src/app/api/auth/passkey/register-options/route.ts`
- `src/app/api/auth/passkey/register-verify/route.ts`
- `src/app/api/auth/passkey/login-options/route.ts`
- `src/app/api/auth/passkey/login-verify/route.ts`
- `src/app/api/auth/passkey/list/route.ts`
- `src/app/api/auth/passkey/[id]/route.ts`
- `src/app/account/page.tsx` — passkey management UI

### Modified files

- `src/db/schema.ts` — new tables, modified users table
- `src/lib/auth.ts` — remove `hashPassword`, `verifyPassword`, drop bcryptjs
- `src/server/db/users.ts` — `createUser(username)`, add `getUserByUsername`, remove `getUserByEmail`; `getUserById` returns `username` instead of `email`
- `src/app/api/auth/me/route.ts` — return `username` instead of `email`
- `src/components/AuthForm.tsx` — username input + passkey flow (replaces email/password form)
- `src/hooks/use-auth.ts` — new mutations for passkey endpoints, `User` type: `username` replaces `email`

### Deleted files

- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/signup/route.ts`

### Dependencies

- Add: `@simplewebauthn/server`, `@simplewebauthn/browser`
- Remove: `bcryptjs`, `@types/bcryptjs`

### Env vars

- Add: `RP_ID` (e.g. `localhost`), `RP_ORIGIN` (e.g. `http://localhost:3000`)
- Keep: `JWT_SECRET`
- Keep: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` (libsql, not actually Turso)

## Account Page

`/account` — authenticated users can:

1. View list of registered passkeys (label, device type, backed-up status, creation date)
2. Add a new passkey (triggers registration flow with current session, optional label)
3. Remove a passkey (blocked if it's the last one)

## Known Limitations

- **No rate limiting** on unauthenticated endpoints (`register-options`, `login-options`). Future TODO — add per-IP rate limiting to prevent challenge table flooding.

## Testing

### Server-side

- Registration: username validation, challenge generation, credential storage, user created only on verify
- Login: challenge generation, assertion verification, counter update
- Edge cases: duplicate username, non-existent username, expired challenge, can't delete last passkey, invalid username format

### Client-side

- AuthForm renders username input, triggers passkey flow
- Account page lists credentials, add/remove
- Can't remove last passkey shows error
- Mock `@simplewebauthn/browser` for browser API calls
