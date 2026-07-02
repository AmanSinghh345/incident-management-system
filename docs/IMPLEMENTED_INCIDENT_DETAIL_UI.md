# Implemented Incident Detail UI

This feature turns incidents from simple list items into full investigation records.

## What changed

- Added a new page:

```text
/incidents/[id]
```

- Each incident in `/incidents` is now clickable.
- The detail page shows:
  - incident title
  - current incident status
  - monitor name and URL
  - monitor status
  - started and resolved timestamps
  - full timeline of updates
  - acknowledge and resolve actions
  - manual timeline update form

## Backend endpoint added

```text
POST /incidents/:id/updates
```

Body:

```json
{
  "message": "Investigating the API health endpoint."
}
```

The backend validates:

- message is required
- message cannot be empty
- message must be 1000 characters or fewer
- user must own the incident through the incident's monitor

## Backend files

- `apps/api/src/modules/incidents/incidents.controller.ts`
  - added `POST /incidents/:id/updates`

- `apps/api/src/modules/incidents/incidents.service.ts`
  - added `addUpdate`
  - creates an `IncidentUpdate`
  - emits a realtime `incident.changed` event

## Frontend files

- `apps/web/lib/auth.ts`
  - added `IncidentDetail`
  - added `getIncident`
  - added `addIncidentUpdate`

- `apps/web/app/incidents/page.tsx`
  - incident titles now link to the detail page
  - added a View button for each incident

- `apps/web/app/incidents/[id]/page.tsx`
  - loads one incident
  - shows status and monitor summary
  - shows the full timeline
  - allows adding manual updates
  - supports acknowledge and resolve
  - refreshes automatically through realtime events

## Why this matters

Incident management is not only about knowing something is down. A useful incident system also records what happened, who responded, and what changed over time.

This page creates that investigation history.

## What is still missing

- Editing or deleting timeline updates.
- Assigning incidents to a responder.
- Incident severity.
- Public incident updates for a status page.
