# Implemented Monitors And Checks API

## What was added

This slice implements monitor ownership, monitor CRUD, manual check-now, and check history:

- `POST /monitors`
- `GET /monitors`
- `GET /monitors/:id`
- `PATCH /monitors/:id`
- `DELETE /monitors/:id`
- `POST /monitors/:id/check-now`
- `GET /monitors/:id/check-results`

All routes require:

```text
Authorization: Bearer <accessToken>
```

## Files to study

- `apps/api/src/modules/monitors/monitors.controller.ts`
- `apps/api/src/modules/monitors/monitors.service.ts`
- `apps/api/src/modules/monitors/monitors.module.ts`
- `apps/api/src/modules/checks/checks.service.ts`
- `apps/api/src/modules/checks/checks.module.ts`

## Monitor CRUD flow

### Create monitor

`POST /monitors`

Body:

```json
{
  "name": "Main API",
  "url": "https://example.com/health",
  "intervalSeconds": 60,
  "failureThreshold": 3
}
```

Flow:

1. `AuthGuard` attaches the logged-in user to the request.
2. `MonitorsController` passes `request.user` and body to `MonitorsService`.
3. Service validates name, URL, interval, and failure threshold.
4. Prisma creates a monitor owned by the current user.

New monitors are created with:

```text
isActive: true
status: UP
```

`UP` here means the monitor is enabled and ready to be checked. The first real check can later confirm it as `UP` or change it to `DOWN`.

### List monitors

`GET /monitors`

Returns only monitors owned by the logged-in user. It also includes the latest check result and the latest active incident so the dashboard can show useful status quickly.

### Update monitor

`PATCH /monitors/:id`

Supported fields:

```json
{
  "name": "New name",
  "url": "https://example.com",
  "intervalSeconds": 120,
  "failureThreshold": 2,
  "isActive": false
}
```

If `isActive` is `false`, the monitor status becomes `PAUSED`. If it is `true`, the status moves back to `UP` until the next check decides otherwise.

## Check-now flow

`POST /monitors/:id/check-now`

Flow:

1. Service confirms the monitor belongs to the logged-in user.
2. API performs a `GET` request to the monitor URL.
3. It measures response time in milliseconds.
4. It stores a `CheckResult`.
5. It updates monitor status to `UP` or `DOWN`.
6. It checks recent failures against `failureThreshold`.
7. It opens or resolves an incident when needed.

## Current check rules

- `PAUSED` monitors are not checked.
- A successful HTTP response is `response.ok`.
- Any network error, timeout, or non-OK response becomes `FAILURE`.
- Timeout is currently fixed at 5000 ms.
- Failure threshold uses the monitor's `failureThreshold` field.
- One active incident is allowed per monitor.
- A successful check resolves the active incident.

## Why check-now is useful first

Before BullMQ scheduling exists, `check-now` proves the core monitoring logic:

```text
monitor -> HTTP request -> CheckResult -> Monitor status -> Incident decision
```

After this works, the worker can call the same logic on a schedule.
