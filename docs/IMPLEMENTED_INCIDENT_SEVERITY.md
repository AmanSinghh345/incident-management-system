# Implemented Incident Severity

This feature adds priority levels to incidents.

## What was added

Incidents now have a severity:

- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

Default severity:

```text
HIGH
```

## Database changes

Added enum:

```prisma
enum IncidentSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

Added field:

```prisma
severity IncidentSeverity @default(HIGH)
```

Migration:

```text
apps/api/prisma/migrations/20260701003000_add_incident_severity/migration.sql
```

## Backend changes

New endpoint:

```text
PATCH /incidents/:id/severity
```

Body:

```json
{
  "severity": "CRITICAL"
}
```

Backend files:

- `apps/api/src/modules/incidents/incidents.controller.ts`
  - added severity update route

- `apps/api/src/modules/incidents/incidents.service.ts`
  - validates severity
  - updates incident severity
  - adds a timeline update when severity changes
  - emits realtime incident update

- `apps/api/src/modules/notifications/notifications.service.ts`
  - includes severity in webhook incident payloads

## Frontend changes

- `apps/web/lib/auth.ts`
  - added `IncidentSeverity`
  - added severity to incident types
  - added `updateIncidentSeverity`

- `apps/web/app/incidents/page.tsx`
  - shows severity badges
  - sorts active incidents by severity after status

- `apps/web/app/incidents/[id]/page.tsx`
  - shows severity
  - lets user change severity
  - records severity changes in the timeline

- `apps/web/lib/status.ts`
  - public incidents include severity

- `apps/web/app/status/[workspaceSlug]/page.tsx`
  - shows severity badges on public incident cards

## Bug fixed

Acknowledging an incident no longer sends an incident resolved notification.

## Why this matters

Incident management is about prioritization. Severity helps teams decide what to work on first.

Example:

```text
CRITICAL: checkout is down
HIGH: main API is failing
MEDIUM: dashboard latency
LOW: non-critical status check failed
```

## What is still missing

- Severity filters.
- Severity-based notification routing.
- Escalation policies.
- Assigned responder.
