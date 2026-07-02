# PulseOps Architecture Notes

PulseOps is a pnpm monorepo with a Next.js frontend and a NestJS backend. PostgreSQL stores application data through Prisma, Redis stores BullMQ jobs, and realtime UI refreshes use Server-Sent Events.

## Runtime Pieces

```text
apps/web
  Next.js App Router UI for auth, dashboard, monitors, incidents, settings,
  and public status pages.

apps/api
  NestJS REST API, Prisma access, SSE endpoint, notification delivery, and the
  BullMQ monitor-check worker module.

packages/shared
  Shared TypeScript DTO/type definitions. The web app also has richer local API
  client types in apps/web/lib/auth.ts.

PostgreSQL
  Users, monitors, check results, incidents, incident updates, notifications,
  webhook endpoints, workspace members, invites, and audit logs.

Redis
  BullMQ delayed jobs for monitor checks.
```

## Monitor Check Flow

```text
Monitor is created or updated
-> API schedules a BullMQ delayed job
-> Worker module runs inside the API process
-> ChecksService performs an HTTP request
-> CheckResult is stored
-> Monitor status is updated
-> Repeated failures open an incident
-> A later successful check resolves active incidents
-> SSE event prompts connected clients to refresh
```

## Realtime

The implemented realtime transport is SSE:

- backend: `GET /realtime/events`
- frontend: `EventSource` in `apps/web/lib/auth.ts`
- events: `monitor.changed`, `monitor.deleted`, `check.created`, `incident.changed`

Socket.IO packages are installed, but there is no Socket.IO gateway in the current implementation.

## Notifications

The notifications module supports:

- webhook endpoint CRUD
- HMAC-signed webhook delivery attempts
- test webhook attempts
- Resend email delivery path when email env vars are configured
- notification history records

There is no Slack, PagerDuty, SMS, push notification, or retry/backoff worker yet.

## Status Page

The public status page is workspace-slug based:

- API: `GET /status/:workspaceSlug`
- Web: `/status/[workspaceSlug]`

Public monitor settings control whether a monitor appears and whether its URL is shown.

## Deployment Shape

The repository has Dockerfiles for the API and web app plus `docker-compose.prod.yml` for a production-style local run. No live cloud deployment URL is included yet.
