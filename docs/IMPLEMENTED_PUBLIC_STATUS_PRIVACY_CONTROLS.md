# Implemented Public Status Privacy Controls

This feature controls what monitor information appears on the public status page.

## What was added

Each monitor now has:

- `isPublic`
  - controls whether the monitor appears on the public status page
- `publicName`
  - optional display name for the public status page
- `showUrl`
  - controls whether the real monitor URL is shown publicly

## Database changes

Added fields to `Monitor`:

```prisma
isPublic  Boolean @default(true)
publicName String?
showUrl   Boolean @default(false)
```

Migration:

```text
apps/api/prisma/migrations/20260701002000_add_public_monitor_controls/migration.sql
```

## Backend behavior

Public status API:

```text
GET /status/:workspaceSlug
```

Now:

- only includes monitors where `isPublic = true`
- uses `publicName` when it exists
- hides monitor URL unless `showUrl = true`
- only includes incidents for public monitors

## Backend files

- `apps/api/src/modules/monitors/monitors.service.ts`
  - validates `isPublic`, `publicName`, and `showUrl`
  - supports these fields during monitor create/update

- `apps/api/src/modules/status/status.service.ts`
  - filters out private monitors
  - masks private URLs
  - shapes incident monitor data with public-safe names and URLs

## Frontend files

- `apps/web/lib/auth.ts`
  - added public status control fields to monitor types

- `apps/web/lib/status.ts`
  - public monitor URLs can now be `null`

- `apps/web/app/monitors/page.tsx`
  - create form supports public name, status page visibility, and URL visibility
  - monitor list shows Public/Private

- `apps/web/app/monitors/[id]/page.tsx`
  - settings summary shows public visibility fields
  - edit form can update public visibility fields

- `apps/web/app/status/[workspaceSlug]/page.tsx`
  - shows `URL hidden` when `showUrl` is false

## Why this matters

Public status pages should not leak internal health check endpoints.

This lets the admin expose a friendly service name like:

```text
Website
```

instead of exposing an internal URL like:

```text
https://api.internal.example.com/healthz?token=...
```

## What is still missing

- Global status page branding settings.
- Per-monitor public descriptions.
- Custom public component ordering.
- Public/private incident update controls.
