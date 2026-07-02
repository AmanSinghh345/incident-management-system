# Implemented Webhook Signing

This feature lets webhook receivers verify that a webhook request came from PulseOps.

## What was added

- Each webhook endpoint now has a `secret`.
- New webhooks get an app-generated `whsec_...` secret.
- Existing webhooks get a database-generated fallback secret through migration.
- Webhook deliveries include signing headers.
- Notification settings UI can:
  - show/hide the secret
  - rotate the secret

## Database changes

Added to `WebhookEndpoint`:

```prisma
secret String @default(uuid())
```

Migration:

```text
apps/api/prisma/migrations/20260701001000_add_webhook_signing_secret/migration.sql
```

## Backend endpoints

```text
POST /notifications/webhooks/:id/rotate-secret
```

Existing endpoints still work:

```text
GET /notifications/webhooks
POST /notifications/webhooks
POST /notifications/webhooks/:id/test
```

## Signing headers

PulseOps sends:

```text
X-PulseOps-Event
X-PulseOps-Timestamp
X-PulseOps-Signature
```

The signature is:

```text
HMAC_SHA256(secret, timestamp + "." + rawBody)
```

## Example verification logic

```ts
import { createHmac, timingSafeEqual } from "crypto";

function verifyPulseOpsWebhook(secret: string, timestamp: string, rawBody: string, signature: string) {
  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

## Backend files

- `apps/api/src/modules/notifications/notifications.service.ts`
  - generates webhook secrets
  - signs webhook payloads
  - sends signature headers
  - rotates secrets

- `apps/api/src/modules/notifications/notifications.controller.ts`
  - added rotate-secret endpoint

## Frontend files

- `apps/web/lib/auth.ts`
  - webhook type now includes `secret`
  - added `rotateWebhookSecret`

- `apps/web/app/settings/notifications/page.tsx`
  - shows masked webhook secrets
  - can reveal/hide secret
  - can rotate secret

## Why this matters

Without signing, a receiver cannot know whether a request really came from PulseOps.

With signing, the receiver can reject fake webhook requests.

## What is still missing

- Timestamp tolerance checks in sample receiver code.
- Secret copy button.
- Audit log entry when a secret rotates.
- Hiding full secrets after first creation in a production security model.
