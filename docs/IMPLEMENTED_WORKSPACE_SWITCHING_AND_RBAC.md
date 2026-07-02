# Implemented Workspace Switching and RBAC

## What changed

PulseOps now supports active workspace context for team members.

Before this feature, a logged-in user could only see data owned by their own user ID. That made invites useful for storing membership, but not enough for real collaboration.

Now the frontend can select an active workspace, and the backend uses that workspace for monitors, incidents, checks, notifications, and team settings.

## Backend behavior

Authenticated requests can include this header:

```http
X-PulseOps-Workspace-Owner-Id: <workspace-owner-user-id>
```

The `AuthGuard` verifies that the logged-in user is a member of that workspace. If the header is missing, the API defaults to the user's own workspace.

The guard attaches these fields to `request.user`:

- `workspaceOwnerId`
- `workspaceRole`
- active `workspaceSlug`

## Role rules

Workspace roles are:

- `OWNER`
- `ADMIN`
- `MEMBER`

Current permissions:

- `OWNER` and `ADMIN` can manage monitors.
- `OWNER` and `ADMIN` can manage webhooks/notification settings.
- `OWNER` and `ADMIN` can invite, cancel invites, and remove non-owner members.
- `MEMBER` can view workspace data and work incidents.

## New API

Added:

```http
GET /team/workspaces
```

This returns every workspace the logged-in user can access.

Realtime SSE also accepts:

```http
GET /realtime/events?token=<token>&workspaceOwnerId=<workspace-owner-user-id>
```

This lets the frontend subscribe to the selected workspace stream.

## Frontend behavior

The dashboard now has a workspace selector.

When the user chooses a workspace:

- the selected workspace owner ID is saved in local storage
- future API calls send `X-PulseOps-Workspace-Owner-Id`
- realtime subscribes to the selected workspace
- the dashboard reloads into the selected workspace

## Files touched

- `apps/api/src/modules/auth/auth.guard.ts`
- `apps/api/src/modules/monitors/monitors.service.ts`
- `apps/api/src/modules/checks/checks.service.ts`
- `apps/api/src/modules/incidents/incidents.service.ts`
- `apps/api/src/modules/notifications/notifications.service.ts`
- `apps/api/src/modules/realtime/realtime.controller.ts`
- `apps/api/src/modules/team/team.controller.ts`
- `apps/api/src/modules/team/team.service.ts`
- `apps/web/lib/auth.ts`
- `apps/web/app/dashboard/page.tsx`

