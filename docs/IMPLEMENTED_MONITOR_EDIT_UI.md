# Implemented Monitor Edit UI

## What was added

The monitor detail page now includes an edit form for monitor settings:

```text
/monitors/:id
```

Users can edit:

- Monitor name
- URL
- Interval seconds
- Failure threshold

## Files to study

- `apps/web/app/monitors/[id]/page.tsx`
- `apps/web/lib/auth.ts`

## API helper added

`apps/web/lib/auth.ts` now includes:

```ts
updateMonitor(accessToken, monitorId, input)
```

It calls:

```text
PATCH /monitors/:id
```

with a JSON body like:

```json
{
  "name": "Main API",
  "url": "https://example.com/health",
  "intervalSeconds": 60,
  "failureThreshold": 2
}
```

## Page behavior

1. Monitor detail loads monitor data.
2. Edit fields are prefilled from the loaded monitor.
3. User edits values and clicks `Save settings`.
4. Frontend validates basic rules.
5. Frontend calls `PATCH /monitors/:id`.
6. Page reloads monitor detail and check history.
7. Success or error message is shown.

## Validation rules

Frontend validation currently checks:

- name is required
- URL is required
- interval must be at least 30 seconds
- failure threshold must be at least 1

The backend also validates these values, so invalid requests are blocked server-side too.

## Reset button

The `Reset` button restores the edit fields to the latest loaded monitor values without saving.

## What is still missing

- Better shared form components.
- Toast notifications.
- Unsaved changes warning.
- Edit monitor directly from the monitor list.
- Backend fields for method, timeout, and expected status code.
