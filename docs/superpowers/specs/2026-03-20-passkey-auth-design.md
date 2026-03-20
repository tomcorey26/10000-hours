# Passkey-Only Authentication Design

Replace password-based auth with passkey-only (WebAuthn) auth using `@simplewebauthn/server` and `@simplewebauthn/browser`. Clean cut — no migration from existing password accounts.

## Decisions

- **Passkey-only** — no passwords, no email, no forgot-password flow
- **Username as identifier** — unique, used to look up credentials at login
- **Multiple passkeys per user** (Option B) — users register backup passkeys for recovery
- **Passkey sync** (Option D) — iCloud Keychain, Google Password Manager, 1Password handle cross-device access naturally
- **Library: `@simplewebauthn`** — wraps raw WebAuthn, handles CBOR/attestation complexity

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
  transports    text     JSON array, e.g. ["internal","hybrid"]
  createdAt     integer  timestamp
```

One user → many credentials.

### New: challenges table

```
challenges
  id            integer  PK autoincrement
  userId        integer  FK → users.id, cascade delete (nullable for registration)
  challenge     text     not null
  type          text     "registration" | "authentication"
  expiresAt     integer  timestamp
```

Short-lived (60s). Deleted on verification or expiry.

## Auth Flows

### Registration (Sign Up)

1. User enters username
2. `POST /api/auth/passkey/register-options` with `{ username }` → server checks availability, creates user row, generates WebAuthn registration options, stores challenge
3. Client calls `startRegistration()` from `@simplewebauthn/browser` → browser biometric prompt
4. `POST /api/auth/passkey/register-verify` with attestation response → server verifies, stores credential, sets JWT session cookie

### Login (Sign In)

1. User enters username
2. `POST /api/auth/passkey/login-options` with `{ username }` → server looks up credentials, generates authentication options, stores challenge
3. Client calls `startAuthentication()` → browser biometric prompt
4. `POST /api/auth/passkey/login-verify` with assertion response → server verifies, updates counter, sets JWT session cookie

### Adding a Passkey (Account Page)

Same as registration steps 2-4, but user is already authenticated. Uses session userId instead of creating a new user.

## API Routes

### New

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/passkey/register-options` | Generate registration challenge |
| POST | `/api/auth/passkey/register-verify` | Verify attestation, create credential, set session |
| POST | `/api/auth/passkey/login-options` | Generate authentication challenge |
| POST | `/api/auth/passkey/login-verify` | Verify assertion, set session |
| GET | `/api/auth/passkey/list` | List user's credentials (authenticated) |
| DELETE | `/api/auth/passkey/[id]` | Delete a credential (reject if last one) |

### Deleted

- `POST /api/auth/login`
- `POST /api/auth/signup`

### Unchanged

- `POST /api/auth/logout`
- `GET /api/auth/me`
- Middleware (`src/middleware.ts`)
- JWT session layer

## File Changes

### New files

- `src/lib/passkey.ts` — WebAuthn RP config (RP_ID, RP_ORIGIN, RP name)
- `src/server/db/passkeys.ts` — credential CRUD queries
- `src/server/db/challenges.ts` — challenge store/retrieve/delete
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
- `src/server/db/users.ts` — `createUser(username)`, add `getUserByUsername`, remove `getUserByEmail`
- `src/components/AuthForm.tsx` — username input + passkey flow (replaces email/password form)
- `src/hooks/use-auth.ts` — new mutations for passkey endpoints

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

1. View list of registered passkeys (credential ID truncated, creation date)
2. Add a new passkey (triggers registration flow with current session)
3. Remove a passkey (blocked if it's the last one)

## Testing

### Server-side

- Registration: username validation, challenge generation, credential storage
- Login: challenge generation, assertion verification, counter update
- Edge cases: duplicate username, non-existent username, expired challenge, can't delete last passkey

### Client-side

- AuthForm renders username input, triggers passkey flow
- Account page lists credentials, add/remove
- Can't remove last passkey shows error
- Mock `@simplewebauthn/browser` for browser API calls
