# Implemented Monitor Detail UI

## What was added

The frontend now has a monitor detail page:

```text
/monitors/:id
```

Users can:

- View one monitor's current status.
- See monitor settings.
- Run a manual check.
- See related incidents.
- See full recent check history.

The monitor list now links each monitor name and `View` button to its detail page.

## Files to study

- `apps/web/app/monitors/[id]/page.tsx`
- `apps/web/app/monitors/page.tsx`
- `apps/web/lib/auth.ts`

## API helpers added

`apps/web/lib/auth.ts` now includes:

```ts
getMonitor(accessToken, monitorId)
getMonitorCheckResults(accessToken, monitorId)
```

These call:

```text
GET /monitors/:id
GET /monitors/:id/check-results
```

## Dynamic route

Next.js uses this file:

```text
apps/web/app/monitors/[id]/page.tsx
```

The page reads the monitor id with:

```ts
useParams<{ id: string }>()
```

## Page load flow

1. Read `pulseops.accessToken` from local storage.
2. Redirect to `/login` if no token exists.
3. Load monitor detail and check history in parallel.
4. Render current status, latest check, response time, and active incident count.

## Run check flow

The `Run Check` button calls:

```text
POST /monitors/:id/check-now
```

After the check completes, the page reloads monitor detail and check history so the newest result appears immediately.

## What is still missing

- Edit monitor settings from the detail page.
- Show response time chart.
- Paginate check history.
- Link incident rows to future incident detail pages.
- Realtime refresh through SSE events.
