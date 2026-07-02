# Implemented Monitor Check Configuration

This feature makes monitor health rules configurable instead of hardcoded.

## What was added

Each monitor now stores:

- `method`
  - allowed values: `GET`, `POST`, `HEAD`
  - default: `GET`
- `expectedStatusCode`
  - default: `200`
  - valid range: `100` to `599`
- `timeoutSeconds`
  - default: `5`
  - valid range: `1` to `60`

## Database changes

Added fields to `Monitor`:

```prisma
method             String @default("GET")
expectedStatusCode Int    @default(200)
timeoutSeconds     Int    @default(5)
```

Migration:

```text
apps/api/prisma/migrations/20260701000000_add_monitor_check_config/migration.sql
```

## Backend files

- `apps/api/src/modules/monitors/monitors.service.ts`
  - validates method, expected status code, and timeout
  - supports these fields during monitor create/update

- `apps/api/src/modules/checks/checks.service.ts`
  - uses `monitor.method` for `fetch`
  - uses `monitor.timeoutSeconds` for `AbortSignal.timeout`
  - marks the check as failed unless the response status exactly matches `expectedStatusCode`

## Frontend files

- `apps/web/lib/auth.ts`
  - added `MonitorMethod`
  - added monitor config fields to monitor types and create/update inputs

- `apps/web/app/monitors/page.tsx`
  - create monitor form now includes method, expected status, and timeout

- `apps/web/app/monitors/[id]/page.tsx`
  - settings summary shows method, expected status, and timeout
  - edit form can update those fields

## Behavior change

Before:

```text
GET URL, timeout after 5s, success if HTTP response is 2xx
```

Now:

```text
Configured METHOD URL, timeout after timeoutSeconds, success only if status === expectedStatusCode
```

Example:

```text
HEAD https://example.com expected 200 timeout 3s
```

## What is still missing

- Custom request body for POST checks.
- Custom request headers.
- Expected keyword/body matching.
- Redirect-following controls.
