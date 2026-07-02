# Implemented Team Members and Invites

## What changed

PulseOps now has a workspace team layer.

The project can now store:

- accepted workspace members
- member roles
- pending invites
- accepted invites
- cancelled invites

Incidents can also be assigned to any accepted workspace member, not only the logged-in user.

## Database changes

Added enums:

- `WorkspaceRole`: `OWNER`, `ADMIN`, `MEMBER`
- `WorkspaceInviteStatus`: `PENDING`, `ACCEPTED`, `CANCELLED`

Added tables:

- `WorkspaceMember`
- `WorkspaceInvite`

The migration also backfills existing users as `OWNER` members of their own workspace.

## Backend API

Added guarded team endpoints:

```http
GET /team/members
GET /team/invites
GET /team/invites/received
POST /team/invites
POST /team/invites/:id/accept
POST /team/invites/:id/cancel
DELETE /team/members/:id
```

Added incident assignment endpoint:

```http
PATCH /incidents/:id/assign
```

Request body:

```json
{
  "userId": "workspace-member-user-id"
}
```

The API checks that the assignee is an accepted member of the workspace before assigning the incident.

## Frontend changes

Added a team settings page:

```text
/settings/team
```

The page supports:

- viewing current members
- inviting a teammate by email
- choosing `ADMIN` or `MEMBER`
- cancelling pending invites
- removing non-owner members
- accepting invites sent to the logged-in user's email

The dashboard now links to the Team page.

The incident detail page now has an assignee dropdown populated from workspace members.

## Current scope

This feature introduces the collaboration foundation and team-based incident assignment.

The next hardening step is full workspace switching and route-wide RBAC, so invited members can operate directly inside another owner's workspace with role-based permissions across monitors, webhooks, and settings.

## Files touched

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260701005000_add_workspace_members_and_invites/migration.sql`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/team/team.module.ts`
- `apps/api/src/modules/team/team.controller.ts`
- `apps/api/src/modules/team/team.service.ts`
- `apps/api/src/modules/incidents/incidents.module.ts`
- `apps/api/src/modules/incidents/incidents.controller.ts`
- `apps/api/src/modules/incidents/incidents.service.ts`
- `apps/api/src/app.module.ts`
- `apps/web/lib/auth.ts`
- `apps/web/app/settings/team/page.tsx`
- `apps/web/app/incidents/[id]/page.tsx`
- `apps/web/app/dashboard/page.tsx`

