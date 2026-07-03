# PulseOps

PulseOps is a full-stack incident monitoring project for tracking URL health checks and incident state.
It includes monitor scheduling, incident workflows, notification delivery attempts, and a public workspace status page.

## Features

- User registration and login with signed access tokens.
- URL monitor CRUD with method, expected status code, timeout, interval, failure threshold, and public status-page settings.
- Manual checks from the UI and scheduled checks through BullMQ/Redis.
- Check history, response time storage, 24-hour/7-day uptime summaries, and hourly monitor stats.
- Incident creation after repeated failed checks and automatic resolution after a successful recovery check.
- Incident actions for acknowledge, resolve, assignment, severity changes, and timeline updates.
- Server-Sent Events (SSE) for monitor, check, and incident refresh events.
- Signed webhook delivery attempts for incident/test events.
- Resend email delivery path when `RESEND_API_KEY` and `EMAIL_FROM` are configured.
- Notification history for webhook/email attempts.
- Public workspace status page with public monitor controls and recent incident history.
- Team invites, workspace switching, and audit logs.

## Tech Stack

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS
- Backend: NestJS, TypeScript
- Database: PostgreSQL with Prisma
- Background scheduling: BullMQ with Redis
- Realtime: Server-Sent Events
- Package manager: pnpm workspaces
- Deployment packaging: Dockerfiles and Docker Compose

## Architecture Overview

```text
apps/web        Next.js UI
apps/api        NestJS REST API, SSE endpoint, and BullMQ worker module
packages/shared Shared TypeScript DTO/type definitions
postgres        Persistent data through Prisma
redis           BullMQ delayed monitor check jobs
```

The BullMQ worker runs inside the NestJS API process. It schedules monitor checks, stores `CheckResult` rows, updates monitor status, and opens/resolves incidents through the same backend services.

Realtime updates use `GET /realtime/events` as an SSE stream. The frontend listens with `EventSource` and reloads affected views after monitor, check, or incident events.

## Local Setup

Requirements:

- Node.js 22
- pnpm 9
- Docker Desktop or Docker Engine

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`
- API health: `http://localhost:4000/health`

Health check response:

```json
{
  "ok": true,
  "service": "pulseops-api",
  "time": "2026-07-03T00:00:00.000Z"
}
```

Useful verification commands:

```bash
pnpm --filter api typecheck
pnpm --filter web typecheck
pnpm --filter api build
pnpm --filter web build
```

## Docker Production-Style Setup

The repository includes Dockerfiles for the API and web app plus a production-style Compose file:

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `docker-compose.prod.yml`

Run locally with:

```bash
cp .env.example .env
# Set a stronger JWT_SECRET in .env before using this outside local testing.
docker compose -f docker-compose.prod.yml up --build
```

Validate/build the Docker setup without starting services:

```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
```

In `docker-compose.prod.yml`, the API runs Prisma migrations with `prisma migrate deploy` before starting.

## Environment Variables

Copy `.env.example` to `.env` for local development.

API variables:

```env
DATABASE_URL="postgresql://pulseops:pulseops@127.0.0.1:5433/pulseops?schema=public"
REDIS_URL=
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=replace-with-a-long-random-value
FRONTEND_URL=http://localhost:3000
BACKEND_PORT=4000
RESEND_API_KEY=
EMAIL_FROM="PulseOps <alerts@example.com>"
```

Web variable:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```


## Demo Flow

Use this flow for local demos and interviews:

1. Start dependencies with `docker compose up -d`.
2. Run `pnpm db:generate` and `pnpm db:migrate`.
3. Start the app with `pnpm dev`.
4. Register a user at `http://localhost:3000/register`.
5. Create a monitor from the Monitors page.
6. Run a manual check and confirm a check result appears.
7. To demo incident creation, set the failure threshold to `1` or `2`, then use an incorrect expected status code or a failing URL.
8. Confirm an open incident appears.
9. Restore the monitor to a successful URL/status code and run another check.
10. Confirm the incident is resolved automatically.
11. Open the public status page from the Dashboard.
12. Optional: create a webhook endpoint and send a test webhook, then check notification history.

## Render Health Check

There is no global API prefix in `apps/api/src/main.ts`, so the health-check route is:

```text
GET /health
HEAD /health
```

Local health-check URL:

```text
http://localhost:4000/health
```

Current Render health-check URL:

```text
https://incident-management-system-wv1w.onrender.com/health
```

cron-job.org or UptimeRobot can ping the Render free backend to reduce cold starts:

```text
URL: https://incident-management-system-wv1w.onrender.com/health
Method: GET
Schedule: every 10 minutes
Cron expression: */10 * * * *
```
