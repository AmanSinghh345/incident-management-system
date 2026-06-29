# Implemented Dashboard Data

## What was added

The dashboard now loads real backend data after login:

- `GET /me`
- `GET /monitors`

It also supports logout by clearing the saved access token and redirecting to `/login`.

## Files to study

- `apps/web/app/dashboard/page.tsx`
- `apps/web/lib/auth.ts`

## Dashboard load flow

1. Dashboard reads `pulseops.accessToken` from `localStorage`.
2. If there is no token, it redirects to `/login`.
3. If a token exists, it calls:

```text
GET /me
GET /monitors
```

4. Both requests send:

```text
Authorization: Bearer <accessToken>
```

5. Dashboard renders user/workspace information, monitor metrics, and monitor rows.

## Metrics shown

The dashboard computes these from the monitor list:

- Active monitors
- UP monitors
- DOWN monitors
- Open incidents
- Recent checks

These are frontend-derived metrics for now. Later, the backend can expose a dedicated dashboard summary endpoint if the queries become heavier.

## Monitor table

Each monitor row shows:

- Name
- URL
- Status badge
- Last check time
- Response time
- Active incident count

The backend currently returns each monitor with:

```text
checkResults: latest check only
incidents: latest active incident only
```

That keeps the dashboard payload small.

## Logout flow

The logout button calls:

```ts
clearAccessToken()
router.replace("/login")
```

This removes the local token and sends the user back to the login page.

## What is still missing

- Route protection should eventually happen through middleware or a shared protected layout.
- Dashboard should refresh after running a check.
- Add create monitor UI.
- Add monitor details page.
- Add incident list/detail pages.
- Add WebSocket updates after backend realtime events exist.
