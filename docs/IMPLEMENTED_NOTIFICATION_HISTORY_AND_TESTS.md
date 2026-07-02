# Implemented Notification History And Tests

This feature makes webhook notifications easier to verify and debug.

## What was added

- Delivery history API.
- Test webhook API.
- Test button in the notification settings UI.
- Delivery history table in the notification settings UI.

## Backend endpoints

```text
GET /notifications/history
POST /notifications/webhooks/:id/test
```

Both routes require the normal bearer token.

## Backend files

- `apps/api/src/modules/notifications/notifications.controller.ts`
  - added delivery history route
  - added test webhook route

- `apps/api/src/modules/notifications/notifications.service.ts`
  - `listHistory` returns the latest 50 notification attempts
  - `testWebhook` sends a `webhook.test` payload
  - test attempts are saved in the `Notification` table

## Frontend files

- `apps/web/lib/auth.ts`
  - added `NotificationHistoryItem`
  - added `getNotificationHistory`
  - added `testWebhookEndpoint`

- `apps/web/app/settings/notifications/page.tsx`
  - loads webhooks and delivery history together
  - adds a Test button for each active webhook
  - shows the latest 50 notification attempts

## Test webhook payload

```json
{
  "event": "webhook.test",
  "workspaceSlug": "aman",
  "message": "PulseOps test webhook.",
  "sentAt": "..."
}
```

## Why this matters

Without delivery history, webhook alerts are hard to trust. This gives the user immediate feedback:

- did PulseOps try to send the notification?
- did the endpoint return success?
- what endpoint received it?
- was it tied to an incident or just a test?

## What is still missing

- Retry/backoff for failed deliveries.
- Filtering delivery history by status or incident.
- Webhook signing secret.
- Manual resend button.
