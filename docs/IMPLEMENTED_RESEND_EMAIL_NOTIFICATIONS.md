# Implemented Resend Email Notifications

## What changed

PulseOps now has a real email notification channel powered by the Resend Email API.

The backend sends email when:

- An incident opens.
- An incident resolves.
- A user clicks the test email action from notification settings.

Every email attempt is saved in the `Notification` table with:

- `channel: EMAIL`
- `status: SENT` or `FAILED`
- recipient email address
- subject/event name
- delivery message from Resend or the local configuration error
- related incident ID when the email belongs to an incident

## API changes

### Test email

```http
POST /notifications/email/test
Authorization: Bearer <access-token>
```

This sends a test email to the logged-in user's email address and records the result in notification history.

### Incident emails

Incident emails are sent from the existing notification flow:

- `sendIncidentOpened(incidentId)`
- `sendIncidentResolved(incidentId)`

That means webhooks and email are both triggered from the same incident lifecycle.

## Configuration

Add these values to `apps/api/.env` locally:

```env
RESEND_API_KEY=your_resend_api_key_here
EMAIL_FROM="PulseOps <alerts@yourdomain.com>"
```

`RESEND_API_KEY` is the API key from Resend.

`EMAIL_FROM` must be a sender identity/domain that Resend allows. During early testing, use the sender/domain Resend gives you or a verified domain.

After changing env values, restart the API server so Nest loads the new configuration.

## Frontend changes

The notification settings page now includes an Email alerts section with a `Test Email` button.

The delivery history also shows whether each attempt came from `EMAIL` or `WEBHOOK`, so failed configuration is visible instead of hidden.

## Failure behavior

If `RESEND_API_KEY` or `EMAIL_FROM` is missing, the app does not crash. It records a failed email notification with this message:

```text
Resend email is not configured. Set RESEND_API_KEY and EMAIL_FROM.
```

This is intentional because it makes setup issues visible from the app's notification history.

## Files touched

- `apps/api/src/modules/notifications/notifications.service.ts`
- `apps/api/src/modules/notifications/notifications.controller.ts`
- `apps/web/app/settings/notifications/page.tsx`
- `apps/web/lib/auth.ts`
- `.env.example`

