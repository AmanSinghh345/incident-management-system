# PulseOps — Uptime Monitoring & Incident Management

PulseOps is a full-stack uptime monitoring and incident management platform that tracks URL health, detects service failures, and manages incident lifecycles.

It supports configurable monitoring schedules, automated health checks, incident workflows, notification delivery, real-time dashboard updates, and public workspace status pages.

## Features

### Authentication & Workspace Management
- User registration and login with signed access tokens.
- Workspace creation and switching.
- Team invitations and member management.
- Role-based workspace access and authorization.
- Audit logs for tracking important workspace actions.

### Uptime Monitoring
- Create, update, pause, resume, and delete URL monitors.
- Configure HTTP method, expected status code, timeout, check interval, and failure threshold.
- Trigger manual health checks from the dashboard.
- Schedule automated checks using BullMQ and Redis.
- Store check history, response times, and monitor status.
- View 24-hour and 7-day uptime summaries and hourly statistics.

### Incident Management
- Automatically create incidents after consecutive failed health checks reach the configured threshold.
- Automatically resolve active incidents after a successful recovery check.
- Acknowledge and resolve incidents manually.
- Assign incidents and update their severity.
- Maintain an incident timeline for tracking status changes and actions.

### Notifications & Integrations
- Signed webhook delivery for incident and test events.
- Email notifications through Resend when configured.
- Track notification delivery attempts and their status.
- View notification history for debugging delivery issues.

### Real-time Updates & Public Status
- Server-Sent Events (SSE) for monitor, check, and incident updates.
- Live dashboard refreshes using the browser's `EventSource` API.
- Public workspace status pages.
- Configurable public monitor visibility.
- Recent incident history on public status pages.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS |
| Backend | NestJS, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Background Jobs | BullMQ, Redis |
| Real-time Communication | Server-Sent Events (SSE) |
| Email Delivery | Resend |
| Package Management | pnpm Workspaces |
| Containerization | Docker, Docker Compose |

## Architecture Overview

```text
                    ┌──────────────────────┐
                    │      Next.js UI      │
                    │  Dashboard / Status  │
                    └──────────┬───────────┘
                               │
                         REST API / SSE
                               │
                    ┌──────────▼───────────┐
                    │      NestJS API      │
                    │                      │
                    │ Authentication       │
                    │ Workspace Management │
                    │ Monitor Management   │
                    │ Incident Management  │
                    │ Notifications        │
                    │ SSE Endpoint         │
                    └──────┬────────┬──────┘
                           │        │
                    ┌──────▼───┐ ┌──▼──────────┐
                    │PostgreSQL│ │    Redis    │
                    │  Prisma  │ │   BullMQ    │
                    └──────────┘ └─────┬───────┘
                                       │
                                ┌──────▼───────┐
                                │ BullMQ Worker│
                                │              │
                                │ Scheduled    │
                                │ Health Checks│
                                └──────┬───────┘
                                       │
                                ┌──────▼───────┐
                                │ Check Results│
                                │ & Incidents  │
                                └──────┬───────┘
                                       │
                             Notifications / SSE
```

### Monitor Check Lifecycle

1. A user creates a monitor and configures its check interval, HTTP method, expected status code, timeout, and failure threshold.
2. The NestJS API validates the request and stores the monitor configuration in PostgreSQL through Prisma.
3. The monitor is scheduled as a delayed BullMQ job in Redis.
4. The BullMQ worker processes scheduled jobs and performs HTTP health checks.
5. Each check result is stored in PostgreSQL, including its status and response time.
6. If consecutive failures reach the configured threshold, an incident is created.
7. Notifications are sent through configured email or webhook channels.
8. SSE events notify connected dashboard clients about relevant updates.
9. When a subsequent check succeeds, an active incident is automatically resolved and the monitor status is updated.

**Implementation note:** The BullMQ worker currently runs inside the NestJS API process. Redis stores delayed jobs, while PostgreSQL stores persistent monitor, check, and incident data.

### Real-time Communication

The backend exposes:

```http
GET /realtime/events
```

The frontend connects using the browser's `EventSource` API.

The SSE stream sends events related to:
- Monitor creation, updates, and deletion.
- New check results.
- Incident state changes.

The frontend uses these events to refresh the affected dashboard views without repeatedly polling the API.

### Project Structure

```text
PulseOps/
├── apps/
│   ├── web/              # Next.js frontend
│   └── api/              # NestJS backend and BullMQ worker
├── packages/
│   └── shared/           # Shared TypeScript types and DTOs
├── docker-compose.yml
├── docker-compose.prod.yml
├── pnpm-workspace.yaml
└── package.json
```

## Local Development Setup

### Prerequisites

- Node.js 22
- pnpm 9
- Docker Desktop or Docker Engine

### 1. Clone the repository

```bash
git clone https://github.com/AmanSinghh345/incident-management-system.git

cd incident-management-system
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Configure the required values in `.env`.

### 4. Start PostgreSQL and Redis

```bash
docker compose up -d
```

### 5. Generate Prisma Client and run migrations

```bash
pnpm db:generate
pnpm db:migrate
```

### 6. Start the application

```bash
pnpm dev
```

### Local URLs

| Service | URL |
|---|---|
| Web Application | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| API Health Check | http://localhost:4000/health |

Example health-check response:

```json
{
  "ok": true,
  "service": "pulseops-api",
  "time": "2026-07-03T00:00:00.000Z"
}
```

## Environment Variables

Copy `.env.example` and configure the following variables.

### API

```env
DATABASE_URL="postgresql://pulseops:pulseops@127.0.0.1:5433/pulseops?schema=public"

REDIS_URL=
REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=replace-with-a-long-random-value

FRONTEND_URL=http://localhost:3000
BACKEND_PORT=4000

RESEND_API_KEY=
RESEND_FROM="PulseOps <alerts@pulseops.space>"
```

### Web

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

Use strong secrets and appropriate production credentials when deploying. Do not commit `.env` or expose API keys.

## Testing

The backend includes unit and integration tests covering authentication, monitor management, health checks, incident workflows, notifications, background jobs, real-time events, and status pages.

### Run API tests

From the `apps/api` directory:

```bash
npm test -- --runInBand
```

### Run tests with coverage

```bash
npm test -- --runInBand --coverage
```

### Current test results

| Metric | Result |
|---|---:|
| Test suites passed | 12 |
| Tests passed | 197 |
| Statement coverage | 94.19% |
| Branch coverage | 83.09% |
| Function coverage | 89.65% |
| Line coverage | 93.81% |

Coverage results reflect the current local test run and may change as the codebase evolves.

### Additional verification

From the repository root:

```bash
pnpm --filter api typecheck
pnpm --filter web typecheck

pnpm --filter api build
pnpm --filter web build
```

## Docker Production-Style Setup

The repository includes Dockerfiles for both applications and a production-oriented Compose configuration.

```text
apps/api/Dockerfile
apps/web/Dockerfile
docker-compose.prod.yml
```

Start the production-style environment locally:

```bash
cp .env.example .env
```

Set a strong `JWT_SECRET` and configure the required environment variables, then run:

```bash
docker compose -f docker-compose.prod.yml up --build
```

Validate the Compose configuration and build images separately:

```bash
docker compose -f docker-compose.prod.yml config

docker compose -f docker-compose.prod.yml build
```

The production Compose configuration runs Prisma migrations using `prisma migrate deploy` before starting the API.

## Demo Flow

Use the following workflow to demonstrate the main application features:

1. Start PostgreSQL and Redis using Docker Compose.
2. Generate Prisma Client and apply database migrations.
3. Start the frontend and backend.
4. Register a new user.
5. Create a monitor from the Monitors page.
6. Configure its URL, expected status code, interval, timeout, and failure threshold.
7. Trigger a manual health check and inspect the resulting check history.
8. To demonstrate incident creation, use a failing URL or an incorrect expected status code with a failure threshold of `1` or `2`.
9. Verify that an incident is automatically created after the configured number of failures.
10. Restore the monitor to a healthy URL or expected status code and trigger another check.
11. Verify that the active incident is automatically resolved.
12. Open the public workspace status page and inspect monitor health and incident history.
13. Optionally configure a webhook endpoint, send a test event, and inspect notification history.

## Deployment & Health Checks

The backend exposes a health endpoint:

```http
GET /health
HEAD /health
```

There is no global API prefix configured in `apps/api/src/main.ts`.

### Render Deployment

The deployed API health-check endpoint is:

https://incident-management-system-wv1w.onrender.com/health

You can configure an external uptime service such as UptimeRobot or cron-job.org to periodically request this endpoint.

Example configuration:

```text
URL: https://incident-management-system-wv1w.onrender.com/health
Method: GET
Interval: 10 minutes
Cron: */10 * * * *
```

Periodic health checks can help reduce cold starts on free hosting plans, but do not guarantee uninterrupted availability.

## Future Improvements

Potential areas for further development include:

- Separating the BullMQ worker into an independently deployable service.
- Scaling workers horizontally for higher monitoring workloads.
- Adding retry policies and dead-letter handling for failed jobs.
- Supporting additional notification integrations.
- Improving observability with structured logs and metrics.
- Adding more advanced incident analytics and reporting.

## Links

- **GitHub Repository:** https://github.com/AmanSinghh345/incident-management-system
- **Live Application:** https://incident-management-system-vw1w.onrender.com

---

**PulseOps** — Monitor services, detect failures, and manage incidents from one place.


## Architecture Overview

The following diagram illustrates the overall PulseOps architecture and how the frontend, backend, database, Redis queue, and monitoring workers interact.

![PulseOps System Architecture](https://github.com/user-attachments/assets/73778b69-900f-497e-98d5-59d4f45f408a)

### Future Changes & Roadmap Architecture

![PulseOps Future Changes](https://github.com/user-attachments/assets/00a91ce9-5388-476a-9166-1612d9688acc)