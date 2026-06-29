# Implemented Frontend Auth

## What was added

The login and register pages now call the real backend auth APIs:

- `POST /auth/login`
- `POST /auth/register`

After a successful response, the frontend stores the returned `accessToken` in `localStorage` and redirects the user to `/dashboard`.

## Files to study

- `apps/web/lib/api.ts`
- `apps/web/lib/auth.ts`
- `apps/web/app/login/page.tsx`
- `apps/web/app/register/page.tsx`

## Auth helper

`apps/web/lib/auth.ts` contains the frontend auth functions:

```ts
login(email, password)
register(name, email, password)
saveAccessToken(accessToken)
getAccessToken()
clearAccessToken()
```

The helper uses `API_BASE_URL` from `apps/web/lib/api.ts`.

Default API base URL:

```text
http://localhost:4000
```

## Login flow

1. User enters email and password.
2. Page validates that both fields are present.
3. Submit button enters loading state.
4. Frontend calls `POST /auth/login`.
5. On success, token is saved in `localStorage`.
6. User is redirected to `/dashboard`.
7. On failure, the backend error message is shown.

## Register flow

1. User enters name, email, and password.
2. Page validates all fields.
3. Password must be at least 8 characters.
4. Frontend calls `POST /auth/register`.
5. On success, token is saved in `localStorage`.
6. User is redirected to `/dashboard`.
7. If the email already exists, the backend `409 Conflict` message is shown.

## Browser storage

The token key is:

```text
pulseops.accessToken
```

You can inspect it in the browser devtools:

```text
Application -> Local Storage -> http://localhost:3000
```

## How to test manually

1. Start backend:

```powershell
pnpm dev:api
```

2. Start frontend:

```powershell
pnpm dev:web
```

3. Open:

```text
http://localhost:3000/register
```

4. Create a user with a new email.
5. Confirm you are redirected to `/dashboard`.
6. Open local storage and confirm `pulseops.accessToken` exists.
7. Sign in from `/login` with the same user.

## What is still missing

- Dashboard should read the token and load real `/me` or `/monitors` data.
- Add logout button.
- Add route protection for dashboard pages.
- Add token expiry handling.
- Add shared UI components for form fields, buttons, and error states.
