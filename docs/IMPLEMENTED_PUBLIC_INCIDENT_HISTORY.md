# Implemented Public Incident History

This feature makes the public status page show recent incidents, not only currently active incidents.

## What was added

The public status API now returns:

```ts
recentIncidents
```

The public status page now shows:

- active incidents
- recent incidents
- resolved incident badges
- started and resolved timestamps
- latest public update message

## Backend file

- `apps/api/src/modules/status/status.service.ts`
  - keeps `incidents` as active incidents
  - adds `recentIncidents` with the latest 10 incidents of any status
  - includes monitor summary and latest update

## Frontend files

- `apps/web/lib/status.ts`
  - added `recentIncidents` to `PublicStatusPage`

- `apps/web/app/status/[workspaceSlug]/page.tsx`
  - added Recent incidents section
  - reused an incident card for active and recent incidents
  - added status badge colors for open, acknowledged, and resolved

## Why this matters

Public status pages should communicate history, not only current health.

If a service was down earlier and recovered, visitors can still see what happened and when it was resolved.

## What is still missing

- Pagination for older incidents.
- Public incident detail pages.
- Month-by-month incident archive.
- Public uptime history charts.
