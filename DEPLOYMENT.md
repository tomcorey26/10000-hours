# Deployment: Coolify + Hetzner

## Stack
- **Server**: Hetzner Cloud CX22 (2 vCPU, 4GB RAM recommended)
- **PaaS**: Coolify (self-hosted, runs on the Hetzner server)
- **Database**: Local SQLite file via `@libsql/client` (not Turso cloud)
- **Reverse proxy**: Traefik (managed by Coolify, routes domains to apps)

## Server Setup

1. Create a Hetzner VPS (Ubuntu 24.04), add SSH key
2. Firewall inbound rules: TCP 22 (SSH), 80 (HTTP), 443 (HTTPS), 8000 (Coolify dashboard)
3. SSH in and install Coolify:
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```
4. Visit `http://<server-ip>:8000` to complete setup
5. Choose **This Machine** as server type (Coolify deploys on itself)

## Coolify Resource Config

- **Build pack**: Dockerfile
- **Port**: 3000
- **Environment variables**:
  - `DATABASE_URL=file:/app/data/local.db`
  - `JWT_SECRET=<openssl rand -base64 32>`
- **Persistent storage**: Directory mount, destination `/app/data` (keeps SQLite DB across deploys)

## Dockerfile Overview

Three-stage multi-stage build:

1. **deps** — Installs `node_modules` from lockfile (cached by Docker)
2. **builder** — Copies source + deps, runs `next build` with standalone output. Uses placeholder env vars (real ones injected at runtime)
3. **runner** — Slim production image. Copies only build output + drizzle tooling. On startup: fixes volume permissions, runs `drizzle-kit push` to sync schema, then starts `node server.js`

## Domains & HTTPS

Coolify uses Traefik to route multiple domains to different apps on one server:

```
myapp.com          → 10000-hours app
coolify.myapp.com  → Coolify dashboard
other.myapp.com    → another app
```

Setup:
1. Add A records in DNS provider, all pointing to the server IP
2. Set the domain in each Coolify resource's settings
3. Coolify auto-provisions HTTPS via Let's Encrypt

## Known Issues / TODOs

- **Secure cookies**: Currently disabled (`secure: false` in `src/lib/auth.ts`) so auth works over HTTP. Re-enable once HTTPS is set up.
- **Auto-deploy**: Webhook from GitHub not triggering — using manual deploys for now. Check Coolify webhook settings.
- **RAM**: 2GB servers can choke during Docker builds. 4GB (CX22) recommended.

## Useful Commands

```bash
# SSH into server
ssh root@<server-ip>

# View running containers
docker ps

# Tail logs of latest container
docker logs -f $(docker ps -q --latest)

# Generate a JWT secret
openssl rand -base64 32
```

## Billing

Hetzner auto-charges monthly to payment method on file. Manage at Hetzner Cloud Console → Account → Billing.
