# Implemented Public Status Page

This feature gives each workspace a public service health page.

## What was added

Public API route:

```text
GET /status/:workspaceSlug
```

Public web route:

```text
/status/[workspaceSlug]
```

Example:

```text
http://localhost:3000/status/aman
```

## What the page shows

- workspace name
- overall system status
- total services
- active services
- active incident count
- monitor/service list
- latest check time and response time
- active incidents with latest update

The page does not require login.

## Backend files

- `apps/api/src/modules/status/status.controller.ts`
  - exposes `GET /status/:workspaceSlug`

- `apps/api/src/modules/status/status.service.ts`
  - finds the workspace by slug
  - loads monitors, latest check result, and active incidents
  - calculates overall public status

- `apps/api/src/modules/status/status.module.ts`
  - registers the controller and service

- `apps/api/src/app.module.ts`
  - imports `StatusModule`

## Frontend files

- `apps/web/lib/status.ts`
  - contains public status types
  - contains `getPublicStatus`

- `apps/web/app/status/[workspaceSlug]/page.tsx`
  - public page UI
  - refreshes every 30 seconds

- `apps/web/app/dashboard/page.tsx`
  - adds a Status Page link for the logged-in workspace

## Overall status rules

- `MAJOR_OUTAGE`: at least one active monitor is `DOWN`
- `PARTIAL_OUTAGE`: at least one active monitor is `DEGRADED`
- `OPERATIONAL`: active monitors exist and none are down/degraded
- `NO_MONITORS`: workspace has no active monitors
- `PAUSED`: reserved for paused-only setups

## Why this matters

A monitoring product is much more useful when customers can see service health without logging into the admin dashboard.

This turns internal monitor data into a public communication surface.

## What is still missing

- Custom status page branding.
- Hiding private/internal monitor URLs.
- Public historical uptime charts.
- Incident update visibility controls.
- Custom domain support.
