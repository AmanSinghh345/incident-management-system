# Task Division

This project is designed for two developers working in parallel without stepping on each other's files too often.

## Developer A

- NestJS backend setup
- Prisma schema
- Auth APIs
- Monitor CRUD APIs
- BullMQ worker
- URL health check logic
- Incident auto-create/resolve logic
- SSE realtime events
- Webhook/email notification attempts

## Developer B

- Next.js frontend setup
- Landing page
- Auth UI
- Dashboard UI
- Monitors list page
- Create/Edit monitor page
- Monitor details page
- Incidents list page
- Incident details page
- Public status page
- Settings/alerts UI

## Suggested First Tasks

Developer A should start with Prisma migrations, the health route, and the auth module contract.

Developer B should start with the app layout, auth pages, dashboard shell, and shared UI components.
