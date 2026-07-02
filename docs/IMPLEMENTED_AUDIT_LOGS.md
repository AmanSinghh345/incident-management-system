# Implemented Audit Logs

## What changed

PulseOps now records important workspace actions in a persistent audit log.

This makes the product more production-like because operators can answer:

- who changed a monitor
- who assigned or resolved an incident
- who invited or removed a teammate
- who changed webhook settings
- when a test notification was sent

## Database changes

Added `AuditLog`.

Each audit event stores:

- workspace owner ID
- actor user ID
- action name
- entity type
- entity ID
- human-readable summary
- optional JSON metadata
- timestamp

## Backend API

Added:

```http
GET /audit-logs
Authorization: Bearer <access-token>
```

The endpoint returns the latest 100 audit events for the active workspace.

It respects workspace switching through:

```http
X-PulseOps-Workspace-Owner-Id: <workspace-owner-user-id>
```

## Events currently logged

Monitor events:

- `monitor.created`
- `monitor.updated`
- `monitor.deleted`

Incident events:

- `incident.acknowledged`
- `incident.resolved`
- `incident.severity_updated`
- `incident.assigned`
- `incident.unassigned`
- `incident.update_added`

Team events:

- `team.invite_created`
- `team.invite_accepted`
- `team.invite_cancelled`
- `team.member_removed`

Notification events:

- `webhook.created`
- `webhook.updated`
- `webhook.deleted`
- `webhook.secret_rotated`
- `notification.webhook_tested`
- `notification.email_tested`

## Frontend changes

Added:

```text
/settings/audit
```

The page shows:

- grouped activity by date
- action name
- summary
- actor name/email
- entity type and ID
- metadata JSON preview

The dashboard now links to the Audit page.

## Files touched

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260701006000_add_audit_logs/migration.sql`
- `apps/api/src/modules/audit/audit-log.module.ts`
- `apps/api/src/modules/audit/audit-log.controller.ts`
- `apps/api/src/modules/audit/audit-log.service.ts`
- `apps/api/src/modules/monitors/monitors.service.ts`
- `apps/api/src/modules/monitors/monitors.module.ts`
- `apps/api/src/modules/incidents/incidents.service.ts`
- `apps/api/src/modules/incidents/incidents.module.ts`
- `apps/api/src/modules/team/team.service.ts`
- `apps/api/src/modules/team/team.module.ts`
- `apps/api/src/modules/notifications/notifications.service.ts`
- `apps/api/src/modules/notifications/notifications.module.ts`
- `apps/api/src/app.module.ts`
- `apps/web/lib/auth.ts`
- `apps/web/app/settings/audit/page.tsx`
- `apps/web/app/dashboard/page.tsx`

