# Implemented Monitor Analytics

This feature adds basic uptime and response-time analytics to each monitor.

## What was added

Backend API:

```text
GET /monitors/:id/stats
```

Frontend:

```text
/monitors/[id]
```

The monitor detail page now shows:

- 24 hour uptime
- 7 day uptime
- average response time for the last 24 hours
- failed checks out of total checks for the last 24 hours
- hourly health timeline for the last 24 hours

## Backend files

- `apps/api/src/modules/monitors/monitors.controller.ts`
  - added `GET /monitors/:id/stats`

- `apps/api/src/modules/checks/checks.service.ts`
  - added `getStatsForMonitor`
  - calculates summary data from stored `CheckResult` rows
  - builds 24 hourly buckets for the chart

## Frontend files

- `apps/web/lib/auth.ts`
  - added `MonitorStatsSummary`
  - added `MonitorStatsBucket`
  - added `MonitorStats`
  - added `getMonitorStats`

- `apps/web/app/monitors/[id]/page.tsx`
  - loads monitor details, check history, and stats together
  - renders analytics cards
  - renders a simple hourly status chart

## How uptime is calculated

For a time window:

```text
successful checks / total checks * 100
```

If there are no checks in a window, uptime is returned as `null` and shown as `--`.

## How the hourly chart works

The backend splits the last 24 hours into 24 buckets.

Each bucket includes:

- total checks
- successful checks
- failed checks
- uptime percentage
- average response time

The frontend colors buckets:

- green: checks succeeded
- red: at least one failed check
- gray: no checks in that hour

## What is still missing

- 7 day visual chart.
- Response-time line chart.
- Custom date ranges.
- Exporting uptime reports.
