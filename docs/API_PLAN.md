# API Plan

These are planned API routes for the PulseOps MVP. They are not fully implemented yet.

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /me`

## Monitors

- `POST /monitors`
- `GET /monitors`
- `GET /monitors/:id`
- `PATCH /monitors/:id`
- `DELETE /monitors/:id`
- `POST /monitors/:id/check-now`
- `GET /monitors/:id/check-results`

## Incidents

- `GET /incidents`
- `GET /incidents/:id`
- `PATCH /incidents/:id/acknowledge`
- `PATCH /incidents/:id/resolve`
- `POST /incidents/:id/updates`

## Status Page

- `GET /status/:workspaceSlug`
