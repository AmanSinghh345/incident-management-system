# Implemented Incident UI

## What was added

The frontend now has an incident management page:

```text
/incidents
```

Users can:

- List incidents.
- See active incidents first.
- Acknowledge open incidents.
- Resolve active incidents.
- See the affected monitor and latest timeline message.

The dashboard now links to this page through `View Incidents`.

## Files to study

- `apps/web/app/incidents/page.tsx`
- `apps/web/app/dashboard/page.tsx`
- `apps/web/lib/auth.ts`

## API helpers added

`apps/web/lib/auth.ts` now includes:

```ts
getIncidents(accessToken)
acknowledgeIncident(accessToken, incidentId)
resolveIncident(accessToken, incidentId)
```

All helpers send:

```text
Authorization: Bearer <accessToken>
```

## Incident list flow

1. `/incidents` reads `pulseops.accessToken` from local storage.
2. If there is no token, the page redirects to `/login`.
3. If a token exists, frontend calls:

```text
GET /incidents
```

4. The page sorts incidents in this order:

```text
OPEN -> ACKNOWLEDGED -> RESOLVED
```

5. Within the same status, newer incidents appear first.

## Acknowledge flow

The Acknowledge button calls:

```text
PATCH /incidents/:id/acknowledge
```

The button is enabled only for `OPEN` incidents.

## Resolve flow

The Resolve button calls:

```text
PATCH /incidents/:id/resolve
```

The button is disabled for already resolved incidents.

## How to create a test incident

Incidents are not created directly from the frontend. They are created by failed monitor checks.

For testing:

1. Create a monitor with a bad URL or a URL that returns an error.
2. Set `failureThreshold` to `1` or `2`.
3. Run Check from `/monitors`.
4. Open `/incidents`.

The incident should appear if the failure threshold is crossed.

## What is still missing

- Incident detail page.
- Full timeline UI.
- Add incident update/note form.
- Reopen incident action.
- SSE live refresh.
- Delivery status is visible in notification history.
