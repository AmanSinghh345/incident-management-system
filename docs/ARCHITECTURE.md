# PulseOps Architecture

PulseOps uses a simple monorepo with a Next.js frontend, a NestJS backend, PostgreSQL for persistent data, Redis for queue processing, and Socket.IO for realtime dashboard updates.

## Main Flow

```text
User adds monitor
-> Backend saves monitor
-> Worker checks URL periodically
-> CheckResult is stored
-> If repeated failures happen, Incident is created
-> WebSocket updates dashboard
-> Email alert is sent
-> Public status page updates
```

## Components

## Frontend

The Next.js app in `apps/web` handles the landing page, authentication screens, dashboard, monitor pages, incident pages, and public status pages.

## Backend API

The NestJS app in `apps/api` exposes REST APIs for auth, users, monitors, incidents, check results, notifications, and status pages.

## Database

PostgreSQL stores users, monitors, check results, incidents, incident updates, and notifications. Prisma owns the schema and database migrations.

## Worker

BullMQ workers will read monitor check jobs from Redis, perform URL checks, store results, and trigger incident logic.

## Realtime

Socket.IO will send monitor and incident updates to connected dashboard clients after important backend events.

## Notifications

The notifications module will send email alerts when incidents are created, acknowledged, resolved, or updated.
