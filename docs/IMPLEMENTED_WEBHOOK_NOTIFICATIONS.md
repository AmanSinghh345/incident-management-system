# Implemented Webhook Notifications

This feature lets PulseOps send outbound webhook alerts when incidents open or resolve.

## What was added

- Users can create webhook endpoints.
- Users can pause/resume webhook endpoints.
- Users can delete webhook endpoints.
- PulseOps sends webhook payloads when:
  - an incident opens
  - an incident resolves
- Each delivery attempt is saved in the existing `Notification` table.

## Database changes

Added `WEBHOOK` to:

```prisma
enum NotificationChannel
```

Added:

```prisma
model WebhookEndpoint
```

This stores:

- name
- URL
- active/paused state
- owner user
- timestamps

Migration:

```text
apps/api/prisma/migrations/20260630000000_add_webhook_endpoints/migration.sql
```

## Backend endpoints

```text
GET /notifications/webhooks
POST /notifications/webhooks
PATCH /notifications/webhooks/:id
DELETE /notifications/webhooks/:id
```

All routes require the normal bearer token.

## Backend files

- `apps/api/src/modules/notifications/notifications.controller.ts`
  - exposes webhook CRUD routes

- `apps/api/src/modules/notifications/notifications.service.ts`
  - validates webhook URLs
  - manages webhook endpoints
  - sends incident webhook payloads
  - stores delivery results as `Notification` rows

- `apps/api/src/modules/checks/checks.service.ts`
  - sends `incident.opened` when automatic checks create an incident
  - sends `incident.resolved` when automatic checks resolve an incident

- `apps/api/src/modules/incidents/incidents.service.ts`
  - sends `incident.resolved` when a user manually resolves an incident

## Frontend files

- `apps/web/app/settings/notifications/page.tsx`
  - notification settings UI
  - create, pause/resume, and delete webhooks

- `apps/web/lib/auth.ts`
  - added webhook endpoint types and API helpers

- `apps/web/app/dashboard/page.tsx`
  - added a Notifications link

## Webhook payload shape

Example:

```json
{
  "event": "incident.opened",
  "workspaceSlug": "aman",
  "incident": {
    "id": "...",
    "title": "Example is down",
    "status": "OPEN",
    "startedAt": "...",
    "resolvedAt": null
  },
  "monitor": {
    "id": "...",
    "name": "Example",
    "url": "https://example.com/",
    "status": "DOWN"
  },
  "latestUpdate": {
    "id": "...",
    "message": "Monitor check failed.",
    "createdAt": "..."
  }
}
```

## How to test

Use a webhook inspection service like webhook.site.

1. Copy the generated webhook URL.
2. Open PulseOps Notifications.
3. Add the webhook URL.
4. Create or use a monitor that fails enough times to open an incident.
5. Check the webhook inspection page for the JSON payload.

## What is still missing

- Retry/backoff for failed webhook deliveries.
- Webhook signing secret.
- Email notifications.
- Notification delivery history UI.
