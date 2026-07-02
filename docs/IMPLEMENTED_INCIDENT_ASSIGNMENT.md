# Implemented Incident Assignment

This feature lets an incident have an assigned responder.

## What was added

Incidents can now be:

- assigned to the current user
- unassigned

This is the first step toward team-based incident ownership.

## Database changes

Added to `Incident`:

```prisma
assignedToId String?
assignedTo   User?
```

Added to `User`:

```prisma
assignedIncidents Incident[]
```

Migration:

```text
apps/api/prisma/migrations/20260701004000_add_incident_assignment/migration.sql
```

## Backend endpoints

```text
PATCH /incidents/:id/assign-to-me
PATCH /incidents/:id/unassign
```

Both endpoints:

- require auth
- verify the incident belongs to the user workspace
- add a timeline update
- emit a realtime incident change

## Backend files

- `apps/api/src/modules/incidents/incidents.controller.ts`
  - added assign/unassign routes

- `apps/api/src/modules/incidents/incidents.service.ts`
  - includes assigned user in incident list/detail responses
  - added `assignToMe`
  - added `unassign`

## Frontend files

- `apps/web/lib/auth.ts`
  - added `IncidentAssignee`
  - added `assignedTo` on incidents
  - added `assignIncidentToMe`
  - added `unassignIncident`

- `apps/web/app/incidents/page.tsx`
  - shows assignee on incident cards
  - adds Assign/Unassign action

- `apps/web/app/incidents/[id]/page.tsx`
  - shows assignee in summary and settings
  - adds Assign to me/Unassign action

## Why this matters

Severity tells the team how important an incident is.

Assignment tells the team who owns the response.

Together they make the incident workflow feel much more operational.

## What is still missing

- Workspace members.
- Assigning incidents to another user.
- Role permissions.
- Assignee filters.
