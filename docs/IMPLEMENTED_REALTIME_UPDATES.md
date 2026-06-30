# Implemented Realtime Updates

This feature makes PulseOps refresh important screens automatically when backend data changes.

## What changed

- Added `GET /realtime/events` as a Server-Sent Events stream.
- The API verifies the same access token used by normal REST requests.
- The backend emits events when:
  - a monitor is created, updated, paused, resumed, or deleted
  - a check result is created
  - an incident is opened, acknowledged, auto-resolved, or manually resolved
- The web app subscribes after login using the stored access token.
- Dashboard, monitor list, monitor detail, and incident list silently reload their existing API data when relevant events arrive.

## Backend files

- `apps/api/src/modules/realtime/realtime.controller.ts`
  - exposes the SSE endpoint
  - accepts `token` as a query parameter because browser `EventSource` cannot send custom authorization headers
  - validates the token and user before opening the stream

- `apps/api/src/modules/realtime/realtime.service.ts`
  - owns the in-memory event stream
  - filters events by user id so users only receive their own workspace events
  - provides helper methods like `emitMonitorChanged`, `emitCheckCreated`, and `emitIncidentChanged`

- `apps/api/src/modules/checks/checks.service.ts`
  - emits `check.created` after a check finishes
  - emits `incident.changed` if that check opens or resolves an incident

- `apps/api/src/modules/monitors/monitors.service.ts`
  - emits monitor events after create, update, and delete actions

- `apps/api/src/modules/incidents/incidents.service.ts`
  - emits incident events after acknowledge and resolve actions

## Frontend files

- `apps/web/lib/auth.ts`
  - added `subscribeToRealtime`
  - opens an `EventSource` connection to `/realtime/events?token=...`
  - returns a cleanup function so React can close the connection when leaving the page

- `apps/web/app/dashboard/page.tsx`
  - refreshes dashboard data after monitor, check, or incident events

- `apps/web/app/monitors/page.tsx`
  - refreshes the monitor list after monitor/check/incident events

- `apps/web/app/monitors/[id]/page.tsx`
  - refreshes monitor detail and check history after related events

- `apps/web/app/incidents/page.tsx`
  - refreshes incident data after check or incident events

## Why Server-Sent Events

SSE is enough for this milestone because the app only needs server-to-browser notifications right now. It avoids adding a frontend websocket dependency and fits the current REST-first design.

## Limitation

Realtime events are in-memory. They work while one API process is running locally. In a production multi-server setup, this should move to Redis pub/sub or another shared event bus.
