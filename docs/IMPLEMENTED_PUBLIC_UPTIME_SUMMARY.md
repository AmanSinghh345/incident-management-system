# Implemented Public Uptime Summary

This feature adds uptime summaries to the public status page.

## What was added

The public status API now includes per-service uptime data:

- 24 hour uptime percentage
- 7 day uptime percentage
- 24 hour average response time
- total checks used for each window

The public status page now shows uptime columns in the Services list.

## Backend file

- `apps/api/src/modules/status/status.service.ts`
  - fetches check results from the last 7 days for each public monitor
  - calculates 24h and 7d uptime
  - calculates average response time
  - attaches `uptime` to each monitor in the public response

## Frontend files

- `apps/web/lib/status.ts`
  - added `PublicUptimeSummary`
  - added `uptime` to `PublicStatusMonitor`

- `apps/web/app/status/[workspaceSlug]/page.tsx`
  - shows 24h uptime
  - shows 7d uptime
  - shows average response time

## How uptime is calculated

```text
successful checks / total checks * 100
```

If no checks exist in that time window, the page shows:

```text
--
```

## Why this matters

A status page should communicate both current state and recent reliability.

Current state answers:

```text
Is the service up right now?
```

Uptime summary answers:

```text
How reliable has this service been recently?
```

## What is still missing

- Public uptime charts.
- Per-day uptime bars.
- Custom public date ranges.
- SLA/SLO targets.
