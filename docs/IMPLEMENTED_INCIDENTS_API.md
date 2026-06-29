# Implemented Incidents API

## What was added

This slice adds basic incident APIs:

- `GET /incidents`
- `GET /incidents/:id`
- `PATCH /incidents/:id/acknowledge`
- `PATCH /incidents/:id/resolve`

All routes require:

```text
Authorization: Bearer <accessToken>
```

## Files to study

- `apps/api/src/modules/incidents/incidents.controller.ts`
- `apps/api/src/modules/incidents/incidents.service.ts`
- `apps/api/src/modules/incidents/incidents.module.ts`
- `apps/api/src/modules/checks/checks.service.ts`

## How incidents are created

Incidents are created from `POST /monitors/:id/check-now`, not from a direct create endpoint.

Flow:

1. A check result is saved as `FAILURE`.
2. The service reads the latest N check results, where N is `failureThreshold`.
3. If all latest N results failed, the service checks for an existing active incident.
4. If no active incident exists, it creates one.

This prevents duplicate active incidents for the same monitor.

## How incidents are resolved

There are two paths:

### Auto resolve

When `check-now` succeeds and an active incident exists, the incident becomes `RESOLVED` and gets a timeline update:

```text
Incident auto-resolved after a successful check.
```

### Manual resolve

`PATCH /incidents/:id/resolve`

This sets:

- `status` to `RESOLVED`
- `resolvedAt` to current time
- timeline update to `Incident manually resolved.`

## Acknowledge flow

`PATCH /incidents/:id/acknowledge`

This sets the incident status to `ACKNOWLEDGED` and adds a timeline update. It is useful when someone has seen the problem but the service is not fixed yet.

## Ownership rule

The incident service never trusts an incident id by itself. It loads the incident with its monitor and confirms:

```text
incident.monitor.ownerId === loggedInUser.id
```

This keeps users from reading or changing other users' incidents.

## What is still missing

- Add custom incident updates: `POST /incidents/:id/updates`
- Add severity field to the Prisma schema.
- Emit WebSocket events when incidents open/resolve.
- Send notifications when incidents open/resolve.
- Use two-success resolve threshold instead of immediate auto-resolve.
