# Implemented Monitor UI

## What was added

The frontend now has a monitor management page:

```text
/monitors
```

Users can:

- Create monitors.
- List existing monitors.
- Run a manual check.
- Pause or resume a monitor.
- Delete a monitor after confirmation.

The dashboard also links to this page through `Add Monitor` and `Manage monitors`.

## Files to study

- `apps/web/app/monitors/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/lib/auth.ts`

## API helpers added

`apps/web/lib/auth.ts` now includes these protected monitor helpers:

```ts
createMonitor(accessToken, input)
updateMonitorActiveState(accessToken, monitorId, isActive)
deleteMonitor(accessToken, monitorId)
runMonitorCheck(accessToken, monitorId)
```

All helpers send:

```text
Authorization: Bearer <accessToken>
```

## Create monitor flow

1. `/monitors` reads token from `localStorage`.
2. If there is no token, the page redirects to `/login`.
3. User fills name, URL, interval, and failure threshold.
4. Form validates required fields.
5. Frontend calls `POST /monitors`.
6. Page reloads the monitor list.

## Run check flow

1. User clicks `Check`.
2. Frontend calls:

```text
POST /monitors/:id/check-now
```

3. Backend performs the HTTP check.
4. Backend stores a `CheckResult`.
5. Frontend reloads monitors so latest status and response time appear.

## Pause and resume flow

Pause/resume uses:

```text
PATCH /monitors/:id
```

Body:

```json
{
  "isActive": false
}
```

or:

```json
{
  "isActive": true
}
```

When paused, the monitor status becomes `PAUSED` and the Check button is disabled.

## Delete flow

Delete uses a browser confirmation dialog first:

```ts
window.confirm(...)
```

If confirmed, frontend calls:

```text
DELETE /monitors/:id
```

Then it reloads the monitor list.

## What is still missing

- Edit monitor form for name, URL, interval, and failure threshold.
- Monitor details page with full check history.
- Better confirmation modal component.
- Toast component instead of inline success messages.
- Realtime refresh when WebSocket events are added.
